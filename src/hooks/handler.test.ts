import { describe, it, expect } from 'vitest'
import { parseHookEvent, getProjectFromCwd } from './handler.js'

describe('parseHookEvent', () => {
  it('should parse valid JSON', () => {
    const input = JSON.stringify({ session_id: 's1', tool_name: 'Bash', cwd: '/tmp' })
    const result = parseHookEvent(input)
    expect(result).not.toBeNull()
    expect(result!.session_id).toBe('s1')
    expect(result!.tool_name).toBe('Bash')
  })

  it('should return null for invalid JSON', () => {
    const result = parseHookEvent('not json')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = parseHookEvent('')
    expect(result).toBeNull()
  })
})

describe('getProjectFromCwd', () => {
  it('should extract project name from unix path', () => {
    expect(getProjectFromCwd('/home/user/projects/myapp')).toBe('myapp')
  })

  it('should extract project name from windows path', () => {
    expect(getProjectFromCwd('C:\\Users\\Cade\\projects\\stats')).toBe('stats')
  })
})
