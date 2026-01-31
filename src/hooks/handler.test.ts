import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseHookEvent, getProjectFromCwd, detectAgent } from './handler.js'

describe('parseHookEvent', () => {
  it('should parse valid JSON', () => {
    const input = JSON.stringify({ session_id: 's1', tool_name: 'Bash', cwd: '/tmp' })
    const result = parseHookEvent(input)
    expect(result).not.toBeNull()
    expect(result!.session_id).toBe('s1')
    expect(result!.tool_name).toBe('Bash')
  })

  it('should return null for invalid JSON', () => {
    const result = parseHookEvent('not json')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = parseHookEvent('')
    expect(result).toBeNull()
  })
})

describe('getProjectFromCwd', () => {
  it('should extract project name from unix path', () => {
    expect(getProjectFromCwd('/home/user/projects/myapp')).toBe('myapp')
  })

  it('should extract project name from windows path', () => {
    expect(getProjectFromCwd('C:\\Users\\Cade\\projects\\stats')).toBe('stats')
  })
})

describe('detectAgent', () => {
  const ENV_KEYS = [
    'GEMINI_SESSION_ID',
    'GEMINI_PROJECT_DIR',
    'GEMINI_CLI',
    'GITHUB_COPILOT_CLI',
    'OPENCODE',
  ]

  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {}
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key]
      } else {
        delete process.env[key]
      }
    }
  })

  it('should return gemini-cli when GEMINI_SESSION_ID is set', () => {
    process.env.GEMINI_SESSION_ID = 'sess-123'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('should return gemini-cli when GEMINI_PROJECT_DIR is set', () => {
    process.env.GEMINI_PROJECT_DIR = '/home/user/project'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('should return gemini-cli when GEMINI_CLI is set', () => {
    process.env.GEMINI_CLI = '1'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('should return copilot-cli when GITHUB_COPILOT_CLI is set', () => {
    process.env.GITHUB_COPILOT_CLI = '1'
    expect(detectAgent()).toBe('copilot-cli')
  })

  it('should return opencode when OPENCODE is set', () => {
    process.env.OPENCODE = '1'
    expect(detectAgent()).toBe('opencode')
  })

  it('should return claude-code when no agent env vars are set', () => {
    expect(detectAgent()).toBe('claude-code')
  })

  it('should prioritize gemini-cli over copilot-cli', () => {
    process.env.GEMINI_SESSION_ID = 'sess-123'
    process.env.GITHUB_COPILOT_CLI = '1'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('should prioritize copilot-cli over opencode', () => {
    process.env.GITHUB_COPILOT_CLI = '1'
    process.env.OPENCODE = '1'
    expect(detectAgent()).toBe('copilot-cli')
  })
})
