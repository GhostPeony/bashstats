# Multi-Agent Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Gemini CLI, Copilot CLI, and OpenCode tracking alongside Claude Code, with per-agent dashboard filtering and multi-agent badges.

**Architecture:** Normalizer functions translate each agent's hook payload into the existing internal format before hitting the writer. The stats engine and API accept an optional agent filter. OpenCode uses a separate plugin file instead of shell hooks.

**Tech Stack:** TypeScript, better-sqlite3, Express, vitest

---

### Task 1: Gemini CLI Normalizer

**Files:**
- Create: `src/hooks/normalizers/gemini.ts`
- Test: `src/hooks/normalizers/gemini.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/normalizers/gemini.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeGeminiEvent } from './gemini.js'

describe('normalizeGeminiEvent', () => {
  it('passes through SessionStart unchanged', () => {
    const input = {
      session_id: 'abc',
      transcript_path: '/tmp/t.jsonl',
      cwd: '/home/user/project',
      hook_event_name: 'SessionStart',
      timestamp: '2026-01-31T12:00:00.000Z',
      source: 'startup',
    }
    const result = normalizeGeminiEvent('SessionStart', input)
    expect(result).toEqual({
      hookType: 'SessionStart',
      payload: input,
    })
  })

  it('maps SessionEnd to Stop', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'SessionEnd',
      timestamp: '2026-01-31T12:00:00.000Z',
      reason: 'exit',
    }
    const result = normalizeGeminiEvent('SessionEnd', input)
    expect(result.hookType).toBe('Stop')
    expect(result.payload.stop_hook_active).toBe(false)
  })

  it('maps BeforeAgent to UserPromptSubmit', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'BeforeAgent',
      timestamp: '2026-01-31T12:00:00.000Z',
      prompt: 'fix the bug',
    }
    const result = normalizeGeminiEvent('BeforeAgent', input)
    expect(result.hookType).toBe('UserPromptSubmit')
    expect(result.payload.prompt).toBe('fix the bug')
  })

  it('maps BeforeTool to PreToolUse', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'BeforeTool',
      timestamp: '2026-01-31T12:00:00.000Z',
      tool_name: 'write_file',
      tool_input: { file_path: '/tmp/x.ts' },
    }
    const result = normalizeGeminiEvent('BeforeTool', input)
    expect(result.hookType).toBe('PreToolUse')
    expect(result.payload.tool_name).toBe('write_file')
  })

  it('maps AfterTool to PostToolUse', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'AfterTool',
      timestamp: '2026-01-31T12:00:00.000Z',
      tool_name: 'read_file',
      tool_input: { file_path: '/tmp/x.ts' },
      tool_response: { content: 'hello' },
    }
    const result = normalizeGeminiEvent('AfterTool', input)
    expect(result.hookType).toBe('PostToolUse')
    expect(result.payload.tool_response).toEqual({ content: 'hello' })
  })

  it('maps AfterModel to token data', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'AfterModel',
      timestamp: '2026-01-31T12:00:00.000Z',
      llm_response: {
        usageMetadata: { totalTokenCount: 5000 },
      },
    }
    const result = normalizeGeminiEvent('AfterModel', input)
    expect(result.hookType).toBe('AfterModel')
    expect(result.tokenData).toEqual({ totalTokenCount: 5000 })
  })

  it('maps PreCompress to PreCompact', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'PreCompress',
      timestamp: '2026-01-31T12:00:00.000Z',
      trigger: 'auto',
    }
    const result = normalizeGeminiEvent('PreCompress', input)
    expect(result.hookType).toBe('PreCompact')
    expect(result.payload.trigger).toBe('auto')
  })

  it('returns null for unknown events', () => {
    const input = {
      session_id: 'abc',
      cwd: '/home/user/project',
      hook_event_name: 'BeforeToolSelection',
      timestamp: '2026-01-31T12:00:00.000Z',
    }
    const result = normalizeGeminiEvent('BeforeToolSelection', input)
    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/normalizers/gemini.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the implementation**

```typescript
// src/hooks/normalizers/gemini.ts

export interface NormalizedEvent {
  hookType: string
  payload: Record<string, unknown>
  tokenData?: { totalTokenCount: number }
}

/**
 * Normalize a Gemini CLI hook event into bashstats internal format.
 * Returns null for events we don't track (BeforeModel, BeforeToolSelection).
 */
