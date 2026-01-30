import { handleHookEvent } from '../handler.js'
handleHookEvent('Stop').catch(() => process.exit(0))
