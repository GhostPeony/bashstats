import os from 'os'
import path from 'path'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { AchievementEngine } from '../achievements/compute.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

export function runExport(): void {
  const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)
  let db: BashStatsDB
  try {
    db = new BashStatsDB(dbPath)
  } catch {
    console.error('No data found. Run "bashstats init" first.')
    process.exit(1)
  }

  const stats = new StatsEngine(db)
  const achievements = new AchievementEngine(db, stats)

  try {
    const payload = {
      exported_at: new Date().toISOString(),
      stats: stats.getAllStats(),
      achievements: achievements.getAchievementsPayload(),
      daily_activity: db.getAllDailyActivity(),
    }
    console.log(JSON.stringify(payload, null, 2))
  } finally {
    db.close()
  }
}
