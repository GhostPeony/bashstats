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

  describe('agent filter', () => {
    beforeEach(() => {
      // Create sessions with different agents
      writer.recordSessionStart('s1', '/proj', 'startup', 'claude-code')
      writer.recordPrompt('s1', 'hello claude')
      writer.recordToolUse('s1', 'PostToolUse', 'Bash', { command: 'ls' }, {}, 0, '/proj')
      writer.recordSessionEnd('s1', 'stopped')

      writer.recordSessionStart('s2', '/proj', 'startup', 'gemini-cli')
      writer.recordPrompt('s2', 'hello gemini')
      writer.recordPrompt('s2', 'second prompt')
      writer.recordToolUse('s2', 'PostToolUse', 'Read', { file_path: 'f.ts' }, {}, null, '/proj')
      writer.recordToolUse('s2', 'PostToolUse', 'Read', { file_path: 'g.ts' }, {}, null, '/proj')
      writer.recordSessionEnd('s2', 'stopped')
    })

    it('getLifetimeStats() with no filter returns all sessions', () => {
      const stats = engine.getLifetimeStats()
      expect(stats.totalSessions).toBe(2)
      expect(stats.totalPrompts).toBe(3)
      expect(stats.totalToolCalls).toBe(3)
    })

    it('getLifetimeStats("claude-code") returns only claude-code sessions', () => {
      const stats = engine.getLifetimeStats('claude-code')
      expect(stats.totalSessions).toBe(1)
      expect(stats.totalPrompts).toBe(1)
      expect(stats.totalToolCalls).toBe(1)
      expect(stats.totalBashCommands).toBe(1)
      expect(stats.totalFilesRead).toBe(0)
    })

    it('getLifetimeStats("gemini-cli") returns only gemini-cli sessions', () => {
      const stats = engine.getLifetimeStats('gemini-cli')
      expect(stats.totalSessions).toBe(1)
      expect(stats.totalPrompts).toBe(2)
      expect(stats.totalToolCalls).toBe(2)
      expect(stats.totalBashCommands).toBe(0)
      expect(stats.totalFilesRead).toBe(2)
    })

    it('getLifetimeStats("copilot-cli") returns 0 for agent with no sessions', () => {
      const stats = engine.getLifetimeStats('copilot-cli')
      expect(stats.totalSessions).toBe(0)
      expect(stats.totalPrompts).toBe(0)
      expect(stats.totalToolCalls).toBe(0)
      expect(stats.totalDurationSeconds).toBe(0)
    })

    it('getToolBreakdown() filters by agent', () => {
      const claudeTools = engine.getToolBreakdown('claude-code')
      expect(claudeTools['Bash']).toBe(1)
      expect(claudeTools['Read']).toBeUndefined()

      const geminiTools = engine.getToolBreakdown('gemini-cli')
      expect(geminiTools['Read']).toBe(2)
      expect(geminiTools['Bash']).toBeUndefined()
    })

    it('getSessionRecords() filters by agent', () => {
      const claudeRecords = engine.getSessionRecords('claude-code')
      expect(claudeRecords.mostToolsInSession).toBe(1)

      const geminiRecords = engine.getSessionRecords('gemini-cli')
      expect(geminiRecords.mostPromptsInSession).toBe(2)
    })

    it('getProjectStats() filters by agent', () => {
      const claudeProjects = engine.getProjectStats('claude-code')
      expect(claudeProjects.uniqueProjects).toBe(1)

      const copilotProjects = engine.getProjectStats('copilot-cli')
      expect(copilotProjects.uniqueProjects).toBe(0)
    })

    it('getAllStats() passes agent through to all sub-methods', () => {
      const all = engine.getAllStats('claude-code')
      expect(all.lifetime.totalSessions).toBe(1)
      expect(all.lifetime.totalPrompts).toBe(1)
      expect(all.tools['Bash']).toBe(1)
      expect(all.tools['Read']).toBeUndefined()
    })
  })

  describe('getAgentBreakdown', () => {
    it('returns correct favoriteAgent, sessionsPerAgent, distinctAgents', () => {
      writer.recordSessionStart('s1', '/proj', 'startup', 'claude-code')
      writer.recordSessionEnd('s1', 'stopped')
      writer.recordSessionStart('s2', '/proj', 'startup', 'claude-code')
      writer.recordSessionEnd('s2', 'stopped')
      writer.recordSessionStart('s3', '/proj', 'startup', 'gemini-cli')
      writer.recordSessionEnd('s3', 'stopped')

      const breakdown = engine.getAgentBreakdown()
      expect(breakdown.favoriteAgent).toBe('claude-code')
      expect(breakdown.sessionsPerAgent['claude-code']).toBe(2)
      expect(breakdown.sessionsPerAgent['gemini-cli']).toBe(1)
      expect(breakdown.distinctAgents).toBe(2)
    })

    it('returns "unknown" when no sessions exist', () => {
      const breakdown = engine.getAgentBreakdown()
      expect(breakdown.favoriteAgent).toBe('unknown')
      expect(breakdown.distinctAgents).toBe(0)
    })

    it('computes hoursPerAgent from duration_seconds', () => {
      writer.recordSessionStart('s1', '/proj', 'startup', 'claude-code')
      writer.recordSessionEnd('s1', 'stopped')
      // Manually set duration for predictable test
      db.prepare('UPDATE sessions SET duration_seconds = 7200 WHERE id = ?').run('s1')

      const breakdown = engine.getAgentBreakdown()
      expect(breakdown.hoursPerAgent['claude-code']).toBe(2)
    })
  })
})
