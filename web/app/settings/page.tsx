import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getUserByGithubId, trackEvent } from '@/lib/db'
import SettingsForm from './settings-form'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings - bashstats',
}

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) {
    redirect('/api/auth/github')
  }

  const user = await getUserByGithubId(session.githubId)
  if (!user) {
    redirect('/')
  }

  trackEvent('settings_view', user.id)

  return (
    <main className="container section">
      <h1 style={{ marginBottom: 8 }}>Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
        Manage your profile, privacy, and account.
      </p>
      <SettingsForm
        username={user.username}
        displayName={user.display_name ?? ''}
        bio={user.bio ?? ''}
        location={user.location ?? ''}
        website={user.website ?? ''}
        twitter={user.twitter ?? ''}
        githubUrl={user.github_url ?? ''}
        isPublic={user.is_public}
        showOnLeaderboard={user.show_on_leaderboard}
        anonymousDisplay={user.anonymous_display}
        lastUploadAt={user.last_upload_at}
      />
    </main>
  )
}
