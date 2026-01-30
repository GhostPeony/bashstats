import { handleHookEvent } from '../handler.js'
handleHookEvent('PermissionRequest').catch(() => process.exit(0))
