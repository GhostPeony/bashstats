import os from 'os'
import path from 'path'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

export function runStreak(): void {
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
    const time = engine.getTimeStats()
    const daily = db.getAllDailyActivity(30)

    console.log('')
    console.log('  bashstats - Streak')
    console.log(`  Current streak:  ${time.currentStreak} days`)
    console.log(`  Longest streak:  ${time.longestStreak} days`)
    console.log('')

    // Last 30 days calendar
    if (daily.length > 0) {
      console.log('  Last 30 days:')
      const dates = new Set(daily.map(d => d.date))
      const today = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      let line = '  '
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        line += dates.has(dateStr) ? '#' : '.'
      }
      console.log(line)
    }
    console.log('')
  } finally {
    db.close()
  }
}
