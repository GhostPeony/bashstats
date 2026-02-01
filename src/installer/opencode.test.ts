import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getOpenCodePluginContent, installOpenCode, uninstallOpenCode, isOpenCodeAvailable, getOpenCodePluginsDir, getOpenCodePluginPath } from './opencode.js'

const TEST_DB_PATH = '/home/testuser/.bashstats/bashstats.db'

describe('getOpenCodePluginContent', () => {
  let content: string

  beforeEach(() => {
    content = getOpenCodePluginContent(TEST_DB_PATH)
  })

  // --- Structure & exports ---

  it('should return a non-empty string', () => {
    expect(typeof content).toBe('string')
    expect(content.length).toBeGreaterThan(0)
  })

  it('should export a default async function', () => {
    expect(content).toContain('export default async')
  })

  it('should accept { project, directory } parameters', () => {
    expect(content).toMatch(/export default async\s*\(\s*\{.*project.*directory.*\}/)
  })

  it('should return an object with an event handler', () => {
    expect(content).toContain('event: async')
  })

  // --- DB path ---

  it('should embed the provided DB path', () => {
    expect(content).toContain(TEST_DB_PATH)
  })

  it('should use a different path when given a different argument', () => {
    const other = getOpenCodePluginContent('/custom/path.db')
    expect(other).toContain('/custom/path.db')
    expect(other).not.toContain(TEST_DB_PATH)
  })

  // --- better-sqlite3 import ---

  it('should import better-sqlite3 directly', () => {
    expect(content).toContain('import Database from "better-sqlite3"')
  })

  // --- Session ID format ---

  it('should generate an opencode-prefixed session ID', () => {
    expect(content).toContain('`opencode-${Date.now()}`')
  })

  // --- Event handlers ---

  it('should handle session.created event', () => {
    expect(content).toContain('"session.created"')
  })

  it('should handle session.idle event', () => {
    expect(content).toContain('"session.idle"')
  })

  it('should handle session.deleted event', () => {
    expect(content).toContain('"session.deleted"')
  })

  it('should handle tool.execute.before event', () => {
    expect(content).toContain('"tool.execute.before"')
  })

  it('should handle tool.execute.after event', () => {
    expect(content).toContain('"tool.execute.after"')
  })

  it('should handle session.error event', () => {
    expect(content).toContain('"session.error"')
  })

  it('should handle session.compacted event', () => {
    expect(content).toContain('"session.compacted"')
  })

  it('should handle message.updated event', () => {
    expect(content).toContain('"message.updated"')
  })

  it('should check for role=user on message.updated', () => {
    expect(content).toContain('"user"')
    expect(content).toContain('role')
  })

  // --- SQL statements ---

  it('should INSERT INTO sessions on session.created', () => {
    expect(content).toContain('INSERT OR IGNORE INTO sessions')
  })

  it('should UPDATE sessions with ended_at on session end', () => {
    expect(content).toContain('UPDATE sessions SET ended_at')
  })

  it('should include stop_reason in session end update', () => {
    expect(content).toContain('stop_reason')
  })

  it('should include duration_seconds in session end update', () => {
    expect(content).toContain('duration_seconds')
  })

  it('should INSERT INTO events for tool events', () => {
    expect(content).toContain('INSERT INTO events')
  })

  it('should INSERT INTO prompts for user messages', () => {
    expect(content).toContain('INSERT INTO prompts')
  })

  it('should increment session tool_count', () => {
    expect(content).toContain('tool_count = tool_count + 1')
  })

  it('should increment session error_count', () => {
    expect(content).toContain('error_count = error_count + 1')
  })

  it('should increment session prompt_count', () => {
    expect(content).toContain('prompt_count = prompt_count + 1')
  })

  it('should INSERT INTO daily_activity (upsert pattern)', () => {
    expect(content).toContain('INSERT INTO daily_activity')
    expect(content).toContain('ON CONFLICT(date) DO UPDATE SET')
  })

  // --- Hook types for events ---

  it('should use PreToolUse hook type for tool.execute.before', () => {
    expect(content).toContain('"PreToolUse"')
  })

  it('should use PostToolUse hook type for tool.execute.after', () => {
    expect(content).toContain('"PostToolUse"')
  })

  it('should use PostToolUseFailure hook type for session.error', () => {
    expect(content).toContain('"PostToolUseFailure"')
  })

  it('should use PreCompact hook type for session.compacted', () => {
    expect(content).toContain('"PreCompact"')
  })

  // --- Agent identification ---

  it('should use agent=opencode', () => {
    expect(content).toContain('"opencode"')
  })

  // --- DB per-event pattern (withDb helper) ---

  it('should open and close DB per event via a helper', () => {
    expect(content).toContain('withDb')
    expect(content).toContain('db?.close()')
  })

  // --- WAL mode and busy timeout ---

  it('should set WAL journal mode', () => {
    expect(content).toContain('journal_mode = WAL')
  })

  it('should set busy_timeout', () => {
    expect(content).toContain('busy_timeout = 5000')
  })

  // --- Prompt metrics ---

  it('should compute char_count for prompts', () => {
    expect(content).toContain('charCount')
    expect(content).toContain('char_count')
  })

  it('should compute word_count for prompts', () => {
    expect(content).toContain('wordCount')
    expect(content).toContain('word_count')
  })

  // --- Daily activity increments ---

  it('should increment daily sessions', () => {
    expect(content).toContain('sessions: 1')
  })

  it('should increment daily tool_calls', () => {
    expect(content).toContain('tool_calls: 1')
  })

  it('should increment daily errors', () => {
    expect(content).toContain('errors: 1')
  })

  it('should increment daily prompts', () => {
    expect(content).toContain('prompts: 1')
  })

  it('should increment daily duration_seconds on session end', () => {
    expect(content).toContain('duration_seconds: durationSeconds')
  })

  // --- Syntax check (no obvious syntax errors) ---

  it('should not contain unbalanced template literals', () => {
    // Rough check: count backticks (should be even since they come in pairs)
    const backticks = (content.match(/`/g) || []).length
    expect(backticks % 2).toBe(0)
  })
})

describe('installOpenCode / uninstallOpenCode', () => {
  let tempDir: string
  let origHome: () => string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bashstats-opencode-test-'))
    origHome = os.homedir
    // Override os.homedir for test isolation
    ;(os as any).homedir = () => tempDir
  })

  afterEach(() => {
    ;(os as any).homedir = origHome
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should install plugin file to plugins directory', () => {
    // Create the opencode config dir so it looks installed
    fs.mkdirSync(path.join(tempDir, '.config', 'opencode'), { recursive: true })

    const result = installOpenCode()
    expect(result.success).toBe(true)

    const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'bashstats.ts')
    expect(fs.existsSync(pluginPath)).toBe(true)

    const content = fs.readFileSync(pluginPath, 'utf-8')
    expect(content).toContain('export default async')
    expect(content).toContain('better-sqlite3')
  })

  it('should create plugins directory if it does not exist', () => {
    const result = installOpenCode()
    expect(result.success).toBe(true)

    const pluginsDir = path.join(tempDir, '.config', 'opencode', 'plugins')
    expect(fs.existsSync(pluginsDir)).toBe(true)
  })

  it('should create data directory', () => {
    installOpenCode()
    const dataDir = path.join(tempDir, '.bashstats')
    expect(fs.existsSync(dataDir)).toBe(true)
  })

  it('should embed correct DB path', () => {
    installOpenCode()
    const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'bashstats.ts')
    const content = fs.readFileSync(pluginPath, 'utf-8')
    const expectedDbPath = path.join(tempDir, '.bashstats', 'bashstats.db')
    // JSON.stringify escapes backslashes on Windows, so check the serialized form
    const serialized = JSON.stringify(expectedDbPath)
    // serialized is e.g. "\"C:\\\\Users\\\\...\"", strip outer quotes
    const embeddedPath = serialized.slice(1, -1)
    expect(content).toContain(embeddedPath)
  })

  it('should uninstall by deleting the plugin file', () => {
    installOpenCode()
    const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'bashstats.ts')
    expect(fs.existsSync(pluginPath)).toBe(true)

    const result = uninstallOpenCode()
    expect(result.success).toBe(true)
    expect(fs.existsSync(pluginPath)).toBe(false)
  })

  it('should succeed when uninstalling with no plugin file', () => {
    const result = uninstallOpenCode()
    expect(result.success).toBe(true)
    expect(result.message).toContain('nothing to uninstall')
  })

  it('should be idempotent on re-install', () => {
    installOpenCode()
    const result = installOpenCode()
    expect(result.success).toBe(true)

    const pluginPath = path.join(tempDir, '.config', 'opencode', 'plugins', 'bashstats.ts')
    expect(fs.existsSync(pluginPath)).toBe(true)
  })
})

describe('isOpenCodeAvailable', () => {
  let tempDir: string
  let origHome: () => string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bashstats-opencode-avail-'))
    origHome = os.homedir
    ;(os as any).homedir = () => tempDir
  })

  afterEach(() => {
    ;(os as any).homedir = origHome
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('should return false when opencode directory does not exist', () => {
    expect(isOpenCodeAvailable()).toBe(false)
  })

  it('should return true when opencode directory exists', () => {
    fs.mkdirSync(path.join(tempDir, '.config', 'opencode'), { recursive: true })
    expect(isOpenCodeAvailable()).toBe(true)
  })
})

describe('getOpenCodePluginsDir / getOpenCodePluginPath', () => {
  it('should return path under ~/.config/opencode/plugins/', () => {
    const dir = getOpenCodePluginsDir()
    expect(dir).toContain('.config')
    expect(dir).toContain('opencode')
    expect(dir).toContain('plugins')
  })

  it('should return bashstats.ts as plugin filename', () => {
    const p = getOpenCodePluginPath()
    expect(path.basename(p)).toBe('bashstats.ts')
  })

  it('should have plugin path inside plugins dir', () => {
    const dir = getOpenCodePluginsDir()
    const p = getOpenCodePluginPath()
    expect(p.startsWith(dir)).toBe(true)
  })
})
