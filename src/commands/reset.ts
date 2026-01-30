import os from 'os'
import path from 'path'
import fs from 'fs'
import { BashStatsDB } from '../db/database.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

export function runReset(): void {
  const dbPath = path.join(os.homedir(), DATA_DIR, DB_FILENAME)

  if (!fs.existsSync(dbPath)) {
    console.log('No data to reset.')
    return
  }

  // Delete and recreate
  fs.unlinkSync(dbPath)
  const db = new BashStatsDB(dbPath)
  db.setMetadata('first_run', new Date().toISOString())
  db.close()

  console.log('All data has been reset. Starting fresh.')
}
