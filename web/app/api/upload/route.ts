import { NextRequest, NextResponse } from 'next/server'
import { getUserByToken, updateUserSnapshot, trackEvent } from '@/lib/db'
import type { ProfileSnapshot } from '@/lib/types'

// Simple in-memory rate limiter: 1 upload per 30s per user
const lastUpload = new Map<number, number>()
const RATE_LIMIT_MS = 30_000

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const token = authHeader.slice(7)
  const user = await getUserByToken(token)
  if (!user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // Rate limit
  const now = Date.now()
  const last = lastUpload.get(user.id) ?? 0
  if (now - last < RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000)
    return NextResponse.json(
      { error: 'Rate limited', retry_after: retryAfter },
      { status: 429 },
    )
  }
  lastUpload.set(user.id, now)

  // Limit request body size (snapshot is ~60KB, reject anything over 500KB)
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
  if (contentLength > 512_000) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  let snapshot: ProfileSnapshot
  try {
    snapshot = (await req.json()) as ProfileSnapshot
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate required structure and types
  if (
    !snapshot.stats || typeof snapshot.stats !== 'object' ||
    !snapshot.achievements || typeof snapshot.achievements !== 'object' ||
    !snapshot.achievements.xp || typeof snapshot.achievements.xp !== 'object' ||
    !snapshot.activity || !Array.isArray(snapshot.activity) ||
    !snapshot.sessions || !Array.isArray(snapshot.sessions)
  ) {
    return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 })
  }

  // Validate numeric fields are actually numbers and within reasonable bounds
  const xp = snapshot.achievements.xp
  if (
    typeof xp.totalXP !== 'number' || xp.totalXP < 0 || xp.totalXP > 100_000_000 ||
    typeof xp.rankNumber !== 'number' || xp.rankNumber < 0 ||
    typeof xp.rankTier !== 'string' || xp.rankTier.length > 30
  ) {
    return NextResponse.json({ error: 'Invalid XP data' }, { status: 400 })
  }

  const lt = snapshot.stats.lifetime
  if (
    typeof lt.totalSessions !== 'number' || lt.totalSessions < 0 ||
    typeof lt.totalPrompts !== 'number' || lt.totalPrompts < 0 ||
    typeof lt.totalDurationSeconds !== 'number' || lt.totalDurationSeconds < 0 ||
    typeof lt.totalTokens !== 'number' || lt.totalTokens < 0
  ) {
    return NextResponse.json({ error: 'Invalid lifetime stats' }, { status: 400 })
  }

  // Extract denormalized fields
  const badgesUnlocked = snapshot.achievements.badges
    ? snapshot.achievements.badges.filter((b) => b.unlocked).length
    : 0

  await updateUserSnapshot(user.id, snapshot, {
    totalXp: xp.totalXP,
    rankNumber: xp.rankNumber,
    rankTier: xp.rankTier,
    totalSessions: lt.totalSessions,
    totalPrompts: lt.totalPrompts,
    totalHours: Math.round((lt.totalDurationSeconds / 3600) * 10) / 10,
    currentStreak: snapshot.stats.time?.currentStreak ?? 0,
    longestStreak: snapshot.stats.time?.longestStreak ?? 0,
    badgesUnlocked,
    totalTokens: lt.totalTokens,
  })

  trackEvent('upload', user.id, {
    xp: xp.totalXP,
    rank: xp.rankTier,
    sessions: lt.totalSessions,
    badges: badgesUnlocked,
  })

  return NextResponse.json({ message: 'Uploaded' })
}
