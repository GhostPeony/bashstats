import { sql, createPool } from '@vercel/postgres'

export interface UserRow {
  id: number
  github_id: number
  username: string
  display_name: string | null
  avatar_url: string | null
  total_xp: number
  rank_number: number
  rank_tier: string
  total_sessions: number
  total_prompts: number
  total_hours: number
  current_streak: number
  longest_streak: number
  badges_unlocked: number
  total_tokens: number
  snapshot: unknown | null
  bio: string | null
  location: string | null
  website: string | null
  twitter: string | null
  github_url: string | null
  is_public: boolean
  show_on_leaderboard: boolean
  anonymous_display: boolean
  hide_projects: boolean
  api_token: string
  created_at: string
  updated_at: string
  last_upload_at: string | null
}

export async function getUserByToken(token: string): Promise<UserRow | null> {
  const { rows } = await sql<UserRow>`
    SELECT * FROM users WHERE api_token = ${token} LIMIT 1
  `
  return rows[0] ?? null
}

// Columns safe to return for public-facing queries (excludes api_token)
const PUBLIC_COLUMNS = `id, github_id, username, display_name, avatar_url, total_xp, rank_number, rank_tier, total_sessions, total_prompts, total_hours, current_streak, longest_streak, badges_unlocked, total_tokens, snapshot, bio, location, website, twitter, github_url, is_public, show_on_leaderboard, anonymous_display, hide_projects, created_at, updated_at, last_upload_at`

export async function getUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await sql<UserRow>`
    SELECT id, github_id, username, display_name, avatar_url, total_xp, rank_number, rank_tier, total_sessions, total_prompts, total_hours, current_streak, longest_streak, badges_unlocked, total_tokens, snapshot, bio, location, website, twitter, github_url, is_public, show_on_leaderboard, anonymous_display, hide_projects, api_token, created_at, updated_at, last_upload_at FROM users WHERE username = ${username} LIMIT 1
  `
  return rows[0] ?? null
}

export async function getUserByGithubId(githubId: number): Promise<UserRow | null> {
  const { rows } = await sql<UserRow>`
    SELECT * FROM users WHERE github_id = ${githubId} LIMIT 1
  `
  return rows[0] ?? null
}

export async function upsertUser(params: {
  githubId: number
  username: string
  displayName: string | null
  avatarUrl: string | null
  apiToken: string
}): Promise<UserRow> {
  const { rows } = await sql<UserRow>`
    INSERT INTO users (github_id, username, display_name, avatar_url, api_token)
    VALUES (${params.githubId}, ${params.username}, ${params.displayName}, ${params.avatarUrl}, ${params.apiToken})
    ON CONFLICT (github_id)
    DO UPDATE SET
      username = ${params.username},
      display_name = ${params.displayName},
      avatar_url = ${params.avatarUrl},
      updated_at = NOW()
    RETURNING *
  `
  return rows[0]
}

export async function updateUserSnapshot(
  userId: number,
  snapshot: unknown,
  fields: {
    totalXp: number
    rankNumber: number
    rankTier: string
    totalSessions: number
    totalPrompts: number
    totalHours: number
    currentStreak: number
    longestStreak: number
    badgesUnlocked: number
    totalTokens: number
  },
): Promise<void> {
  await sql`
    UPDATE users SET
      snapshot = ${JSON.stringify(snapshot)},
      total_xp = ${fields.totalXp},
      rank_number = ${fields.rankNumber},
      rank_tier = ${fields.rankTier},
      total_sessions = ${fields.totalSessions},
      total_prompts = ${fields.totalPrompts},
      total_hours = ${fields.totalHours},
      current_streak = ${fields.currentStreak},
      longest_streak = ${fields.longestStreak},
      badges_unlocked = ${fields.badgesUnlocked},
      total_tokens = ${fields.totalTokens},
      updated_at = NOW(),
      last_upload_at = NOW()
    WHERE id = ${userId}
  `
}

