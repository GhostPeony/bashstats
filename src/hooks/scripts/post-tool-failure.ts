import { handleHookEvent } from '../handler.js'
handleHookEvent('PostToolUseFailure').catch(() => process.exit(0))
