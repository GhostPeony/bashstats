import fs from 'fs'
import { getDbPath } from '../hooks/handler.js'
import { BashStatsDB } from '../db/database.js'
import { buildSnapshot } from '../upload/snapshot.js'
import { getAuth, uploadSnapshot } from '../upload/uploader.js'

export async function runShare(): Promise<void> {
  const auth = getAuth()
  if (!auth) {
    console.log('Not logged in. Run "bashstats login" first.')
    return
  }

  const dbPath = getDbPath()
  if (!fs.existsSync(dbPath)) {
    console.log('No bashstats database found. Run "bashstats init" first.')
    return
  }

  console.log('Building snapshot...')

  const db = new BashStatsDB(dbPath)
  try {
    const snapshot = buildSnapshot(db)
    console.log('Uploading to bashstats.com...')

    const result = await uploadSnapshot(snapshot, auth.api_token)

    if (result.ok) {
      console.log(`Uploaded! View your profile: https://bashstats.com/u/${auth.username}`)
    } else {
      console.log(`Upload failed (${result.status}): ${result.message}`)
    }
  } finally {
    db.close()
  }
}
