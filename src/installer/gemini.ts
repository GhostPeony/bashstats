import fs from 'fs'
import path from 'path'
import os from 'os'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import { BashStatsDB } from '../db/database.js'
import { getHooksDir } from './installer.js'

/**
 * Maps each Gemini hook event name to the corresponding script filename.
 *
 * Gemini uses different event names than Claude. Our normalizer maps:
 *   SessionStart  -> session-start.js
 *   SessionEnd    -> stop.js           (normalizer converts to Stop)
 *   BeforeAgent   -> user-prompt-submit.js (normalizer converts to UserPromptSubmit)
 *   BeforeTool    -> pre-tool-use.js
 *   AfterTool     -> post-tool-use.js
 *   AfterModel    -> stop.js           (handler accumulates tokens; script is a no-op)
 *   PreCompress   -> pre-compact.js
 *   Notification  -> notification.js
 */
export const GEMINI_HOOK_SCRIPTS: Record<string, string> = {
  SessionStart: 'session-start.js',
  SessionEnd: 'stop.js',
  BeforeAgent: 'user-prompt-submit.js',
  BeforeTool: 'pre-tool-use.js',
  AfterTool: 'post-tool-use.js',
  AfterModel: 'stop.js',
  PreCompress: 'pre-compact.js',
  Notification: 'notification.js',
}

/** Marker comment appended to bashstats hook commands for identification. */
const MARKER = '# bashstats-managed'

/** Default timeout (in seconds) for Gemini hook commands. */
const DEFAULT_TIMEOUT = 10

interface GeminiHookCommand {
  name: string
  type: string
  command: string
  timeout: number
}

interface GeminiHookEntry {
  hooks: GeminiHookCommand[]
}

interface GeminiHooksMap {
  [event: string]: GeminiHookEntry[]
}

interface GeminiSettings {
  hooks?: GeminiHooksMap
  [key: string]: unknown
}

/**
 * Merges bashstats hooks into a Gemini settings object without overwriting existing hooks.
 * Uses the `# bashstats-managed` marker to identify our hooks for idempotent updates.
 *
 * Gemini hook structure: { hooks: { EventName: [{ hooks: [{ name, type, command, timeout }] }] } }
 */
export function mergeGeminiHooks(settings: Record<string, unknown>, hooksDir: string): Record<string, unknown> {
  const result: GeminiSettings = { ...settings }

  if (!result.hooks) {
    result.hooks = {}
  }

  for (const [event, scriptFile] of Object.entries(GEMINI_HOOK_SCRIPTS)) {
    const command = `node "${path.join(hooksDir, scriptFile)}" ${MARKER}`

    // Get existing entries for this event, or empty array
    const existing: GeminiHookEntry[] = result.hooks[event] ?? []

    // Filter out any previous bashstats-managed hooks
    const nonBashstats = existing.filter((entry) => {
      return !entry.hooks?.some((h) => h.command?.includes(MARKER))
    })

    // Build the new bashstats hook entry
    const bashstatsEntry: GeminiHookEntry = {
      hooks: [{ name: 'bashstats', type: 'command', command, timeout: DEFAULT_TIMEOUT }],
    }

    // Add bashstats entry alongside preserved hooks
    result.hooks[event] = [...nonBashstats, bashstatsEntry]
  }

  return result
}

/**
 * Returns the path to ~/.gemini/settings.json
 */
export function getGeminiSettingsPath(): string {
  return path.join(os.homedir(), '.gemini', 'settings.json')
}

/**
 * Checks if the ~/.gemini/ directory exists, indicating Gemini CLI is available.
 */
export function isGeminiAvailable(): boolean {
  try {
    const geminiDir = path.join(os.homedir(), '.gemini')
    return fs.existsSync(geminiDir) && fs.statSync(geminiDir).isDirectory()
  } catch {
    return false
  }
}

/**
 * Checks if bashstats hooks are currently present in ~/.gemini/settings.json.
 */
export function isGeminiInstalled(): boolean {
  try {
    const settingsPath = getGeminiSettingsPath()
    if (!fs.existsSync(settingsPath)) return false

    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const settings: GeminiSettings = JSON.parse(raw)

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

/**
 * Full Gemini installation:
 * - Creates ~/.bashstats/ directory
 * - Initializes the database with metadata
 * - Reads existing ~/.gemini/settings.json
 * - Merges bashstats hooks
 * - Writes settings back
 */
export function installGemini(): { success: boolean; message: string } {
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

    // Ensure ~/.gemini/ directory exists
    const geminiDir = path.join(os.homedir(), '.gemini')
    fs.mkdirSync(geminiDir, { recursive: true })

    // Read existing settings
    const settingsPath = getGeminiSettingsPath()
    let settings: Record<string, unknown> = {}
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8')
      settings = JSON.parse(raw)
    }

    // Merge hooks
    const hooksDir = getHooksDir()
    settings = mergeGeminiHooks(settings, hooksDir)

    // Write settings back
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')

    return { success: true, message: 'bashstats Gemini hooks installed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Gemini installation failed: ${message}` }
  }
}

/**
 * Removes all bashstats hooks from ~/.gemini/settings.json.
 * Cleans up empty arrays and empty hooks objects.
 */
export function uninstallGemini(): { success: boolean; message: string } {
  try {
    const settingsPath = getGeminiSettingsPath()
    if (!fs.existsSync(settingsPath)) {
      return { success: true, message: 'No Gemini settings.json found; nothing to uninstall.' }
    }

    const raw = fs.readFileSync(settingsPath, 'utf-8')
    const settings: GeminiSettings = JSON.parse(raw)

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

    return { success: true, message: 'bashstats Gemini hooks removed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Gemini uninstall failed: ${message}` }
  }
}
