import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { AchievementEngine } from '../achievements/compute.js'
import { DEFAULT_PORT } from '../constants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createApp(db: BashStatsDB): express.Express {
  const app = express()
  const stats = new StatsEngine(db)
  const achievements = new AchievementEngine(db, stats)

  // Serve static files
  app.use(express.static(path.join(__dirname, 'static')))

  // API endpoints
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' })
  })

  app.get('/api/stats', (_req, res) => {
    try {
      res.json(stats.getAllStats())
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' })
    }
  })

  app.get('/api/achievements', (_req, res) => {
    try {
      res.json(achievements.getAchievementsPayload())
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch achievements' })
    }
  })

  app.get('/api/activity', (_req, res) => {
    try {
      const days = parseInt((_req.query.days as string) || '365')
      res.json(db.getAllDailyActivity(days))
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch activity' })
    }
  })

  app.get('/api/sessions', (_req, res) => {
    try {
      const sessions = db.prepare('SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100').all()
      res.json(sessions)
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch sessions' })
    }
  })

  // Fallback to index.html for SPA
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'index.html'))
  })

  return app
}

export function startServer(db: BashStatsDB, port: number = DEFAULT_PORT): void {
  const app = createApp(db)
  app.listen(port, '127.0.0.1', () => {
    console.log(`bashstats dashboard running at http://127.0.0.1:${port}`)
  })
}
