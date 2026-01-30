import { install, isInstalled } from '../installer/installer.js'

export function runInit(): void {
  if (isInstalled()) {
    console.log('bashstats hooks are already installed. Reinstalling...')
  }

  const result = install()
  if (result.success) {
    console.log('')
    console.log('  bashstats installed successfully!')
    console.log('')
    console.log('  ' + result.message)
    console.log('')
    console.log('  Run "bashstats" to open the dashboard.')
    console.log('  Your Claude Code sessions are now being tracked.')
    console.log('')
    console.log('  [SECRET ACHIEVEMENT UNLOCKED] Launch Day')
    console.log('  "Welcome to bashstats. Your stats are now being watched. Forever."')
    console.log('')
  } else {
    console.error('Installation failed: ' + result.message)
    process.exit(1)
  }
}
