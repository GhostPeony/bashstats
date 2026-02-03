import { handleHookEvent, getDbPath } from '../handler.js'
import { getAuth, uploadSnapshot } from '../../upload/uploader.js'
import { BashStatsDB } from '../../db/database.js'
import { buildSnapshot } from '../../upload/snapshot.js'
import fs from 'fs'

async function run() {
  await handleHookEvent('Stop')

  // Auto-upload: fire-and-forget, never block the hook
  const auth = getAuth()
  if (!auth) return

  const dbPath = getDbPath()
  if (!fs.existsSync(dbPath)) return

  const db = new BashStatsDB(dbPath)
  try {
    const snapshot = buildSnapshot(db)
    await uploadSnapshot(snapshot, auth.api_token, 5000)
  } catch {
    // Silently ignore upload errors
  } finally {
    db.close()
  }
}

run().catch(() => process.exit(0))
