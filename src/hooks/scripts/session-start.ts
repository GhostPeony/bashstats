import { handleHookEvent } from '../handler.js'
handleHookEvent('SessionStart').catch(() => process.exit(0))