export function normalizeGeminiEvent(
  geminiEvent: string,
  raw: Record<string, unknown>,
): NormalizedEvent | null {
  switch (geminiEvent) {
    case 'SessionStart':
      return { hookType: 'SessionStart', payload: raw }

    case 'SessionEnd':
      return {
        hookType: 'Stop',
        payload: {
          ...raw,
          stop_hook_active: false,
        },
      }

    case 'BeforeAgent':
      return { hookType: 'UserPromptSubmit', payload: raw }

    case 'BeforeTool':
      return { hookType: 'PreToolUse', payload: raw }

    case 'AfterTool':
      return { hookType: 'PostToolUse', payload: raw }

    case 'AfterModel': {
      const llmResponse = raw.llm_response as Record<string, unknown> | undefined
      const usageMetadata = llmResponse?.usageMetadata as { totalTokenCount?: number } | undefined
      return {
        hookType: 'AfterModel',
        payload: raw,
        tokenData: usageMetadata ? { totalTokenCount: usageMetadata.totalTokenCount ?? 0 } : undefined,
      }
    }

    case 'PreCompress':
      return { hookType: 'PreCompact', payload: raw }

    case 'Notification':
      return { hookType: 'Notification', payload: raw }

    default:
      return null
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/normalizers/gemini.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/normalizers/gemini.ts src/hooks/normalizers/gemini.test.ts
git commit -m "feat: add Gemini CLI event normalizer"
```

---

### Task 2: Copilot CLI Normalizer

**Files:**
- Create: `src/hooks/normalizers/copilot.ts`
- Test: `src/hooks/normalizers/copilot.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/normalizers/copilot.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeCopilotEvent } from './copilot.js'

describe('normalizeCopilotEvent', () => {
  it('maps sessionStart to SessionStart', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      source: 'new',
      initialPrompt: 'hello',
    }
    const result = normalizeCopilotEvent('sessionStart', input)
    expect(result.hookType).toBe('SessionStart')
    expect(result.payload.cwd).toBe('/home/user/project')
    expect(result.payload.source).toBe('startup')
  })

  it('maps sessionEnd to Stop', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      reason: 'complete',
    }
    const result = normalizeCopilotEvent('sessionEnd', input)
    expect(result.hookType).toBe('Stop')
  })

  it('maps userPromptSubmitted to UserPromptSubmit', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      prompt: 'fix the bug',
    }
    const result = normalizeCopilotEvent('userPromptSubmitted', input)
    expect(result.hookType).toBe('UserPromptSubmit')
    expect(result.payload.prompt).toBe('fix the bug')
  })

  it('maps preToolUse to PreToolUse and parses toolArgs', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      toolName: 'bash',
      toolArgs: '{"command":"ls -la"}',
    }
    const result = normalizeCopilotEvent('preToolUse', input)
    expect(result.hookType).toBe('PreToolUse')
    expect(result.payload.tool_name).toBe('bash')
    expect(result.payload.tool_input).toEqual({ command: 'ls -la' })
  })

  it('maps postToolUse to PostToolUse', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      toolName: 'edit',
      toolArgs: '{"file_path":"/tmp/x.ts"}',
      toolResult: {
        resultType: 'success',
        textResultForLlm: 'edited',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', input)
    expect(result.hookType).toBe('PostToolUse')
    expect(result.payload.tool_name).toBe('edit')
    expect(result.payload.tool_response).toEqual({
      resultType: 'success',
      textResultForLlm: 'edited',
    })
    expect(result.payload.exit_code).toBe(0)
  })

  it('maps postToolUse failure to PostToolUseFailure', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      toolName: 'bash',
      toolArgs: '{"command":"bad"}',
      toolResult: {
        resultType: 'failure',
        textResultForLlm: 'command failed',
      },
    }
    const result = normalizeCopilotEvent('postToolUse', input)
    expect(result.hookType).toBe('PostToolUseFailure')
    expect(result.payload.exit_code).toBe(1)
  })

  it('maps errorOccurred to PostToolUseFailure', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      error: {
        message: 'something broke',
        name: 'RuntimeError',
      },
    }
    const result = normalizeCopilotEvent('errorOccurred', input)
    expect(result.hookType).toBe('PostToolUseFailure')
    expect(result.payload.tool_name).toBe('_error')
  })

  it('handles malformed toolArgs gracefully', () => {
    const input = {
      timestamp: 1704614400000,
      cwd: '/home/user/project',
      toolName: 'bash',
      toolArgs: 'not-json',
    }
    const result = normalizeCopilotEvent('preToolUse', input)
    expect(result.payload.tool_input).toEqual({})
  })

  it('returns null for unknown events', () => {
    const result = normalizeCopilotEvent('unknown', { timestamp: 0, cwd: '/' })
    expect(result).toBeNull()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/normalizers/copilot.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the implementation**

```typescript
// src/hooks/normalizers/copilot.ts

import type { NormalizedEvent } from './gemini.js'

/**
 * Parse Copilot's stringified toolArgs safely.
 */
function parseToolArgs(toolArgs: unknown): Record<string, unknown> {
  if (typeof toolArgs !== 'string') return {}
  try {
    return JSON.parse(toolArgs)
  } catch {
    return {}
  }
}

/**
 * Generate a session_id from Copilot's timestamp-based events.
 * Copilot doesn't provide a session_id in hooks, so we derive one
 * from the process PID + date to group events within a session.
 */
function deriveSessionId(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `copilot-${process.pid}-${date}`
}

/**
 * Map Copilot source values to our internal source values.
 */
function mapSource(source: unknown): string {
  if (source === 'resume') return 'resume'
  return 'startup'
}

/**
 * Normalize a Copilot CLI hook event into bashstats internal format.
 * Returns null for events we don't track.
 */
export function normalizeCopilotEvent(
  copilotEvent: string,
  raw: Record<string, unknown>,
): NormalizedEvent | null {
  const sessionId = deriveSessionId()
  const cwd = (raw.cwd as string) ?? ''

  switch (copilotEvent) {
    case 'sessionStart':
      return {
        hookType: 'SessionStart',
        payload: {
          session_id: sessionId,
          cwd,
          source: mapSource(raw.source),
          hook_event_name: 'SessionStart',
        },
      }

    case 'sessionEnd':
      return {
        hookType: 'Stop',
        payload: {
          session_id: sessionId,
          cwd,
          stop_hook_active: false,
          hook_event_name: 'Stop',
        },
      }

    case 'userPromptSubmitted':
      return {
        hookType: 'UserPromptSubmit',
        payload: {
          session_id: sessionId,
          cwd,
          prompt: raw.prompt ?? '',
          hook_event_name: 'UserPromptSubmit',
        },
      }

    case 'preToolUse':
      return {
        hookType: 'PreToolUse',
        payload: {
          session_id: sessionId,
          cwd,
          tool_name: raw.toolName ?? '',
          tool_input: parseToolArgs(raw.toolArgs),
          tool_use_id: '',
          hook_event_name: 'PreToolUse',
        },
      }

    case 'postToolUse': {
      const toolResult = raw.toolResult as Record<string, unknown> | undefined
      const isFailure = toolResult?.resultType === 'failure' || toolResult?.resultType === 'denied'
      return {
        hookType: isFailure ? 'PostToolUseFailure' : 'PostToolUse',
        payload: {
          session_id: sessionId,
          cwd,
          tool_name: raw.toolName ?? '',
          tool_input: parseToolArgs(raw.toolArgs),
          tool_response: toolResult ?? {},
          tool_use_id: '',
          exit_code: isFailure ? 1 : 0,
          hook_event_name: isFailure ? 'PostToolUseFailure' : 'PostToolUse',
        },
      }
    }

    case 'errorOccurred': {
      const error = raw.error as Record<string, unknown> | undefined
      return {
        hookType: 'PostToolUseFailure',
        payload: {
          session_id: sessionId,
          cwd,
          tool_name: '_error',
          tool_input: { error_message: error?.message ?? '', error_name: error?.name ?? '' },
          tool_response: {},
          tool_use_id: '',
          exit_code: 1,
          hook_event_name: 'PostToolUseFailure',
        },
      }
    }

    default:
      return null
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/normalizers/copilot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/normalizers/copilot.ts src/hooks/normalizers/copilot.test.ts
git commit -m "feat: add Copilot CLI event normalizer"
```

---

### Task 3: Integrate Normalizers into Handler

**Files:**
- Modify: `src/hooks/handler.ts:14-18` (detectAgent) and `src/hooks/handler.ts:59-162` (handleHookEvent)
- Test: `src/hooks/handler.test.ts` (existing, add cases)

**Step 1: Write the failing test**

Add to existing handler tests (or create `src/hooks/handler.test.ts`):

```typescript
// src/hooks/handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectAgent } from './handler.js'

describe('detectAgent', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  it('detects gemini-cli from GEMINI_SESSION_ID', () => {
    process.env.GEMINI_SESSION_ID = 'abc'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('detects gemini-cli from GEMINI_PROJECT_DIR', () => {
    process.env.GEMINI_PROJECT_DIR = '/tmp'
    expect(detectAgent()).toBe('gemini-cli')
  })

  it('detects copilot-cli from GITHUB_COPILOT_CLI', () => {
    process.env.GITHUB_COPILOT_CLI = '1'
    expect(detectAgent()).toBe('copilot-cli')
  })

  it('detects opencode from OPENCODE', () => {
    process.env.OPENCODE = '1'
    expect(detectAgent()).toBe('opencode')
  })

  it('defaults to claude-code', () => {
    delete process.env.GEMINI_SESSION_ID
    delete process.env.GEMINI_PROJECT_DIR
    delete process.env.GEMINI_CLI
    delete process.env.GEMINI_API_KEY
    delete process.env.GITHUB_COPILOT_CLI
    delete process.env.OPENCODE
    expect(detectAgent()).toBe('claude-code')
  })
})
```

**Step 2: Run test to verify behavior**

Run: `npx vitest run src/hooks/handler.test.ts`
Expected: Some tests FAIL (GEMINI_SESSION_ID and GEMINI_PROJECT_DIR not yet handled)

**Step 3: Update detectAgent and add normalization to handleHookEvent**

In `src/hooks/handler.ts`, update `detectAgent()` at line 14:

```typescript
export function detectAgent(): AgentType {
  // Gemini CLI sets these env vars automatically in hook processes
  if (process.env.GEMINI_SESSION_ID || process.env.GEMINI_PROJECT_DIR || process.env.GEMINI_CLI || process.env.GEMINI_API_KEY) return 'gemini-cli'
  if (process.env.GITHUB_COPILOT_CLI) return 'copilot-cli'
  if (process.env.OPENCODE) return 'opencode'
  return 'claude-code'
}
```

Add imports at the top of handler.ts:

```typescript
import { normalizeGeminiEvent } from './normalizers/gemini.js'
import { normalizeCopilotEvent } from './normalizers/copilot.js'
```

In `handleHookEvent`, after parsing the event and detecting the agent (around line 72-78), add normalization before the switch:

```typescript
export async function handleHookEvent(hookType: string): Promise<void> {
  const raw = await readStdin()
  const event = parseHookEvent(raw)
  if (!event) return

  const dataDir = getDataDir()
  fs.mkdirSync(dataDir, { recursive: true })

  const dbPath = getDbPath()
  const db = new BashStatsDB(dbPath)
  const writer = new BashStatsWriter(db)

  try {
    const agent = detectAgent()

    // Normalize non-Claude events into internal format
    let normalizedHookType = hookType
    let normalizedEvent = event

    if (agent === 'gemini-cli') {
      const normalized = normalizeGeminiEvent(hookType, event)
      if (!normalized) return
      // Handle Gemini-specific AfterModel token accumulation
      if (normalized.hookType === 'AfterModel' && normalized.tokenData) {
        // Store accumulated token data in metadata for session-end retrieval
        const sessionId = (event.session_id as string) ?? ''
        const existingRaw = db.getMetadata(`gemini_tokens_${sessionId}`)
        const existing = existingRaw ? parseInt(existingRaw, 10) : 0
        db.setMetadata(`gemini_tokens_${sessionId}`, String(existing + normalized.tokenData.totalTokenCount))
        return
      }
      normalizedHookType = normalized.hookType
      normalizedEvent = normalized.payload
    } else if (agent === 'copilot-cli') {
      const normalized = normalizeCopilotEvent(hookType, event)
      if (!normalized) return
      normalizedHookType = normalized.hookType
      normalizedEvent = normalized.payload
    }

    const sessionId = (normalizedEvent.session_id as string) ?? ''
    const cwd = (normalizedEvent.cwd as string) ?? ''

    switch (normalizedHookType) {
      // ... existing switch cases unchanged, but use normalizedEvent and agent ...
    }
  } finally {
    db.close()
  }
}
```

The key change: replace `event` references in the switch body with `normalizedEvent`, and replace `hookType` with `normalizedHookType`. The switch cases themselves stay identical.

For the Stop case with Gemini, retrieve accumulated tokens from metadata instead of parsing transcript:

```typescript
case 'Stop': {
  let tokens = null
  if (agent === 'claude-code') {
    const rawPath = (normalizedEvent.transcript_path as string) ?? ''
    const transcriptPath = rawPath && rawPath.endsWith('.jsonl') ? path.resolve(rawPath) : ''
    tokens = transcriptPath ? await extractTokenUsage(transcriptPath) : null
  } else if (agent === 'gemini-cli') {
    const totalRaw = db.getMetadata(`gemini_tokens_${sessionId}`)
    if (totalRaw) {
      const total = parseInt(totalRaw, 10)
      // Gemini only gives totalTokenCount, split as approximation
      tokens = { input_tokens: Math.round(total * 0.7), output_tokens: Math.round(total * 0.3), cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
    }
  }
  // Copilot: tokens stay null (not available from hooks)
  writer.recordSessionEnd(sessionId, 'stopped', tokens)
  break
}
```

**Step 4: Run tests**

Run: `npx vitest run src/hooks/handler.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/handler.ts src/hooks/handler.test.ts
git commit -m "feat: integrate normalizers into hook handler for multi-agent support"
```

---

### Task 4: Gemini CLI Installer

**Files:**
- Create: `src/installer/gemini.ts`
- Test: `src/installer/gemini.test.ts`

**Step 1: Write the failing test**

```typescript
// src/installer/gemini.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { mergeGeminiHooks, isGeminiInstalled, getGeminiSettingsPath } from './gemini.js'

describe('mergeGeminiHooks', () => {
  it('adds bashstats hooks to empty settings', () => {
    const result = mergeGeminiHooks({}, '/fake/hooks')
    expect(result.hooks).toBeDefined()
    expect(result.hooks.SessionStart).toBeDefined()
    expect(result.hooks.SessionStart.length).toBeGreaterThan(0)
  })

  it('preserves existing non-bashstats hooks', () => {
    const existing = {
      hooks: {
        SessionStart: [
          { hooks: [{ name: 'my-hook', type: 'command', command: 'echo hello' }] },
        ],
      },
    }
    const result = mergeGeminiHooks(existing, '/fake/hooks')
    const entries = result.hooks.SessionStart
    expect(entries.length).toBe(2) // original + bashstats
    expect(entries[0].hooks[0].command).toBe('echo hello')
  })

  it('replaces old bashstats hooks idempotently', () => {
    const existing = {
      hooks: {
        SessionStart: [
          { hooks: [{ name: 'bashstats', type: 'command', command: 'old # bashstats-managed' }] },
        ],
      },
    }
    const result = mergeGeminiHooks(existing, '/fake/hooks')
    const entries = result.hooks.SessionStart
    expect(entries.length).toBe(1)
    expect(entries[0].hooks[0].command).toContain('/fake/hooks')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/installer/gemini.test.ts`
Expected: FAIL -- module not found

**Step 3: Write the implementation**

```typescript
// src/installer/gemini.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { getHooksDir } from './installer.js'

const MARKER = '# bashstats-managed'

/**
 * Gemini hook events we track, mapped to our script files.
 * Gemini uses the same script files as Claude -- the normalizer
 * inside handleHookEvent translates the payload.
 */
const GEMINI_HOOK_MAP: Record<string, string> = {
  SessionStart: 'session-start.js',
  SessionEnd: 'stop.js',
  BeforeAgent: 'user-prompt-submit.js',
  BeforeTool: 'pre-tool-use.js',
  AfterTool: 'post-tool-use.js',
  AfterModel: 'stop.js', // Token accumulation handled in handler
  PreCompress: 'pre-compact.js',
  Notification: 'notification.js',
}

interface GeminiHookEntry {
  matcher?: string
  hooks: { name?: string; type: string; command: string; timeout?: number }[]
}

interface GeminiSettings {
  hooks?: Record<string, GeminiHookEntry[]>
  [key: string]: unknown
}

export function getGeminiSettingsPath(): string {
  return path.join(os.homedir(), '.gemini', 'settings.json')
}

export function mergeGeminiHooks(settings: Record<string, unknown>, hooksDir: string): GeminiSettings {
  const result: GeminiSettings = { ...settings }
  if (!result.hooks) result.hooks = {}

  for (const [event, scriptFile] of Object.entries(GEMINI_HOOK_MAP)) {
    const command = `node "${path.join(hooksDir, scriptFile)}" ${MARKER}`
    const existing: GeminiHookEntry[] = result.hooks[event] ?? []

    // Filter out previous bashstats hooks
    const nonBashstats = existing.filter((entry) =>
      !entry.hooks?.some((h) => h.command?.includes(MARKER))
    )

    const bashstatsEntry: GeminiHookEntry = {
      hooks: [{ name: 'bashstats', type: 'command', command, timeout: 5000 }],
    }

    result.hooks[event] = [...nonBashstats, bashstatsEntry]
  }

  return result
}

export function installGemini(): { success: boolean; message: string } {
  try {
    const settingsPath = getGeminiSettingsPath()
    const geminiDir = path.dirname(settingsPath)

    if (!fs.existsSync(geminiDir)) {
      return { success: false, message: 'Gemini CLI not found (~/.gemini/ does not exist)' }
    }

    let settings: Record<string, unknown> = {}
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    }

    const hooksDir = getHooksDir()
    settings = mergeGeminiHooks(settings, hooksDir)
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')

    return { success: true, message: 'Gemini CLI hooks installed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Gemini install failed: ${message}` }
  }
}

