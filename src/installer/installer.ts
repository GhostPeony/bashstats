import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import { BashStatsDB } from '../db/database.js'

/**
 * Maps each Claude hook event name to the corresponding script filename.
 */
export const HOOK_SCRIPTS: Record<string, string> = {
  SessionStart: 'session-start.js',
  UserPromptSubmit: 'user-prompt-submit.js',
  PreToolUse: 'pre-tool-use.js',
  PostToolUse: 'post-tool-use.js',
  PostToolUseFailure: 'post-tool-failure.js',
  Stop: 'stop.js',
  Notification: 'notification.js',
  SubagentStart: 'subagent-start.js',
  SubagentStop: 'subagent-stop.js',
  PreCompact: 'pre-compact.js',
  PermissionRequest: 'permission-request.js',
  Setup: 'setup.js',
}

/** Marker comment appended to bashstats hook commands for identification. */
const MARKER = '# bashstats-managed'

interface HookEntry {
  matcher: string
  hooks: { type: string; command: string }[]
}

interface HooksMap {
  [event: string]: HookEntry[]
}

interface Settings {
  hooks?: HooksMap
  [key: string]: unknown
}

/**
 * Merges bashstats hooks into a settings object without overwriting existing hooks.
 * Uses the `# bashstats-managed` marker to identify our hooks for idempotent updates.
 */
export function mergeHooks(settings: Record<string, unknown>, hooksDir: string): Record<string, unknown> {
  const result: Settings = { ...settings }

  if (!result.hooks) {
    result.hooks = {}
  }

  for (const [event, scriptFile] of Object.entries(HOOK_SCRIPTS)) {
    const command = `node "${path.join(hooksDir, scriptFile)}" ${MARKER}`

    // Get existing entries for this event, or empty array
    const existing: HookEntry[] = result.hooks[event] ?? []

    // Filter out any previous bashstats-managed hooks
    const nonBashstats = existing.filter((entry) => {
      return !entry.hooks?.some((h) => h.command?.includes(MARKER))
    })

    // Build the new bashstats hook entry
    const bashstatsEntry: HookEntry = {
      matcher: '',
      hooks: [{ type: 'command', command }],
    }

    // Add bashstats entry alongside preserved hooks
    result.hooks[event] = [...nonBashstats, bashstatsEntry]
  }

  return result
}

/**
 * Returns the path to ~/.claude/settings.json
 */
export function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json')
}

/**
 * Returns the path to the dist/hooks/ directory, resolved from this module's location.
 */
export function getHooksDir(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, 'hooks')
}

/**
 * Full installation:
 * - Creates ~/.bashstats/ directory
 * - Initializes the database with metadata
 * - Reads existing ~/.claude/settings.json
 * - Merges bashstats hooks
 * - Writes settings back
 */
export function install(): { success: boolean; message: string } {
  try {
    // Create data directory
    const dataDir = path.join(os.homedir(), DATA_DIR)
    fs.mkdirSync(dataDir, { recursive: true })

    // Initialize database
    const dbPath = path.join(dataDir, DB_FILENAME)
    const db = new BashStatsDB(dbPath)
    const now = new Date().toISOString()
    db.setMetadata('installed_at', now)
    if (!db.getMetadata('first_run')) {
      db.setMetadata('first_run', now)
    }
    db.close()

    // Ensure ~/.claude/ directory exists
    const claudeDir = path.join(os.homedir(), '.claude')
    fs.mkdirSync(claudeDir, { recursive: true })

    // Read existing settings
    const settingsPath = getClaudeSettingsPath()
    let settings: Record<string, unknown> = {}
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8')
      settings = JSON.parse(raw)
    }

    // Merge hooks
    const hooksDir = getHooksDir()
    settings = mergeHooks(settings, hooksDir)

    // Write settings back
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')

    return { success: true, message: 'bashstats hooks installed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Installation failed: ${message}` }
  }
}

/**
 * Removes all bashstats hooks from ~/.claude/settings.json.
 * Cleans up empty arrays and empty hooks objects.
 */
export function uninstall(): { success: boolean; message: string } {
  try {
    const settingsPath = getClaudeSettingsPath()
    if (!fs.existsSync(settingsPath)) {
      return { success: true, message: 'No settings.json found; nothing to uninstall.' }
    }

    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const settings: Settings = JSON.parse(raw)

    if (settings.hooks) {
      for (const event of Object.keys(settings.hooks)) {
        // Filter out bashstats-managed entries
        settings.hooks[event] = settings.hooks[event].filter((entry) => {
          return !entry.hooks?.some((h) => h.command?.includes(MARKER))
        })

        // Clean up empty arrays
        if (settings.hooks[event].length === 0) {
          delete settings.hooks[event]
        }
      }

      // Clean up empty hooks object
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')

    return { success: true, message: 'bashstats hooks removed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Uninstall failed: ${message}` }
  }
}

/**
 * Checks if bashstats hooks are currently present in ~/.claude/settings.json.
 */
export function isInstalled(): boolean {
  try {
    const settingsPath = getClaudeSettingsPath()
    if (!fs.existsSync(settingsPath)) return false

    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const settings: Settings = JSON.parse(raw)

    if (!settings.hooks) return false

    // Check if any hook event contains a bashstats-managed entry
    for (const event of Object.keys(settings.hooks)) {
      const entries = settings.hooks[event]
      for (const entry of entries) {
        if (entry.hooks?.some((h) => h.command?.includes(MARKER))) {
          return true
        }
      }
    }

    return false
  } catch {
    return false
  }
}
