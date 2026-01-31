import fs from 'fs'
import path from 'path'
import os from 'os'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

/**
 * Returns the OpenCode plugins directory path: ~/.config/opencode/plugins/
 */
export function getOpenCodePluginsDir(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins')
}

/**
 * Returns the full path to the bashstats plugin file inside OpenCode's plugins directory.
 */
export function getOpenCodePluginPath(): string {
  return path.join(getOpenCodePluginsDir(), 'bashstats.ts')
}

/**
 * Checks whether OpenCode is available by looking for ~/.config/opencode/.
 */
export function isOpenCodeAvailable(): boolean {
  try {
    return fs.existsSync(path.join(os.homedir(), '.config', 'opencode'))
  } catch {
    return false
  }
}

/**
 * Generates the self-contained TypeScript plugin source that OpenCode loads in-process.
 *
 * The plugin uses `better-sqlite3` directly (not our modules) because OpenCode
 * loads plugins separately. It opens and closes the DB per event to avoid
 * long-lived connections.
 *
 * @param dbPath - Absolute path to the bashstats SQLite database
 */
export function getOpenCodePluginContent(dbPath: string): string {
  return `// bashstats plugin for OpenCode -- auto-generated, do not edit
// Tracks coding sessions, tool usage, and prompts for bashstats achievements.

import Database from "better-sqlite3";

const DB_PATH = ${JSON.stringify(dbPath)};

function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;
}

function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}T\${pad(d.getHours())}:\${pad(d.getMinutes())}:\${pad(d.getSeconds())}.\${ms}\`;
}

function withDb<T>(fn: (db: InstanceType<typeof Database>) => T): T | undefined {
  let db: InstanceType<typeof Database> | undefined;
  try {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("busy_timeout = 5000");
    return fn(db);
  } catch {
    // silently ignore DB errors so we never break the host
  } finally {
    try { db?.close(); } catch {}
  }
  return undefined;
}

function insertEvent(db: InstanceType<typeof Database>, sessionId: string, hookType: string, toolName?: string, toolInput?: string, project?: string): void {
  db.prepare(
    "INSERT INTO events (session_id, hook_type, tool_name, tool_input, cwd, project, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(sessionId, hookType, toolName ?? null, toolInput ?? null, null, project ?? null, localNow());
}

function incrementDaily(db: InstanceType<typeof Database>, increments: { sessions?: number; prompts?: number; tool_calls?: number; errors?: number; duration_seconds?: number }): void {
  const date = today();
  db.prepare(
    \`INSERT INTO daily_activity (date, sessions, prompts, tool_calls, errors, duration_seconds, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
     ON CONFLICT(date) DO UPDATE SET
       sessions = sessions + excluded.sessions,
       prompts = prompts + excluded.prompts,
       tool_calls = tool_calls + excluded.tool_calls,
       errors = errors + excluded.errors,
       duration_seconds = duration_seconds + excluded.duration_seconds\`
  ).run(
    date,
    increments.sessions ?? 0,
    increments.prompts ?? 0,
    increments.tool_calls ?? 0,
    increments.errors ?? 0,
    increments.duration_seconds ?? 0,
  );
}

export default async ({ project, directory }: { project?: string; directory?: string }) => {
  const sessionId = \`opencode-\${Date.now()}\`;
  const startedAt = localNow();
  const projectName = project ?? directory ?? null;

  // Create session on plugin load
  withDb((db) => {
    db.prepare(
      "INSERT OR IGNORE INTO sessions (id, agent, started_at, project) VALUES (?, ?, ?, ?)"
    ).run(sessionId, "opencode", startedAt, projectName);
    incrementDaily(db, { sessions: 1 });
  });

  return {
    event: async ({ event }: { event: { type: string; properties?: Record<string, unknown> } }) => {
      const eventType = event.type;
      const props = event.properties ?? {};

      if (eventType === "session.created") {
        withDb((db) => {
          db.prepare(
            "INSERT OR IGNORE INTO sessions (id, agent, started_at, project) VALUES (?, ?, ?, ?)"
          ).run(sessionId, "opencode", startedAt, projectName);
          incrementDaily(db, { sessions: 1 });
        });
      }

      else if (eventType === "session.idle" || eventType === "session.deleted") {
        withDb((db) => {
          const endedAt = localNow();
          const startMs = new Date(startedAt).getTime();
          const endMs = new Date(endedAt).getTime();
          const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
          const stopReason = eventType === "session.idle" ? "idle" : "deleted";
          db.prepare(
            "UPDATE sessions SET ended_at = ?, stop_reason = ?, duration_seconds = ? WHERE id = ?"
          ).run(endedAt, stopReason, durationSeconds, sessionId);
          incrementDaily(db, { duration_seconds: durationSeconds });
        });
      }

      else if (eventType === "tool.execute.before") {
        withDb((db) => {
          const toolName = (props.tool as string) ?? "unknown";
          const toolInput = props.input ? JSON.stringify(props.input) : null;
          insertEvent(db, sessionId, "PreToolUse", toolName, toolInput, projectName ?? undefined);
        });
      }

      else if (eventType === "tool.execute.after") {
        withDb((db) => {
          const toolName = (props.tool as string) ?? "unknown";
          const toolInput = props.input ? JSON.stringify(props.input) : null;
          insertEvent(db, sessionId, "PostToolUse", toolName, toolInput, projectName ?? undefined);
          db.prepare(
            "UPDATE sessions SET tool_count = tool_count + 1 WHERE id = ?"
          ).run(sessionId);
          incrementDaily(db, { tool_calls: 1 });
        });
      }

      else if (eventType === "session.error") {
        withDb((db) => {
          const toolName = (props.tool as string) ?? null;
          insertEvent(db, sessionId, "PostToolUseFailure", toolName ?? undefined, undefined, projectName ?? undefined);
          db.prepare(
            "UPDATE sessions SET error_count = error_count + 1 WHERE id = ?"
          ).run(sessionId);
          incrementDaily(db, { errors: 1 });
        });
      }

      else if (eventType === "session.compacted") {
        withDb((db) => {
          insertEvent(db, sessionId, "PreCompact", undefined, undefined, projectName ?? undefined);
        });
      }

      else if (eventType === "message.updated") {
        const role = props.role as string | undefined;
        if (role === "user") {
          withDb((db) => {
            const content = (props.content as string) ?? "";
            const charCount = content.length;
            const wordCount = content.trim() === "" ? 0 : content.trim().split(/\\s+/).length;
            db.prepare(
              "INSERT INTO prompts (session_id, content, char_count, word_count, timestamp) VALUES (?, ?, ?, ?, ?)"
            ).run(sessionId, content, charCount, wordCount, localNow());
            db.prepare(
              "UPDATE sessions SET prompt_count = prompt_count + 1 WHERE id = ?"
            ).run(sessionId);
            incrementDaily(db, { prompts: 1 });
          });
        }
      }
    },
  };
};
`
}

