import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AchievementEngine } from './compute.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import { StatsEngine } from '../stats/engine.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('AchievementEngine', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let stats: StatsEngine
  let achievements: AchievementEngine
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-ach-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    stats = new StatsEngine(db)
    achievements = new AchievementEngine(db, stats)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should return all badges with zero progress for empty db', () => {
    const badges = achievements.computeBadges()
    expect(badges.length).toBeGreaterThan(40)
    expect(badges.every(b => b.tier === 0)).toBe(true)
  })

  it('should unlock First Prompt at Bronze after 1 prompt', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    const badges = achievements.computeBadges()
    const firstPrompt = badges.find(b => b.id === 'first_prompt')!
    expect(firstPrompt.tier).toBe(1) // Bronze
    expect(firstPrompt.tierName).toBe('Bronze')
  })

  it('should compute XP from activity', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', {}, {}, 0, '/tmp')
    const xp = achievements.computeXP()
    expect(xp.totalXP).toBeGreaterThan(0)
    expect(xp.rank).toBe('Bronze')
  })

  it('should not show secret badges as unlocked when criteria not met', () => {
    const badges = achievements.computeBadges()
    const secrets = badges.filter(b => b.secret)
    expect(secrets.length).toBe(10)
    expect(secrets.every(b => !b.unlocked)).toBe(true)
  })

  it('should compute full achievements payload', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    const payload = achievements.getAchievementsPayload()
    expect(payload.stats).toBeDefined()
    expect(payload.badges).toBeDefined()
    expect(payload.xp).toBeDefined()
    expect(payload.xp.rank).toBe('Bronze')
  })
})
