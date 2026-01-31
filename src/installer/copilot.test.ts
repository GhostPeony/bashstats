import { describe, it, expect } from 'vitest'
import path from 'path'
import { buildCopilotHooksConfig, COPILOT_HOOK_SCRIPTS } from './copilot.js'

describe('COPILOT_HOOK_SCRIPTS', () => {
  it('should define all 6 Copilot hook events', () => {
    const events = Object.keys(COPILOT_HOOK_SCRIPTS)
    expect(events).toHaveLength(6)
    expect(events).toContain('sessionStart')
    expect(events).toContain('sessionEnd')
    expect(events).toContain('userPromptSubmitted')
    expect(events).toContain('preToolUse')
    expect(events).toContain('postToolUse')
    expect(events).toContain('errorOccurred')
  })

  it('should map events to the correct script files', () => {
    expect(COPILOT_HOOK_SCRIPTS.sessionStart).toBe('session-start.js')
    expect(COPILOT_HOOK_SCRIPTS.sessionEnd).toBe('stop.js')
    expect(COPILOT_HOOK_SCRIPTS.userPromptSubmitted).toBe('user-prompt-submit.js')
    expect(COPILOT_HOOK_SCRIPTS.preToolUse).toBe('pre-tool-use.js')
    expect(COPILOT_HOOK_SCRIPTS.postToolUse).toBe('post-tool-use.js')
    expect(COPILOT_HOOK_SCRIPTS.errorOccurred).toBe('post-tool-failure.js')
  })
})

describe('buildCopilotHooksConfig', () => {
  const hooksDir = '/fake/dist/hooks'
  const config = buildCopilotHooksConfig(hooksDir)

  it('should have version 1', () => {
    expect(config.version).toBe(1)
  })

  it('should have a hooks object with all 6 events', () => {
    const events = Object.keys(config.hooks)
    expect(events).toHaveLength(6)
    expect(events).toContain('sessionStart')
    expect(events).toContain('sessionEnd')
    expect(events).toContain('userPromptSubmitted')
    expect(events).toContain('preToolUse')
    expect(events).toContain('postToolUse')
    expect(events).toContain('errorOccurred')
  })

  it('should produce one hook entry per event', () => {
    for (const event of Object.keys(config.hooks)) {
      expect(config.hooks[event]).toHaveLength(1)
    }
  })

  it('should set type to "command" for every hook entry', () => {
    for (const entries of Object.values(config.hooks)) {
      expect(entries[0].type).toBe('command')
    }
  })

  it('should include both bash and powershell commands pointing to the same script', () => {
    for (const [event, entries] of Object.entries(config.hooks)) {
      const entry = entries[0]
      const expectedScript = COPILOT_HOOK_SCRIPTS[event]
      const expectedPath = path.join(hooksDir, expectedScript)
      expect(entry.bash).toBe(`node "${expectedPath}"`)
      expect(entry.powershell).toBe(`node "${expectedPath}"`)
    }
  })

  it('should set timeoutSec to 30 for every hook entry', () => {
    for (const entries of Object.values(config.hooks)) {
      expect(entries[0].timeoutSec).toBe(30)
    }
  })

  it('should set comment to "bashstats-managed" for every hook entry', () => {
    for (const entries of Object.values(config.hooks)) {
      expect(entries[0].comment).toBe('bashstats-managed')
    }
  })

  it('should use the provided hooksDir in all paths', () => {
    const customDir = path.join('custom', 'path', 'to', 'hooks')
    const customConfig = buildCopilotHooksConfig(customDir)

    for (const entries of Object.values(customConfig.hooks)) {
      expect(entries[0].bash).toContain(customDir)
      expect(entries[0].powershell).toContain(customDir)
    }
  })

  it('should produce valid JSON when serialized', () => {
    const json = JSON.stringify(config, null, 2)
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(Object.keys(parsed.hooks)).toHaveLength(6)
  })
})
