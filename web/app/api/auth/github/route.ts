import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub OAuth not configured' }, { status: 500 })
  }

  // If already signed in and this is a web request (no CLI callback), skip OAuth
  const cliCallback = req.nextUrl.searchParams.get('cli_callback')
  if (!cliCallback) {
    const session = await getSession()
    if (session) {
      return NextResponse.redirect(new URL(`/u/${session.username}`, req.url))
    }
  }

  const publicOrigin = process.env.PUBLIC_URL || req.nextUrl.origin
  const stateParam = req.nextUrl.searchParams.get('state') ?? ''

  // Build state: include CLI callback info if present
  const stateObj = {
    nonce: crypto.randomBytes(16).toString('hex'),
    cli_callback: cliCallback ?? '',
    state: stateParam,
  }
  const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url')

  const redirectUri = `${publicOrigin}/api/auth/github/callback`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  })

  const response = NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  return response
}
