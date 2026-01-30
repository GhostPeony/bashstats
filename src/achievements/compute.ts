import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { BADGE_DEFINITIONS, RANK_THRESHOLDS, TIER_XP } from '../constants.js'
import type {
  BadgeResult,
  BadgeTier,
  XPResult,
  AchievementsPayload,
  AllStats,
} from '../types.js'
import { TIER_NAMES } from '../types.js'

export class AchievementEngine {
  private db: BashStatsDB
  private stats: StatsEngine

  constructor(db: BashStatsDB, stats: StatsEngine) {
    this.db = db
    this.stats = stats
  }

  computeBadges(): BadgeResult[] {
    const allStats = this.stats.getAllStats()
    const flat = this.flattenStats(allStats)

    return BADGE_DEFINITIONS.map(badge => {
      const value = flat[badge.stat] ?? 0

      let tier: BadgeTier = 0
      if (badge.aspirational) {
        // Aspirational: only Obsidian (5) or Locked (0)
        tier = value >= badge.tiers[4] ? 5 : 0
      } else if (badge.secret) {
        // Secret: unlocked (1) or locked (0)
        tier = value >= badge.tiers[0] ? 1 : 0
      } else {
        // Normal tiered badge: check how many thresholds exceeded
        for (let i = 0; i < badge.tiers.length; i++) {
          if (value >= badge.tiers[i]) {
            tier = (i + 1) as BadgeTier
          } else {
            break
          }
        }
      }

      // Calculate progress toward next tier
      let nextThreshold = 0
      let progress = 0
      let maxed = false

      if (badge.aspirational) {
        nextThreshold = badge.tiers[4]
        progress = tier === 5 ? 1 : Math.min(value / nextThreshold, 0.99)
        maxed = tier === 5
      } else if (badge.secret) {
        nextThreshold = badge.tiers[0]
        progress = tier >= 1 ? 1 : 0
        maxed = tier >= 1
      } else if (tier >= 5) {
        nextThreshold = badge.tiers[4]
        progress = 1
        maxed = true
      } else {
        // tier is 0..4 here (we already handled tier >= 5 above)
        const tierIdx = tier as 0 | 1 | 2 | 3 | 4
        nextThreshold = badge.tiers[tierIdx]
        const prevThreshold = tierIdx > 0 ? badge.tiers[(tierIdx - 1) as 0 | 1 | 2 | 3] : 0
        const range = nextThreshold - prevThreshold
        progress = range > 0 ? Math.min((value - prevThreshold) / range, 0.99) : 0
      }

      // Persist unlock if tier > 0
      if (tier > 0) {
        for (let t = 1; t <= tier; t++) {
          this.db.insertUnlock(badge.id, t)
        }
      }

      return {
        id: badge.id,
        name: badge.name,
        icon: badge.icon,
        description: badge.description,
        category: badge.category,
        stat: badge.stat,
        tiers: badge.tiers,
        tier,
        tierName: TIER_NAMES[tier],
        value,
        nextThreshold,
        progress,
        maxed,
        secret: badge.secret ?? false,
        unlocked: tier > 0,
      }
    })
  }

  computeXP(): XPResult {
    const allStats = this.stats.getAllStats()
    const badges = this.computeBadges()

    // Calculate XP from activity
    let totalXP = 0
    totalXP += allStats.lifetime.totalPrompts * 1       // +1 per prompt
    totalXP += allStats.lifetime.totalToolCalls * 1      // +1 per tool call
    totalXP += allStats.lifetime.totalSessions * 10      // +10 per session
    totalXP += allStats.time.nightOwlCount * 2           // +2 per night owl prompt
    totalXP += Math.floor(allStats.time.longestStreak / 100) * 25  // +25 per 100 in longest streak

    // Badge tier XP
    for (const badge of badges) {
      if (badge.tier > 0) {
        totalXP += TIER_XP[badge.tier] ?? 0
      }
    }

    // Determine rank from RANK_THRESHOLDS (highest threshold that XP exceeds)
    let rank = 'Bronze'
    let nextRankXP = RANK_THRESHOLDS[RANK_THRESHOLDS.length - 2]?.xp ?? 1000 // Silver threshold
    for (const threshold of RANK_THRESHOLDS) {
      if (totalXP >= threshold.xp) {
        rank = threshold.rank
        break
      }
    }

    // Calculate progress toward next rank
    let progress = 0
    const rankIndex = RANK_THRESHOLDS.findIndex(t => t.rank === rank)
    if (rankIndex <= 0) {
      // Already at highest rank (Obsidian)
      nextRankXP = RANK_THRESHOLDS[0].xp
      progress = 1
    } else {
      const currentThreshold = RANK_THRESHOLDS[rankIndex].xp
      nextRankXP = RANK_THRESHOLDS[rankIndex - 1].xp
      const range = nextRankXP - currentThreshold
      progress = range > 0 ? Math.min((totalXP - currentThreshold) / range, 0.99) : 0
    }

    return {
      totalXP,
      rank,
      nextRankXP,
      progress,
    }
  }

