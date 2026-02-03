import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const publicOrigin = process.env.PUBLIC_URL || req.nextUrl.origin
  await clearSessionCookie()
  return NextResponse.redirect(new URL('/', publicOrigin), 303)
}