/**
 * Installs the bashstats plugin into OpenCode's plugins directory.
 * Creates the plugins directory if it does not exist.
 */
export function installOpenCode(): { success: boolean; message: string } {
  try {
    const dataDir = path.join(os.homedir(), DATA_DIR)
    fs.mkdirSync(dataDir, { recursive: true })

    const dbPath = path.join(dataDir, DB_FILENAME)
    const pluginsDir = getOpenCodePluginsDir()
    fs.mkdirSync(pluginsDir, { recursive: true })

    const pluginPath = getOpenCodePluginPath()
    const content = getOpenCodePluginContent(dbPath)
    fs.writeFileSync(pluginPath, content, 'utf-8')

    return { success: true, message: `bashstats plugin installed at ${pluginPath}` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `OpenCode plugin install failed: ${message}` }
  }
}

/**
 * Removes the bashstats plugin file from OpenCode's plugins directory.
 */
export function uninstallOpenCode(): { success: boolean; message: string } {
  try {
    const pluginPath = getOpenCodePluginPath()
    if (fs.existsSync(pluginPath)) {
      fs.unlinkSync(pluginPath)
      return { success: true, message: 'bashstats plugin removed from OpenCode.' }
    }
    return { success: true, message: 'No bashstats plugin found; nothing to uninstall.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, message: `OpenCode plugin uninstall failed: ${message}` }
  }
}
