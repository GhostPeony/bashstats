import { notFound } from 'next/navigation'
import { getUserByUsername, trackEvent, type UserRow } from '@/lib/db'
import { getSession } from '@/lib/auth'
import type { Metadata } from 'next'
import fs from 'fs'
import path from 'path'
import SyncButton from './sync-button'

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  const user = await getUserByUsername(username)

  if (!user || !user.is_public) {
    return { title: 'User not found - bashstats' }
  }

  const title = `${user.display_name || user.username} - bashstats`
  const descParts = [`${user.rank_tier} ${user.rank_number}`, `${user.total_xp.toLocaleString()} XP`, `${user.badges_unlocked} badges`, `${user.total_sessions.toLocaleString()} sessions`]
  if (user.bio) descParts.unshift(user.bio)
  const description = descParts.join(' | ')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: user.avatar_url ? [{ url: user.avatar_url }] : [],
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

function ProfileMeta({ user }: { user: UserRow }) {
  const items: { label: string; href?: string }[] = []
  if (user.location) items.push({ label: user.location })
  if (user.website) items.push({ label: user.website.replace(/^https?:\/\//, ''), href: user.website.startsWith('http') ? user.website : `https://${user.website}` })
  if (user.twitter) items.push({ label: `@${user.twitter}`, href: `https://x.com/${user.twitter}` })
  if (user.github_url) items.push({ label: 'GitHub', href: user.github_url })
  if (items.length === 0) return null
  return (
    <div className="profile-meta">
      {items.map((item, i) =>
        item.href ? (
          <a key={i} href={item.href} target="_blank" rel="noopener noreferrer">{item.label}</a>
        ) : (
          <span key={i}>{item.label}</span>
        ),
      )}
    </div>
  )
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const user = await getUserByUsername(username)

  if (!user) {
    notFound()
  }

  const session = await getSession()
  const isOwner = session?.username === username

  // Privacy gate: unlisted profiles only visible to owner
  if (!user.is_public && !isOwner) {
    notFound()
  }

  trackEvent('profile_view', user.id, { viewed_by: 'web' })

  if (!user.snapshot) {
    const displayName = user.display_name || user.username
    return (
      <div className="container section">
        <div className="profile-header">
          {user.avatar_url && (
            <img src={user.avatar_url} alt={user.username} className="profile-avatar" width={64} height={64} />
          )}
          <div className="profile-info">
            <h1>{displayName}</h1>
            <p><a href={`https://github.com/${user.username}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>@{user.username}</a></p>
            {user.bio && <p style={{ marginTop: 4 }}>{user.bio}</p>}
            <ProfileMeta user={user} />
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <h2 style={{ marginBottom: 12 }}>No stats yet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
            {isOwner
              ? 'Run the command below in your terminal to sync your stats.'
              : 'This profile will light up once stats are synced from the CLI.'}
          </p>
          {isOwner ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="code-block" style={{ display: 'inline-block' }}>
                bashstats share
              </div>
              <SyncButton />
            </div>
          ) : (
            <div className="code-block" style={{ display: 'inline-block' }}>
              bashstats login && bashstats share
            </div>
          )}
        </div>
      </div>
    )
  }

  // Read the dashboard HTML file from public/
  let dashboardHtml: string
  try {
    const htmlPath = path.join(process.cwd(), 'public', 'dashboard.html')
    dashboardHtml = fs.readFileSync(htmlPath, 'utf-8')
  } catch {
    return (
      <div className="container section">
        <p>Dashboard template not found.</p>
      </div>
    )
  }

  // Inject the snapshot data before </head>
  // Escape </script> sequences in JSON to prevent XSS breakout
  const safeJson = JSON.stringify(user.snapshot).replace(/</g, '\\u003c')
  const snapshotScript = `<script>window.__BASHSTATS_DATA__ = ${safeJson};</script>`
  const injectedHtml = dashboardHtml.replace('</head>', `${snapshotScript}\n</head>`)

  // Replace the title (escape HTML entities to prevent injection)
  const displayName = user.display_name || user.username
  const safeDisplayName = displayName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const titledHtml = injectedHtml.replace(
    '<title>bashstats</title>',
    `<title>${safeDisplayName} - bashstats</title>`,
  )

  return (
    <div className="profile-container">
      <div className="profile-header">
        {user.avatar_url && (
          <img
            src={user.avatar_url}
            alt={user.username}
            className="profile-avatar"
            width={64}
            height={64}
          />
        )}
        <div className="profile-info">
          <h1>{displayName}</h1>
          <p>
            <a href={`https://github.com/${user.username}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)' }}>@{user.username}</a> &middot; {user.rank_tier} {user.rank_number} &middot;{' '}
            {user.total_xp.toLocaleString()} XP
          </p>
          {user.bio && <p style={{ marginTop: 4 }}>{user.bio}</p>}
          <ProfileMeta user={user} />
        </div>
        {isOwner && (
          <div style={{ marginLeft: 'auto' }}>
            <SyncButton />
          </div>
        )}
      </div>
      <iframe
        className="profile-frame"
        srcDoc={titledHtml}
        title={`${user.username}'s bashstats dashboard`}
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', border: 'none', minHeight: '90vh', borderRadius: 12 }}
      />
    </div>
  )
}
