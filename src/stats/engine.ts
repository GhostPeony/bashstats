import { BashStatsDB } from '../db/database.js'
import { WEEKLY_CHALLENGES, ACTIVITY_MULTIPLIERS } from '../constants.js'
import type {
  LifetimeStats,
  ToolBreakdown,
  TimeStats,
  SessionRecords,
  ProjectStats,
  AllStats,
  WeeklyGoalsPayload,
  WeeklyChallenge,
} from '../types.js'

export function parseGitDiffStats(toolOutputJson: string): { insertions: number; deletions: number } {
  try {
    const parsed = JSON.parse(toolOutputJson)
    const stdout: string = parsed.stdout ?? ''
    const match = stdout.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/)
    if (!match) return { insertions: 0, deletions: 0 }
    return {
      insertions: parseInt(match[2] ?? '0', 10),
      deletions: parseInt(match[3] ?? '0', 10),
    }
  } catch {
    return { insertions: 0, deletions: 0 }
  }
}

function localDateStr(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function selectWeekChallenges(weekStart: string): WeeklyChallenge[] {
  let hash = 0
  for (const c of weekStart) {
    hash = ((hash * 31) + c.charCodeAt(0)) | 0
  }
  hash = Math.abs(hash)
  const pool = [...WEEKLY_CHALLENGES]
  const selected: WeeklyChallenge[] = []
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = hash % pool.length
    selected.push(pool.splice(idx, 1)[0])
    hash = Math.abs(((hash * 127) + 63) | 0)
  }
  return selected
}

export class StatsEngine {
  private db: BashStatsDB

  constructor(db: BashStatsDB) {
    this.db = db
  }

  private queryScalar<T = number>(sql: string, ...params: unknown[]): T {
    const row = this.db.prepare(sql).get(...params) as Record<string, T> | undefined
    if (!row) return 0 as T
    return Object.values(row)[0] ?? (0 as T)
  }

  /** Returns a WHERE/AND clause filtering sessions by agent */
  private agentWhere(agent?: string, alias?: string): { clause: string; params: unknown[] } {
    if (!agent) return { clause: '', params: [] }
    const col = alias ? `${alias}.agent` : 'agent'
    return { clause: ` AND ${col} = ?`, params: [agent] }
  }

  /** Returns a subquery filter for events/prompts tables */
  private agentSessionFilter(agent?: string): { clause: string; params: unknown[] } {
    if (!agent) return { clause: '', params: [] }
    return { clause: ` AND session_id IN (SELECT id FROM sessions WHERE agent = ?)`, params: [agent] }
  }

