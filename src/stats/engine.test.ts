import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StatsEngine } from './engine.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('StatsEngine', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let engine: StatsEngine
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-stats-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    engine = new StatsEngine(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should return zero stats for empty db', () => {
    const stats = engine.getLifetimeStats()
    expect(stats.totalSessions).toBe(0)
    expect(stats.totalPrompts).toBe(0)
    expect(stats.totalToolCalls).toBe(0)
  })

  it('should count sessions and prompts', () => {
    writer.recordSessionStart('s1', '/tmp/project', 'startup')
    writer.recordPrompt('s1', 'hello world')
    writer.recordPrompt('s1', 'fix the bug')
    const stats = engine.getLifetimeStats()
    expect(stats.totalSessions).toBe(1)
    expect(stats.totalPrompts).toBe(2)
  })

  it('should count tool calls by type', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', { command: 'ls' }, {}, 0, '/tmp')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', { command: 'pwd' }, {}, 0, '/tmp')
    writer.recordToolUse('s1', 'PostToolUse', 'Read', { file_path: 'f.ts' }, {}, null, '/tmp')
    const tools = engine.getToolBreakdown()
    expect(tools['Bash']).toBe(2)
    expect(tools['Read']).toBe(1)
  })

  it('should compute streaks from daily activity', () => {
    db.incrementDailyActivity('2026-01-27', { sessions: 1 })
    db.incrementDailyActivity('2026-01-28', { sessions: 1 })
    db.incrementDailyActivity('2026-01-29', { sessions: 1 })
    const time = engine.getTimeStats()
    expect(time.longestStreak).toBeGreaterThanOrEqual(3)
  })

  it('should get project stats', () => {
    writer.recordSessionStart('s1', '/home/user/projectA', 'startup')
    writer.recordSessionStart('s2', '/home/user/projectB', 'startup')
    writer.recordSessionStart('s3', '/home/user/projectA', 'startup')
    const projects = engine.getProjectStats()
    expect(projects.uniqueProjects).toBe(2)
    expect(projects.mostVisitedProject).toBe('projectA')
  })

  it('should get session records', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', {}, {}, 0, '/tmp')
    writer.recordToolUse('s1', 'PostToolUse', 'Read', {}, {}, null, '/tmp')
    writer.recordSessionEnd('s1', 'completed')
    const records = engine.getSessionRecords()
    expect(records.mostToolsInSession).toBeGreaterThanOrEqual(2)
  })

  it('should get all stats combined', () => {
    writer.recordSessionStart('s1', '/tmp/proj', 'startup')
    writer.recordPrompt('s1', 'test')
    const all = engine.getAllStats()
    expect(all.lifetime).toBeDefined()
    expect(all.tools).toBeDefined()
    expect(all.time).toBeDefined()
    expect(all.sessions).toBeDefined()
    expect(all.projects).toBeDefined()
  })
})
