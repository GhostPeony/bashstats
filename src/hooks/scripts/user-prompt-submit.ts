import { handleHookEvent } from '../handler.js'
handleHookEvent('UserPromptSubmit').catch(() => process.exit(0))
