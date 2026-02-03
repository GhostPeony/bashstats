import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUserByGithubId } from '@/lib/db'
import TokenReveal from './token-reveal'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Get Started - bashstats',
}

export default async function TokenPage() {
  const session = await getSession()
  if (!session) {
    redirect('/api/auth/github')
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    redirect('/')
  }

  const hasUploaded = !!user.last_upload_at

  return (
    <main className="container section">
      <h1 style={{ marginBottom: 8 }}>Welcome, @{user.username}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
        {hasUploaded
          ? 'Your stats are synced. You\'re all set.'
          : 'You\'re signed in. Follow the steps below to start tracking your stats.'}
      </p>

      {!hasUploaded && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="step-num">1</span>
              <h3>Install & initialize</h3>
            </div>
            <div className="code-block" style={{ display: 'block' }}>
              npm install -g bashstats && bashstats init
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span className="step-num">2</span>
              <h3>Connect your account</h3>
            </div>
            <div className="code-block" style={{ display: 'block' }}>
              bashstats login
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>
              Stats sync automatically after each session from here.
            </p>
          </div>
        </>
      )}

      {hasUploaded && (
        <div style={{ marginBottom: 24 }}>
          <a href={`/u/${user.username}`} className="btn btn-primary">View Profile</a>
          {' '}
          <a href="/leaderboard" className="btn">Leaderboard</a>
        </div>
      )}

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Trouble connecting? Use manual API token
        </summary>
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            Only use if <code className="mono">bashstats login</code> fails. Keep this secret.
          </p>
          <TokenReveal username={user.username} />
        </div>
      </details>
    </main>
  )
}
