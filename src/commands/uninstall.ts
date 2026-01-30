import os from 'os'
import path from 'path'
import fs from 'fs'
import { uninstall as removeHooks } from '../installer/installer.js'
import { DATA_DIR } from '../constants.js'

export function runUninstall(): void {
  // Remove hooks
  const hookResult = removeHooks()
  console.log(hookResult.message)

  // Remove data directory
  const dataDir = path.join(os.homedir(), DATA_DIR)
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true })
    console.log(`Removed data directory: ${dataDir}`)
  }

  console.log('bashstats has been uninstalled.')
}
