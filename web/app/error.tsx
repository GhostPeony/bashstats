'use client'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="container section" style={{ textAlign: 'center', paddingTop: 120, paddingBottom: 120 }}>
      <div className="card" style={{ maxWidth: 520, margin: '0 auto', padding: 48 }}>
        <p className="mono accent" style={{ fontSize: '3rem', fontWeight: 700, marginBottom: 8 }}>!</p>
        <h1 style={{ fontSize: '1.5rem', marginBottom: 12 }}>Something Went Wrong</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
          An unexpected error occurred. Try again or head back to the home page.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} className="btn btn-primary">Try Again</button>
          <a href="/" className="btn">Home</a>
        </div>
      </div>
    </main>
  )
}