  getAchievementsPayload(): AchievementsPayload {
    const allStats = this.stats.getAllStats()
    return {
      stats: allStats,
      badges: this.computeBadges(),
      xp: this.computeXP(),
    }
  }

  private flattenStats(allStats: AllStats): Record<string, number> {
    const flat: Record<string, number> = {}

    // Direct lifetime mappings
    flat.totalPrompts = allStats.lifetime.totalPrompts
    flat.totalToolCalls = allStats.lifetime.totalToolCalls
    flat.totalSessions = allStats.lifetime.totalSessions
    flat.totalCharsTyped = allStats.lifetime.totalCharsTyped
    flat.totalBashCommands = allStats.lifetime.totalBashCommands
    flat.totalFilesRead = allStats.lifetime.totalFilesRead
    flat.totalFilesEdited = allStats.lifetime.totalFilesEdited
    flat.totalFilesCreated = allStats.lifetime.totalFilesCreated
    flat.totalSubagents = allStats.lifetime.totalSubagents
    flat.totalErrors = allStats.lifetime.totalErrors
    flat.totalRateLimits = allStats.lifetime.totalRateLimits
    flat.totalWebFetches = allStats.lifetime.totalWebFetches
    flat.totalWebSearches = allStats.lifetime.totalWebSearches
    flat.totalCompactions = allStats.lifetime.totalCompactions

    // Derived
    flat.totalSessionHours = Math.floor(allStats.lifetime.totalDurationSeconds / 3600)

    // From time stats
    flat.longestStreak = allStats.time.longestStreak
    flat.nightOwlCount = allStats.time.nightOwlCount
    flat.earlyBirdCount = allStats.time.earlyBirdCount
    flat.weekendSessions = allStats.time.weekendSessions

    // Computed via queries - tool mastery
    flat.totalSearches = this.queryTotalSearches()

    // Behavioral
    flat.mostRepeatedPromptCount = this.queryMostRepeatedPromptCount()
    flat.uniqueToolsUsed = this.queryUniqueToolsUsed()
    flat.planModeUses = this.queryPlanModeUses()
    flat.longPromptCount = this.queryLongPromptCount()
    flat.quickSessionCount = this.queryQuickSessionCount()

    // Resilience
    flat.longestErrorFreeStreak = this.queryLongestErrorFreeStreak()

    // Humor
    flat.politePromptCount = this.queryPolitePromptCount()
    flat.hugePromptCount = this.queryHugePromptCount()
    flat.maxSameFileEdits = this.queryMaxSameFileEdits()
    flat.longSessionCount = this.queryLongSessionCount()
    flat.repeatedPromptCount = this.queryRepeatedPromptCount()
    flat.maxErrorsInSession = this.queryMaxErrorsInSession()

    // Shipping
    flat.totalCommits = this.queryTotalCommits()
    flat.totalPRs = this.queryTotalPRs()
    flat.uniqueProjects = allStats.projects.uniqueProjects
    flat.uniqueLanguages = this.queryUniqueLanguages()

    // Multi-agent
    flat.concurrentAgentUses = this.queryConcurrentAgentUses()

    // Secret stats
    flat.dangerousCommandBlocked = this.queryDangerousCommandBlocked()
    flat.returnAfterBreak = this.queryReturnAfterBreak()
    flat.threeAmPrompt = this.queryThreeAmPrompt()
    flat.midnightSpanSession = this.queryMidnightSpanSession()
    flat.nestedSubagent = this.queryNestedSubagent()
    flat.holidayActivity = this.queryHolidayActivity()
    flat.speedRunSession = this.querySpeedRunSession()
    flat.allToolsInSession = this.queryAllToolsInSession()
    flat.firstEverSession = allStats.lifetime.totalSessions > 0 ? 1 : 0
    flat.allBadgesGold = 0 // computed after badges are resolved; set to 0 for first pass

    // Aspirational
    flat.totalXP = 0 // computed after XP is calculated; set to 0 for badge pass
    flat.allToolsObsidian = 0 // computed after all badges; set to 0 for first pass

    return flat
  }

  // === Computed stat query helpers ===

  private queryScalar(sql: string, ...params: unknown[]): number {
    const row = this.db.prepare(sql).get(...params) as Record<string, number> | undefined
    if (!row) return 0
    return Object.values(row)[0] ?? 0
  }

