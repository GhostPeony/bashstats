import os from 'os'
import path from 'path'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function runStats(): void {
  const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)
  let db: BashStatsDB
  try {
    db = new BashStatsDB(dbPath)
  } catch {
    console.log('No data yet. Run "bashstats init" to start tracking.')
    return
  }

  const engine = new StatsEngine(db)

  try {
    const lifetime = engine.getLifetimeStats()
    const tools = engine.getToolBreakdown()
    const time = engine.getTimeStats()
    const records = engine.getSessionRecords()
    const projects = engine.getProjectStats()

    console.log('')
    console.log('  bashstats - Your Claude Code Stats')
    console.log('  ===================================')

    // Lifetime Totals
    console.log('')
    console.log('  LIFETIME TOTALS')
    console.log(`    Sessions:     ${formatNumber(lifetime.totalSessions)}`)
    console.log(`    Time:         ${formatDuration(lifetime.totalDurationSeconds)}`)
    console.log(`    Prompts:      ${formatNumber(lifetime.totalPrompts)}`)
    console.log(`    Chars typed:  ${formatNumber(lifetime.totalCharsTyped)}`)
    console.log(`    Tool calls:   ${formatNumber(lifetime.totalToolCalls)}`)
    console.log(`    Errors:       ${formatNumber(lifetime.totalErrors)}`)

    // Tool Breakdown
    if (Object.keys(tools).length > 0) {
      console.log('')
      console.log('  TOOL BREAKDOWN')
      const sorted = Object.entries(tools).sort((a, b) => b[1] - a[1])
      for (const [name, count] of sorted.slice(0, 10)) {
        console.log(`    ${name.padEnd(15)} ${formatNumber(count)}`)
      }
    }

    // Time & Streaks
    console.log('')
    console.log('  TIME & STREAKS')
    console.log(`    Current streak:  ${time.currentStreak} days`)
    console.log(`    Longest streak:  ${time.longestStreak} days`)
    console.log(`    Peak hour:       ${time.peakHour}:00 (${formatNumber(time.peakHourCount)} prompts)`)
    console.log(`    Night owl:       ${formatNumber(time.nightOwlCount)} late-night prompts`)
    console.log(`    Weekend:         ${formatNumber(time.weekendSessions)} weekend sessions`)

    // Session Records
    console.log('')
    console.log('  SESSION RECORDS')
    console.log(`    Longest:         ${formatDuration(records.longestSessionSeconds)}`)
    console.log(`    Most tools:      ${formatNumber(records.mostToolsInSession)} in one session`)
    console.log(`    Most prompts:    ${formatNumber(records.mostPromptsInSession)} in one session`)
    console.log(`    Avg duration:    ${formatDuration(records.avgDurationSeconds)}`)

    // Projects
    if (projects.uniqueProjects > 0) {
      console.log('')
      console.log('  PROJECTS')
      console.log(`    Unique:          ${projects.uniqueProjects}`)
      console.log(`    Most visited:    ${projects.mostVisitedProject} (${formatNumber(projects.mostVisitedProjectCount)} sessions)`)
    }

    console.log('')
  } finally {
    db.close()
  }
}
