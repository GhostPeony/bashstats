import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserByGithubId } from '@/lib/db'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ api_token: user.api_token, username: user.username })
}
