import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp } from './server.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { Express } from 'express'

// Simple helper to test express app without starting server
async function request(app: Express, path: string) {
  // Use node's http to make a request
  return new Promise<{ status: number; body: unknown }>((resolve) => {
    const http = require('http')
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      http.get(`http://127.0.0.1:${addr.port}${path}`, (res: any) => {
        let data = ''
        res.on('data', (chunk: string) => { data += chunk })
        res.on('end', () => {
          server.close()
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      })
    })
  })
}

describe('Dashboard Server', () => {
  let db: BashStatsDB
  let dbPath: string
  let app: Express

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-server-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    app = createApp(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should return health check', async () => {
    const res = await request(app, '/api/health')
    expect(res.status).toBe(200)
    expect((res.body as any).status).toBe('ok')
  })

  it('should return stats', async () => {
    const res = await request(app, '/api/stats')
    expect(res.status).toBe(200)
    expect((res.body as any).lifetime).toBeDefined()
    expect((res.body as any).tools).toBeDefined()
  })

  it('should return achievements', async () => {
    const res = await request(app, '/api/achievements')
    expect(res.status).toBe(200)
    expect((res.body as any).badges).toBeDefined()
    expect((res.body as any).xp).toBeDefined()
  })

  it('should return daily activity', async () => {
    const writer = new BashStatsWriter(db)
    writer.recordSessionStart('s1', '/tmp', 'startup')
    const res = await request(app, '/api/activity')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('should return sessions', async () => {
    const writer = new BashStatsWriter(db)
    writer.recordSessionStart('s1', '/tmp', 'startup')
    const res = await request(app, '/api/sessions')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect((res.body as any[]).length).toBe(1)
  })

  it('should return agent breakdown', async () => {
    const writer = new BashStatsWriter(db)
    writer.recordSessionStart('s1', '/tmp', 'startup', 'claude-code')
    writer.recordSessionStart('s2', '/tmp', 'startup', 'gemini-cli')
    const res = await request(app, '/api/agents')
    expect(res.status).toBe(200)
    expect((res.body as any).distinctAgents).toBe(2)
    expect((res.body as any).sessionsPerAgent).toBeDefined()
    expect((res.body as any).sessionsPerAgent['claude-code']).toBe(1)
    expect((res.body as any).sessionsPerAgent['gemini-cli']).toBe(1)
  })

  it('should filter sessions by agent', async () => {
    const writer = new BashStatsWriter(db)
    writer.recordSessionStart('s1', '/tmp', 'startup', 'claude-code')
    writer.recordSessionStart('s2', '/tmp', 'startup', 'gemini-cli')
    writer.recordSessionStart('s3', '/tmp', 'startup', 'claude-code')

    const all = await request(app, '/api/sessions')
    expect((all.body as any[]).length).toBe(3)

    const filtered = await request(app, '/api/sessions?agent=claude-code')
    expect(filtered.status).toBe(200)
    expect(Array.isArray(filtered.body)).toBe(true)
    expect((filtered.body as any[]).length).toBe(2)
    for (const s of filtered.body as any[]) {
      expect(s.agent).toBe('claude-code')
    }
  })
})
