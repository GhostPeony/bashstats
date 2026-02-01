import fs from 'fs'
import readline from 'readline'
import type { TokenUsage } from '../types.js'

/**
 * Read a Claude Code transcript JSONL file and sum all token usage.
 *
 * Claude Code writes multiple transcript entries per API call (one per streaming
 * content block), each carrying the same usage object. We deduplicate by message
 * ID so each API call's usage is counted exactly once.
 *
 * Returns null on any failure (missing file, no usage data, parse errors).
 */
export async function extractTokenUsage(transcriptPath: string): Promise<TokenUsage | null> {
  try {
    if (!fs.existsSync(transcriptPath)) return null

    const stream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    // Track usage per unique message ID to avoid counting streaming duplicates
    const seenMessages = new Map<string, {
      input_tokens: number
      output_tokens: number
      cache_creation_input_tokens: number
      cache_read_input_tokens: number
    }>()

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        const usage = entry.usage ?? entry.response?.usage ?? entry.message?.usage
        if (usage && typeof usage === 'object' && 'input_tokens' in usage) {
          // Use message ID to deduplicate; fall back to a unique key if absent
          const msgId = entry.message?.id ?? entry.id ?? `_line_${seenMessages.size}`
          // Keep the last occurrence (most complete usage data for this message)
          seenMessages.set(msgId, {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
          })
        }
      } catch {
        // skip unparseable lines
      }
    }

    if (seenMessages.size === 0) return null

    let inputTokens = 0
    let outputTokens = 0
    let cacheCreation = 0
    let cacheRead = 0
    for (const u of seenMessages.values()) {
      inputTokens += u.input_tokens
      outputTokens += u.output_tokens
      cacheCreation += u.cache_creation_input_tokens
      cacheRead += u.cache_read_input_tokens
    }

    return {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_creation_input_tokens: cacheCreation,
      cache_read_input_tokens: cacheRead,
    }
  } catch {
    return null
  }
}
