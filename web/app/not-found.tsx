import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="container section" style={{ textAlign: 'center', paddingTop: 120, paddingBottom: 120 }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto', padding: 48 }}>
        <p className="mono accent" style={{ fontSize: '4rem', fontWeight: 700, marginBottom: 8 }}>404</p>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 12 }}>Page Not Found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn">Home</Link>
          <Link href="/leaderboard" className="btn btn-primary">Leaderboard</Link>
        </div>
      </div>
    </main>
  )
}
