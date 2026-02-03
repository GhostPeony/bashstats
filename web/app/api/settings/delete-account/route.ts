import { NextResponse } from 'next/server'
import { getSession, clearSessionCookie } from '@/lib/auth'
import { getUserByGithubId, deleteUser, trackEvent } from '@/lib/db'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  trackEvent('account_delete', user.id)
  await deleteUser(user.id)
  await clearSessionCookie()

  return NextResponse.json({ ok: true })
}
