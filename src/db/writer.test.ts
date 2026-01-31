import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BashStatsWriter } from './writer.js'
import { BashStatsDB } from './database.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('BashStatsWriter', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-writer-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should record a session start', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    const session = db.getSession('sess-1')
    expect(session).not.toBeNull()
    expect(session!.project).toBe('project')
  })

  it('should record a prompt', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    writer.recordPrompt('sess-1', 'Fix the bug')
    const prompts = db.getPrompts('sess-1')
    expect(prompts).toHaveLength(1)
    expect(prompts[0].word_count).toBe(3)
    expect(prompts[0].char_count).toBe(11)
  })

  it('should record a tool use', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    writer.recordToolUse('sess-1', 'PostToolUse', 'Bash', { command: 'ls' }, { stdout: 'file.txt' }, 0, '/home/user/project')
    const events = db.getEvents({ session_id: 'sess-1', tool_name: 'Bash' })
    expect(events).toHaveLength(1)
    expect(events[0].success).toBe(1)
  })

  it('should record session end and compute duration', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    writer.recordSessionEnd('sess-1', 'completed')
    const session = db.getSession('sess-1')
    expect(session!.stop_reason).toBe('completed')
    expect(session!.ended_at).not.toBeNull()
  })

  it('should increment daily activity on prompt', () => {
    writer.recordSessionStart('sess-1', '/tmp', 'startup')
    writer.recordPrompt('sess-1', 'hello')
    writer.recordPrompt('sess-1', 'world')
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const activity = db.getDailyActivity(today)
    expect(activity!.prompts).toBe(2)
  })
})
