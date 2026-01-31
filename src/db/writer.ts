import { BashStatsDB } from './database.js'
import type { TokenUsage } from '../types.js'
import path from 'path'

export class BashStatsWriter {
  private db: BashStatsDB

  constructor(db: BashStatsDB) {
    this.db = db
  }

  private extractProject(cwd: string): string {
    return path.basename(cwd)
  }

  private today(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  private now(): string {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ms = String(d.getMilliseconds()).padStart(3, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
  }

  recordSessionStart(sessionId: string, cwd: string, source: string, agent?: string): void {
    const project = this.extractProject(cwd)
    const timestamp = this.now()

    this.db.insertSession({
      id: sessionId,
      agent,
      started_at: timestamp,
      project,
    })

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'SessionStart',
      tool_name: null,
      tool_input: JSON.stringify({ source }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd,
      project,
      timestamp,
    })

    this.db.incrementDailyActivity(this.today(), { sessions: 1 })
  }

  recordPrompt(sessionId: string, content: string): void {
    const timestamp = this.now()
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length
    const charCount = content.length

    this.db.insertPrompt({
      session_id: sessionId,
      content,
      char_count: charCount,
      word_count: wordCount,
      timestamp,
    })

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'UserPromptSubmit',
      tool_name: null,
      tool_input: null,
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp,
    })

    this.db.incrementSessionCounters(sessionId, { prompts: 1 })
    this.db.incrementDailyActivity(this.today(), { prompts: 1 })
  }

  recordToolUse(
    sessionId: string,
    hookType: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    toolOutput: Record<string, unknown>,
    exitCode: number | null,
    cwd: string,
  ): void {
    const timestamp = this.now()
    const project = this.extractProject(cwd)
    const success = exitCode === 0 ? 1 : 0

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: hookType,
      tool_name: toolName,
      tool_input: JSON.stringify(toolInput),
      tool_output: JSON.stringify(toolOutput),
      exit_code: exitCode,
      success,
      cwd,
      project,
      timestamp,
    })

    this.db.incrementSessionCounters(sessionId, {
      tools: 1,
      errors: success === 0 ? 1 : 0,
    })

    this.db.incrementDailyActivity(this.today(), {
      tool_calls: 1,
      errors: success === 0 ? 1 : 0,
    })
  }

  recordSessionEnd(sessionId: string, stopReason: string, tokens?: TokenUsage | null): void {
    const timestamp = this.now()
    const session = this.db.getSession(sessionId)

    let durationSeconds: number | undefined
    if (session) {
      const startTime = new Date(session.started_at).getTime()
      const endTime = new Date(timestamp).getTime()
      durationSeconds = Math.round((endTime - startTime) / 1000)
    }

    this.db.updateSession(sessionId, {
      ended_at: timestamp,
      stop_reason: stopReason,
      duration_seconds: durationSeconds,
    })

    if (tokens) {
      this.db.updateSessionTokens(sessionId, tokens)
    }

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'Stop',
      tool_name: null,
      tool_input: JSON.stringify({ stop_reason: stopReason }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp,
    })

    const dailyIncrements: Record<string, number> = {}
    if (durationSeconds !== undefined) {
      dailyIncrements.duration_seconds = durationSeconds
    }
    if (tokens) {
      dailyIncrements.input_tokens = tokens.input_tokens
      dailyIncrements.output_tokens = tokens.output_tokens
      dailyIncrements.cache_creation_input_tokens = tokens.cache_creation_input_tokens
      dailyIncrements.cache_read_input_tokens = tokens.cache_read_input_tokens
    }
    if (Object.keys(dailyIncrements).length > 0) {
      this.db.incrementDailyActivity(this.today(), dailyIncrements)
    }
  }

  recordNotification(sessionId: string, message: string, notificationType: string): void {
    const timestamp = this.now()
    const isError = notificationType === 'error' || notificationType === 'rate_limit'

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'Notification',
      tool_name: null,
      tool_input: JSON.stringify({ message, notification_type: notificationType }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp,
    })

    if (isError) {
      this.db.incrementSessionCounters(sessionId, { errors: 1 })
      this.db.incrementDailyActivity(this.today(), { errors: 1 })
    }
  }

  recordSubagent(sessionId: string, hookType: string, agentId: string, agentType?: string): void {
    const timestamp = this.now()

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: hookType,
      tool_name: null,
      tool_input: JSON.stringify({ agent_id: agentId, agent_type: agentType ?? null }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp,
    })
  }

  recordCompaction(sessionId: string, trigger: string): void {
    const timestamp = this.now()

    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'PreCompact',
      tool_name: null,
      tool_input: JSON.stringify({ trigger }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp,
    })
  }
}
