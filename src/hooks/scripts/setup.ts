import { handleHookEvent } from '../handler.js'
handleHookEvent('Setup').catch(() => process.exit(0))
