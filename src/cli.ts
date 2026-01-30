import { Command } from 'commander'
import { runInit } from './commands/init.js'
import { runWeb } from './commands/web.js'
import { runStats } from './commands/stats.js'
import { runAchievements } from './commands/achievements.js'
import { runStreak } from './commands/streak.js'
import { runExport } from './commands/export-data.js'
import { runReset } from './commands/reset.js'
import { runUninstall } from './commands/uninstall.js'
import { DEFAULT_PORT } from './constants.js'

const program = new Command()

program
  .name('bashstats')
  .description('Obsessive stat tracking, achievements, and badges for Claude Code')
  .version('0.1.0')

program.command('init').description('Install hooks and set up database').action(runInit)
program.command('web')
  .description('Open browser dashboard')
  .option('-p, --port <number>', 'Port to run on', String(DEFAULT_PORT))
  .option('--no-open', 'Do not open browser automatically')
  .action(runWeb)
program.command('stats').description('Quick stat summary').action(runStats)
program.command('achievements').description('List all badges with progress').action(runAchievements)
program.command('streak').description('Show current and longest streak').action(runStreak)
program.command('export').description('Export all data as JSON').action(runExport)
program.command('reset').description('Wipe all data').action(runReset)
program.command('uninstall').description('Remove hooks and data').action(runUninstall)

program.action(() => {
  console.log('bashstats - Obsessive stat tracking for Claude Code')
  console.log('')
  console.log('Use "bashstats init" to install hooks.')
  console.log('Use "bashstats stats" for a quick summary.')
  console.log('Use "bashstats --help" for all commands.')
})

program.parse()
