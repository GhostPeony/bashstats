import os from 'os'
import path from 'path'
import fs from 'fs'
import { uninstall as removeClaudeHooks } from '../installer/installer.js'
import { uninstallGemini } from '../installer/gemini.js'
import { uninstallCopilot } from '../installer/copilot.js'
import { uninstallOpenCode } from '../installer/opencode.js'
import { DATA_DIR } from '../constants.js'

export function runUninstall(): void {
  // Remove all agent hooks
  const claudeResult = removeClaudeHooks()
  console.log(claudeResult.message)

  const geminiResult = uninstallGemini()
  if (geminiResult.message !== 'No Gemini settings found.') console.log(geminiResult.message)

  const copilotResult = uninstallCopilot()
  console.log(copilotResult.message)

  const openCodeResult = uninstallOpenCode()
  console.log(openCodeResult.message)

  // Remove data directory
  const dataDir = path.join(os.homedir(), DATA_DIR)
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true })
    console.log(`Removed data directory: ${dataDir}`)
  }

  console.log('bashstats has been fully uninstalled.')
}
