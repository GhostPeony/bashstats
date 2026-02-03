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

  await deleteUser(user.id)
  trackEvent('account_delete', null, { deleted_user_id: user.id, username: user.username })
  await clearSessionCookie()

  return NextResponse.json({ ok: true })
}
