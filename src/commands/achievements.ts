import os from 'os'
import path from 'path'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { AchievementEngine } from '../achievements/compute.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import type { BadgeResult } from '../types.js'

function progressBar(progress: number, width: number = 20): string {
  const filled = Math.round(progress * width)
  const empty = width - filled
  return '#'.repeat(filled) + '.'.repeat(empty)
}

function tierColor(tierName: string): string {
  return `[${tierName}]`
}

export function runAchievements(): void {
  const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)
  let db: BashStatsDB
  try {
    db = new BashStatsDB(dbPath)
  } catch {
    console.log('No data yet. Run "bashstats init" to start tracking.')
    return
  }

  const stats = new StatsEngine(db)
  const engine = new AchievementEngine(db, stats)

  try {
    const payload = engine.getAchievementsPayload()

    // Header
    console.log('')
    console.log(`  bashstats - Achievements`)
    console.log(`  Rank: ${payload.xp.rank}    XP: ${payload.xp.totalXP.toLocaleString()} / ${payload.xp.nextRankXP.toLocaleString()}`)
    console.log(`  ${progressBar(payload.xp.progress, 40)}  ${Math.round(payload.xp.progress * 100)}%`)
    console.log('')

    // Group badges by category
    const categories = new Map<string, BadgeResult[]>()
    for (const badge of payload.badges) {
      // Skip secrets that aren't unlocked
      if (badge.secret && !badge.unlocked) continue
      const cat = badge.category
      if (!categories.has(cat)) categories.set(cat, [])
      categories.get(cat)!.push(badge)
    }

    const categoryNames: Record<string, string> = {
      volume: 'VOLUME',
      tool_mastery: 'TOOL MASTERY',
      time: 'TIME & STREAKS',
      behavioral: 'BEHAVIORAL',
      resilience: 'RESILIENCE',
      shipping: 'SHIPPING & PROJECTS',
      multi_agent: 'MULTI-AGENT',
      humor: 'HUMOR',
      aspirational: 'ASPIRATIONAL',
      secret: 'SECRET',
    }

    for (const [cat, badges] of categories) {
      console.log(`  ${categoryNames[cat] || cat.toUpperCase()}`)
      for (const badge of badges) {
        const tier = badge.tier > 0 ? tierColor(badge.tierName) : '[Locked]'
        const bar = badge.maxed ? ' MAXED' : ` ${progressBar(badge.progress, 15)}`
        const value = badge.value.toLocaleString()
        const next = badge.maxed ? '' : ` / ${badge.nextThreshold.toLocaleString()}`
        console.log(`    ${tier.padEnd(12)} ${badge.name.padEnd(22)} ${value}${next}${bar}`)
        if (badge.description && (badge.category === 'humor' || badge.category === 'secret')) {
          console.log(`               "${badge.description}"`)
        }
      }
      console.log('')
    }
  } finally {
    db.close()
  }
}
