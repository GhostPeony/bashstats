import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSession } from '@/lib/auth'
import { getUserByGithubId, updateApiToken, trackEvent } from '@/lib/db'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const newToken = crypto.randomBytes(32).toString('hex')
  await updateApiToken(user.id, newToken)

  trackEvent('token_regenerate', user.id)

  return NextResponse.json({ token: newToken })
}
