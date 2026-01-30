import { handleHookEvent } from '../handler.js'
handleHookEvent('Notification').catch(() => process.exit(0))
