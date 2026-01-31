import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import { getHooksDir } from './installer.js'

/**
 * Maps Copilot hook event names to the corresponding bashstats script filenames.
 */
export const COPILOT_HOOK_SCRIPTS: Record<string, string> = {
  sessionStart: 'session-start.js',
  sessionEnd: 'stop.js',
  userPromptSubmitted: 'user-prompt-submit.js',
  preToolUse: 'pre-tool-use.js',
  postToolUse: 'post-tool-use.js',
  errorOccurred: 'post-tool-failure.js',
}

/** Comment marker for identifying bashstats-managed hook entries. */
const COMMENT_MARKER = 'bashstats-managed'

interface CopilotHookEntry {
  type: string
  bash: string
  powershell: string
  timeoutSec: number
  comment: string
}

interface CopilotHooksConfig {
  version: number
  hooks: Record<string, CopilotHookEntry[]>
}

/**
 * Builds the complete Copilot hooks JSON config for bashstats.
 * Each event maps to a single hook entry with both bash and powershell commands.
 */
export function buildCopilotHooksConfig(hooksDir: string): CopilotHooksConfig {
  const hooks: Record<string, CopilotHookEntry[]> = {}

  for (const [event, scriptFile] of Object.entries(COPILOT_HOOK_SCRIPTS)) {
    const scriptPath = path.join(hooksDir, scriptFile)
    hooks[event] = [
      {
        type: 'command',
        bash: `node "${scriptPath}"`,
        powershell: `node "${scriptPath}"`,
        timeoutSec: 30,
        comment: COMMENT_MARKER,
      },
    ]
  }

  return { version: 1, hooks }
}

/**
 * Returns the path to ~/.copilot/hooks/bashstats-hooks.json
 */
export function getCopilotHooksPath(): string {
  return path.join(os.homedir(), '.copilot', 'hooks', 'bashstats-hooks.json')
}

/**
 * Installs bashstats hooks for Copilot by writing bashstats-hooks.json
 * to ~/.copilot/hooks/.
 */
export function installCopilot(): { success: boolean; message: string } {
  try {
    const hooksPath = getCopilotHooksPath()
    const hooksDir = path.dirname(hooksPath)

    // Ensure ~/.copilot/hooks/ directory exists
    fs.mkdirSync(hooksDir, { recursive: true })

    // Build and write the hooks config
    const distHooksDir = getHooksDir()
    const config = buildCopilotHooksConfig(distHooksDir)
    fs.writeFileSync(hooksPath, JSON.stringify(config, null, 2), 'utf-8')

    return { success: true, message: 'Copilot bashstats hooks installed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Copilot installation failed: ${message}` }
  }
}

/**
 * Uninstalls bashstats hooks for Copilot by deleting bashstats-hooks.json.
 */
export function uninstallCopilot(): { success: boolean; message: string } {
  try {
    const hooksPath = getCopilotHooksPath()

    if (!fs.existsSync(hooksPath)) {
      return { success: true, message: 'No bashstats-hooks.json found; nothing to uninstall.' }
    }

    fs.unlinkSync(hooksPath)
    return { success: true, message: 'Copilot bashstats hooks removed successfully.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `Copilot uninstall failed: ${message}` }
  }
}

/**
 * Checks if the `copilot` binary is available on PATH.
 */
export function isCopilotAvailable(): boolean {
  try {
    execSync('copilot --version', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}