// Fire-and-forget event tracking — never blocks the response
export function trackEvent(event: string, userId?: number | null, metadata?: Record<string, unknown>) {
  sql`
    INSERT INTO events (event, user_id, metadata)
    VALUES (${event}, ${userId ?? null}, ${JSON.stringify(metadata ?? {})})
  `.catch(() => {}) // swallow errors silently
}

export async function updateUserProfile(
  userId: number,
  fields: {
    displayName?: string | null
    bio?: string | null
    location?: string | null
    website?: string | null
    twitter?: string | null
    githubUrl?: string | null
    isPublic?: boolean
    showOnLeaderboard?: boolean
    anonymousDisplay?: boolean
    hideProjects?: boolean
  },
): Promise<void> {
  await sql`
    UPDATE users SET
      display_name = COALESCE(${fields.displayName ?? null}, display_name),
      bio = ${fields.bio ?? null},
      location = ${fields.location ?? null},
      website = ${fields.website ?? null},
      twitter = ${fields.twitter ?? null},
      github_url = ${fields.githubUrl ?? null},
      is_public = COALESCE(${fields.isPublic ?? null}, is_public),
      show_on_leaderboard = COALESCE(${fields.showOnLeaderboard ?? null}, show_on_leaderboard),
      anonymous_display = COALESCE(${fields.anonymousDisplay ?? null}, anonymous_display),
      hide_projects = COALESCE(${fields.hideProjects ?? null}, hide_projects),
      updated_at = NOW()
    WHERE id = ${userId}
  `
}

export async function updateApiToken(userId: number, newToken: string): Promise<void> {
  await sql`
    UPDATE users SET api_token = ${newToken}, updated_at = NOW()
    WHERE id = ${userId}
  `
}

export async function deleteUser(userId: number): Promise<void> {
  await sql`DELETE FROM events WHERE user_id = ${userId}`
  await sql`DELETE FROM users WHERE id = ${userId}`
}

export async function seedGithubProfile(
  userId: number,
  fields: {
    bio?: string | null
    location?: string | null
    website?: string | null
    twitter?: string | null
    githubUrl?: string | null
  },
): Promise<void> {
  await sql`
    UPDATE users SET
      bio = COALESCE(bio, ${fields.bio ?? null}),
      location = COALESCE(location, ${fields.location ?? null}),
      website = COALESCE(website, ${fields.website ?? null}),
      twitter = COALESCE(twitter, ${fields.twitter ?? null}),
      github_url = COALESCE(github_url, ${fields.githubUrl ?? null}),
      updated_at = NOW()
    WHERE id = ${userId}
  `
}

export type LeaderboardSort =
  | 'total_xp'
  | 'rank_number'
  | 'total_sessions'
  | 'longest_streak'
  | 'badges_unlocked'
  | 'total_tokens'

const VALID_SORTS = new Set<string>([
  'total_xp',
  'rank_number',
  'total_sessions',
  'longest_streak',
  'badges_unlocked',
  'total_tokens',
])

export async function getLeaderboard(
  sort: string = 'total_xp',
  limit: number = 50,
  offset: number = 0,
): Promise<{ users: UserRow[]; total: number }> {
  const sortColumn = VALID_SORTS.has(sort) ? sort : 'total_xp'

  // Use pool.query for dynamic ORDER BY (tagged templates don't support dynamic column names)
  const pool = createPool()
  const { rows: users } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE total_xp > 0 AND show_on_leaderboard = true ORDER BY ${sortColumn} DESC, id ASC LIMIT $1 OFFSET $2`,
    [limit, offset],
  )

  const { rows: countRows } = await sql`
    SELECT COUNT(*) as total FROM users WHERE total_xp > 0 AND show_on_leaderboard = true
  `

  return {
    users: users as UserRow[],
    total: Number(countRows[0]?.total ?? 0),
  }
}
