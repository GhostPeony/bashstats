import fs from 'fs'
import path from 'path'
import os from 'os'
import { DATA_DIR } from '../constants.js'
import type { ProfileSnapshot } from '../types.js'

const AUTH_FILE = path.join(os.homedir(), DATA_DIR, 'auth.json')
const UPLOAD_URL = 'https://bashstats.com/api/upload'

export interface AuthConfig {
  api_token: string
  username: string
}

export function getAuth(): AuthConfig | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null
    const raw = fs.readFileSync(AUTH_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as AuthConfig
    if (!parsed.api_token || !parsed.username) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAuth(auth: AuthConfig): void {
  const dir = path.dirname(AUTH_FILE)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2), 'utf-8')
}

export function deleteAuth(): boolean {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE)
      return true
    }
    return false
  } catch {
    return false
  }
}

export async function uploadSnapshot(
  snapshot: ProfileSnapshot,
  apiToken: string,
  timeoutMs: number = 10000,
): Promise<{ ok: boolean; status: number; message: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(snapshot),
      signal: controller.signal,
    })

    const body = await res.text()
    let message = ''
    try {
      message = JSON.parse(body).message ?? body
    } catch {
      message = body
    }

    return { ok: res.ok, status: res.status, message }
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, status: 0, message: 'Upload timed out' }
    }
    return { ok: false, status: 0, message: String(err) }
  } finally {
    clearTimeout(timer)
  }
}