  private queryTotalSearches(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name IN ('Grep', 'Glob') AND hook_type = 'PostToolUse'"
    )
  }

  private queryPolitePromptCount(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE LOWER(content) LIKE '%please%' OR LOWER(content) LIKE '%thank%'"
    )
  }

  private queryHugePromptCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM prompts WHERE char_count > 5000'
    )
  }

  private queryLongPromptCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM prompts WHERE char_count > 1000'
    )
  }

  private queryMostRepeatedPromptCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM prompts GROUP BY LOWER(TRIM(content)) ORDER BY c DESC LIMIT 1'
    )
  }

  private queryUniqueToolsUsed(): number {
    return this.queryScalar(
      "SELECT COUNT(DISTINCT tool_name) as c FROM events WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL"
    )
  }

  private queryPlanModeUses(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PostToolUse' AND tool_name = 'Task'"
    )
  }

  private queryQuickSessionCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds < 300 AND tool_count > 0'
    )
  }

  private queryLongSessionCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds > 28800'
    )
  }

  private queryMaxErrorsInSession(): number {
    return this.queryScalar(
      'SELECT COALESCE(MAX(error_count), 0) as c FROM sessions'
    )
  }

  private queryMaxSameFileEdits(): number {
    // Find the most times any single file path was edited
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type = 'PostToolUse' GROUP BY json_extract(tool_input, '$.file_path') ORDER BY c DESC LIMIT 1"
    )
  }

  private queryRepeatedPromptCount(): number {
    // Total prompts that were submitted more than once (i.e., duplicates)
    return this.queryScalar(
      'SELECT COALESCE(SUM(cnt), 0) as c FROM (SELECT COUNT(*) as cnt FROM prompts GROUP BY LOWER(TRIM(content)) HAVING cnt > 1)'
    )
  }

  private queryLongestErrorFreeStreak(): number {
    // Count consecutive successful tool calls without an error
    const rows = this.db.prepare(
      "SELECT hook_type FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure') ORDER BY timestamp ASC"
    ).all() as { hook_type: string }[]

    let longest = 0
    let current = 0
    for (const row of rows) {
      if (row.hook_type === 'PostToolUse') {
        current++
        longest = Math.max(longest, current)
      } else {
        current = 0
      }
    }
    return longest
  }

  private queryTotalCommits(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%'"
    )
  }

  private queryTotalPRs(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%gh pr create%'"
    )
  }

  private queryUniqueLanguages(): number {
    // Estimate languages from file extensions in Edit/Write/Read events
    const rows = this.db.prepare(
      "SELECT DISTINCT json_extract(tool_input, '$.file_path') as fp FROM events WHERE tool_name IN ('Edit', 'Write', 'Read') AND hook_type = 'PostToolUse' AND tool_input IS NOT NULL"
    ).all() as { fp: string | null }[]

    const extensions = new Set<string>()
    for (const row of rows) {
      if (row.fp) {
        const match = row.fp.match(/\.([a-zA-Z0-9]+)$/)
        if (match) {
          extensions.add(match[1].toLowerCase())
        }
      }
    }
    return extensions.size
  }

  private queryConcurrentAgentUses(): number {
    // Count sessions that had subagent starts
    return this.queryScalar(
      "SELECT COUNT(DISTINCT session_id) as c FROM events WHERE hook_type = 'SubagentStart'"
    )
  }

  // === Secret stat helpers ===

  private queryDangerousCommandBlocked(): number {
    // Dangerous commands that were in PreToolUse but not followed by PostToolUse
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PreToolUse' AND tool_name = 'Bash' AND (tool_input LIKE '%rm -rf%' OR tool_input LIKE '%rm -r /%')"
    )
  }

  private queryReturnAfterBreak(): number {
    // Sessions after a 7+ day gap
    const rows = this.db.prepare(
      'SELECT started_at FROM sessions ORDER BY started_at ASC'
    ).all() as { started_at: string }[]

    if (rows.length < 2) return 0
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].started_at).getTime()
      const curr = new Date(rows[i].started_at).getTime()
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
      if (diffDays >= 7) return 1
    }
    return 0
  }

  private queryThreeAmPrompt(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) = 3"
    ) > 0 ? 1 : 0
  }

  private queryMidnightSpanSession(): number {
    // Session that started before midnight and ended after midnight
    const rows = this.db.prepare(
      "SELECT started_at, ended_at FROM sessions WHERE ended_at IS NOT NULL"
    ).all() as { started_at: string; ended_at: string }[]

    for (const row of rows) {
      const startDate = row.started_at.slice(0, 10)
      const endDate = row.ended_at.slice(0, 10)
      if (startDate !== endDate) return 1
    }
    return 0
  }

  private queryNestedSubagent(): number {
    // Any subagent activity is a proxy for nested subagent detection
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'"
    ) > 0 ? 1 : 0
  }

  private queryHolidayActivity(): number {
    // Check for sessions on major US holidays (Dec 25, Jan 1, Jul 4, Nov last Thursday)
    const holidays = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE strftime('%m-%d', started_at) IN ('12-25', '01-01', '07-04')"
    )
    return holidays > 0 ? 1 : 0
  }

  private querySpeedRunSession(): number {
    // Session under 20 seconds with tool usage
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds <= 20 AND tool_count > 0'
    ) > 0 ? 1 : 0
  }

  private queryAllToolsInSession(): number {
    // Session that used Bash, Read, Write, Edit, Grep, Glob, and WebFetch
    const requiredTools = ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch']
    const rows = this.db.prepare(
      "SELECT session_id, COUNT(DISTINCT tool_name) as cnt FROM events WHERE hook_type = 'PostToolUse' AND tool_name IN ('Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch') GROUP BY session_id"
    ).all() as { session_id: string; cnt: number }[]

    for (const row of rows) {
      if (row.cnt >= requiredTools.length) return 1
    }
    return 0
  }
}
