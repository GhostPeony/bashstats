import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getUserByGithubId, updateUserProfile, trackEvent } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await req.json()

  // Validate string lengths
  const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 100).trim() : user.display_name
  const bio = typeof body.bio === 'string' ? body.bio.slice(0, 200).trim() : user.bio
  const location = typeof body.location === 'string' ? body.location.slice(0, 100).trim() : user.location
  const website = typeof body.website === 'string' ? body.website.slice(0, 200).trim() : user.website
  const twitter = typeof body.twitter === 'string' ? body.twitter.replace(/^@/, '').slice(0, 39).trim() : user.twitter
  const githubUrl = typeof body.github_url === 'string' ? body.github_url.slice(0, 500).trim() : user.github_url

  // Validate booleans
  const isPublic = typeof body.is_public === 'boolean' ? body.is_public : user.is_public
  const showOnLeaderboard = typeof body.show_on_leaderboard === 'boolean' ? body.show_on_leaderboard : user.show_on_leaderboard
  const anonymousDisplay = typeof body.anonymous_display === 'boolean' ? body.anonymous_display : user.anonymous_display
  const hideProjects = typeof body.hide_projects === 'boolean' ? body.hide_projects : user.hide_projects

  await updateUserProfile(user.id, {
    displayName: displayName || null,
    bio: bio || null,
    location: location || null,
    website: website || null,
    twitter: twitter || null,
    githubUrl: githubUrl || null,
    isPublic,
    showOnLeaderboard,
    anonymousDisplay,
    hideProjects,
  })

  trackEvent('settings_update', user.id)

  return NextResponse.json({ ok: true })
}
