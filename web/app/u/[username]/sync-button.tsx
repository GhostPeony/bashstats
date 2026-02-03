'use client'

import { useState } from 'react'

export default function SyncButton() {
  const [state, setState] = useState<'idle' | 'copied' | 'checking'>('idle')

  async function handleSync() {
    await navigator.clipboard.writeText('bashstats share')
    setState('copied')
    setTimeout(() => setState('idle'), 3000)
  }

  function handleRefresh() {
    setState('checking')
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button className="btn" onClick={handleSync} style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
        {state === 'copied' ? 'Copied! Run in terminal' : 'Sync Stats'}
      </button>
      <button
        className="btn"
        onClick={handleRefresh}
        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
        title="Refresh to check for new data"
      >
        {state === 'checking' ? 'Checking...' : 'Refresh'}
      </button>
    </div>
  )
}
