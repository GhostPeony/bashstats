import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeCopilotEvent, parseToolArgs } from './copilot.js'

describe('parseToolArgs', () => {
  it('should parse valid JSON string into an object', () => {
    expect(parseToolArgs('{"command":"ls -la"}')).toEqual({ command: 'ls -la' })
  })

  it('should return {} for invalid JSON', () => {
    expect(parseToolArgs('not json')).toEqual({})
  })

  it('should return {} for empty string', () => {
    expect(parseToolArgs('')).toEqual({})
  })

  it('should return {} for undefined', () => {
    expect(parseToolArgs(undefined as unknown as string)).toEqual({})
  })

  it('should return {} for null', () => {
    expect(parseToolArgs(null as unknown as string)).toEqual({})
  })

  it('should handle JSON arrays by returning them as-is', () => {
    expect(parseToolArgs('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('should handle nested JSON objects', () => {
    const input = '{"file":{"path":"/tmp/test.ts","content":"hello"}}'
    expect(parseToolArgs(input)).toEqual({ file: { path: '/tmp/test.ts', content: 'hello' } })
  })
})

describe('normalizeCopilotEvent', () => {
  const mockDate = '2026-01-31'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-31T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- sessionStart -> SessionStart ---

  it('should map sessionStart with source "new" to SessionStart with source "startup"', () => {
    const raw = { source: 'new', model: 'gpt-4o' }
    const result = normalizeCopilotEvent('sessionStart', raw)
    expect(result).toEqual({
      hookType: 'SessionStart',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        source: 'startup',
        model: 'gpt-4o',
      },
    })
  })

  it('should map sessionStart with source "resume" to SessionStart with source "resume"', () => {
    const raw = { source: 'resume', model: 'gpt-4o' }
    const result = normalizeCopilotEvent('sessionStart', raw)
    expect(result).toEqual({
      hookType: 'SessionStart',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        source: 'resume',
        model: 'gpt-4o',
      },
    })
  })

  it('should default sessionStart source to "startup" for unknown source values', () => {
    const raw = { source: 'unknown-source', model: 'gpt-4o' }
    const result = normalizeCopilotEvent('sessionStart', raw)
    expect(result!.payload.source).toBe('startup')
  })

  it('should default sessionStart source to "startup" when source is missing', () => {
    const raw = { model: 'gpt-4o' }
    const result = normalizeCopilotEvent('sessionStart', raw)
    expect(result!.payload.source).toBe('startup')
  })

  it('should derive session_id from process.ppid and date', () => {
    const raw = { source: 'new' }
    const result = normalizeCopilotEvent('sessionStart', raw)
    expect(result!.payload.session_id).toBe(`copilot-${process.ppid}-${mockDate}`)
  })

  // --- sessionEnd -> Stop ---

  it('should map sessionEnd to Stop with stop_hook_active: false', () => {
    const raw = { reason: 'user_exit' }
    const result = normalizeCopilotEvent('sessionEnd', raw)
    expect(result).toEqual({
      hookType: 'Stop',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        reason: 'user_exit',
        stop_hook_active: false,
      },
    })
  })

  // --- userPromptSubmitted -> UserPromptSubmit ---

  it('should map userPromptSubmitted to UserPromptSubmit', () => {
    const raw = { prompt: 'fix the bug' }
    const result = normalizeCopilotEvent('userPromptSubmitted', raw)
    expect(result).toEqual({
      hookType: 'UserPromptSubmit',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        prompt: 'fix the bug',
      },
    })
  })

  // --- preToolUse -> PreToolUse ---

  it('should map preToolUse to PreToolUse with parsed toolArgs', () => {
    const raw = {
      toolName: 'Bash',
      toolArgs: '{"command":"ls -la"}',
    }
    const result = normalizeCopilotEvent('preToolUse', raw)
    expect(result).toEqual({
      hookType: 'PreToolUse',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        tool_name: 'Bash',
        tool_input: { command: 'ls -la' },
      },
    })
  })

  it('should handle preToolUse with malformed toolArgs gracefully', () => {
    const raw = {
      toolName: 'Bash',
      toolArgs: 'not-valid-json',
    }
    const result = normalizeCopilotEvent('preToolUse', raw)
    expect(result!.payload.tool_input).toEqual({})
  })

  it('should handle preToolUse with missing toolArgs', () => {
    const raw = {
      toolName: 'Read',
    }
    const result = normalizeCopilotEvent('preToolUse', raw)
    expect(result!.payload.tool_input).toEqual({})
  })

  // --- postToolUse (success) -> PostToolUse ---

  it('should map postToolUse with successful result to PostToolUse', () => {
    const raw = {
      toolName: 'Read',
      toolArgs: '{"file_path":"/tmp/test.ts"}',
      toolResult: {
        resultType: 'success',
        output: 'file contents here',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', raw)
    expect(result).toEqual({
      hookType: 'PostToolUse',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        tool_name: 'Read',
        tool_input: { file_path: '/tmp/test.ts' },
        tool_response: { resultType: 'success', output: 'file contents here' },
        exit_code: 0,
      },
    })
  })

  it('should map postToolUse with no resultType to PostToolUse (success)', () => {
    const raw = {
      toolName: 'Read',
      toolArgs: '{"file_path":"/tmp/test.ts"}',
      toolResult: {
        output: 'file contents here',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', raw)
    expect(result!.hookType).toBe('PostToolUse')
    expect(result!.payload.exit_code).toBe(0)
  })

  // --- postToolUse (failure) -> PostToolUseFailure ---

  it('should map postToolUse with resultType "failure" to PostToolUseFailure', () => {
    const raw = {
      toolName: 'Bash',
      toolArgs: '{"command":"exit 1"}',
      toolResult: {
        resultType: 'failure',
        error: 'command failed',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', raw)
    expect(result).toEqual({
      hookType: 'PostToolUseFailure',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        tool_name: 'Bash',
        tool_input: { command: 'exit 1' },
        tool_response: { resultType: 'failure', error: 'command failed' },
        exit_code: 1,
      },
    })
  })

  it('should map postToolUse with resultType "denied" to PostToolUseFailure', () => {
    const raw = {
      toolName: 'Bash',
      toolArgs: '{"command":"rm -rf /"}',
      toolResult: {
        resultType: 'denied',
        reason: 'permission denied',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', raw)
    expect(result!.hookType).toBe('PostToolUseFailure')
    expect(result!.payload.exit_code).toBe(1)
  })

  it('should handle postToolUse with missing toolResult', () => {
    const raw = {
      toolName: 'Bash',
      toolArgs: '{"command":"ls"}',
    }
    const result = normalizeCopilotEvent('postToolUse', raw)
    expect(result!.hookType).toBe('PostToolUse')
    expect(result!.payload.tool_response).toEqual({})
    expect(result!.payload.exit_code).toBe(0)
  })

  // --- errorOccurred -> PostToolUseFailure ---

  it('should map errorOccurred to PostToolUseFailure with tool_name="_error"', () => {
    const raw = {
      error: {
        message: 'Something went wrong',
        name: 'RuntimeError',
      },
    }
    const result = normalizeCopilotEvent('errorOccurred', raw)
    expect(result).toEqual({
      hookType: 'PostToolUseFailure',
      payload: {
        session_id: `copilot-${process.ppid}-${mockDate}`,
        tool_name: '_error',
        tool_input: {},
        tool_response: {
          error_message: 'Something went wrong',
          error_name: 'RuntimeError',
        },
        exit_code: 1,
      },
    })
  })

  it('should handle errorOccurred with missing error fields', () => {
    const raw = { error: {} }
    const result = normalizeCopilotEvent('errorOccurred', raw)
    expect(result!.payload.tool_response).toEqual({
      error_message: '',
      error_name: '',
    })
  })

  it('should handle errorOccurred with no error object', () => {
    const raw = {}
    const result = normalizeCopilotEvent('errorOccurred', raw)
    expect(result!.payload.tool_name).toBe('_error')
    expect(result!.payload.tool_response).toEqual({
      error_message: '',
      error_name: '',
    })
  })

  // --- Unknown events -> null ---

  it('should return null for unknown event names', () => {
    expect(normalizeCopilotEvent('unknownEvent', {})).toBeNull()
  })

  it('should return null for empty event name', () => {
    expect(normalizeCopilotEvent('', {})).toBeNull()
  })

  it('should return null for SomeFutureEvent', () => {
    expect(normalizeCopilotEvent('SomeFutureEvent', {})).toBeNull()
  })

  // --- Session ID derivation ---

  it('should generate consistent session_id across different events in the same process', () => {
    const start = normalizeCopilotEvent('sessionStart', { source: 'new' })
    const prompt = normalizeCopilotEvent('userPromptSubmitted', { prompt: 'hello' })
    const end = normalizeCopilotEvent('sessionEnd', {})
    expect(start!.payload.session_id).toBe(prompt!.payload.session_id)
    expect(prompt!.payload.session_id).toBe(end!.payload.session_id)
  })
})
