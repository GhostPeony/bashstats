import fs from 'fs'
import readline from 'readline'
import type { TokenUsage } from '../types.js'

/**
 * Read a Claude Code transcript JSONL file and sum all token usage.
 * Returns null on any failure (missing file, no usage data, parse errors).
 */
export async function extractTokenUsage(transcriptPath: string): Promise<TokenUsage | null> {
  try {
    if (!fs.existsSync(transcriptPath)) return null

    const stream = fs.createReadStream(transcriptPath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    let inputTokens = 0
    let outputTokens = 0
    let cacheCreation = 0
    let cacheRead = 0
    let found = false

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        const usage = entry.usage ?? entry.response?.usage ?? entry.message?.usage
        if (usage && typeof usage === 'object') {
          inputTokens += usage.input_tokens ?? 0
          outputTokens += usage.output_tokens ?? 0
          cacheCreation += usage.cache_creation_input_tokens ?? 0
          cacheRead += usage.cache_read_input_tokens ?? 0
          found = true
        }
      } catch {
        // skip unparseable lines
      }
    }

    if (!found) return null

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
