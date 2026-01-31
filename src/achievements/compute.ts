import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { BADGE_DEFINITIONS, TIER_XP, xpForRank, rankTierForRank } from '../constants.js'
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

  computeBadges(agent?: string): BadgeResult[] {
    const allStats = this.stats.getAllStats(agent)
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
        trigger: badge.trigger,
        secret: badge.secret ?? false,
        unlocked: tier > 0,
      }
    })
  }

  computeXP(agent?: string): XPResult {
    const allStats = this.stats.getAllStats(agent)
    const badges = this.computeBadges(agent)

    // Calculate XP from activity
    let totalXP = 0
    totalXP += allStats.lifetime.totalPrompts * 1              // +1 per prompt
    totalXP += allStats.lifetime.totalSessions * 5             // +5 per session
    totalXP += Math.floor(allStats.lifetime.totalDurationSeconds / 3600) * 10  // +10 per hour
    totalXP += allStats.time.longestStreak * 5                 // +5 per streak day

    // Badge tier XP
    for (const badge of badges) {
      if (badge.tier > 0) {
        totalXP += TIER_XP[badge.tier] ?? 0
      }
    }

    // Determine rank number (1-500) from XP using exponential curve
    let rankNumber = 0
    for (let r = 500; r >= 1; r--) {
      if (totalXP >= xpForRank(r)) {
        rankNumber = r
        break
      }
    }

    // Calculate progress toward next rank
    let nextRankXP: number
    let progress: number

    if (rankNumber >= 500) {
      nextRankXP = xpForRank(500)
      progress = 1
    } else {
      const nextRank = rankNumber + 1
      nextRankXP = xpForRank(nextRank)
      const currentThreshold = rankNumber > 0 ? xpForRank(rankNumber) : 0
      const range = nextRankXP - currentThreshold
      progress = range > 0 ? Math.min((totalXP - currentThreshold) / range, 0.99) : 0
    }

    return {
      totalXP,
      rankNumber,
      rankTier: rankTierForRank(rankNumber || 1),
      nextRankXP,
      progress,
    }
  }

  getAchievementsPayload(agent?: string): AchievementsPayload {
    const allStats = this.stats.getAllStats(agent)
    return {
      stats: allStats,
      badges: this.computeBadges(agent),
      xp: this.computeXP(agent),
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
    flat.allNonSecretBadgesUnlocked = 0 // computed after all badges; set to 0

    // ===================================================================
    // NEW: Time & Patterns
    // ===================================================================
    flat.witchingHourPrompts = this.queryWitchingHourPrompts()
    flat.lunchBreakDays = this.queryLunchBreakDays()
    flat.mondaySessions = this.queryMondaySessions()
    flat.fridayCommits = this.queryFridayCommits()
    flat.maxUniqueHoursInDay = this.queryMaxUniqueHoursInDay()
    flat.uniqueQuarters = this.queryUniqueQuarters()

    // ===================================================================
    // NEW: Session Behavior
    // ===================================================================
    flat.extendedSessionCount = this.queryExtendedSessionCount()
    flat.quickDrawSessions = this.queryQuickDrawSessions()
    flat.diverseToolSessions = this.queryDiverseToolSessions()
    // totalCompactions already mapped above
    flat.permissionRequests = this.queryPermissionRequests()
    flat.returnerDays = this.queryReturnerDays()

    // ===================================================================
    // NEW: Prompt Patterns
    // ===================================================================
    flat.shortPromptCount = this.queryShortPromptCount()
    flat.questionPromptCount = this.queryQuestionPromptCount()
    flat.sorryPromptCount = this.querySorryPromptCount()
    flat.capsLockPromptCount = this.queryCapsLockPromptCount()
    flat.emojiPromptCount = this.queryEmojiPromptCount()
    flat.codeDumpPromptCount = this.queryCodeDumpPromptCount()

    // ===================================================================
    // NEW: Error & Recovery
    // ===================================================================
    flat.rubberDuckCount = this.queryRubberDuckCount()
    flat.thirdTimeCharmCount = this.queryThirdTimeCharmCount()
    flat.undoEditCount = this.queryUndoEditCount()
    flat.crashySessions = this.queryCrashySessions()
    flat.totalLifetimeErrors = allStats.lifetime.totalErrors

    // ===================================================================
    // NEW: Tool Combos
    // ===================================================================
    flat.readEditRunCount = this.queryReadEditRunCount()
    // totalSearches already mapped above (reused by grep_ninja)
    flat.maxFilesCreatedInSession = this.queryMaxFilesCreatedInSession()
    flat.maxSameFileEditsLifetime = this.queryMaxSameFileEditsLifetime()
    flat.searchThenEditCount = this.querySearchThenEditCount()

    // ===================================================================
    // NEW: Project Dedication
    // ===================================================================
    flat.maxProjectSessions = this.queryMaxProjectSessions()
    flat.maxProjectsInDay = this.queryMaxProjectsInDay()
    flat.finishedProjects = this.queryFinishedProjects()
    flat.legacyReturns = this.queryLegacyReturns()
    flat.totalUniqueProjects = allStats.projects.uniqueProjects

    // ===================================================================
    // NEW: Multi-Agent (additional stats)
    // ===================================================================
    flat.maxConcurrentSubagents = this.queryMaxConcurrentSubagents()
    flat.quickSubagentStops = this.queryQuickSubagentStops()
    flat.totalSubagentSpawns = allStats.lifetime.totalSubagents
    flat.maxSubagentsInSession = this.queryMaxSubagentsInSession()

    // Cross-agent stats
    flat.distinctAgentsUsed = this.queryScalar('SELECT COUNT(DISTINCT agent) FROM sessions')
    flat.geminiSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'gemini-cli'")
    flat.copilotSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'copilot-cli'")
    flat.opencodeSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'opencode'")
    flat.doubleAgentDays = this.queryScalar(
      "SELECT COUNT(*) FROM (SELECT substr(started_at, 1, 10) as d FROM sessions GROUP BY d HAVING COUNT(DISTINCT agent) >= 2)"
    )
    flat.agentSwitchDays = flat.doubleAgentDays

    // ===================================================================
    // NEW: Humor & Meta (additional stats)
    // ===================================================================
    flat.dejaVuCount = this.queryDejaVuCount()
    flat.trustIssueCount = this.queryTrustIssueCount()
    flat.backseatDriverCount = this.queryBackseatDriverCount()
    flat.negotiatorCount = this.queryNegotiatorCount()
    flat.maxConsecutivePermissions = this.queryMaxConsecutivePermissions()
    // longSessionCount already mapped above (reused by touch_grass_humor)
    // longestErrorFreeStreak already mapped above (reused by inbox_zero)
    flat.bashRetrySuccessCount = this.queryBashRetrySuccessCount()

    // ===================================================================
    // NEW: Secret (additional stats)
    // ===================================================================
    flat.easterEggActivity = this.queryEasterEggActivity()
    flat.fullMoonSession = this.queryFullMoonSession()
    flat.birthdaySession = this.queryBirthdaySession()
    flat.luckyNumber = (allStats.lifetime.totalPrompts >= 777 || allStats.lifetime.totalToolCalls >= 7777) ? 1 : 0
    flat.ghostSessions = this.queryGhostSessions()
    flat.bullseyeSessions = this.queryBullseyeSessions()
    flat.hasTenMillionSession = this.queryHasTenMillionSession()

    // ===================================================================
    // NEW: Token Usage
    // ===================================================================
    flat.totalTokens = allStats.lifetime.totalTokens
    flat.totalOutputTokens = allStats.lifetime.totalOutputTokens
    flat.totalCacheReadTokens = allStats.lifetime.totalCacheReadTokens
    flat.totalCacheCreationTokens = allStats.lifetime.totalCacheCreationTokens
    flat.totalInputTokens = allStats.lifetime.totalInputTokens
    flat.mostTokensInSession = allStats.sessions.mostTokensInSession
    flat.avgTokensPerSession = allStats.sessions.avgTokensPerSession
    flat.heavyTokenSessions = this.queryHeavyTokenSessions()
    flat.lightTokenSessions = this.queryLightTokenSessions()
    flat.maxOutputInSession = this.queryMaxOutputInSession()

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
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type = 'PostToolUse' GROUP BY json_extract(tool_input, '$.file_path') ORDER BY c DESC LIMIT 1"
    )
  }

  private queryRepeatedPromptCount(): number {
    return this.queryScalar(
      'SELECT COALESCE(SUM(cnt), 0) as c FROM (SELECT COUNT(*) as cnt FROM prompts GROUP BY LOWER(TRIM(content)) HAVING cnt > 1)'
    )
  }

  private queryLongestErrorFreeStreak(): number {
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
    return this.queryScalar(
      "SELECT COUNT(DISTINCT session_id) as c FROM events WHERE hook_type = 'SubagentStart'"
    )
  }

  // === Secret stat helpers ===

  private queryDangerousCommandBlocked(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PreToolUse' AND tool_name = 'Bash' AND (tool_input LIKE '%rm -rf%' OR tool_input LIKE '%rm -r /%')"
    )
  }

  private queryReturnAfterBreak(): number {
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
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'"
    ) > 0 ? 1 : 0
  }

  private queryHolidayActivity(): number {
    const holidays = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE strftime('%m-%d', started_at) IN ('12-25', '01-01', '07-04')"
    )
    return holidays > 0 ? 1 : 0
  }

  private querySpeedRunSession(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds <= 20 AND tool_count > 0'
    ) > 0 ? 1 : 0
  }

  private queryAllToolsInSession(): number {
    const requiredTools = ['Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch']
    const rows = this.db.prepare(
      "SELECT session_id, COUNT(DISTINCT tool_name) as cnt FROM events WHERE hook_type = 'PostToolUse' AND tool_name IN ('Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'WebFetch') GROUP BY session_id"
    ).all() as { session_id: string; cnt: number }[]

    for (const row of rows) {
      if (row.cnt >= requiredTools.length) return 1
    }
    return 0
  }

  // ===================================================================
  // NEW: Time & Patterns queries
  // ===================================================================

  private queryWitchingHourPrompts(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 2 AND 3"
    )
  }

  private queryLunchBreakDays(): number {
    return this.queryScalar(
      "SELECT COUNT(DISTINCT strftime('%Y-%m-%d', started_at)) as c FROM sessions WHERE CAST(strftime('%H', started_at) AS INTEGER) = 12"
    )
  }

  private queryMondaySessions(): number {
    // SQLite strftime('%w') returns 1 for Monday
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE CAST(strftime('%w', started_at) AS INTEGER) = 1"
    )
  }

  private queryFridayCommits(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%' AND CAST(strftime('%w', timestamp) AS INTEGER) = 5"
    )
  }

  private queryMaxUniqueHoursInDay(): number {
    return this.queryScalar(
      "SELECT COUNT(DISTINCT CAST(strftime('%H', timestamp) AS INTEGER)) as c FROM prompts GROUP BY strftime('%Y-%m-%d', timestamp) ORDER BY c DESC LIMIT 1"
    )
  }

  private queryUniqueQuarters(): number {
    // Count unique year-quarter combos (e.g. 2025-Q1, 2025-Q2, 2026-Q1 = 3)
    return this.queryScalar(
      "SELECT COUNT(DISTINCT (strftime('%Y', timestamp) || '-Q' || CASE WHEN CAST(strftime('%m', timestamp) AS INTEGER) BETWEEN 1 AND 3 THEN '1' WHEN CAST(strftime('%m', timestamp) AS INTEGER) BETWEEN 4 AND 6 THEN '2' WHEN CAST(strftime('%m', timestamp) AS INTEGER) BETWEEN 7 AND 9 THEN '3' ELSE '4' END)) as c FROM prompts"
    )
  }

  // ===================================================================
  // NEW: Session Behavior queries
  // ===================================================================

  private queryExtendedSessionCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds > 3600 AND prompt_count >= 15'
    )
  }

  private queryQuickDrawSessions(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds < 120 AND tool_count > 0'
    )
  }

  private queryDiverseToolSessions(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM (SELECT session_id FROM events WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL GROUP BY session_id HAVING COUNT(DISTINCT tool_name) >= 5)"
    )
  }

  private queryPermissionRequests(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'PermissionRequest'"
    )
  }

  private queryReturnerDays(): number {
    // Days where a single project had 5+ sessions
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM (SELECT strftime('%Y-%m-%d', started_at) as d, project FROM sessions WHERE project IS NOT NULL GROUP BY d, project HAVING COUNT(*) >= 5)"
    )
  }

  // ===================================================================
  // NEW: Prompt Patterns queries
  // ===================================================================

  private queryShortPromptCount(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM prompts WHERE word_count < 10'
    )
  }

  private queryQuestionPromptCount(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE TRIM(content) LIKE '%?'"
    )
  }

  private querySorryPromptCount(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE LOWER(content) LIKE '%sorry%'"
    )
  }

  private queryCapsLockPromptCount(): number {
    // Prompts that are fully uppercase and at least 10 chars
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE content = UPPER(content) AND char_count >= 10"
    )
  }

  private queryEmojiPromptCount(): number {
    // Count prompts containing emoji characters using a range check
    // SQLite doesn't have great emoji support, so we check for characters above the basic multilingual plane
    const rows = this.db.prepare(
      'SELECT content FROM prompts'
    ).all() as { content: string }[]

    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FAFF}]/u
    let count = 0
    for (const row of rows) {
      if (emojiRegex.test(row.content)) {
        count++
      }
    }
    return count
  }

  private queryCodeDumpPromptCount(): number {
    // Prompts with 50+ newlines (proxy for 50+ lines)
    const rows = this.db.prepare(
      'SELECT content FROM prompts WHERE char_count > 200'
    ).all() as { content: string }[]

    let count = 0
    for (const row of rows) {
      const lineCount = row.content.split('\n').length
      if (lineCount >= 50) count++
    }
    return count
  }

  // ===================================================================
  // NEW: Error & Recovery queries
  // ===================================================================

  private queryRubberDuckCount(): number {
    // Error followed by success on same tool without Edit in between
    const rows = this.db.prepare(
      "SELECT hook_type, tool_name FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure') ORDER BY timestamp ASC"
    ).all() as { hook_type: string; tool_name: string | null }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]
      const curr = rows[i]
      if (
        prev.hook_type === 'PostToolUseFailure' &&
        curr.hook_type === 'PostToolUse' &&
        prev.tool_name === curr.tool_name &&
        curr.tool_name !== 'Edit'
      ) {
        count++
      }
    }
    return count
  }

  private queryThirdTimeCharmCount(): number {
    // Tool success after 2+ consecutive failures of same tool
    const rows = this.db.prepare(
      "SELECT hook_type, tool_name FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure') ORDER BY timestamp ASC"
    ).all() as { hook_type: string; tool_name: string | null }[]

    let count = 0
    let failStreak = 0
    let failTool: string | null = null

    for (const row of rows) {
      if (row.hook_type === 'PostToolUseFailure') {
        if (row.tool_name === failTool) {
          failStreak++
        } else {
          failStreak = 1
          failTool = row.tool_name
        }
      } else if (row.hook_type === 'PostToolUse') {
        if (failStreak >= 2 && row.tool_name === failTool) {
          count++
        }
        failStreak = 0
        failTool = null
      }
    }
    return count
  }

  private queryUndoEditCount(): number {
    // Back-to-back Edit on same file within same session
    const rows = this.db.prepare(
      "SELECT session_id, json_extract(tool_input, '$.file_path') as fp FROM events WHERE tool_name = 'Edit' AND hook_type = 'PostToolUse' AND tool_input IS NOT NULL ORDER BY timestamp ASC"
    ).all() as { session_id: string; fp: string | null }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].session_id === rows[i - 1].session_id && rows[i].fp === rows[i - 1].fp && rows[i].fp) {
        count++
      }
    }
    return count
  }

  private queryCrashySessions(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE error_count >= 10'
    )
  }

  // ===================================================================
  // NEW: Tool Combos queries
  // ===================================================================

  private queryReadEditRunCount(): number {
    // Detect Read → Edit → Bash sequences
    const rows = this.db.prepare(
      "SELECT tool_name FROM events WHERE hook_type = 'PostToolUse' AND tool_name IN ('Read', 'Edit', 'Bash') ORDER BY timestamp ASC"
    ).all() as { tool_name: string }[]

    let count = 0
    for (let i = 2; i < rows.length; i++) {
      if (rows[i - 2].tool_name === 'Read' && rows[i - 1].tool_name === 'Edit' && rows[i].tool_name === 'Bash') {
        count++
      }
    }
    return count
  }

  private queryMaxFilesCreatedInSession(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Write' AND hook_type = 'PostToolUse' GROUP BY session_id ORDER BY c DESC LIMIT 1"
    )
  }

  private queryMaxSameFileEditsLifetime(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE tool_name = 'Edit' AND hook_type = 'PostToolUse' GROUP BY json_extract(tool_input, '$.file_path') ORDER BY c DESC LIMIT 1"
    )
  }

  private querySearchThenEditCount(): number {
    // Grep/Glob followed by Edit within same session (adjacent or within 5 events)
    const rows = this.db.prepare(
      "SELECT session_id, tool_name FROM events WHERE hook_type = 'PostToolUse' AND tool_name IN ('Grep', 'Glob', 'Edit') ORDER BY timestamp ASC"
    ).all() as { session_id: string; tool_name: string }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (
        rows[i].tool_name === 'Edit' &&
        (rows[i - 1].tool_name === 'Grep' || rows[i - 1].tool_name === 'Glob') &&
        rows[i].session_id === rows[i - 1].session_id
      ) {
        count++
      }
    }
    return count
  }

  // ===================================================================
  // NEW: Project Dedication queries
  // ===================================================================

  private queryMaxProjectSessions(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE project IS NOT NULL GROUP BY project ORDER BY c DESC LIMIT 1'
    )
  }

  private queryMaxProjectsInDay(): number {
    return this.queryScalar(
      "SELECT COUNT(DISTINCT project) as c FROM sessions WHERE project IS NOT NULL GROUP BY strftime('%Y-%m-%d', started_at) ORDER BY c DESC LIMIT 1"
    )
  }

  private queryFinishedProjects(): number {
    // Projects that had a commit and then 7+ days of inactivity
    const projectRows = this.db.prepare(
      "SELECT DISTINCT project FROM events WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%' AND project IS NOT NULL"
    ).all() as { project: string }[]

    let count = 0
    for (const pr of projectRows) {
      const lastSession = this.db.prepare(
        'SELECT MAX(started_at) as last FROM sessions WHERE project = ?'
      ).get(pr.project) as { last: string | null } | undefined

      if (lastSession?.last) {
        const daysSince = (Date.now() - new Date(lastSession.last).getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince >= 7) count++
      }
    }
    return count
  }

  private queryLegacyReturns(): number {
    // Returns to a project after 30+ days of inactivity
    const rows = this.db.prepare(
      'SELECT project, started_at FROM sessions WHERE project IS NOT NULL ORDER BY project, started_at ASC'
    ).all() as { project: string; started_at: string }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].project === rows[i - 1].project) {
        const prev = new Date(rows[i - 1].started_at).getTime()
        const curr = new Date(rows[i].started_at).getTime()
        const diffDays = (curr - prev) / (1000 * 60 * 60 * 24)
        if (diffDays >= 30) count++
      }
    }
    return count
  }

  // ===================================================================
  // NEW: Multi-Agent queries
  // ===================================================================

  private queryMaxConcurrentSubagents(): number {
    // Simulate concurrent subagents by tracking start/stop events
    const rows = this.db.prepare(
      "SELECT hook_type, tool_input FROM events WHERE hook_type IN ('SubagentStart', 'SubagentStop') ORDER BY timestamp ASC"
    ).all() as { hook_type: string; tool_input: string | null }[]

    let current = 0
    let max = 0
    for (const row of rows) {
      if (row.hook_type === 'SubagentStart') {
        current++
        max = Math.max(max, current)
      } else {
        current = Math.max(0, current - 1)
      }
    }
    return max
  }

  private queryQuickSubagentStops(): number {
    // Subagents stopped within 30 seconds of starting
    const starts = this.db.prepare(
      "SELECT tool_input, timestamp FROM events WHERE hook_type = 'SubagentStart'"
    ).all() as { tool_input: string | null; timestamp: string }[]

    const stops = this.db.prepare(
      "SELECT tool_input, timestamp FROM events WHERE hook_type = 'SubagentStop'"
    ).all() as { tool_input: string | null; timestamp: string }[]

    let count = 0
    for (const start of starts) {
      if (!start.tool_input) continue
      let agentId: string | null = null
      try {
        const parsed = JSON.parse(start.tool_input)
        agentId = parsed.agent_id ?? null
      } catch { continue }
      if (!agentId) continue

      for (const stop of stops) {
        if (!stop.tool_input) continue
        try {
          const parsed = JSON.parse(stop.tool_input)
          if (parsed.agent_id === agentId) {
            const startTime = new Date(start.timestamp).getTime()
            const stopTime = new Date(stop.timestamp).getTime()
            if ((stopTime - startTime) < 30000) count++
            break
          }
        } catch { continue }
      }
    }
    return count
  }

  private queryMaxSubagentsInSession(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart' GROUP BY session_id ORDER BY c DESC LIMIT 1"
    )
  }

  // ===================================================================
  // NEW: Humor & Meta queries
  // ===================================================================

  private queryDejaVuCount(): number {
    // Same prompt submitted twice within 5 minutes
    const rows = this.db.prepare(
      'SELECT LOWER(TRIM(content)) as content, timestamp FROM prompts ORDER BY timestamp ASC'
    ).all() as { content: string; timestamp: string }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].content === rows[i - 1].content) {
        const prev = new Date(rows[i - 1].timestamp).getTime()
        const curr = new Date(rows[i].timestamp).getTime()
        if ((curr - prev) < 300000) count++ // 5 minutes
      }
    }
    return count
  }

  private queryTrustIssueCount(): number {
    // Read immediately after Write on same file
    const rows = this.db.prepare(
      "SELECT tool_name, json_extract(tool_input, '$.file_path') as fp FROM events WHERE hook_type = 'PostToolUse' AND tool_name IN ('Write', 'Read') AND tool_input IS NOT NULL ORDER BY timestamp ASC"
    ).all() as { tool_name: string; fp: string | null }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].tool_name === 'Read' && rows[i - 1].tool_name === 'Write' && rows[i].fp === rows[i - 1].fp && rows[i].fp) {
        count++
      }
    }
    return count
  }

  private queryBackseatDriverCount(): number {
    // Prompts with numbered step-by-step instructions (e.g., "1." "2." "3.")
    const rows = this.db.prepare(
      'SELECT content FROM prompts WHERE char_count > 20'
    ).all() as { content: string }[]

    let count = 0
    const stepPattern = /(?:^|\n)\s*\d+\.\s/
    for (const row of rows) {
      const matches = row.content.match(/(?:^|\n)\s*\d+\.\s/g)
      if (matches && matches.length >= 3) count++
    }
    return count
  }

  private queryNegotiatorCount(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM prompts WHERE LOWER(content) LIKE '%try again%' OR LOWER(content) LIKE '%one more time%'"
    )
  }

  private queryMaxConsecutivePermissions(): number {
    const rows = this.db.prepare(
      "SELECT hook_type FROM events WHERE hook_type IN ('PermissionRequest', 'PostToolUse', 'UserPromptSubmit') ORDER BY timestamp ASC"
    ).all() as { hook_type: string }[]

    let maxStreak = 0
    let current = 0
    for (const row of rows) {
      if (row.hook_type === 'PermissionRequest') {
        current++
        maxStreak = Math.max(maxStreak, current)
      } else {
        current = 0
      }
    }
    return maxStreak
  }

  private queryBashRetrySuccessCount(): number {
    // Bash success after a previous Bash failure
    const rows = this.db.prepare(
      "SELECT hook_type FROM events WHERE tool_name = 'Bash' AND hook_type IN ('PostToolUse', 'PostToolUseFailure') ORDER BY timestamp ASC"
    ).all() as { hook_type: string }[]

    let count = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].hook_type === 'PostToolUseFailure' && rows[i].hook_type === 'PostToolUse') {
        count++
      }
    }
    return count
  }

  // ===================================================================
  // NEW: Secret queries
  // ===================================================================

  private queryEasterEggActivity(): number {
    // Check for sessions on Easter, Valentine's Day, or Thanksgiving
    // Valentine's Day: Feb 14, Thanksgiving: Nov 22-28 (Thursday, 4th week)
    // We use a simplified check for key dates
    const count = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE strftime('%m-%d', started_at) IN ('02-14', '11-28', '11-27', '11-26', '11-25', '11-24', '11-23', '11-22') OR (strftime('%m', started_at) = '04' AND CAST(strftime('%d', started_at) AS INTEGER) BETWEEN 1 AND 25)"
    )
    return count > 0 ? 1 : 0
  }

  private queryFullMoonSession(): number {
    // Check if any session falls on a full moon date
    // Using lunar cycle calculation: known new moon = Jan 11, 2024
    // Full moon is ~14.765 days after new moon, cycle is ~29.53059 days
    const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime()
    const lunarCycleMs = 29.53059 * 24 * 60 * 60 * 1000
    const fullMoonOffsetMs = 14.765 * 24 * 60 * 60 * 1000
    const oneDayMs = 24 * 60 * 60 * 1000

    const rows = this.db.prepare(
      'SELECT started_at FROM sessions'
    ).all() as { started_at: string }[]

    for (const row of rows) {
      const sessionTime = new Date(row.started_at).getTime()
      const timeSinceFullMoon = ((sessionTime - knownNewMoon - fullMoonOffsetMs) % lunarCycleMs + lunarCycleMs) % lunarCycleMs
      // Within 1 day of a full moon
      if (timeSinceFullMoon < oneDayMs || timeSinceFullMoon > lunarCycleMs - oneDayMs) {
        return 1
      }
    }
    return 0
  }

  private queryBirthdaySession(): number {
    // Session on the anniversary of first session (same month-day, different year)
    const first = this.db.prepare(
      'SELECT started_at FROM sessions ORDER BY started_at ASC LIMIT 1'
    ).get() as { started_at: string } | undefined

    if (!first) return 0

    const installMonthDay = first.started_at.slice(5, 10) // "MM-DD"
    const installYear = first.started_at.slice(0, 4)

    const anniversarySession = this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE strftime('%m-%d', started_at) = ? AND strftime('%Y', started_at) != ?",
      installMonthDay, installYear
    )
    return anniversarySession > 0 ? 1 : 0
  }

  private queryGhostSessions(): number {
    return this.queryScalar(
      "SELECT COUNT(*) as c FROM sessions WHERE tool_count = 0 AND ended_at IS NOT NULL"
    ) > 0 ? 1 : 0
  }

  private queryBullseyeSessions(): number {
    // Session with exactly 1 prompt, 0 errors, and at least 1 tool call
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE prompt_count = 1 AND error_count = 0 AND tool_count > 0'
    ) > 0 ? 1 : 0
  }

  // === Token Usage queries ===

  private queryHeavyTokenSessions(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)) >= 1000000'
    )
  }

  private queryLightTokenSessions(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)) > 0 AND (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)) < 50000 AND tool_count > 0'
    )
  }

  private queryMaxOutputInSession(): number {
    return this.queryScalar(
      'SELECT COALESCE(MAX(output_tokens), 0) as c FROM sessions'
    )
  }

  private queryHasTenMillionSession(): number {
    return this.queryScalar(
      'SELECT COUNT(*) as c FROM sessions WHERE (COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0) + COALESCE(cache_creation_input_tokens, 0) + COALESCE(cache_read_input_tokens, 0)) >= 10000000'
    ) > 0 ? 1 : 0
  }
}
