import { install, isInstalled } from '../installer/installer.js'
import { installGemini, isGeminiAvailable } from '../installer/gemini.js'
import { installCopilot, isCopilotAvailable } from '../installer/copilot.js'
import { installOpenCode, isOpenCodeAvailable } from '../installer/opencode.js'
import { runWeb } from './web.js'

export function runInit(): void {
  if (isInstalled()) {
    console.log('bashstats hooks are already installed. Reinstalling...')
  }

  // Always install Claude Code hooks
  const claudeResult = install()
  if (!claudeResult.success) {
    console.error('Installation failed: ' + claudeResult.message)
    process.exit(1)
  }

  const installed: string[] = ['Claude Code']

  // Auto-detect and install for other agents
  if (isGeminiAvailable()) {
    const result = installGemini()
    if (result.success) installed.push('Gemini CLI')
    else console.log(`  Note: ${result.message}`)
  }

  if (isCopilotAvailable()) {
    const result = installCopilot()
    if (result.success) installed.push('Copilot CLI')
    else console.log(`  Note: ${result.message}`)
  }

  if (isOpenCodeAvailable()) {
    const result = installOpenCode()
    if (result.success) installed.push('OpenCode')
    else console.log(`  Note: ${result.message}`)
  }

  console.log('')
  console.log('  bashstats installed successfully!')
  console.log('')
  console.log(`  Installed hooks for: ${installed.join(', ')}`)
  console.log('  Your coding sessions are now being tracked.')
  console.log('')
  console.log('  [SECRET ACHIEVEMENT UNLOCKED] Launch Day')
  console.log('  "Welcome to bashstats. Your stats are now being watched. Forever."')
  console.log('')
  console.log('  Want a public profile and global leaderboard ranking?')
  console.log('  Run "bashstats login" to sign in with GitHub at bashstats.com')
  console.log('')
  console.log('  Opening dashboard...')
  console.log('')

  runWeb({})
}
