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
    expect(xp.rankTier).toBe('Bronze')
    expect(xp.rankNumber).toBeGreaterThanOrEqual(0)
  })

  it('should not show secret badges as unlocked when criteria not met', () => {
    const badges = achievements.computeBadges()
    const secrets = badges.filter(b => b.secret)
    expect(secrets.length).toBe(17)
    expect(secrets.every(b => !b.unlocked)).toBe(true)
  })

  it('should compute full achievements payload', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    const payload = achievements.getAchievementsPayload()
    expect(payload.stats).toBeDefined()
    expect(payload.badges).toBeDefined()
    expect(payload.xp).toBeDefined()
    expect(payload.xp.rankTier).toBe('Bronze')
  })

  // =========================================================
  // Cross-agent badge tests
  // =========================================================

  it('should compute distinctAgentsUsed for polyglot_agent badge', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup', 'claude-code')
    writer.recordSessionStart('s2', '/tmp', 'startup', 'gemini-cli')
    const badges = achievements.computeBadges()
    const polyglot = badges.find(b => b.id === 'polyglot_agent')!
    expect(polyglot).toBeDefined()
    expect(polyglot.value).toBe(2)
    expect(polyglot.tier).toBe(1) // Bronze: threshold is 2
  })

  it('should count gemini sessions for gemini_whisperer badge', () => {
    for (let i = 0; i < 10; i++) {
      writer.recordSessionStart(`g${i}`, '/tmp', 'startup', 'gemini-cli')
    }
    const badges = achievements.computeBadges()
    const gemini = badges.find(b => b.id === 'gemini_whisperer')!
    expect(gemini).toBeDefined()
    expect(gemini.value).toBe(10)
    expect(gemini.tier).toBe(1) // Bronze: threshold is 10
  })

  it('should count copilot sessions for copilot_rider badge', () => {
    for (let i = 0; i < 10; i++) {
      writer.recordSessionStart(`c${i}`, '/tmp', 'startup', 'copilot-cli')
    }
    const badges = achievements.computeBadges()
    const copilot = badges.find(b => b.id === 'copilot_rider')!
    expect(copilot).toBeDefined()
    expect(copilot.value).toBe(10)
    expect(copilot.tier).toBe(1) // Bronze: threshold is 10
  })

  it('should count opencode sessions for open_source_spirit badge', () => {
    for (let i = 0; i < 10; i++) {
      writer.recordSessionStart(`o${i}`, '/tmp', 'startup', 'opencode')
    }
    const badges = achievements.computeBadges()
    const opencode = badges.find(b => b.id === 'open_source_spirit')!
    expect(opencode).toBeDefined()
    expect(opencode.value).toBe(10)
    expect(opencode.tier).toBe(1) // Bronze: threshold is 10
  })

  it('should compute doubleAgentDays and agentSwitchDays for double_agent and agent_hopper badges', () => {
    // Create sessions from two different agents on the same day using raw INSERT
    // to control the started_at timestamps precisely
    const stmt = db.prepare('INSERT INTO sessions (id, agent, started_at, project) VALUES (?, ?, ?, ?)')
    stmt.run('da1', 'claude-code', '2025-06-15T10:00:00Z', null)
    stmt.run('da2', 'gemini-cli', '2025-06-15T14:00:00Z', null)
    stmt.run('da3', 'claude-code', '2025-06-16T10:00:00Z', null)
    stmt.run('da4', 'copilot-cli', '2025-06-16T14:00:00Z', null)
    stmt.run('da5', 'claude-code', '2025-06-17T10:00:00Z', null)
    stmt.run('da6', 'opencode', '2025-06-17T14:00:00Z', null)
    stmt.run('da7', 'claude-code', '2025-06-18T10:00:00Z', null)
    stmt.run('da8', 'gemini-cli', '2025-06-18T14:00:00Z', null)
    stmt.run('da9', 'claude-code', '2025-06-19T10:00:00Z', null)
    stmt.run('da10', 'copilot-cli', '2025-06-19T14:00:00Z', null)

    const badges = achievements.computeBadges()
    const doubleAgent = badges.find(b => b.id === 'double_agent')!
    const agentHopper = badges.find(b => b.id === 'agent_hopper')!

    expect(doubleAgent).toBeDefined()
    expect(doubleAgent.value).toBe(5)
    expect(doubleAgent.tier).toBe(1) // Bronze: threshold is 5

    expect(agentHopper).toBeDefined()
    expect(agentHopper.value).toBe(5) // same as doubleAgentDays
    expect(agentHopper.tier).toBe(2) // Silver: tiers are [2, 4, 6, 8, 10], value 5 >= 4 but < 6
  })

  it('should include all 6 new cross-agent badge IDs in computeBadges output', () => {
    const badges = achievements.computeBadges()
    const newBadgeIds = [
      'polyglot_agent',
      'gemini_whisperer',
      'copilot_rider',
      'open_source_spirit',
      'agent_hopper',
      'double_agent',
    ]
    for (const id of newBadgeIds) {
      expect(badges.find(b => b.id === id), `Badge ${id} should exist`).toBeDefined()
    }
  })
})
