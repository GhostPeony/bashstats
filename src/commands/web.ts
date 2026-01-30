import fs from 'fs'
import { exec } from 'child_process'
import { getDbPath } from '../hooks/handler.js'
import { BashStatsDB } from '../db/database.js'
import { startServer } from '../dashboard/server.js'
import { DEFAULT_PORT } from '../constants.js'

function openBrowser(url: string): void {
  const platform = process.platform
  let command: string

  if (platform === 'win32') {
    command = `start "" "${url}"`
  } else if (platform === 'darwin') {
    command = `open "${url}"`
  } else {
    command = `xdg-open "${url}"`
  }

  exec(command, (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit: ${url}`)
    }
  })
}

export function runWeb(options: { port?: string; open?: boolean }): void {
  const dbPath = getDbPath()

  if (!fs.existsSync(dbPath)) {
    console.log('No bashstats database found.')
    console.log('Run "bashstats init" first to set up tracking.')
    return
  }

  const port = options.port ? parseInt(options.port, 10) : DEFAULT_PORT

  if (isNaN(port) || port < 1 || port > 65535) {
    console.log(`Invalid port: ${options.port}`)
    return
  }

  const db = new BashStatsDB(dbPath)
  const url = `http://127.0.0.1:${port}`

  startServer(db, port)

  const shouldOpen = options.open !== false
  if (shouldOpen) {
    // Small delay to let the server start before opening
    setTimeout(() => openBrowser(url), 500)
  }
}