export function uninstallGemini(): { success: boolean; message: string } {
  try {
    const settingsPath = getGeminiSettingsPath()
    if (!fs.existsSync(settingsPath)) {
      return { success: true, message: 'No Gemini settings found.' }
    }

    const settings: GeminiSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    if (settings.hooks) {
      for (const event of Object.keys(settings.hooks)) {
        settings.hooks[event] = settings.hooks[event].filter((entry) =>
          !entry.hooks?.some((h) => h.command?.includes(MARKER))
        )
        if (settings.hooks[event].length === 0) delete settings.hooks[event]
      }
      if (Object.keys(settings.hooks).length === 0) delete settings.hooks
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    return { success: true, message: 'Gemini CLI hooks removed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Gemini uninstall failed: ${message}` }
  }
}

export function isGeminiInstalled(): boolean {
  try {
    const settingsPath = getGeminiSettingsPath()
    if (!fs.existsSync(settingsPath)) return false
    const settings: GeminiSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    if (!settings.hooks) return false
    for (const event of Object.keys(settings.hooks)) {
      for (const entry of settings.hooks[event]) {
        if (entry.hooks?.some((h) => h.command?.includes(MARKER))) return true
      }
    }
    return false
  } catch {
    return false
  }
}

/** Check if Gemini CLI is available on this system. */
export function isGeminiAvailable(): boolean {
  return fs.existsSync(path.join(os.homedir(), '.gemini'))
}
```

**Step 4: Run test**

Run: `npx vitest run src/installer/gemini.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/installer/gemini.ts src/installer/gemini.test.ts
git commit -m "feat: add Gemini CLI hook installer"
```

---

### Task 5: Copilot CLI Installer

**Files:**
- Create: `src/installer/copilot.ts`
- Test: `src/installer/copilot.test.ts`

**Step 1: Write the failing test**

```typescript
// src/installer/copilot.test.ts
import { describe, it, expect } from 'vitest'
import { buildCopilotHooksConfig } from './copilot.js'

describe('buildCopilotHooksConfig', () => {
  it('builds valid hook config with all 6 events', () => {
    const config = buildCopilotHooksConfig('/fake/hooks')
    expect(config.version).toBe(1)
    expect(Object.keys(config.hooks)).toEqual([
      'sessionStart', 'sessionEnd', 'userPromptSubmitted',
      'preToolUse', 'postToolUse', 'errorOccurred',
    ])
  })

  it('includes both bash and powershell entries', () => {
    const config = buildCopilotHooksConfig('/fake/hooks')
    const entry = config.hooks.sessionStart[0]
    expect(entry.bash).toBeDefined()
    expect(entry.powershell).toBeDefined()
  })

  it('points to correct script files', () => {
    const config = buildCopilotHooksConfig('/fake/hooks')
    expect(config.hooks.sessionStart[0].bash).toContain('session-start.js')
    expect(config.hooks.postToolUse[0].bash).toContain('post-tool-use.js')
    expect(config.hooks.errorOccurred[0].bash).toContain('post-tool-failure.js')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/installer/copilot.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/installer/copilot.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { getHooksDir } from './installer.js'

const COPILOT_HOOK_MAP: Record<string, string> = {
  sessionStart: 'session-start.js',
  sessionEnd: 'stop.js',
  userPromptSubmitted: 'user-prompt-submit.js',
  preToolUse: 'pre-tool-use.js',
  postToolUse: 'post-tool-use.js',
  errorOccurred: 'post-tool-failure.js',
}

const MARKER_COMMENT = 'bashstats-managed'

interface CopilotHookEntry {
  type: string
  bash: string
  powershell: string
  cwd?: string
  timeoutSec?: number
  comment?: string
}

interface CopilotHooksConfig {
  version: number
  hooks: Record<string, CopilotHookEntry[]>
}

export function buildCopilotHooksConfig(hooksDir: string): CopilotHooksConfig {
  const hooks: Record<string, CopilotHookEntry[]> = {}

  for (const [event, scriptFile] of Object.entries(COPILOT_HOOK_MAP)) {
    const scriptPath = path.join(hooksDir, scriptFile)
    hooks[event] = [{
      type: 'command',
      bash: `node "${scriptPath}"`,
      powershell: `node "${scriptPath}"`,
      timeoutSec: 30,
      comment: MARKER_COMMENT,
    }]
  }

  return { version: 1, hooks }
}

function getCopilotHooksDir(): string {
  // Copilot hooks go in ~/.copilot/hooks/ for global hooks
  return path.join(os.homedir(), '.copilot', 'hooks')
}

export function installCopilot(): { success: boolean; message: string } {
  try {
    const hooksDir = getHooksDir()
    const config = buildCopilotHooksConfig(hooksDir)
    const copilotHooksDir = getCopilotHooksDir()

    fs.mkdirSync(copilotHooksDir, { recursive: true })
    const configPath = path.join(copilotHooksDir, 'bashstats-hooks.json')
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')

    return { success: true, message: 'Copilot CLI hooks installed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Copilot install failed: ${message}` }
  }
}

export function uninstallCopilot(): { success: boolean; message: string } {
  try {
    const copilotHooksDir = getCopilotHooksDir()
    const configPath = path.join(copilotHooksDir, 'bashstats-hooks.json')
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath)
    }
    return { success: true, message: 'Copilot CLI hooks removed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Copilot uninstall failed: ${message}` }
  }
}

/** Check if Copilot CLI is available on this system. */
export function isCopilotAvailable(): boolean {
  try {
    execSync('copilot --version', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}
```

**Step 4: Run test**

Run: `npx vitest run src/installer/copilot.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/installer/copilot.ts src/installer/copilot.test.ts
git commit -m "feat: add Copilot CLI hook installer"
```

---

### Task 6: OpenCode Plugin Installer

**Files:**
- Create: `src/installer/opencode.ts`
- Create: `src/plugins/opencode.ts`
- Test: `src/installer/opencode.test.ts`

**Step 1: Write the failing test**

```typescript
// src/installer/opencode.test.ts
import { describe, it, expect } from 'vitest'
import { getOpenCodePluginContent, isOpenCodeAvailable } from './opencode.js'

describe('getOpenCodePluginContent', () => {
  it('returns a string containing the plugin export', () => {
    const content = getOpenCodePluginContent('/home/user/.bashstats/bashstats.db')
    expect(content).toContain('export default')
    expect(content).toContain('bashstats.db')
    expect(content).toContain('session.created')
    expect(content).toContain('tool.execute.before')
    expect(content).toContain('tool.execute.after')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/installer/opencode.test.ts`
Expected: FAIL

**Step 3: Write the implementation**

```typescript
// src/installer/opencode.ts
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

function getOpenCodePluginsDir(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins')
}

/**
 * Generate the OpenCode plugin source code.
 * This is a self-contained TS file that OpenCode loads in-process.
 * It imports directly from the installed bashstats npm package.
 */
export function getOpenCodePluginContent(dbPath: string): string {
  return `// bashstats-managed: OpenCode plugin for bashstats stat tracking
// This file is auto-generated by "bashstats init". Do not edit manually.
import Database from 'better-sqlite3'

const DB_PATH = ${JSON.stringify(dbPath)}

function getDb() {
  const db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  return db
}

function now() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}T\${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}.\${ms}\`
}

function today() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`
}

export default async ({ project, directory }) => {
  let sessionId = \`opencode-\${Date.now()}\`

  return {
    event: async ({ event }) => {
      const db = getDb()
      try {
        const timestamp = now()
        const projectName = project?.name ?? 'unknown'

        if (event.type === 'session.created') {
          sessionId = event.properties?.sessionId ?? sessionId
          db.prepare('INSERT OR IGNORE INTO sessions (id, agent, started_at, project) VALUES (?, ?, ?, ?)').run(sessionId, 'opencode', timestamp, projectName)
          db.prepare('INSERT INTO daily_activity (date, sessions) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET sessions = sessions + 1').run(today())
        }

        if (event.type === 'session.idle' || event.type === 'session.deleted') {
          const session = db.prepare('SELECT started_at FROM sessions WHERE id = ?').get(sessionId)
          if (session) {
            const duration = Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)
            db.prepare('UPDATE sessions SET ended_at = ?, stop_reason = ?, duration_seconds = ? WHERE id = ?').run(timestamp, 'stopped', duration, sessionId)
            db.prepare('INSERT INTO daily_activity (date, duration_seconds) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET duration_seconds = duration_seconds + ?').run(today(), duration, duration)
          }
        }

        if (event.type === 'tool.execute.before') {
          db.prepare('INSERT INTO events (session_id, hook_type, tool_name, tool_input, timestamp, cwd, project) VALUES (?, ?, ?, ?, ?, ?, ?)').run(sessionId, 'PreToolUse', event.properties?.tool ?? '', JSON.stringify(event.properties ?? {}), timestamp, directory ?? '', projectName)
        }

        if (event.type === 'tool.execute.after') {
          db.prepare('INSERT INTO events (session_id, hook_type, tool_name, tool_input, tool_output, exit_code, success, timestamp, cwd, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(sessionId, 'PostToolUse', event.properties?.tool ?? '', JSON.stringify(event.properties ?? {}), '', 0, 1, timestamp, directory ?? '', projectName)
          db.prepare('UPDATE sessions SET tool_count = tool_count + 1 WHERE id = ?').run(sessionId)
          db.prepare('INSERT INTO daily_activity (date, tool_calls) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET tool_calls = tool_calls + 1').run(today())
        }

        if (event.type === 'session.error') {
          db.prepare('INSERT INTO events (session_id, hook_type, tool_name, exit_code, success, timestamp, cwd, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(sessionId, 'PostToolUseFailure', '_error', 1, 0, timestamp, directory ?? '', projectName)
          db.prepare('UPDATE sessions SET error_count = error_count + 1 WHERE id = ?').run(sessionId)
          db.prepare('INSERT INTO daily_activity (date, errors) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET errors = errors + 1').run(today())
        }

        if (event.type === 'session.compacted') {
          db.prepare('INSERT INTO events (session_id, hook_type, tool_input, timestamp) VALUES (?, ?, ?, ?)').run(sessionId, 'PreCompact', JSON.stringify({ trigger: 'auto' }), timestamp)
        }

        if (event.type === 'message.updated' && event.properties?.role === 'user') {
          const content = event.properties?.content ?? ''
          const wordCount = content.split(/\\s+/).filter(w => w.length > 0).length
          db.prepare('INSERT INTO prompts (session_id, content, char_count, word_count, timestamp) VALUES (?, ?, ?, ?, ?)').run(sessionId, content, content.length, wordCount, timestamp)
          db.prepare('UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = ?').run(sessionId)
          db.prepare('INSERT INTO daily_activity (date, prompts) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET prompts = prompts + 1').run(today())
        }
      } finally {
        db.close()
      }
    },
  }
}
`
}

export function installOpenCode(): { success: boolean; message: string } {
  try {
    const pluginsDir = getOpenCodePluginsDir()
    if (!fs.existsSync(path.join(os.homedir(), '.config', 'opencode'))) {
      return { success: false, message: 'OpenCode not found (~/.config/opencode/ does not exist)' }
    }

    fs.mkdirSync(pluginsDir, { recursive: true })
    const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)
    const pluginContent = getOpenCodePluginContent(dbPath)
    const pluginPath = path.join(pluginsDir, 'bashstats.ts')
    fs.writeFileSync(pluginPath, pluginContent, 'utf-8')

    return { success: true, message: 'OpenCode plugin installed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `OpenCode install failed: ${message}` }
  }
}

export function uninstallOpenCode(): { success: boolean; message: string } {
  try {
    const pluginPath = path.join(getOpenCodePluginsDir(), 'bashstats.ts')
    if (fs.existsSync(pluginPath)) {
      fs.unlinkSync(pluginPath)
    }
    return { success: true, message: 'OpenCode plugin removed.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `OpenCode uninstall failed: ${message}` }
  }
}

export function isOpenCodeAvailable(): boolean {
  return fs.existsSync(path.join(os.homedir(), '.config', 'opencode'))
}
```

**Step 4: Run test**

Run: `npx vitest run src/installer/opencode.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/installer/opencode.ts src/installer/opencode.test.ts src/plugins/opencode.ts
git commit -m "feat: add OpenCode plugin installer"
```

---

### Task 7: Update init and uninstall commands for multi-agent

**Files:**
- Modify: `src/commands/init.ts:1-25`
- Modify: `src/commands/uninstall.ts:1-20`

**Step 1: Update init.ts**

Replace the full contents of `src/commands/init.ts`:

```typescript
import { install, isInstalled } from '../installer/installer.js'
import { installGemini, isGeminiAvailable } from '../installer/gemini.js'
import { installCopilot, isCopilotAvailable } from '../installer/copilot.js'
import { installOpenCode, isOpenCodeAvailable } from '../installer/opencode.js'

export function runInit(): void {
  if (isInstalled()) {
    console.log('bashstats hooks are already installed. Reinstalling...')
  }

  // Always install Claude Code hooks
  const claudeResult = install()
  if (!claudeResult.success) {
    console.error('Installation failed: ' + claudeResult.message)
    process.exit(1)
  }

  const installed: string[] = ['Claude Code']

  // Auto-detect and install for other agents
  if (isGeminiAvailable()) {
    const result = installGemini()
    if (result.success) installed.push('Gemini CLI')
    else console.log(`  Note: ${result.message}`)
  }

  if (isCopilotAvailable()) {
    const result = installCopilot()
    if (result.success) installed.push('Copilot CLI')
    else console.log(`  Note: ${result.message}`)
  }

  if (isOpenCodeAvailable()) {
    const result = installOpenCode()
    if (result.success) installed.push('OpenCode')
    else console.log(`  Note: ${result.message}`)
  }

  console.log('')
  console.log('  bashstats installed successfully!')
  console.log('')
  console.log(`  Installed hooks for: ${installed.join(', ')}`)
  console.log('')
  console.log('  Run "bashstats web" to open the dashboard.')
  console.log('  Your coding sessions are now being tracked.')
  console.log('')
  console.log('  [SECRET ACHIEVEMENT UNLOCKED] Launch Day')
  console.log('  "Welcome to bashstats. Your stats are now being watched. Forever."')
  console.log('')
}
```

**Step 2: Update uninstall.ts**

Replace the full contents of `src/commands/uninstall.ts`:

```typescript
import os from 'os'
import path from 'path'
import fs from 'fs'
import { uninstall as removeClaudeHooks } from '../installer/installer.js'
import { uninstallGemini } from '../installer/gemini.js'
import { uninstallCopilot } from '../installer/copilot.js'
import { uninstallOpenCode } from '../installer/opencode.js'
import { DATA_DIR } from '../constants.js'

export function runUninstall(): void {
  // Remove all agent hooks
  const claudeResult = removeClaudeHooks()
  console.log(claudeResult.message)

  const geminiResult = uninstallGemini()
  if (geminiResult.message !== 'No Gemini settings found.') console.log(geminiResult.message)

  const copilotResult = uninstallCopilot()
  console.log(copilotResult.message)

  const openCodeResult = uninstallOpenCode()
  console.log(openCodeResult.message)

  // Remove data directory
  const dataDir = path.join(os.homedir(), DATA_DIR)
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true })
    console.log(`Removed data directory: ${dataDir}`)
  }

  console.log('bashstats has been fully uninstalled.')
}
```

**Step 3: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/commands/init.ts src/commands/uninstall.ts
git commit -m "feat: multi-agent auto-detect in init and uninstall commands"
```

---

### Task 8: Add Agent Filter to Stats Engine

**Files:**
- Modify: `src/stats/engine.ts:16-315`
- Test: `src/stats/engine.test.ts`

**Step 1: Write the failing test**

Add to `src/stats/engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StatsEngine } from './engine.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import fs from 'fs'

describe('StatsEngine agent filtering', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let engine: StatsEngine
  const dbPath = '__test_engine_filter.db'

  beforeEach(() => {
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    engine = new StatsEngine(db)

    // Create sessions for different agents
    writer.recordSessionStart('s1', '/proj', 'startup', 'claude-code')
    writer.recordPrompt('s1', 'hello claude')
    writer.recordSessionEnd('s1', 'stopped')

    writer.recordSessionStart('s2', '/proj', 'startup', 'gemini-cli')
    writer.recordPrompt('s2', 'hello gemini')
    writer.recordPrompt('s2', 'another prompt')
    writer.recordSessionEnd('s2', 'stopped')
  })

  afterEach(() => {
    db.close()
    fs.unlinkSync(dbPath)
  })

  it('returns all sessions when no agent filter', () => {
    const stats = engine.getLifetimeStats()
    expect(stats.totalSessions).toBe(2)
    expect(stats.totalPrompts).toBe(3)
  })

  it('filters to claude-code only', () => {
    const stats = engine.getLifetimeStats('claude-code')
    expect(stats.totalSessions).toBe(1)
    expect(stats.totalPrompts).toBe(1)
  })

  it('filters to gemini-cli only', () => {
    const stats = engine.getLifetimeStats('gemini-cli')
    expect(stats.totalSessions).toBe(1)
    expect(stats.totalPrompts).toBe(2)
  })

  it('returns zero for agent with no sessions', () => {
    const stats = engine.getLifetimeStats('copilot-cli')
    expect(stats.totalSessions).toBe(0)
    expect(stats.totalPrompts).toBe(0)
  })
})

describe('StatsEngine.getAgentBreakdown', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let engine: StatsEngine
  const dbPath = '__test_engine_agents.db'

  beforeEach(() => {
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    engine = new StatsEngine(db)

    writer.recordSessionStart('s1', '/p', 'startup', 'claude-code')
    writer.recordSessionEnd('s1', 'stopped')
    writer.recordSessionStart('s2', '/p', 'startup', 'claude-code')
    writer.recordSessionEnd('s2', 'stopped')
    writer.recordSessionStart('s3', '/p', 'startup', 'gemini-cli')
    writer.recordSessionEnd('s3', 'stopped')
  })

  afterEach(() => {
    db.close()
    fs.unlinkSync(dbPath)
  })

  it('returns per-agent session counts', () => {
    const breakdown = engine.getAgentBreakdown()
    expect(breakdown.sessionsPerAgent['claude-code']).toBe(2)
    expect(breakdown.sessionsPerAgent['gemini-cli']).toBe(1)
  })

  it('identifies favorite agent', () => {
    const breakdown = engine.getAgentBreakdown()
    expect(breakdown.favoriteAgent).toBe('claude-code')
  })

  it('counts distinct agents', () => {
    const breakdown = engine.getAgentBreakdown()
    expect(breakdown.distinctAgents).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/stats/engine.test.ts`
Expected: FAIL -- getLifetimeStats doesn't accept agent param, getAgentBreakdown doesn't exist

**Step 3: Implement agent filtering**

The approach: Add an optional `agent?: string` parameter to each stats method. When present, join events/sessions/prompts through sessions to filter by agent. This is the most invasive change -- every SQL query in the engine needs a conditional WHERE clause.

Add to `src/stats/engine.ts`:

1. Add a helper method for building agent-filtered queries:

```typescript
private agentSessionIds(agent?: string): string {
  if (!agent) return ''
  return ` AND session_id IN (SELECT id FROM sessions WHERE agent = '${agent}')`
}

private agentSessionWhere(agent?: string): string {
  if (!agent) return ''
  return ` AND agent = '${agent}'`
}
```

2. Add `agent?: string` parameter to `getLifetimeStats`, `getToolBreakdown`, `getTimeStats`, `getSessionRecords`, `getProjectStats`, `getAllStats`.

3. Apply the filter to each query. For example, `getLifetimeStats(agent?: string)`:
   - Queries on `sessions` table: add `WHERE agent = ?` or `AND agent = ?`
   - Queries on `events` table: add `AND session_id IN (SELECT id FROM sessions WHERE agent = ?)`
   - Queries on `prompts` table: add `AND session_id IN (SELECT id FROM sessions WHERE agent = ?)`

4. Add `getAgentBreakdown()` method:

```typescript
getAgentBreakdown(): { favoriteAgent: string; sessionsPerAgent: Record<string, number>; hoursPerAgent: Record<string, number>; distinctAgents: number } {
  const rows = this.db.prepare(
    'SELECT agent, COUNT(*) as cnt, COALESCE(SUM(duration_seconds), 0) as total_seconds FROM sessions GROUP BY agent ORDER BY cnt DESC'
  ).all() as { agent: string; cnt: number; total_seconds: number }[]

  const sessionsPerAgent: Record<string, number> = {}
  const hoursPerAgent: Record<string, number> = {}
  for (const row of rows) {
    sessionsPerAgent[row.agent] = row.cnt
    hoursPerAgent[row.agent] = Math.round(row.total_seconds / 3600 * 10) / 10
  }

  return {
    favoriteAgent: rows.length > 0 ? rows[0].agent : 'unknown',
    sessionsPerAgent,
    hoursPerAgent,
    distinctAgents: rows.length,
  }
}
```

**Implementation note:** To avoid SQL injection with the agent parameter, use parameterized queries. The `queryScalar` helper needs to be updated to support the additional WHERE clause. The cleanest approach is to add a private method `sessionFilter(agent?: string)` that returns `{ clause: string, params: unknown[] }` and chain it into each query.

**Step 4: Run tests**

Run: `npx vitest run src/stats/engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stats/engine.ts src/stats/engine.test.ts
git commit -m "feat: add agent filter to stats engine and agent breakdown endpoint"
```

---

### Task 9: Add Multi-Agent Badges to Constants and Compute

**Files:**
- Modify: `src/constants.ts:110-118` (replace multi_agent section)
- Modify: `src/achievements/compute.ts` (add new stat queries)
- Test: `src/achievements/compute.test.ts`

**Step 1: Write the failing test**

Add to `src/achievements/compute.test.ts`:

```typescript
describe('multi-agent badges', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let engine: AchievementEngine
  const dbPath = '__test_multi_agent_badges.db'

  beforeEach(() => {
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    const stats = new StatsEngine(db)
    engine = new AchievementEngine(db, stats)
  })

  afterEach(() => {
    db.close()
    fs.unlinkSync(dbPath)
  })

  it('computes distinctAgentsUsed', () => {
    writer.recordSessionStart('s1', '/p', 'startup', 'claude-code')
    writer.recordSessionEnd('s1', 'stopped')
    writer.recordSessionStart('s2', '/p', 'startup', 'gemini-cli')
    writer.recordSessionEnd('s2', 'stopped')

    const badges = engine.computeBadges()
    const polyglot = badges.find(b => b.id === 'polyglot_agent')
    expect(polyglot).toBeDefined()
    expect(polyglot!.value).toBe(2)
    expect(polyglot!.tier).toBe(1) // Bronze at 2 agents
  })

  it('computes geminiSessions', () => {
    for (let i = 0; i < 10; i++) {
      writer.recordSessionStart(`g${i}`, '/p', 'startup', 'gemini-cli')
      writer.recordSessionEnd(`g${i}`, 'stopped')
    }

    const badges = engine.computeBadges()
    const gemini = badges.find(b => b.id === 'gemini_whisperer')
    expect(gemini).toBeDefined()
    expect(gemini!.value).toBe(10)
    expect(gemini!.tier).toBe(1) // Bronze at 10
  })

  it('computes doubleAgentDays', () => {
    // Two agents on the same day
    writer.recordSessionStart('s1', '/p', 'startup', 'claude-code')
    writer.recordSessionEnd('s1', 'stopped')
    writer.recordSessionStart('s2', '/p', 'startup', 'gemini-cli')
    writer.recordSessionEnd('s2', 'stopped')

    const badges = engine.computeBadges()
    const doubleAgent = badges.find(b => b.id === 'double_agent')
    expect(doubleAgent).toBeDefined()
    expect(doubleAgent!.value).toBeGreaterThanOrEqual(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/achievements/compute.test.ts`
Expected: FAIL -- badge IDs not found

**Step 3: Add badge definitions to constants.ts**

Replace the existing multi_agent section (lines 110-118) in `src/constants.ts`. Keep the existing 6 subagent badges, and append the 6 new cross-agent badges:

```typescript
  // ===================================================================
  // MULTI-AGENT (12) - Subagent + Cross-Agent badges
  // ===================================================================
  // --- Subagent badges (existing) ---
  { id: 'buddy_system', name: 'Buddy System', icon: '\u{1F91D}', description: 'Use concurrent agents', category: 'multi_agent', stat: 'concurrentAgentUses', tiers: [1, 5, 25, 100, 500], trigger: 'Sessions with SubagentStart events' },
  { id: 'hive_mind', name: 'Hive Mind', icon: '\u{1F41D}', description: 'Spawn subagents total', category: 'multi_agent', stat: 'totalSubagents', tiers: [25, 250, 1000, 5000, 25000], trigger: 'Total SubagentStart events across all sessions' },
  { id: 'swarm_intelligence', name: 'Swarm Intelligence', icon: '\u{1F41C}', description: "You've built an army.", category: 'multi_agent', stat: 'maxConcurrentSubagents', tiers: [3, 5, 8, 12, 20], trigger: 'Max concurrent subagents active at any point' },
  { id: 'micromanager', name: 'Micromanager', icon: '\u{1F440}', description: 'Let them cook? Never heard of it.', category: 'multi_agent', stat: 'quickSubagentStops', tiers: [1, 5, 25, 100, 500], trigger: 'Subagents stopped within 30 seconds of starting' },
  { id: 'the_orchestrator', name: 'The Orchestrator', icon: '\u{1F3BC}', description: "You don't code. You conduct.", category: 'multi_agent', stat: 'totalSubagentSpawns', tiers: [50, 250, 1000, 5000, 25000], trigger: 'Total subagent spawns across all sessions' },
  { id: 'agent_smith', name: 'Agent Smith', icon: '\u{1F576}', description: "They're multiplying.", category: 'multi_agent', stat: 'maxSubagentsInSession', tiers: [10, 25, 50, 100, 250], trigger: 'Max SubagentStart events in a single session' },

  // --- Cross-agent badges (new) ---
  { id: 'polyglot_agent', name: 'Polyglot Agent', icon: '\u{1F30F}', description: 'A tool for every occasion.', category: 'multi_agent', stat: 'distinctAgentsUsed', tiers: [2, 3, 4, 4, 4], trigger: 'Distinct CLI agents used (Claude Code, Gemini, Copilot, OpenCode)' },
  { id: 'gemini_whisperer', name: 'Gemini Whisperer', icon: '\u{264A}', description: 'The stars aligned for your Gemini sessions.', category: 'multi_agent', stat: 'geminiSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in Gemini CLI' },
  { id: 'copilot_rider', name: 'Copilot Rider', icon: '\u{2708}', description: 'Your copilot is always on duty.', category: 'multi_agent', stat: 'copilotSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in Copilot CLI' },
  { id: 'open_source_spirit', name: 'Open Source Spirit', icon: '\u{1F4A1}', description: 'Freedom in every keystroke.', category: 'multi_agent', stat: 'opencodeSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in OpenCode' },
  { id: 'agent_hopper', name: 'Agent Hopper', icon: '\u{1F407}', description: "Can't pick a favorite? Neither can we.", category: 'multi_agent', stat: 'agentSwitchDays', tiers: [2, 4, 6, 8, 10], trigger: 'Days where you used 2+ different CLI agents' },
  { id: 'double_agent', name: 'Double Agent', icon: '\u{1F575}', description: 'Playing both sides. Respect.', category: 'multi_agent', stat: 'doubleAgentDays', tiers: [5, 25, 100, 250, 500], trigger: 'Days with sessions in 2+ different CLI agents' },
```

**Step 4: Add stat queries in compute.ts flattenStats**

In `src/achievements/compute.ts`, add these queries inside `flattenStats()` (in the section where multi-agent stats are computed):

```typescript
// Cross-agent stats
flat.distinctAgentsUsed = this.queryScalar('SELECT COUNT(DISTINCT agent) FROM sessions')
flat.geminiSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'gemini-cli'")
flat.copilotSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'copilot-cli'")
flat.opencodeSessions = this.queryScalar("SELECT COUNT(*) FROM sessions WHERE agent = 'opencode'")
flat.doubleAgentDays = this.queryScalar(
  "SELECT COUNT(*) FROM (SELECT substr(started_at, 1, 10) as d FROM sessions GROUP BY d HAVING COUNT(DISTINCT agent) >= 2)"
)
flat.agentSwitchDays = flat.doubleAgentDays // same metric
```

**Step 5: Run tests**

Run: `npx vitest run src/achievements/compute.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/constants.ts src/achievements/compute.ts src/achievements/compute.test.ts
git commit -m "feat: add 6 cross-agent badges for multi-agent tracking"
```

---

### Task 10: Add Agent Filter to API Endpoints

**Files:**
- Modify: `src/dashboard/server.ts:11-64`
- Test: `src/dashboard/server.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to src/dashboard/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest' // or use fetch
import { createApp } from './server.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import fs from 'fs'

describe('API agent filtering', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let app: ReturnType<typeof createApp>
  const dbPath = '__test_server_agents.db'

  beforeEach(() => {
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    app = createApp(db)

    writer.recordSessionStart('s1', '/proj', 'startup', 'claude-code')
    writer.recordSessionEnd('s1', 'stopped')
    writer.recordSessionStart('s2', '/proj', 'startup', 'gemini-cli')
    writer.recordSessionEnd('s2', 'stopped')
  })

  afterEach(() => {
    db.close()
    fs.unlinkSync(dbPath)
  })

  it('GET /api/agents returns breakdown', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)
    expect(res.body.favoriteAgent).toBeDefined()
    expect(res.body.sessionsPerAgent).toBeDefined()
  })

  it('GET /api/sessions?agent=claude-code filters sessions', async () => {
    const res = await request(app).get('/api/sessions?agent=claude-code')
    expect(res.status).toBe(200)
    expect(res.body.length).toBe(1)
    expect(res.body[0].agent).toBe('claude-code')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/dashboard/server.test.ts`
Expected: FAIL -- /api/agents endpoint doesn't exist

**Step 3: Update server.ts**

```typescript
// In src/dashboard/server.ts, update existing endpoints to accept ?agent param
// and add the new /api/agents endpoint.

app.get('/api/stats', (req, res) => {
  try {
    const agent = req.query.agent as string | undefined
    res.json(stats.getAllStats(agent))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

app.get('/api/achievements', (req, res) => {
  try {
    const agent = req.query.agent as string | undefined
    res.json(achievements.getAchievementsPayload(agent))
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch achievements' })
  }
})

app.get('/api/sessions', (req, res) => {
  try {
    const agent = req.query.agent as string | undefined
    let sql = 'SELECT * FROM sessions'
    const params: unknown[] = []
    if (agent) {
      sql += ' WHERE agent = ?'
      params.push(agent)
    }
    sql += ' ORDER BY started_at DESC LIMIT 100'
    const sessions = db.prepare(sql).all(...params)
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

// New endpoint
app.get('/api/agents', (_req, res) => {
  try {
    res.json(stats.getAgentBreakdown())
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agent breakdown' })
  }
})
```

Also update `getAchievementsPayload` in `src/achievements/compute.ts` to accept optional agent filter and pass it through to `stats.getAllStats(agent)`.

**Step 4: Run tests**

Run: `npx vitest run src/dashboard/server.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/dashboard/server.ts src/dashboard/server.test.ts src/achievements/compute.ts
git commit -m "feat: add agent filter to API endpoints and /api/agents endpoint"
```

---

### Task 11: Dashboard UI - Agent Dropdown and Breakdown Panel

**Files:**
- Modify: `src/dashboard/static/index.html`

This is the largest single task. The changes are UI-only (HTML/CSS/JS in the SPA).

**Step 1: Add agent dropdown to header**

In the header section (around line 1031), add a dropdown:

```html
<select id="agent-filter" class="agent-filter">
  <option value="">All Agents</option>
  <option value="claude-code">Claude Code</option>
  <option value="gemini-cli">Gemini CLI</option>
  <option value="copilot-cli">Copilot CLI</option>
  <option value="opencode">OpenCode</option>
</select>
```

**Step 2: Add CSS for dropdown and agent badges**

```css
.agent-filter {
  background: var(--card-bg);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 0.85rem;
  cursor: pointer;
}

.agent-badge {
  display: inline-block;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--card-bg);
  border: 1px solid var(--border);
  opacity: 0.8;
}

.agent-badge.claude-code { border-color: #d97706; }
.agent-badge.gemini-cli { border-color: #4285f4; }
.agent-badge.copilot-cli { border-color: #6e40c9; }
.agent-badge.opencode { border-color: #10b981; }

.stat-na {
  opacity: 0.4;
  font-style: italic;
}

.agent-breakdown { margin: 1rem 0; }
.agent-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.agent-bar-fill {
  height: 20px;
  border-radius: 4px;
  min-width: 4px;
  transition: width 0.3s ease;
}
```

**Step 3: Update JavaScript state and fetch logic**

Add to the state object:

```javascript
let selectedAgent = ''
let agentBreakdown = null
```

Update `loadAllData()` to include agent filter:

```javascript
async function loadAllData() {
  const agentParam = selectedAgent ? `?agent=${selectedAgent}` : ''
  const [s, a, act, sess, agents] = await Promise.all([
    fetchJSON(`/api/stats${agentParam}`),
    fetchJSON(`/api/achievements${agentParam}`),
    fetchJSON(`/api/activity?days=365${selectedAgent ? `&agent=${selectedAgent}` : ''}`),
    fetchJSON(`/api/sessions${agentParam}`),
    fetchJSON('/api/agents'),
  ])
  stats = s; achievements = a; activity = act; sessions = sess; agentBreakdown = agents
  renderAll()
}
```

Add event listener for dropdown:

```javascript
document.getElementById('agent-filter').addEventListener('change', (e) => {
  selectedAgent = e.target.value
  loadAllData()
})
```

**Step 4: Add agent breakdown panel to renderOverview()**

```javascript
function renderAgentBreakdown() {
  if (selectedAgent || !agentBreakdown) return ''
  const maxSessions = Math.max(...Object.values(agentBreakdown.sessionsPerAgent), 1)
  const bars = Object.entries(agentBreakdown.sessionsPerAgent)
    .sort(([,a], [,b]) => b - a)
    .map(([agent, count]) => {
      const pct = (count / maxSessions * 100).toFixed(0)
      const hours = agentBreakdown.hoursPerAgent[agent] ?? 0
      const colors = { 'claude-code': '#d97706', 'gemini-cli': '#4285f4', 'copilot-cli': '#6e40c9', 'opencode': '#10b981' }
      return `<div class="agent-bar">
        <span style="width:90px;font-size:0.8rem">${escapeHtml(agent)}</span>
        <div style="flex:1;background:var(--border);border-radius:4px;height:20px">
          <div class="agent-bar-fill" style="width:${pct}%;background:${colors[agent] ?? 'var(--accent)'}"></div>
        </div>
        <span style="font-size:0.8rem;width:80px;text-align:right">${count} sess / ${hours}h</span>
      </div>`
    }).join('')

  const names = { 'claude-code': 'Claude Code', 'gemini-cli': 'Gemini CLI', 'copilot-cli': 'Copilot CLI', 'opencode': 'OpenCode' }
  return `<div class="card agent-breakdown">
    <h3>Agent Breakdown</h3>
    <p>Favorite: <strong>${escapeHtml(names[agentBreakdown.favoriteAgent] ?? agentBreakdown.favoriteAgent)}</strong> | ${agentBreakdown.distinctAgents} agents used</p>
    ${bars}
  </div>`
}
```

**Step 5: Add agent label to session list items**

In the session rendering code, add a small badge after each session entry:

```javascript
const agentLabel = `<span class="agent-badge ${sess.agent}">${sess.agent}</span>`
```

**Step 6: Manual test**

Run: `npx tsup && node dist/cli.js web`
Verify:
- Dropdown appears in header
- Selecting an agent filters stats, achievements, sessions
- Agent breakdown panel appears with bar chart
- N/A shows for unavailable stats
- Session list shows agent labels

**Step 7: Commit**

```bash
git add src/dashboard/static/index.html
git commit -m "feat: add agent filter dropdown and breakdown panel to dashboard"
```

---

### Task 12: Update Types and Exports

**Files:**
- Modify: `src/types.ts:202-208` (AllStats)
- Modify: `src/index.ts`

**Step 1: Add AgentBreakdown type**

In `src/types.ts`, add after the `AllStats` interface:

```typescript
export interface AgentBreakdown {
  favoriteAgent: string
  sessionsPerAgent: Record<string, number>
  hoursPerAgent: Record<string, number>
  distinctAgents: number
}
```

**Step 2: Export new modules from index.ts**

Ensure `src/index.ts` re-exports the new installer modules so they're accessible:

```typescript
export { installGemini, uninstallGemini, isGeminiAvailable } from './installer/gemini.js'
export { installCopilot, uninstallCopilot, isCopilotAvailable } from './installer/copilot.js'
export { installOpenCode, uninstallOpenCode, isOpenCodeAvailable } from './installer/opencode.js'
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/types.ts src/index.ts
git commit -m "feat: add AgentBreakdown type and export new installer modules"
```

---

### Task 13: Final Integration Test

**Step 1: Build the project**

Run: `npx tsup`
Expected: Build succeeds with no errors

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Manual smoke test**

Run: `node dist/cli.js init`
Expected: Output shows "Installed hooks for: Claude Code" (plus any detected agents)

Run: `node dist/cli.js web --no-open`
Expected: Server starts. Visit http://127.0.0.1:17900 manually. Verify:
- Agent dropdown in header
- Agent breakdown panel (empty data is OK)
- Selecting agent filters work
- No console errors

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: multi-agent support for Gemini CLI, Copilot CLI, and OpenCode"
```
