import { describe, it, expect, afterEach } from 'vitest'
import { extractTokenUsage } from './transcript.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

function writeTempJsonl(lines: object[]): string {
  const filePath = path.join(os.tmpdir(), `bashstats-transcript-test-${Date.now()}.jsonl`)
  const content = lines.map(l => JSON.stringify(l)).join('\n') + '\n'
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

describe('extractTokenUsage', () => {
  const tempFiles: string[] = []

  afterEach(() => {
    for (const f of tempFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
    tempFiles.length = 0
  })

  it('should return null for missing file', async () => {
    const result = await extractTokenUsage('/nonexistent/file.jsonl')
    expect(result).toBeNull()
  })

  it('should return null for file with no usage data', async () => {
    const f = writeTempJsonl([
      { type: 'user', message: { role: 'user', content: 'hello' } },
    ])
    tempFiles.push(f)
    const result = await extractTokenUsage(f)
    expect(result).toBeNull()
  })

  it('should extract usage from a single message', async () => {
    const f = writeTempJsonl([
      {
        type: 'assistant',
        message: {
          id: 'msg_001',
          role: 'assistant',
          usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 200, cache_read_input_tokens: 500 },
        },
      },
    ])
    tempFiles.push(f)
    const result = await extractTokenUsage(f)
    expect(result).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: 500,
    })
  })

  it('should deduplicate entries with the same message ID', async () => {
    // Simulates Claude Code writing multiple streaming content blocks per API call
    const f = writeTempJsonl([
      {
        type: 'assistant',
        message: {
          id: 'msg_001',
          role: 'assistant',
          content: [{ type: 'text', text: 'thinking...' }],
          usage: { input_tokens: 3, output_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 15000 },
        },
      },
      {
        type: 'assistant',
        message: {
          id: 'msg_001',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_1', name: 'Read', input: {} }],
          usage: { input_tokens: 3, output_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 15000 },
        },
      },
      {
        type: 'assistant',
        message: {
          id: 'msg_001',
          role: 'assistant',
          content: [{ type: 'tool_use', id: 'tool_2', name: 'Write', input: {} }],
          usage: { input_tokens: 3, output_tokens: 2, cache_creation_input_tokens: 4000, cache_read_input_tokens: 15000 },
        },
      },
    ])
    tempFiles.push(f)
    const result = await extractTokenUsage(f)
    // Should count msg_001 only ONCE, not 3 times
    expect(result).toEqual({
      input_tokens: 3,
      output_tokens: 2,
      cache_creation_input_tokens: 4000,
      cache_read_input_tokens: 15000,
    })
  })

  it('should sum usage across different message IDs', async () => {
    const f = writeTempJsonl([
      {
        type: 'assistant',
        message: {
          id: 'msg_001',
          role: 'assistant',
          usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 100, cache_read_input_tokens: 500 },
        },
      },
      {
        type: 'assistant',
        message: {
          id: 'msg_002',
          role: 'assistant',
          usage: { input_tokens: 5, output_tokens: 30, cache_creation_input_tokens: 200, cache_read_input_tokens: 1000 },
        },
      },
    ])
    tempFiles.push(f)
    const result = await extractTokenUsage(f)
    expect(result).toEqual({
      input_tokens: 15,
      output_tokens: 50,
      cache_creation_input_tokens: 300,
      cache_read_input_tokens: 1500,
    })
  })

  it('should handle mixed duplicate and unique messages', async () => {
    const f = writeTempJsonl([
      // msg_001 appears 3 times (streaming blocks)
      { type: 'assistant', message: { id: 'msg_001', usage: { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 } } },
      { type: 'assistant', message: { id: 'msg_001', usage: { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 } } },
      { type: 'assistant', message: { id: 'msg_001', usage: { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000 } } },
      // msg_002 appears 2 times
      { type: 'assistant', message: { id: 'msg_002', usage: { input_tokens: 1, output_tokens: 20, cache_creation_input_tokens: 50, cache_read_input_tokens: 2000 } } },
      { type: 'assistant', message: { id: 'msg_002', usage: { input_tokens: 1, output_tokens: 20, cache_creation_input_tokens: 50, cache_read_input_tokens: 2000 } } },
    ])
    tempFiles.push(f)
    const result = await extractTokenUsage(f)
    // Should be msg_001 + msg_002, not 3*msg_001 + 2*msg_002
    expect(result).toEqual({
      input_tokens: 6,
      output_tokens: 30,
      cache_creation_input_tokens: 150,
      cache_read_input_tokens: 3000,
    })
  })
})
