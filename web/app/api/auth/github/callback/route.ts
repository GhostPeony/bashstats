import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { upsertUser, getUserByGithubId, seedGithubProfile, trackEvent } from '@/lib/db'
import { createSession } from '@/lib/auth'

interface GitHubTokenResponse {
  access_token: string
  token_type: string
  scope: string
}

interface GitHubUser {
  id: number
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  location: string | null
  blog: string | null
  twitter_username: string | null
  html_url: string
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const storedState = req.cookies.get('oauth_state')?.value

  if (!code || !state || state !== storedState) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 })
  }

  // Decode state to get CLI callback info
  let stateObj: { cli_callback?: string; state?: string } = {}
  try {
    stateObj = JSON.parse(Buffer.from(state, 'base64url').toString())
  } catch {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  // Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  })

  const tokenData = (await tokenRes.json()) as GitHubTokenResponse
  if (!tokenData.access_token) {
    return NextResponse.json({ error: 'Failed to get access token' }, { status: 400 })
  }

  // Fetch GitHub user
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const ghUser = (await userRes.json()) as GitHubUser

  // Check if user exists, generate token if new
  let apiToken: string
  const existingUser = await getUserByGithubId(ghUser.id)
  if (existingUser) {
    apiToken = existingUser.api_token
  } else {
    apiToken = crypto.randomBytes(32).toString('hex')
  }

  // Upsert user — only set display_name for new users; existing users keep their settings value
  const user = await upsertUser({
    githubId: ghUser.id,
    username: ghUser.login,
    displayName: existingUser ? existingUser.display_name : ghUser.name,
    avatarUrl: ghUser.avatar_url,
    apiToken,
  })

  // Seed profile fields from GitHub for new users
  if (!existingUser) {
    await seedGithubProfile(user.id, {
      bio: ghUser.bio,
      location: ghUser.location,
      website: ghUser.blog || null,
      twitter: ghUser.twitter_username,
      githubUrl: ghUser.html_url,
    })
  }

  trackEvent(existingUser ? 'sign_in' : 'sign_up', user.id, {
    source: stateObj.cli_callback ? 'cli' : 'web',
  })

  // Create session JWT
  const sessionToken = await createSession({
    userId: user.id,
    username: user.username,
    githubId: user.github_id,
  })

  // Build redirect response
  let response: NextResponse
  if (stateObj.cli_callback) {
    // Validate CLI callback is localhost only to prevent open redirect / token theft
    let callbackUrl: URL
    try {
      callbackUrl = new URL(stateObj.cli_callback)
    } catch {
      return NextResponse.json({ error: 'Invalid callback URL' }, { status: 400 })
    }
    if (callbackUrl.hostname !== 'localhost' && callbackUrl.hostname !== '127.0.0.1') {
      return NextResponse.json({ error: 'Callback must be localhost' }, { status: 400 })
    }
    response = NextResponse.redirect(
      `${stateObj.cli_callback}?token=${apiToken}&username=${user.username}&state=${stateObj.state ?? ''}`,
    )
  } else {
    response = NextResponse.redirect(`${process.env.PUBLIC_URL}/u/${user.username}`)
  }

  // Set session cookie
  response.cookies.set('bashstats_session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
  response.cookies.delete('oauth_state')

  return response
}
