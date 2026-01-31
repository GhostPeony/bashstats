import { describe, it, expect } from 'vitest'
import { normalizeGeminiEvent } from './gemini.js'

describe('normalizeGeminiEvent', () => {
  // --- SessionStart -> SessionStart (pass-through) ---

  it('should pass SessionStart through unchanged', () => {
    const raw = { session_id: 's1', cwd: '/home/user/project', source: 'startup', model: 'gemini-2.5-pro' }
    const result = normalizeGeminiEvent('SessionStart', raw)
    expect(result).toEqual({
      hookType: 'SessionStart',
      payload: raw,
    })
  })

  // --- SessionEnd -> Stop ---

  it('should map SessionEnd to Stop with stop_hook_active: false', () => {
    const raw = { session_id: 's1', reason: 'user_exit' }
    const result = normalizeGeminiEvent('SessionEnd', raw)
    expect(result).toEqual({
      hookType: 'Stop',
      payload: { session_id: 's1', reason: 'user_exit', stop_hook_active: false },
    })
  })

  it('should not clobber existing fields on SessionEnd', () => {
    const raw = { session_id: 's2', reason: 'timeout', cwd: '/tmp' }
    const result = normalizeGeminiEvent('SessionEnd', raw)
    expect(result!.payload.session_id).toBe('s2')
    expect(result!.payload.cwd).toBe('/tmp')
    expect(result!.payload.stop_hook_active).toBe(false)
  })

  // --- BeforeAgent -> UserPromptSubmit ---

  it('should map BeforeAgent to UserPromptSubmit', () => {
    const raw = { session_id: 's1', prompt: 'fix the bug' }
    const result = normalizeGeminiEvent('BeforeAgent', raw)
    expect(result).toEqual({
      hookType: 'UserPromptSubmit',
      payload: raw,
    })
  })

  // --- BeforeTool -> PreToolUse ---

  it('should map BeforeTool to PreToolUse', () => {
    const raw = { session_id: 's1', tool_name: 'Bash', tool_input: { command: 'ls' } }
    const result = normalizeGeminiEvent('BeforeTool', raw)
    expect(result).toEqual({
      hookType: 'PreToolUse',
      payload: raw,
    })
  })

  // --- AfterTool -> PostToolUse ---

  it('should map AfterTool to PostToolUse', () => {
    const raw = {
      session_id: 's1',
      tool_name: 'Read',
      tool_input: { file_path: '/tmp/test.ts' },
      tool_response: { content: 'hello' },
    }
    const result = normalizeGeminiEvent('AfterTool', raw)
    expect(result).toEqual({
      hookType: 'PostToolUse',
      payload: raw,
    })
  })

  // --- AfterModel (with token data) ---

  it('should map AfterModel and extract totalTokenCount from usageMetadata', () => {
    const raw = {
      session_id: 's1',
      llm_response: {
        text: 'some response',
        usageMetadata: { totalTokenCount: 1234, promptTokenCount: 800, candidatesTokenCount: 434 },
      },
    }
    const result = normalizeGeminiEvent('AfterModel', raw)
    expect(result).toEqual({
      hookType: 'AfterModel',
      payload: raw,
      tokenData: { totalTokenCount: 1234 },
    })
  })

  it('should map AfterModel without tokenData when usageMetadata is missing', () => {
    const raw = { session_id: 's1', llm_response: { text: 'hello' } }
    const result = normalizeGeminiEvent('AfterModel', raw)
    expect(result).toEqual({
      hookType: 'AfterModel',
      payload: raw,
    })
    expect(result!.tokenData).toBeUndefined()
  })

  it('should map AfterModel without tokenData when llm_response is missing', () => {
    const raw = { session_id: 's1' }
    const result = normalizeGeminiEvent('AfterModel', raw)
    expect(result).toEqual({
      hookType: 'AfterModel',
      payload: raw,
    })
    expect(result!.tokenData).toBeUndefined()
  })

  it('should map AfterModel without tokenData when totalTokenCount is not a number', () => {
    const raw = {
      session_id: 's1',
      llm_response: { usageMetadata: { totalTokenCount: 'not-a-number' } },
    }
    const result = normalizeGeminiEvent('AfterModel', raw)
    expect(result).toEqual({
      hookType: 'AfterModel',
      payload: raw,
    })
    expect(result!.tokenData).toBeUndefined()
  })

  // --- PreCompress -> PreCompact ---

  it('should map PreCompress to PreCompact', () => {
    const raw = { session_id: 's1', trigger: 'auto' }
    const result = normalizeGeminiEvent('PreCompress', raw)
    expect(result).toEqual({
      hookType: 'PreCompact',
      payload: raw,
    })
  })

  // --- Notification -> Notification (pass-through) ---

  it('should pass Notification through unchanged', () => {
    const raw = { session_id: 's1', message: 'Rate limited', notification_type: 'warning' }
    const result = normalizeGeminiEvent('Notification', raw)
    expect(result).toEqual({
      hookType: 'Notification',
      payload: raw,
    })
  })

  // --- Unknown events -> null ---

  it('should return null for BeforeModel', () => {
    expect(normalizeGeminiEvent('BeforeModel', { session_id: 's1' })).toBeNull()
  })

  it('should return null for BeforeToolSelection', () => {
    expect(normalizeGeminiEvent('BeforeToolSelection', { session_id: 's1' })).toBeNull()
  })

  it('should return null for a completely unknown event', () => {
    expect(normalizeGeminiEvent('SomeFutureEvent', {})).toBeNull()
  })
})
