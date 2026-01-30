import { BashStatsDB } from '../db/database.js'
import type {
  LifetimeStats,
  ToolBreakdown,
  TimeStats,
  SessionRecords,
  ProjectStats,
  AllStats,
} from '../types.js'

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

  getLifetimeStats(): LifetimeStats {
    const totalSessions = this.queryScalar('SELECT COUNT(*) as c FROM sessions')
    const totalPrompts = this.queryScalar('SELECT COUNT(*) as c FROM prompts')
    const totalCharsTyped = this.queryScalar('SELECT COALESCE(SUM(char_count), 0) as c FROM prompts')
    const totalToolCalls = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalDurationSeconds = this.queryScalar(
      'SELECT COALESCE(SUM(duration_seconds), 0) as c FROM sessions'
    )
    const totalFilesRead = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Read' AND hook_type = 'PostToolUse'"
    )
    const totalFilesWritten = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Write' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalFilesEdited = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalFilesCreated = totalFilesWritten
    const totalBashCommands = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalWebSearches = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'WebSearch' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalWebFetches = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'WebFetch' AND hook_type IN ('PostToolUse', 'PostToolUseFailure')"
    )
    const totalSubagents = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'"
    )
    const totalCompactions = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PreCompact'"
    )
    const totalErrors = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PostToolUseFailure' OR (hook_type = 'Notification' AND (tool_input LIKE '%\"notification_type\":\"error\"%' OR tool_input LIKE '%\"notification_type\":\"rate_limit\"%'))"
    )
    const totalRateLimits = this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'Notification' AND tool_input LIKE '%rate_limit%'"
    )

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
    }
  }

  getToolBreakdown(): ToolBreakdown {
    const rows = this.db
      .prepare(
        "SELECT tool_name, COUNT(*) as cnt FROM events WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL GROUP BY tool_name"
      )
      .all() as { tool_name: string; cnt: number }[]

    const breakdown: ToolBreakdown = {}
    for (const row of rows) {
      breakdown[row.tool_name] = row.cnt
    }
    return breakdown
  }

  getTimeStats(): TimeStats {
    // Compute streaks from daily_activity
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

      // Compute current streak (backwards from today)
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      // Build a Set of active dates for quick lookup
      const activeDates = new Set(dailyRows.map(r => r.date))

      // Start from today and go backwards
      let checkDate = new Date(todayStr + 'T00:00:00Z')
      currentStreak = 0

      // Check today first; if not active, check yesterday (in case session hasn't been recorded today yet)
      if (activeDates.has(todayStr)) {
        currentStreak = 1
        checkDate.setUTCDate(checkDate.getUTCDate() - 1)
        while (activeDates.has(checkDate.toISOString().slice(0, 10))) {
          currentStreak++
          checkDate.setUTCDate(checkDate.getUTCDate() - 1)
        }
      } else {
        // Check if yesterday was active
        checkDate.setUTCDate(checkDate.getUTCDate() - 1)
        const yesterdayStr = checkDate.toISOString().slice(0, 10)
        if (activeDates.has(yesterdayStr)) {
          currentStreak = 1
          checkDate.setUTCDate(checkDate.getUTCDate() - 1)
          while (activeDates.has(checkDate.toISOString().slice(0, 10))) {
            currentStreak++
            checkDate.setUTCDate(checkDate.getUTCDate() - 1)
          }
        }
      }
    }

    // Peak hour from prompts timestamps
    const peakHourRow = this.db
      .prepare(
        "SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as cnt FROM prompts GROUP BY hour ORDER BY cnt DESC LIMIT 1"
      )
      .get() as { hour: number; cnt: number } | undefined

    const peakHour = peakHourRow?.hour ?? 0
    const peakHourCount = peakHourRow?.cnt ?? 0

    // Night owl: prompts where hour < 5
    const nightOwlCount = this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) < 5"
    )

    // Early bird: prompts where hour BETWEEN 5 AND 7
    const earlyBirdCount = this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 5 AND 7"
    )

    // Weekend sessions: day of week 0 (Sunday) or 6 (Saturday)
    // SQLite strftime('%w') returns 0=Sunday, 1=Monday, ... 6=Saturday
    const weekendSessions = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE CAST(strftime('%w', started_at) AS INTEGER) IN (0, 6)"
    )

    // Most active day of week
    const mostActiveDayRow = this.db
      .prepare(
        "SELECT CAST(strftime('%w', started_at) AS INTEGER) as dow, COUNT(*) as cnt FROM sessions GROUP BY dow ORDER BY cnt DESC LIMIT 1"
      )
      .get() as { dow: number; cnt: number } | undefined

    const mostActiveDay = mostActiveDayRow?.dow ?? 0

    // Busiest single date
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

  getSessionRecords(): SessionRecords {
    const longestSessionSeconds = this.queryScalar(
      'SELECT COALESCE(MAX(duration_seconds), 0) as c FROM sessions'
    )
    const mostToolsInSession = this.queryScalar(
      'SELECT COALESCE(MAX(tool_count), 0) as c FROM sessions'
    )
    const mostPromptsInSession = this.queryScalar(
      'SELECT COALESCE(MAX(prompt_count), 0) as c FROM sessions'
    )
    const fastestSessionSeconds = this.queryScalar(
      'SELECT COALESCE(MIN(duration_seconds), 0) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds > 0'
    )
    const avgDurationSeconds = this.queryScalar(
      'SELECT COALESCE(AVG(duration_seconds), 0) as c FROM sessions WHERE duration_seconds IS NOT NULL'
    )
    const avgPromptsPerSession = this.queryScalar(
      'SELECT COALESCE(AVG(prompt_count), 0) as c FROM sessions'
    )
    const avgToolsPerSession = this.queryScalar(
      'SELECT COALESCE(AVG(tool_count), 0) as c FROM sessions'
    )

    return {
      longestSessionSeconds,
      mostToolsInSession,
      mostPromptsInSession,
      fastestSessionSeconds,
      avgDurationSeconds: Math.round(avgDurationSeconds),
      avgPromptsPerSession: Math.round(avgPromptsPerSession * 100) / 100,
      avgToolsPerSession: Math.round(avgToolsPerSession * 100) / 100,
    }
  }

  getProjectStats(): ProjectStats {
    const uniqueProjects = this.queryScalar(
      'SELECT COUNT(DISTINCT project) as c FROM sessions WHERE project IS NOT NULL'
    )

    const projectRows = this.db
      .prepare(
        'SELECT project, COUNT(*) as cnt FROM sessions WHERE project IS NOT NULL GROUP BY project ORDER BY cnt DESC'
      )
      .all() as { project: string; cnt: number }[]

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

  getAllStats(): AllStats {
    return {
      lifetime: this.getLifetimeStats(),
      tools: this.getToolBreakdown(),
      time: this.getTimeStats(),
      sessions: this.getSessionRecords(),
      projects: this.getProjectStats(),
    }
  }
}
