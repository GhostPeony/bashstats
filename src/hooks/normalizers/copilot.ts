/**
 * Copilot CLI hook event normalizer.
 *
 * Translates Copilot CLI hook event names and payloads into bashstats's
 * internal format so the shared handler can process them uniformly.
 *
 * Key differences from Claude/Gemini:
 *   - Copilot uses camelCase event names (sessionStart, not SessionStart)
 *   - toolArgs is a stringified JSON string, not an object
 *   - No session_id in payloads -- derived from PPID + date (parent process
 *     is the Copilot CLI process, consistent across all hook invocations)
 *   - postToolUse can be success OR failure based on toolResult.resultType
 *   - errorOccurred maps to PostToolUseFailure with tool_name="_error"
 *   - source values: "new" -> "startup", "resume" -> "resume"
 */

import type { NormalizedEvent } from './gemini.js'

/**
 * Safely parse a stringified JSON toolArgs value.
 * Returns {} on any parse failure (malformed JSON, null, undefined, etc.).
 */
export function parseToolArgs(toolArgs: string): Record<string, unknown> {
  if (!toolArgs || typeof toolArgs !== 'string') return {}
  try {
    return JSON.parse(toolArgs)
  } catch {
    return {}
  }
}

/**
 * Derive a session ID for Copilot events.
 * Copilot doesn't provide session_id in hook payloads, so we construct one
 * from the parent process PID (PPID) and the current date (YYYY-MM-DD).
 * Each hook invocation spawns a new child process, but the parent (Copilot CLI)
 * stays the same for the entire session, so PPID is consistent across events.
 */
function deriveSessionId(): string {
  const date = new Date().toISOString().slice(0, 10)
  const ppid = process.ppid ?? process.pid
  return `copilot-${ppid}-${date}`
}

/**
 * Map Copilot source values to bashstats internal source values.
 * "new" -> "startup", "resume" -> "resume", anything else -> "startup"
 */
function mapSource(source: unknown): string {
  if (source === 'resume') return 'resume'
  return 'startup'
}

/**
 * Determine if a postToolUse result represents a failure.
 * resultType of "failure" or "denied" = failure, everything else = success.
 */
function isToolFailure(toolResult: Record<string, unknown> | undefined): boolean {
  if (!toolResult) return false
  const resultType = toolResult.resultType
  return resultType === 'failure' || resultType === 'denied'
}

/**
 * Map a Copilot CLI hook event to a bashstats NormalizedEvent.
 * Returns null for events that have no bashstats equivalent.
 */
export function normalizeCopilotEvent(
  copilotEvent: string,
  raw: Record<string, unknown>,
): NormalizedEvent | null {
  const sessionId = deriveSessionId()

  switch (copilotEvent) {
    case 'sessionStart': {
      return {
        hookType: 'SessionStart',
        payload: {
          session_id: sessionId,
          source: mapSource(raw.source),
          ...(raw.model !== undefined ? { model: raw.model } : {}),
        },
      }
    }

    case 'sessionEnd': {
      return {
        hookType: 'Stop',
        payload: {
          session_id: sessionId,
          ...raw,
          stop_hook_active: false,
        },
      }
    }

    case 'userPromptSubmitted': {
      return {
        hookType: 'UserPromptSubmit',
        payload: {
          session_id: sessionId,
          prompt: raw.prompt,
        },
      }
    }

    case 'preToolUse': {
      return {
        hookType: 'PreToolUse',
        payload: {
          session_id: sessionId,
          tool_name: raw.toolName as string,
          tool_input: parseToolArgs(raw.toolArgs as string),
        },
      }
    }

    case 'postToolUse': {
      const toolResult = (raw.toolResult as Record<string, unknown>) ?? {}
      const failed = isToolFailure(
        raw.toolResult as Record<string, unknown> | undefined,
      )

      return {
        hookType: failed ? 'PostToolUseFailure' : 'PostToolUse',
        payload: {
          session_id: sessionId,
          tool_name: raw.toolName as string,
          tool_input: parseToolArgs(raw.toolArgs as string),
          tool_response: toolResult,
          exit_code: failed ? 1 : 0,
        },
      }
    }

    case 'errorOccurred': {
      const error = (raw.error as Record<string, unknown>) ?? {}
      return {
        hookType: 'PostToolUseFailure',
        payload: {
          session_id: sessionId,
          tool_name: '_error',
          tool_input: {},
          tool_response: {
            error_message: (error.message as string) ?? '',
            error_name: (error.name as string) ?? '',
          },
          exit_code: 1,
        },
      }
    }

    default:
      return null
  }
}
