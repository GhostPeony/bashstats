import { getLeaderboard, trackEvent } from '@/lib/db'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Leaderboard - bashstats',
  description: 'Global leaderboard for bashstats users ranked by XP, sessions, streaks, and badges.',
}

const COLUMNS = [
  { key: 'total_xp', label: 'XP' },
  { key: 'rank_number', label: 'Rank' },
  { key: 'total_sessions', label: 'Sessions' },
  { key: 'longest_streak', label: 'Streak' },
  { key: 'badges_unlocked', label: 'Badges' },
  { key: 'total_tokens', label: 'Tokens' },
] as const

function rankClass(tier: string): string {
  const map: Record<string, string> = {
    Bronze: 'rank-bronze',
    Silver: 'rank-silver',
    Gold: 'rank-gold',
    Diamond: 'rank-diamond',
    Obsidian: 'rank-obsidian',
    'System Anomaly': 'rank-system-anomaly',
  }
  return map[tier] ?? ''
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

interface Props {
  searchParams: Promise<{ sort?: string; page?: string }>
}

export default async function LeaderboardPage({ searchParams }: Props) {
  const { sort = 'total_xp', page = '1' } = await searchParams
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const perPage = 50
  const offset = (pageNum - 1) * perPage

  let users: Awaited<ReturnType<typeof getLeaderboard>>['users'] = []
  let total = 0
  try {
    const result = await getLeaderboard(sort, perPage, offset)
    users = result.users
    total = result.total
    trackEvent('leaderboard_view', null, { sort, page: pageNum })
  } catch {
    // DB not configured
  }
  const totalPages = Math.ceil(total / perPage)

  return (
    <main className="container section">
      <h1 style={{ marginBottom: 24 }}>Leaderboard</h1>
      <div className="card">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              {COLUMNS.map((col) => (
                <th key={col.key} className={sort === col.key ? 'sorted' : ''}>
                  <a
                    href={`/leaderboard?sort=${col.key}&page=1`}
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {col.label} {sort === col.key ? '\u25BC' : ''}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr key={user.id}>
                <td className="mono">{offset + i + 1}</td>
                <td>
                  {user.anonymous_display ? (
                    <span className="leaderboard-user">
                      <span
                        className="leaderboard-avatar"
                        style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-accent)', display: 'inline-block', border: '1px solid var(--border)' }}
                      />
                      <span style={{ color: 'var(--text-secondary)' }}>Anonymous</span>
                    </span>
                  ) : (
                    <a href={`/u/${user.username}`} className="leaderboard-user">
                      {user.avatar_url && (
                        <img
                          src={user.avatar_url}
                          alt=""
                          className="leaderboard-avatar"
                          width={28}
                          height={28}
                        />
                      )}
                      <span>{user.display_name || user.username}</span>
                    </a>
                  )}
                </td>
                <td className="mono">{formatNumber(user.total_xp)}</td>
                <td>
                  <span className={`mono ${rankClass(user.rank_tier)}`}>
                    {user.rank_tier} {user.rank_number}
                  </span>
                </td>
                <td className="mono">{formatNumber(user.total_sessions)}</td>
                <td className="mono">{user.longest_streak}d</td>
                <td className="mono">{user.badges_unlocked}</td>
                <td className="mono">{formatNumber(user.total_tokens)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  No users yet. Be the first to sign up!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {pageNum > 1 ? (
            <a href={`/leaderboard?sort=${sort}&page=${pageNum - 1}`}>
              <button>&larr; Previous</button>
            </a>
          ) : (
            <button disabled>&larr; Previous</button>
          )}
          <span className="mono">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages ? (
            <a href={`/leaderboard?sort=${sort}&page=${pageNum + 1}`}>
              <button>Next &rarr;</button>
            </a>
          ) : (
            <button disabled>Next &rarr;</button>
          )}
        </div>
      )}
    </main>
  )
}
