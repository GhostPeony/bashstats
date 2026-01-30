import { handleHookEvent } from '../handler.js'
handleHookEvent('PostToolUse').catch(() => process.exit(0))
