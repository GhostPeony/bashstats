import { handleHookEvent } from '../handler.js'
handleHookEvent('PreCompact').catch(() => process.exit(0))
