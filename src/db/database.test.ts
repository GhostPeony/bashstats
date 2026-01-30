import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BashStatsDB } from './database.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('BashStatsDB', () => {
  let db: BashStatsDB
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should create database with all tables', () => {
    const tables = db.getTableNames()
    expect(tables).toContain('events')
    expect(tables).toContain('sessions')
    expect(tables).toContain('prompts')
    expect(tables).toContain('daily_activity')
    expect(tables).toContain('achievement_unlocks')
    expect(tables).toContain('metadata')
  })

  it('should insert and query events', () => {
    db.insertEvent({
      session_id: 'test-session',
      hook_type: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: '{"command":"ls"}',
      tool_output: '{"stdout":"file.txt"}',
      exit_code: 0,
      success: 1,
      cwd: '/tmp',
      project: 'test-project',
      timestamp: new Date().toISOString(),
    })
    const events = db.getEvents({ session_id: 'test-session' })
    expect(events).toHaveLength(1)
    expect(events[0].tool_name).toBe('Bash')
  })

  it('should insert and query sessions', () => {
    db.insertSession({
      id: 'sess-1',
      started_at: new Date().toISOString(),
      project: 'myproject',
    })
    const session = db.getSession('sess-1')
    expect(session).not.toBeNull()
    expect(session!.project).toBe('myproject')
  })

  it('should insert and query prompts', () => {
    db.insertSession({ id: 'sess-1', started_at: new Date().toISOString() })
    db.insertPrompt({
      session_id: 'sess-1',
      content: 'Fix the bug in auth',
      char_count: 19,
      word_count: 5,
      timestamp: new Date().toISOString(),
    })
    const prompts = db.getPrompts('sess-1')
    expect(prompts).toHaveLength(1)
    expect(prompts[0].content).toBe('Fix the bug in auth')
  })

  it('should upsert daily activity', () => {
    const today = new Date().toISOString().slice(0, 10)
    db.incrementDailyActivity(today, { prompts: 1 })
    db.incrementDailyActivity(today, { prompts: 1, tool_calls: 3 })
    const row = db.getDailyActivity(today)
    expect(row!.prompts).toBe(2)
    expect(row!.tool_calls).toBe(3)
  })

  it('should get and set metadata', () => {
    db.setMetadata('first_run', '2026-01-29')
    expect(db.getMetadata('first_run')).toBe('2026-01-29')
  })
})
