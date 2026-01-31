/**
 * Gemini CLI hook event normalizer.
 *
 * Translates Gemini CLI hook event names and payloads into bashstats's
 * internal format so the shared handler can process them uniformly.
 */

export interface NormalizedEvent {
  hookType: string
  payload: Record<string, unknown>
  tokenData?: { totalTokenCount: number }
}

/**
 * Map a Gemini CLI hook event to a bashstats NormalizedEvent.
 * Returns null for events that have no bashstats equivalent.
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
        payload: { ...raw, stop_hook_active: false },
      }

    case 'BeforeAgent':
      return { hookType: 'UserPromptSubmit', payload: raw }

    case 'BeforeTool':
      return { hookType: 'PreToolUse', payload: raw }

    case 'AfterTool':
      return { hookType: 'PostToolUse', payload: raw }

    case 'AfterModel': {
      const usageMetadata = (
        raw.llm_response as Record<string, unknown> | undefined
      )?.usageMetadata as Record<string, unknown> | undefined

      const totalTokenCount =
        typeof usageMetadata?.totalTokenCount === 'number'
          ? usageMetadata.totalTokenCount
          : undefined

      return {
        hookType: 'AfterModel',
        payload: raw,
        ...(totalTokenCount !== undefined ? { tokenData: { totalTokenCount } } : {}),
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
