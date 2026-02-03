'use client'

import { useState } from 'react'

interface SettingsFormProps {
  username: string
  displayName: string
  bio: string
  location: string
  website: string
  twitter: string
  githubUrl: string
  isPublic: boolean
  showOnLeaderboard: boolean
  anonymousDisplay: boolean
  hideProjects: boolean
  lastUploadAt: string | null
}

export default function SettingsForm(props: SettingsFormProps) {
  const [displayName, setDisplayName] = useState(props.displayName)
  const [bio, setBio] = useState(props.bio)
  const [location, setLocation] = useState(props.location)
  const [website, setWebsite] = useState(props.website)
  const [twitter, setTwitter] = useState(props.twitter)
  const [githubUrl, setGithubUrl] = useState(props.githubUrl)
  const [isPublic, setIsPublic] = useState(props.isPublic)
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(props.showOnLeaderboard)
  const [anonymousDisplay, setAnonymousDisplay] = useState(props.anonymousDisplay)
  const [hideProjects, setHideProjects] = useState(props.hideProjects)

  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [newToken, setNewToken] = useState<string | null>(null)
  const [regenConfirm, setRegenConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [copied, setCopied] = useState(false)

  async function handleSave() {
    setSaving(true)
    setFeedback(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          location,
          website,
          twitter,
          github_url: githubUrl,
          is_public: isPublic,
          show_on_leaderboard: showOnLeaderboard,
          anonymous_display: anonymousDisplay,
          hide_projects: hideProjects,
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setFeedback({ type: 'success', message: 'Settings saved.' })
    } catch {
      setFeedback({ type: 'error', message: 'Failed to save settings. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRegenerate() {
    try {
      const res = await fetch('/api/settings/regenerate-token', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setNewToken(data.token)
      setRegenConfirm(false)
    } catch {
      setFeedback({ type: 'error', message: 'Failed to regenerate token.' })
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/settings/delete-account', { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      window.location.href = '/'
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete account.' })
      setDeleting(false)
    }
  }

  function copyCommand() {
    navigator.clipboard.writeText('bashstats share')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="settings-sections">
      {feedback && (
        <div className={`settings-feedback settings-feedback-${feedback.type}`}>
          {feedback.message}
        </div>
      )}

      {/* Profile */}
      <div className="card settings-card">
        <h2 className="settings-section-title">Profile</h2>
        <div className="settings-field">
          <label className="settings-label">Display name</label>
          <input
            type="text"
            className="settings-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            placeholder={props.username}
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">Bio</label>
          <textarea
            className="settings-textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder="Tell us about yourself"
          />
          <span className="settings-char-count">{bio.length}/200</span>
        </div>
        <div className="settings-field">
          <label className="settings-label">Location</label>
          <input
            type="text"
            className="settings-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={100}
            placeholder="San Francisco, CA"
          />
        </div>
      </div>

      {/* Social Links */}
      <div className="card settings-card">
        <h2 className="settings-section-title">Social Links</h2>
        <div className="settings-field">
          <label className="settings-label">Website</label>
          <input
            type="url"
            className="settings-input"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={200}
            placeholder="https://example.com"
          />
        </div>
        <div className="settings-field">
          <label className="settings-label">Twitter / X</label>
          <div className="settings-input-group">
            <span className="settings-input-prefix">@</span>
            <input
              type="text"
              className="settings-input settings-input-prefixed"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value.replace(/^@/, ''))}
              maxLength={39}
              placeholder="username"
            />
          </div>
        </div>
        <div className="settings-field">
          <label className="settings-label">GitHub</label>
          <input
            type="url"
            className="settings-input"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/username"
          />
        </div>
      </div>

      {/* Sync */}
      <div className="card settings-card">
        <h2 className="settings-section-title">Sync</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
          {props.lastUploadAt
            ? `Last synced: ${new Date(props.lastUploadAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`
            : 'Not synced yet.'}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div className="code-block" style={{ margin: 0, flex: 1 }}>bashstats share</div>
          <button className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '0.8rem' }} onClick={copyCommand}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <a href={`/u/${props.username}`} style={{ fontSize: '0.85rem' }}>
          View your profile &rarr;
        </a>
      </div>

      {/* Privacy */}
      <div className="card settings-card">
        <h2 className="settings-section-title">Privacy</h2>
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Profile visibility</div>
            <div className="settings-toggle-desc">When unlisted, only you can see your profile.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Show on leaderboard</div>
            <div className="settings-toggle-desc">When off, you won&apos;t appear on the leaderboard.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={showOnLeaderboard} onChange={(e) => setShowOnLeaderboard(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Anonymous mode</div>
            <div className="settings-toggle-desc">Your name and avatar show as &quot;Anonymous&quot; on the leaderboard.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={anonymousDisplay} onChange={(e) => setAnonymousDisplay(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
        <div className="settings-toggle-row">
          <div>
            <div className="settings-toggle-label">Hide project names</div>
            <div className="settings-toggle-desc">Project names in recent sessions and stats are hidden on your public profile.</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={hideProjects} onChange={(e) => setHideProjects(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* Save button */}
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%' }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      {/* Account (Danger Zone) */}
      <div className="card settings-danger">
        <h2 className="settings-section-title">Account</h2>

        {/* Regenerate Token */}
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>Regenerate API token</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
            This will invalidate your current token. You&apos;ll need to run <code className="mono">bashstats login</code> again.
          </p>
          {newToken ? (
            <div>
              <div className="token-box" style={{ marginBottom: 8 }}>{newToken}</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Copy this token now. Run <code className="mono">bashstats login</code> to re-authenticate.
              </p>
            </div>
          ) : regenConfirm ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-danger" onClick={handleRegenerate}>Yes, regenerate</button>
              <button className="btn btn-secondary" onClick={() => setRegenConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setRegenConfirm(true)}>Regenerate token</button>
          )}
        </div>

        {/* Delete Account */}
        <div>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>Delete account</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
            Permanently delete your account and all data. This cannot be undone.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="settings-input"
              placeholder={`Type "${props.username}" to confirm`}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={{ maxWidth: 260 }}
            />
            <button
              className="btn btn-danger"
              disabled={deleteConfirm !== props.username || deleting}
              onClick={handleDelete}
            >
              {deleting ? 'Deleting...' : 'Delete account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
