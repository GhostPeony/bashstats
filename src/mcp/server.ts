import os from 'os'
import path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { AchievementEngine } from '../achievements/compute.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString('en-US')
}

function hoursFromSeconds(s: number): string {
  return (s / 3600).toFixed(1)
}

function openDB(): BashStatsDB {
  const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)
  return new BashStatsDB(dbPath)
}

const server = new McpServer({
  name: 'bashstats',
  version: '0.2.3',
})

server.tool(
  'bashstats_overview',
  'Get coding stats summary: rank, XP, streak, lifetime totals, today\'s activity, and token usage',
  async () => {
    const db = openDB()
    try {
      const stats = new StatsEngine(db)
      const achievements = new AchievementEngine(db, stats)
      const xp = achievements.computeXP()
      const { lifetime, time } = stats.getAllStats()
      const today = db.getDailyActivity(new Date().toISOString().slice(0, 10))

      const progressPct = (xp.progress * 100).toFixed(1)
      const lines = [
        `Rank ${xp.rankNumber} (${xp.rankTier}) - ${fmt(xp.totalXP)} / ${fmt(xp.nextRankXP)} XP (${progressPct}% to Rank ${xp.rankNumber + 1})`,
        `Streak: ${time.currentStreak} days (longest: ${time.longestStreak} days)`,
        '',
        `Lifetime: ${fmt(lifetime.totalSessions)} sessions, ${fmt(lifetime.totalPrompts)} prompts, ${fmt(lifetime.totalToolCalls)} tool calls, ${hoursFromSeconds(lifetime.totalDurationSeconds)} hours`,
        `Tokens: ${fmt(lifetime.totalTokens)} total (input: ${fmt(lifetime.totalInputTokens)}, output: ${fmt(lifetime.totalOutputTokens)}, cache read: ${fmt(lifetime.totalCacheReadTokens)})`,
        `Code: ${fmt(lifetime.totalCommits)} commits, +${fmt(lifetime.totalLinesAdded)} / -${fmt(lifetime.totalLinesRemoved)} lines`,
      ]

      if (today) {
        const todayTokens = today.input_tokens + today.output_tokens + today.cache_creation_input_tokens + today.cache_read_input_tokens
        lines.push(
          '',
          `Today: ${today.sessions} sessions, ${today.prompts} prompts, ${fmt(today.tool_calls)} tools, ${hoursFromSeconds(today.duration_seconds)} hours, ${fmt(todayTokens)} tokens`,
        )
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } finally {
      db.close()
    }
  },
)

server.tool(
  'bashstats_achievements',
  'Get badge and achievement progress: unlocked count, closest to unlocking, recent unlocks',
  async () => {
    const db = openDB()
    try {
      const stats = new StatsEngine(db)
      const achievements = new AchievementEngine(db, stats)
      const badges = achievements.computeBadges()

      const unlocked = badges.filter((b) => b.unlocked)
      const totalCount = badges.length
      const unlockedCount = unlocked.length
      const pct = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

      // Closest to unlock: not yet fully unlocked, sorted by progress descending
      const closest = badges
        .filter((b) => !b.maxed && b.progress > 0)
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 5)

      // Recent unlocks from DB
      const allUnlocks = db.getUnlocks()
      const recentUnlocks = allUnlocks
        .sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at))
        .slice(0, 5)

      const lines = [`Badges: ${unlockedCount} / ${totalCount} unlocked (${pct}%)`]

      if (closest.length > 0) {
        lines.push('', 'Closest to unlock:')
        for (const b of closest) {
          const pctProgress = Math.round(b.progress * 100)
          lines.push(`  ${b.name} (${pctProgress}%) - ${fmt(b.value)}/${fmt(b.nextThreshold)} ${b.trigger}`)
        }
      }

      if (recentUnlocks.length > 0) {
        lines.push('', 'Recent unlocks:')
        const names = recentUnlocks.map((u) => {
          const badge = badges.find((b) => b.id === u.badge_id)
          return badge ? badge.name : u.badge_id
        })
        lines.push(`  ${names.join(', ')}`)
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } finally {
      db.close()
    }
  },
)

server.tool(
  'bashstats_goals',
  'Get weekly goals and challenge progress: days active, multiplier, each challenge status',
  async () => {
    const db = openDB()
    try {
      const stats = new StatsEngine(db)
      const payload = stats.getWeeklyGoalsPayload()

      const lines = [
        `Weekly Goals (${payload.multiplier}x multiplier, ${payload.daysActive}/7 days active)`,
        '',
      ]

      for (const c of payload.challenges) {
        const status = c.completed ? 'DONE' : '    '
        lines.push(`[${status}] ${c.description} - ${fmt(c.current)}/${fmt(c.threshold)} (+${c.xpReward} XP)`)
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] }
    } finally {
      db.close()
    }
  },
)

const transport = new StdioServerTransport()
await server.connect(transport)