  getLifetimeStats(agent?: string): LifetimeStats {
    const sf = this.agentWhere(agent)
    const ef = this.agentSessionFilter(agent)

    const totalSessions = this.queryScalar('SELECT COUNT(*) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params)
    const totalPrompts = this.queryScalar('SELECT COUNT(*) as c FROM prompts WHERE 1=1' + ef.clause, ...ef.params)
    const totalCharsTyped = this.queryScalar('SELECT COALESCE(SUM(char_count), 0) as c FROM prompts WHERE 1=1' + ef.clause, ...ef.params)
    const totalToolCalls = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalDurationSeconds = this.queryScalar(
      'SELECT COALESCE(SUM(duration_seconds), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const totalFilesRead = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Read' AND hook_type = 'PostToolUse'" + ef.clause, ...ef.params
    )
    const totalFilesWritten = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Write' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalFilesEdited = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalFilesCreated = totalFilesWritten
    const totalBashCommands = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalWebSearches = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'WebSearch' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalWebFetches = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'WebFetch' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')" + ef.clause, ...ef.params
    )
    const totalSubagents = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'" + ef.clause, ...ef.params
    )
    const totalCompactions = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PreCompact'" + ef.clause, ...ef.params
    )
    const totalErrors = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE (hook_type = 'PostToolUseFailure' OR (hook_type = 'Notification' AND (tool_input LIKE '%\"notification_type\":\"error\"%' OR tool_input LIKE '%\"notification_type\":\"rate_limit\"%')))" + ef.clause, ...ef.params
    )
    const totalRateLimits = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'Notification' AND tool_input LIKE '%rate_limit%'" + ef.clause, ...ef.params
    )
    const totalInputTokens = this.queryScalar(
      'SELECT COALESCE(SUM(input_tokens), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const totalOutputTokens = this.queryScalar(
      'SELECT COALESCE(SUM(output_tokens), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const totalCacheCreationTokens = this.queryScalar(
      'SELECT COALESCE(SUM(cache_creation_input_tokens), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const totalCacheReadTokens = this.queryScalar(
      'SELECT COALESCE(SUM(cache_read_input_tokens), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const totalTokens = totalInputTokens + totalOutputTokens + totalCacheCreationTokens + totalCacheReadTokens

    // Git commit & lines changed
    const totalCommits = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%'" + ef.clause, ...ef.params
    )
    const commitOutputRows = this.db
      .prepare(
        "SELECT tool_output FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%' AND tool_output IS NOT NULL" + ef.clause
      )
      .all(...ef.params) as { tool_output: string }[]
    let totalLinesAdded = 0
    let totalLinesRemoved = 0
    for (const row of commitOutputRows) {
      const { insertions, deletions } = parseGitDiffStats(row.tool_output)
      totalLinesAdded += insertions
      totalLinesRemoved += deletions
    }

    return {
      totalSessions,
      totalDurationSeconds,
      totalPrompts,
      totalCharsTyped,
      totalToolCalls,
      totalFilesRead,
      totalFilesWritten,
      totalFilesEdited,
      totalFilesCreated,
      totalBashCommands,
      totalWebSearches,
      totalWebFetches,
      totalSubagents,
      totalCompactions,
      totalErrors,
      totalRateLimits,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
      totalTokens,
      totalCommits,
      totalLinesAdded,
      totalLinesRemoved,
    }
  }

  getToolBreakdown(agent?: string): ToolBreakdown {
    const ef = this.agentSessionFilter(agent)
    const rows = this.db
      .prepare(
        "SELECT tool_name, COUNT(*) as cnt FROM events WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL" + ef.clause + " GROUP BY tool_name"
      )
      .all(...ef.params) as { tool_name: string; cnt: number }[]

    const breakdown: ToolBreakdown = {}
    for (const row of rows) {
      breakdown[row.tool_name] = row.cnt
    }
    return breakdown
  }

  getTimeStats(agent?: string): TimeStats {
    const sf = this.agentWhere(agent)
    const ef = this.agentSessionFilter(agent)

    // Compute streaks from daily_activity (no agent filter -- daily_activity lacks agent info)
    const dailyRows = this.db
      .prepare('SELECT date FROM daily_activity WHERE sessions > 0 OR prompts > 0 OR tool_calls > 0 ORDER BY date ASC')
      .all() as { date: string }[]

    let longestStreak = 0
    let currentStreak = 0

    if (dailyRows.length > 0) {
      // Compute longest streak
      let streak = 1
      for (let i = 1; i < dailyRows.length; i++) {
        const prevDate = new Date(dailyRows[i - 1].date + 'T00:00:00Z')
        const currDate = new Date(dailyRows[i].date + 'T00:00:00Z')
        const diffDays = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays === 1) {
          streak++
        } else {
          longestStreak = Math.max(longestStreak, streak)
          streak = 1
        }
      }
      longestStreak = Math.max(longestStreak, streak)

      // Compute current streak (backwards from today using local time)
      const activeDates = new Set(dailyRows.map(r => r.date))
      const todayStr = localDateStr()

      // Start from today and go backwards
      let checkDate = new Date()
      currentStreak = 0

      // Check today first; if not active, check yesterday (in case session hasn't been recorded today yet)
      if (activeDates.has(todayStr)) {
        currentStreak = 1
        checkDate.setDate(checkDate.getDate() - 1)
        while (activeDates.has(localDateStr(checkDate))) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        }
      } else {
        // Check if yesterday was active
        checkDate.setDate(checkDate.getDate() - 1)
        const yesterdayStr = localDateStr(checkDate)
        if (activeDates.has(yesterdayStr)) {
          currentStreak = 1
          checkDate.setDate(checkDate.getDate() - 1)
          while (activeDates.has(localDateStr(checkDate))) {
            currentStreak++
            checkDate.setDate(checkDate.getDate() - 1)
          }
        }
      }
    }

    // Peak hour from prompts timestamps
    const peakHourRow = this.db
      .prepare(
        "SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as cnt FROM prompts WHERE 1=1" + ef.clause + " GROUP BY hour ORDER BY cnt DESC LIMIT 1"
      )
      .get(...ef.params) as { hour: number; cnt: number } | undefined

    const peakHour = peakHourRow?.hour ?? 0
    const peakHourCount = peakHourRow?.cnt ?? 0

    // Night owl: prompts where hour < 5
    const nightOwlCount = this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) < 5" + ef.clause, ...ef.params
    )

    // Early bird: prompts where hour BETWEEN 5 AND 7
    const earlyBirdCount = this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 5 AND 7" + ef.clause, ...ef.params
    )

    // Weekend sessions: day of week 0 (Sunday) or 6 (Saturday)
    // SQLite strftime('%w') returns 0=Sunday, 1=Monday, ... 6=Saturday
    const weekendSessions = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE CAST(strftime('%w', started_at) AS INTEGER) IN (0, 6)" + sf.clause, ...sf.params
    )

    // Most active day of week
    const mostActiveDayRow = this.db
      .prepare(
        "SELECT CAST(strftime('%w', started_at) AS INTEGER) as dow, COUNT(*) as cnt FROM sessions WHERE 1=1" + sf.clause + " GROUP BY dow ORDER BY cnt DESC LIMIT 1"
      )
      .get(...sf.params) as { dow: number; cnt: number } | undefined

    const mostActiveDay = mostActiveDayRow?.dow ?? 0

    // Busiest single date (no agent filter -- daily_activity lacks agent info)
    const busiestDateRow = this.db
      .prepare(
        'SELECT date, (sessions + prompts + tool_calls) as total FROM daily_activity ORDER BY total DESC LIMIT 1'
      )
      .get() as { date: string; total: number } | undefined

    const busiestDate = busiestDateRow?.date ?? ''
    const busiestDateCount = busiestDateRow?.total ?? 0

    return {
      currentStreak,
      longestStreak,
      peakHour,
      peakHourCount,
      nightOwlCount,
      earlyBirdCount,
      weekendSessions,
      mostActiveDay,
      busiestDate,
      busiestDateCount,
    }
  }

  getSessionRecords(agent?: string): SessionRecords {
    const sf = this.agentWhere(agent)

    const longestSessionSeconds = this.queryScalar(
      'SELECT COALESCE(MAX(duration_seconds), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const mostToolsInSession = this.queryScalar(
      'SELECT COALESCE(MAX(tool_count), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const mostPromptsInSession = this.queryScalar(
      'SELECT COALESCE(MAX(prompt_count), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const fastestSessionSeconds = this.queryScalar(
      'SELECT COALESCE(MIN(duration_seconds), 0) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds > 0' + sf.clause, ...sf.params
    )
    const avgDurationSeconds = this.queryScalar(
      'SELECT COALESCE(AVG(duration_seconds), 0) as c FROM sessions WHERE duration_seconds IS NOT NULL' + sf.clause, ...sf.params
    )
    const avgPromptsPerSession = this.queryScalar(
      'SELECT COALESCE(AVG(prompt_count), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const avgToolsPerSession = this.queryScalar(
      'SELECT COALESCE(AVG(tool_count), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const mostTokensInSession = this.queryScalar(
      'SELECT COALESCE(MAX(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )
    const avgTokensPerSession = this.queryScalar(
      'SELECT COALESCE(AVG(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)), 0) as c FROM sessions WHERE 1=1' + sf.clause, ...sf.params
    )

    return {
      longestSessionSeconds,
      mostToolsInSession,
      mostPromptsInSession,
      fastestSessionSeconds,
      avgDurationSeconds: Math.round(avgDurationSeconds),
      avgPromptsPerSession: Math.round(avgPromptsPerSession * 100) / 100,
      avgToolsPerSession: Math.round(avgToolsPerSession * 100) / 100,
      mostTokensInSession,
      avgTokensPerSession: Math.round(avgTokensPerSession),
    }
  }

  getProjectStats(agent?: string): ProjectStats {
    const sf = this.agentWhere(agent)

    const uniqueProjects = this.queryScalar(
      'SELECT COUNT(DISTINCT project) as c FROM sessions WHERE project IS NOT NULL' + sf.clause, ...sf.params
    )

    const projectRows = this.db
      .prepare(
        'SELECT project, COUNT(*) as cnt FROM sessions WHERE project IS NOT NULL' + sf.clause + ' GROUP BY project ORDER BY cnt DESC'
      )
      .all(...sf.params) as { project: string; cnt: number }[]

    const mostVisitedProject = projectRows.length > 0 ? projectRows[0].project : ''
    const mostVisitedProjectCount = projectRows.length > 0 ? projectRows[0].cnt : 0

    const projectBreakdown: Record<string, number> = {}
    for (const row of projectRows) {
      projectBreakdown[row.project] = row.cnt
    }

    return {
      uniqueProjects,
      mostVisitedProject,
      mostVisitedProjectCount,
      projectBreakdown,
    }
  }

  getAllStats(agent?: string): AllStats {
    return {
      lifetime: this.getLifetimeStats(agent),
      tools: this.getToolBreakdown(agent),
      time: this.getTimeStats(agent),
      sessions: this.getSessionRecords(agent),
      projects: this.getProjectStats(agent),
    }
  }

  getAgentBreakdown(): { favoriteAgent: string; sessionsPerAgent: Record<string, number>; hoursPerAgent: Record<string, number>; distinctAgents: number } {
    const rows = this.db.prepare(
      'SELECT agent, COUNT(*) as cnt, COALESCE(SUM(duration_seconds), 0) as total_seconds FROM sessions GROUP BY agent ORDER BY cnt DESC'
    ).all() as { agent: string; cnt: number; total_seconds: number }[]

    const sessionsPerAgent: Record<string, number> = {}
    const hoursPerAgent: Record<string, number> = {}
    for (const row of rows) {
      sessionsPerAgent[row.agent] = row.cnt
      hoursPerAgent[row.agent] = Math.round(row.total_seconds / 3600 * 10) / 10
    }

    return {
      favoriteAgent: rows.length > 0 ? rows[0].agent : 'unknown',
      sessionsPerAgent,
      hoursPerAgent,
      distinctAgents: rows.length,
    }
  }

  getWeeklyGoalsPayload(): WeeklyGoalsPayload {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(today)
    monday.setDate(monday.getDate() + mondayOffset)
    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() + 6)
    const nextMonday = new Date(monday)
    nextMonday.setDate(nextMonday.getDate() + 7)

    const weekStart = localDateStr(monday)
    const weekEnd = localDateStr(sunday)
    const nextWeekStart = localDateStr(nextMonday)

    const challenges = selectWeekChallenges(weekStart)

    const daysActive = this.queryScalar<number>(
      'SELECT COUNT(*) as c FROM daily_activity WHERE date >= ? AND date <= ? AND (sessions > 0 OR prompts > 0)',
      weekStart, weekEnd
    )

    const multiplier = ACTIVITY_MULTIPLIERS[Math.min(7, Math.max(1, daysActive))] ?? 1.0

    const results = challenges.map(c => {
      const current = this.computeWeeklyStat(c.stat, weekStart, weekEnd, nextWeekStart)
      return {
        id: c.id,
        description: c.description,
        xpReward: c.xpReward,
        completed: current >= c.threshold,
        progress: Math.min(1, current / Math.max(1, c.threshold)),
        threshold: c.threshold,
        current,
      }
    })

    return {
      weekStart,
      daysActive,
      multiplier,
      challenges: results,
    }
  }

  private computeWeeklyStat(stat: string, weekStart: string, weekEnd: string, nextWeekStart: string): number {
    switch (stat) {
      case 'totalPrompts':
        return this.queryScalar('SELECT COALESCE(SUM(prompts), 0) as c FROM daily_activity WHERE date >= ? AND date <= ?', weekStart, weekEnd)
      case 'totalToolCalls':
        return this.queryScalar('SELECT COALESCE(SUM(tool_calls), 0) as c FROM daily_activity WHERE date >= ? AND date <= ?', weekStart, weekEnd)
      case 'totalSessions':
        return this.queryScalar('SELECT COALESCE(SUM(sessions), 0) as c FROM daily_activity WHERE date >= ? AND date <= ?', weekStart, weekEnd)
      case 'daysActive':
        return this.queryScalar('SELECT COUNT(*) as c FROM daily_activity WHERE date >= ? AND date <= ? AND (sessions > 0 OR prompts > 0)', weekStart, weekEnd)
      case 'totalHours': {
        const secs = this.queryScalar('SELECT COALESCE(SUM(duration_seconds), 0) as c FROM daily_activity WHERE date >= ? AND date <= ?', weekStart, weekEnd)
        return Math.round(secs / 3600 * 10) / 10
      }
      case 'totalFilesRead':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Read' AND hook_type = 'PostToolUse' AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalFilesEdited':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type IN ('PostToolUse', 'PostToolUseFailure') AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalFilesCreated':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Write' AND hook_type IN ('PostToolUse', 'PostToolUseFailure') AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalBashCommands':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type IN ('PostToolUse', 'PostToolUseFailure') AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalSearches':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name IN ('Grep', 'Glob') AND hook_type = 'PostToolUse' AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalCommits':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%' AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'totalPRs':
        return this.queryScalar("SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%gh pr create%' AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'commitDays':
        return this.queryScalar("SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%' AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'longPromptCount':
        return this.queryScalar('SELECT COUNT(*) as c FROM prompts WHERE char_count > 1000 AND timestamp >= ? AND timestamp < ?', weekStart, nextWeekStart)
      case 'nightOwlDays':
        return this.queryScalar("SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) < 5 AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'earlyBirdDays':
        return this.queryScalar("SELECT COUNT(DISTINCT substr(timestamp, 1, 10)) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 5 AND 7 AND timestamp >= ? AND timestamp < ?", weekStart, nextWeekStart)
      case 'weekendDays':
        return this.queryScalar("SELECT COUNT(*) as c FROM daily_activity WHERE date >= ? AND date <= ? AND (sessions > 0 OR prompts > 0) AND CAST(strftime('%w', date) AS INTEGER) IN (0, 6)", weekStart, weekEnd)
      case 'uniqueProjects':
        return this.queryScalar('SELECT COUNT(DISTINCT project) as c FROM sessions WHERE project IS NOT NULL AND started_at >= ? AND started_at < ?', weekStart, nextWeekStart)
      case 'cleanSessions':
        return this.queryScalar('SELECT COUNT(*) as c FROM sessions WHERE error_count = 0 AND tool_count > 0 AND started_at >= ? AND started_at < ?', weekStart, nextWeekStart)
      case 'extendedSessionCount':
        return this.queryScalar('SELECT COUNT(*) as c FROM sessions WHERE duration_seconds > 3600 AND prompt_count >= 15 AND started_at >= ? AND started_at < ?', weekStart, nextWeekStart)
      case 'quickDrawSessions':
        return this.queryScalar('SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds < 120 AND tool_count > 0 AND started_at >= ? AND started_at < ?', weekStart, nextWeekStart)
      case 'diverseToolSessions':
        return this.queryScalar("SELECT COUNT(*) as c FROM (SELECT session_id FROM events WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL AND session_id IN (SELECT id FROM sessions WHERE started_at >= ? AND started_at < ?) GROUP BY session_id HAVING COUNT(DISTINCT tool_name) >= 5)", weekStart, nextWeekStart)
      case 'maxSubagentsInSession':
        return this.queryScalar("SELECT COALESCE(MAX(cnt), 0) as c FROM (SELECT COUNT(*) as cnt FROM events WHERE hook_type = 'SubagentStart' AND session_id IN (SELECT id FROM sessions WHERE started_at >= ? AND started_at < ?) GROUP BY session_id)", weekStart, nextWeekStart)
      default:
        return 0
    }
  }
}
