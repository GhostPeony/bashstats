import { handleHookEvent } from '../handler.js'
handleHookEvent('SubagentStart').catch(() => process.exit(0))
