'use client'

import { useState } from 'react'

export default function TokenReveal({ username }: { username: string }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleReveal() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/token')
      if (!res.ok) throw new Error('Failed to fetch token')
      const data = await res.json()
      setToken(data.api_token)
    } catch {
      setToken('Error fetching token. Please refresh and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!token) return
    const json = JSON.stringify({ api_token: token, username }, null, 2)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  if (!token) {
    return (
      <button className="btn" onClick={handleReveal} disabled={loading} style={{ fontSize: '0.8rem' }}>
        {loading ? 'Loading...' : 'Reveal API Token'}
      </button>
    )
  }

  const masked = token.slice(0, 8) + '\u2026' + token.slice(-4)

  return (
    <div>
      <div className="token-box" style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {masked}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={handleCopy} style={{ fontSize: '0.8rem' }}>
          {copied ? 'Copied!' : 'Copy auth.json'}
        </button>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
        Save to <code className="mono">~/.bashstats/auth.json</code>
      </p>
    </div>
  )
}
