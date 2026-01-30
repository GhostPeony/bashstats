import { handleHookEvent } from '../handler.js'
handleHookEvent('PreToolUse').catch(() => process.exit(0))
