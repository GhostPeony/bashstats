import path from 'path'
import os from 'os'
import fs from 'fs'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import type { AgentType, TokenUsage } from '../types.js'
import { extractTokenUsage } from './transcript.js'
import { normalizeGeminiEvent } from './normalizers/gemini.js'
import { normalizeCopilotEvent } from './normalizers/copilot.js'

/**
 * Detect which CLI agent is running based on environment variables and process context.
 * Currently supports Claude Code (default), Gemini CLI, Copilot CLI, and OpenCode.
 */
export function detectAgent(): AgentType {
  if (process.env.GEMINI_SESSION_ID || process.env.GEMINI_PROJECT_DIR || process.env.GEMINI_CLI || process.env.GEMINI_API_KEY) return 'gemini-cli'
  if (process.env.GITHUB_COPILOT_CLI) return 'copilot-cli'
  if (process.env.OPENCODE) return 'opencode'
  return 'claude-code'
}

export function parseHookEvent(input: string): Record<string, unknown> | null {
  try {
    if (!input) return null
    return JSON.parse(input) as Record<string, unknown>
  } catch {
    return null
  }
}

export function getProjectFromCwd(cwd: string): string {
  return path.basename(cwd)
}

export function getDataDir(): string {
  return path.join(os.homedir(), DATA_DIR)
}

export function getDbPath(): string {
  return path.join(os.homedir(), DATA_DIR, DB_FILENAME)
}

export async function readStdin(): Promise<string> {
  if (process.env.CLAUDE_HOOK_EVENT) {
    return process.env.CLAUDE_HOOK_EVENT
  }

  return new Promise<string>((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => {
      resolve(data)
    })
  })
}

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

    // Normalize events for non-Claude agents
    let effectiveHookType = hookType
    let payload: Record<string, unknown> = event

    if (agent === 'gemini-cli') {
      const normalized = normalizeGeminiEvent(hookType, event)
      if (!normalized) return

      // For AfterModel events, accumulate token counts in metadata and return early
      if (normalized.hookType === 'AfterModel') {
        if (normalized.tokenData) {
          const sessionId = (event.session_id as string) ?? ''
          const metaKey = `gemini_tokens_${sessionId}`
          const existing = db.getMetadata(metaKey)
          const prev = existing ? parseInt(existing, 10) : 0
          db.setMetadata(metaKey, String(prev + normalized.tokenData.totalTokenCount))
        }
        return
      }

      effectiveHookType = normalized.hookType
      payload = normalized.payload
    } else if (agent === 'copilot-cli') {
      const normalized = normalizeCopilotEvent(hookType, event)
      if (!normalized) return

      effectiveHookType = normalized.hookType
      payload = normalized.payload
    }

    const sessionId = (payload.session_id as string) ?? ''
    const cwd = (payload.cwd as string) ?? ''

    switch (effectiveHookType) {
      case 'SessionStart': {
        const source = (payload.source as string) ?? 'startup'
        writer.recordSessionStart(sessionId, cwd, source, agent)
        break
      }

      case 'UserPromptSubmit': {
        const prompt = (payload.prompt as string) ?? ''
        writer.recordPrompt(sessionId, prompt)
        break
      }

      case 'PreToolUse': {
        const toolName = (payload.tool_name as string) ?? ''
        const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}
        writer.recordToolUse(sessionId, 'PreToolUse', toolName, toolInput, {}, 0, cwd)
        break
      }

      case 'PostToolUse': {
        const toolName = (payload.tool_name as string) ?? ''
        const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}
        const toolResponse = (payload.tool_response as Record<string, unknown>) ?? {}
        const exitCode = (payload.exit_code as number) ?? 0
        writer.recordToolUse(sessionId, 'PostToolUse', toolName, toolInput, toolResponse, exitCode, cwd)
        break
      }

      case 'PostToolUseFailure': {
        const toolName = (payload.tool_name as string) ?? ''
        const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}
        const toolResponse = (payload.tool_response as Record<string, unknown>) ?? {}
        writer.recordToolUse(sessionId, 'PostToolUseFailure', toolName, toolInput, toolResponse, 1, cwd)
        break
      }

      case 'Stop': {
        let tokens: TokenUsage | null = null

        if (agent === 'gemini-cli') {
          // Retrieve accumulated tokens from metadata
          const metaKey = `gemini_tokens_${sessionId}`
          const stored = db.getMetadata(metaKey)
          if (stored) {
            const totalTokens = parseInt(stored, 10)
            // Approximate 70/30 split for input/output
            const inputTokens = Math.round(totalTokens * 0.7)
            const outputTokens = totalTokens - inputTokens
            tokens = {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
            }
          }
        } else if (agent === 'copilot-cli') {
          // Copilot CLI does not provide token data through hooks
          tokens = null
        } else {
          // Claude Code: parse transcript file for tokens
          const rawPath = (payload.transcript_path as string) ?? ''
          const transcriptPath = rawPath && rawPath.endsWith('.jsonl') ? path.resolve(rawPath) : ''
          tokens = transcriptPath ? await extractTokenUsage(transcriptPath) : null
        }

        writer.recordSessionEnd(sessionId, 'stopped', tokens)
        break
      }

      case 'Notification': {
        const message = (payload.message as string) ?? ''
        const notificationType = (payload.notification_type as string) ?? ''
        writer.recordNotification(sessionId, message, notificationType)
        break
      }

      case 'SubagentStart': {
        const agentId = (payload.agent_id as string) ?? ''
        const agentType = (payload.agent_type as string) ?? ''
        writer.recordSubagent(sessionId, 'SubagentStart', agentId, agentType)
        break
      }

      case 'SubagentStop': {
        const agentId = (payload.agent_id as string) ?? ''
        writer.recordSubagent(sessionId, 'SubagentStop', agentId)
        break
      }

      case 'PreCompact': {
        const trigger = (payload.trigger as string) ?? 'manual'
        writer.recordCompaction(sessionId, trigger)
        break
      }

      case 'PermissionRequest': {
        const toolName = (payload.tool_name as string) ?? ''
        const toolInput = (payload.tool_input as Record<string, unknown>) ?? {}
        writer.recordToolUse(sessionId, 'PermissionRequest', toolName, toolInput, {}, 0, cwd)
        break
      }

      case 'Setup': {
        // no-op
        return
      }
    }
  } finally {
    db.close()
  }
}
