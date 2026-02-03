import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserByToken } from '@/lib/db'

export async function GET(req: NextRequest) {
  // Support both cookie-based and Bearer token auth
  const authHeader = req.headers.get('authorization')

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const user = await getUserByToken(token)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    return NextResponse.json({
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
    })
  }

  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  return NextResponse.json({
    username: session.username,
    userId: session.userId,
  })
}
