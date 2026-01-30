import { handleHookEvent } from '../handler.js'
handleHookEvent('SubagentStop').catch(() => process.exit(0))
