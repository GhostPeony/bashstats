import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { AchievementEngine } from '../achievements/compute.js'
import type { ProfileSnapshot } from '../types.js'

export function buildSnapshot(db: BashStatsDB): ProfileSnapshot {
  const stats = new StatsEngine(db)
  const achievements = new AchievementEngine(db, stats)

  const sessions = db
    .prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100')
    .all() as ProfileSnapshot['sessions']

  return {
    uploaded_at: new Date().toISOString(),
    stats: stats.getAllStats(),
    achievements: achievements.getAchievementsPayload(),
    activity: db.getAllDailyActivity(365),
    sessions,
    weeklyGoals: stats.getWeeklyGoalsPayload(),
    agents: stats.getAgentBreakdown(),
  }
}
