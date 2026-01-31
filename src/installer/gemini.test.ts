import { describe, it, expect } from 'vitest'
import { mergeGeminiHooks, GEMINI_HOOK_SCRIPTS } from './gemini.js'

describe('GEMINI_HOOK_SCRIPTS', () => {
  it('should define all 8 Gemini hook events', () => {
    expect(Object.keys(GEMINI_HOOK_SCRIPTS)).toHaveLength(8)
    expect(GEMINI_HOOK_SCRIPTS.SessionStart).toBe('session-start.js')
    expect(GEMINI_HOOK_SCRIPTS.SessionEnd).toBe('stop.js')
    expect(GEMINI_HOOK_SCRIPTS.BeforeAgent).toBe('user-prompt-submit.js')
    expect(GEMINI_HOOK_SCRIPTS.BeforeTool).toBe('pre-tool-use.js')
    expect(GEMINI_HOOK_SCRIPTS.AfterTool).toBe('post-tool-use.js')
    expect(GEMINI_HOOK_SCRIPTS.AfterModel).toBe('stop.js')
    expect(GEMINI_HOOK_SCRIPTS.PreCompress).toBe('pre-compact.js')
    expect(GEMINI_HOOK_SCRIPTS.Notification).toBe('notification.js')
  })
})

describe('mergeGeminiHooks', () => {
  it('should add hooks to empty settings', () => {
    const settings: Record<string, unknown> = {}
    const result = mergeGeminiHooks(settings, '/path/to/hooks')
    const hooks = (result as any).hooks

    expect(hooks).toBeDefined()
    expect(hooks.SessionStart).toHaveLength(1)
    expect(hooks.SessionEnd).toHaveLength(1)
    expect(hooks.BeforeAgent).toHaveLength(1)
    expect(hooks.BeforeTool).toHaveLength(1)
    expect(hooks.AfterTool).toHaveLength(1)
    expect(hooks.AfterModel).toHaveLength(1)
    expect(hooks.PreCompress).toHaveLength(1)
    expect(hooks.Notification).toHaveLength(1)
  })

  it('should produce correct Gemini hook structure with name, type, command, timeout', () => {
    const settings: Record<string, unknown> = {}
    const result = mergeGeminiHooks(settings, '/path/to/hooks')
    const hooks = (result as any).hooks

    const entry = hooks.SessionStart[0]
    expect(entry.hooks).toHaveLength(1)

    const hookCmd = entry.hooks[0]
    expect(hookCmd.name).toBe('bashstats')
    expect(hookCmd.type).toBe('command')
    expect(hookCmd.command).toContain('session-start.js')
    expect(hookCmd.command).toContain('# bashstats-managed')
    expect(hookCmd.timeout).toBe(10)
  })

  it('should use correct script files for each event', () => {
    const settings: Record<string, unknown> = {}
    const result = mergeGeminiHooks(settings, '/hooks')
    const hooks = (result as any).hooks

    expect(hooks.SessionStart[0].hooks[0].command).toContain('session-start.js')
    expect(hooks.SessionEnd[0].hooks[0].command).toContain('stop.js')
    expect(hooks.BeforeAgent[0].hooks[0].command).toContain('user-prompt-submit.js')
    expect(hooks.BeforeTool[0].hooks[0].command).toContain('pre-tool-use.js')
    expect(hooks.AfterTool[0].hooks[0].command).toContain('post-tool-use.js')
    expect(hooks.AfterModel[0].hooks[0].command).toContain('stop.js')
    expect(hooks.PreCompress[0].hooks[0].command).toContain('pre-compact.js')
    expect(hooks.Notification[0].hooks[0].command).toContain('notification.js')
  })

  it('should preserve existing non-bashstats hooks', () => {
    const settings = {
      hooks: {
        BeforeTool: [
          { hooks: [{ name: 'my-linter', type: 'command', command: 'lint --check', timeout: 30 }] },
        ],
      },
    }
    const result = mergeGeminiHooks(settings, '/path/to/hooks')
    const entries = (result as any).hooks.BeforeTool

    // Should have both existing linter hook AND new bashstats hook
    expect(entries).toHaveLength(2)

    // First entry should be the preserved linter hook
    expect(entries[0].hooks[0].name).toBe('my-linter')
    expect(entries[0].hooks[0].command).toBe('lint --check')

    // Second entry should be the bashstats hook
    expect(entries[1].hooks[0].name).toBe('bashstats')
    expect(entries[1].hooks[0].command).toContain('# bashstats-managed')
  })

  it('should not duplicate bashstats hooks on re-install (idempotent)', () => {
    const settings: Record<string, unknown> = {}
    const result1 = mergeGeminiHooks(settings, '/path/to/hooks')
    const result2 = mergeGeminiHooks(result1, '/path/to/hooks')
    const result3 = mergeGeminiHooks(result2, '/path/to/hooks')

    // Should still have exactly 1 entry per hook type for bashstats
    const hooks = (result3 as any).hooks
    expect(hooks.SessionStart).toHaveLength(1)
    expect(hooks.SessionEnd).toHaveLength(1)
    expect(hooks.BeforeAgent).toHaveLength(1)
    expect(hooks.BeforeTool).toHaveLength(1)
    expect(hooks.AfterTool).toHaveLength(1)
    expect(hooks.AfterModel).toHaveLength(1)
    expect(hooks.PreCompress).toHaveLength(1)
    expect(hooks.Notification).toHaveLength(1)
  })

  it('should replace old bashstats hooks with updated paths', () => {
    const settings: Record<string, unknown> = {}
    const result1 = mergeGeminiHooks(settings, '/old/hooks/path')
    const result2 = mergeGeminiHooks(result1, '/new/hooks/path')

    const hooks = (result2 as any).hooks
    const cmd = hooks.SessionStart[0].hooks[0].command as string
    // Should contain new path, not old (use path-separator-agnostic check)
    expect(cmd).toContain('new')
    expect(cmd).toContain('session-start.js')
    expect(cmd).not.toContain('old')
  })

  it('should preserve existing hooks when replacing bashstats hooks', () => {
    // Start with a non-bashstats hook and a bashstats hook
    const settings = {
      hooks: {
        BeforeTool: [
          { hooks: [{ name: 'custom-gate', type: 'command', command: 'my-gate check', timeout: 5 }] },
          { hooks: [{ name: 'bashstats', type: 'command', command: 'node "/old/path/pre-tool-use.js" # bashstats-managed', timeout: 10 }] },
        ],
      },
    }
    const result = mergeGeminiHooks(settings, '/new/path')
    const entries = (result as any).hooks.BeforeTool

    // Should have 2: preserved custom + updated bashstats
    expect(entries).toHaveLength(2)
    expect(entries[0].hooks[0].command).toBe('my-gate check')
    const bashstatsCmd = entries[1].hooks[0].command as string
    expect(bashstatsCmd).toContain('new')
    expect(bashstatsCmd).toContain('pre-tool-use.js')
    expect(bashstatsCmd).toContain('# bashstats-managed')
    expect(bashstatsCmd).not.toContain('old')
  })

  it('should preserve other top-level settings fields', () => {
    const settings = {
      theme: 'dark',
      codeExecution: { enabled: true },
    }
    const result = mergeGeminiHooks(settings, '/path/to/hooks')

    expect((result as any).theme).toBe('dark')
    expect((result as any).codeExecution).toEqual({ enabled: true })
    expect((result as any).hooks).toBeDefined()
  })

  it('should handle settings with empty hooks object', () => {
    const settings = { hooks: {} }
    const result = mergeGeminiHooks(settings, '/path/to/hooks')
    const hooks = (result as any).hooks

    expect(Object.keys(hooks)).toHaveLength(8)
    expect(hooks.SessionStart).toHaveLength(1)
  })

  it('should handle settings with pre-existing hooks for unknown events', () => {
    const settings = {
      hooks: {
        CustomEvent: [
          { hooks: [{ name: 'custom', type: 'command', command: 'echo hi', timeout: 5 }] },
        ],
      },
    }
    const result = mergeGeminiHooks(settings, '/path/to/hooks')
    const hooks = (result as any).hooks

    // Should keep the custom event
    expect(hooks.CustomEvent).toHaveLength(1)
    expect(hooks.CustomEvent[0].hooks[0].command).toBe('echo hi')

    // Should also have all bashstats events
    expect(hooks.SessionStart).toHaveLength(1)
  })
})
