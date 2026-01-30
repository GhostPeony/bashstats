import { describe, it, expect } from 'vitest'
import { mergeHooks, HOOK_SCRIPTS } from './installer.js'

describe('mergeHooks', () => {
  it('should add hooks to empty settings', () => {
    const settings: Record<string, unknown> = {}
    const result = mergeHooks(settings, '/path/to/hooks')
    expect((result as any).hooks).toBeDefined()
    expect((result as any).hooks.SessionStart).toHaveLength(1)
    expect((result as any).hooks.PostToolUse).toHaveLength(1)
  })

  it('should preserve existing hooks', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'bashbros gate' }] }
        ]
      }
    }
    const result = mergeHooks(settings, '/path/to/hooks')
    // Should have both existing bashbros hook AND new bashstats hook
    expect((result as any).hooks.PreToolUse.length).toBeGreaterThanOrEqual(2)
  })

  it('should not duplicate bashstats hooks on re-install', () => {
    const settings: Record<string, unknown> = {}
    const result1 = mergeHooks(settings, '/path/to/hooks')
    const result2 = mergeHooks(result1, '/path/to/hooks')
    // Should still have exactly 1 entry per hook type for bashstats
    expect((result2 as any).hooks.SessionStart).toHaveLength(1)
  })
})

describe('HOOK_SCRIPTS', () => {
  it('should define all 12 hook events', () => {
    expect(Object.keys(HOOK_SCRIPTS)).toHaveLength(12)
    expect(HOOK_SCRIPTS.SessionStart).toBeDefined()
    expect(HOOK_SCRIPTS.Stop).toBeDefined()
    expect(HOOK_SCRIPTS.UserPromptSubmit).toBeDefined()
    expect(HOOK_SCRIPTS.PreToolUse).toBeDefined()
    expect(HOOK_SCRIPTS.PostToolUse).toBeDefined()
    expect(HOOK_SCRIPTS.PostToolUseFailure).toBeDefined()
    expect(HOOK_SCRIPTS.Notification).toBeDefined()
    expect(HOOK_SCRIPTS.SubagentStart).toBeDefined()
    expect(HOOK_SCRIPTS.SubagentStop).toBeDefined()
    expect(HOOK_SCRIPTS.PreCompact).toBeDefined()
    expect(HOOK_SCRIPTS.PermissionRequest).toBeDefined()
    expect(HOOK_SCRIPTS.Setup).toBeDefined()
  })
})
