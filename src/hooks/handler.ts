import path from 'path'
import os from 'os'
import fs from 'fs'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import type { AgentType } from '../types.js'
import { extractTokenUsage } from './transcript.js'

/**
 * Detect which CLI agent is running based on environment variables and process context.
 * Currently supports Claude Code (default), Gemini CLI, Copilot CLI, and OpenCode.
 */
export function detectAgent(): AgentType {
  if (process.env.GEMINI_CLI || process.env.GEMINI_API_KEY) return 'gemini-cli'
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
    const sessionId = (event.session_id as string) ?? ''
    const cwd = (event.cwd as string) ?? ''

    switch (hookType) {
      case 'SessionStart': {
        const source = (event.source as string) ?? 'startup'
        const agent = detectAgent()
        writer.recordSessionStart(sessionId, cwd, source, agent)
        break
      }

      case 'UserPromptSubmit': {
        const prompt = (event.prompt as string) ?? ''
        writer.recordPrompt(sessionId, prompt)
        break
      }

      case 'PreToolUse': {
        const toolName = (event.tool_name as string) ?? ''
        const toolInput = (event.tool_input as Record<string, unknown>) ?? {}
        writer.recordToolUse(sessionId, 'PreToolUse', toolName, toolInput, {}, 0, cwd)
        break
      }

      case 'PostToolUse': {
        const toolName = (event.tool_name as string) ?? ''
        const toolInput = (event.tool_input as Record<string, unknown>) ?? {}
        const toolResponse = (event.tool_response as Record<string, unknown>) ?? {}
        const exitCode = (event.exit_code as number) ?? 0
        writer.recordToolUse(sessionId, 'PostToolUse', toolName, toolInput, toolResponse, exitCode, cwd)
        break
      }

      case 'PostToolUseFailure': {
        const toolName = (event.tool_name as string) ?? ''
        const toolInput = (event.tool_input as Record<string, unknown>) ?? {}
        const toolResponse = (event.tool_response as Record<string, unknown>) ?? {}
        writer.recordToolUse(sessionId, 'PostToolUseFailure', toolName, toolInput, toolResponse, 1, cwd)
        break
      }

      case 'Stop': {
        const rawPath = (event.transcript_path as string) ?? ''
        const transcriptPath = rawPath && rawPath.endsWith('.jsonl') ? path.resolve(rawPath) : ''
        const tokens = transcriptPath ? await extractTokenUsage(transcriptPath) : null
        writer.recordSessionEnd(sessionId, 'stopped', tokens)
        break
      }

      case 'Notification': {
        const message = (event.message as string) ?? ''
        const notificationType = (event.notification_type as string) ?? ''
        writer.recordNotification(sessionId, message, notificationType)
        break
      }

      case 'SubagentStart': {
        const agentId = (event.agent_id as string) ?? ''
        const agentType = (event.agent_type as string) ?? ''
        writer.recordSubagent(sessionId, 'SubagentStart', agentId, agentType)
        break
      }

      case 'SubagentStop': {
        const agentId = (event.agent_id as string) ?? ''
        writer.recordSubagent(sessionId, 'SubagentStop', agentId)
        break
      }

      case 'PreCompact': {
        const trigger = (event.trigger as string) ?? 'manual'
        writer.recordCompaction(sessionId, trigger)
        break
      }

      case 'PermissionRequest': {
        const toolName = (event.tool_name as string) ?? ''
        const toolInput = (event.tool_input as Record<string, unknown>) ?? {}
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
