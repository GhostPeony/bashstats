import Database from 'better-sqlite3'
import type { EventRow, SessionRow, PromptRow, DailyActivityRow, AchievementUnlockRow, TokenUsage, WeeklyGoalRow, WeeklyXPRow } from '../types.js'

function localNow(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  hook_type TEXT NOT NULL,
  tool_name TEXT,
  tool_input TEXT,
  tool_output TEXT,
  exit_code INTEGER,
  success INTEGER,
  cwd TEXT,
  project TEXT,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent TEXT NOT NULL DEFAULT 'claude-code',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  stop_reason TEXT,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  project TEXT,
  duration_seconds INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_input_tokens INTEGER DEFAULT 0,
  cache_read_input_tokens INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS daily_activity (
  date TEXT PRIMARY KEY,
  sessions INTEGER DEFAULT 0,
  prompts INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cache_creation_input_tokens INTEGER DEFAULT 0,
  cache_read_input_tokens INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS achievement_unlocks (
  badge_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL,
  notified INTEGER DEFAULT 0,
  PRIMARY KEY (badge_id, tier)
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS weekly_goals (
  week_start TEXT NOT NULL,
  challenge_id TEXT NOT NULL,
  completed INTEGER DEFAULT 0,
  xp_reward INTEGER NOT NULL,
  PRIMARY KEY (week_start, challenge_id)
);

CREATE TABLE IF NOT EXISTS weekly_xp (
  week_start TEXT PRIMARY KEY,
  base_xp INTEGER DEFAULT 0,
  multiplier REAL DEFAULT 1.0,
  bonus_xp INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_hook_type ON events(hook_type);
CREATE INDEX IF NOT EXISTS idx_events_tool_name ON events(tool_name);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_project ON events(project);
CREATE INDEX IF NOT EXISTS idx_prompts_session ON prompts(session_id);
CREATE INDEX IF NOT EXISTS idx_prompts_timestamp ON prompts(timestamp);
`

export class BashStatsDB {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('busy_timeout = 5000')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
    this.migrate()
  }

  private migrate(): void {
    const sessionCols = this.db.pragma('table_info(sessions)') as { name: string }[]
    const sessionColNames = new Set(sessionCols.map(c => c.name))

    if (!sessionColNames.has('agent')) {
      this.db.exec("ALTER TABLE sessions ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude-code'")
    }

    const tokenCols = ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']
    for (const col of tokenCols) {
      if (!sessionColNames.has(col)) {
        this.db.exec(`ALTER TABLE sessions ADD COLUMN ${col} INTEGER DEFAULT 0`)
      }
    }

    const dailyCols = this.db.pragma('table_info(daily_activity)') as { name: string }[]
    const dailyColNames = new Set(dailyCols.map(c => c.name))
    for (const col of tokenCols) {
      if (!dailyColNames.has(col)) {
        this.db.exec(`ALTER TABLE daily_activity ADD COLUMN ${col} INTEGER DEFAULT 0`)
      }
    }
  }

  close(): void {
    this.db.close()
  }

  getTableNames(): string[] {
    const rows = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    return rows.map(r => r.name)
  }

  // === Events ===

  insertEvent(event: Omit<EventRow, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO events (session_id, hook_type, tool_name, tool_input, tool_output, exit_code, success, cwd, project, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      event.session_id, event.hook_type, event.tool_name, event.tool_input,
      event.tool_output, event.exit_code, event.success, event.cwd, event.project, event.timestamp
    )
    return result.lastInsertRowid as number
  }

  getEvents(filter: { session_id?: string; hook_type?: string; tool_name?: string }): EventRow[] {
    let sql = 'SELECT * FROM events WHERE 1=1'
    const params: unknown[] = []
    if (filter.session_id) { sql += ' AND session_id = ?'; params.push(filter.session_id) }
    if (filter.hook_type) { sql += ' AND hook_type = ?'; params.push(filter.hook_type) }
    if (filter.tool_name) { sql += ' AND tool_name = ?'; params.push(filter.tool_name) }
    sql += ' ORDER BY timestamp ASC'
    return this.db.prepare(sql).all(...params) as EventRow[]
  }

  // === Sessions ===

  insertSession(session: { id: string; agent?: string; started_at: string; project?: string | null }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO sessions (id, agent, started_at, project) VALUES (?, ?, ?, ?)
    `).run(session.id, session.agent ?? 'claude-code', session.started_at, session.project ?? null)
  }

  getSession(id: string): SessionRow | null {
    return this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as SessionRow | null
  }

  updateSession(id: string, updates: Partial<Pick<SessionRow, 'ended_at' | 'stop_reason' | 'duration_seconds'>>): void {
    const sets: string[] = []
    const params: unknown[] = []
    if (updates.ended_at !== undefined) { sets.push('ended_at = ?'); params.push(updates.ended_at) }
    if (updates.stop_reason !== undefined) { sets.push('stop_reason = ?'); params.push(updates.stop_reason) }
    if (updates.duration_seconds !== undefined) { sets.push('duration_seconds = ?'); params.push(updates.duration_seconds) }
    if (sets.length === 0) return
    params.push(id)
    this.db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  updateSessionTokens(id: string, tokens: TokenUsage): void {
    this.db.prepare(`
      UPDATE sessions SET input_tokens = ?, output_tokens = ?, cache_creation_input_tokens = ?, cache_read_input_tokens = ? WHERE id = ?
    `).run(tokens.input_tokens, tokens.output_tokens, tokens.cache_creation_input_tokens, tokens.cache_read_input_tokens, id)
  }

  incrementSessionCounters(id: string, counters: { prompts?: number; tools?: number; errors?: number }): void {
    const sets: string[] = []
    const params: unknown[] = []
    if (counters.prompts) { sets.push('prompt_count = prompt_count + ?'); params.push(counters.prompts) }
    if (counters.tools) { sets.push('tool_count = tool_count + ?'); params.push(counters.tools) }
    if (counters.errors) { sets.push('error_count = error_count + ?'); params.push(counters.errors) }
    if (sets.length === 0) return
    params.push(id)
    this.db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  // === Prompts ===

  insertPrompt(prompt: Omit<PromptRow, 'id'>): number {
    const result = this.db.prepare(`
      INSERT INTO prompts (session_id, content, char_count, word_count, timestamp) VALUES (?, ?, ?, ?, ?)
    `).run(prompt.session_id, prompt.content, prompt.char_count, prompt.word_count, prompt.timestamp)
    return result.lastInsertRowid as number
  }

  getPrompts(sessionId: string): PromptRow[] {
    return this.db.prepare('SELECT * FROM prompts WHERE session_id = ? ORDER BY timestamp ASC').all(sessionId) as PromptRow[]
  }

  // === Daily Activity ===

  incrementDailyActivity(date: string, increments: { sessions?: number; prompts?: number; tool_calls?: number; errors?: number; duration_seconds?: number; input_tokens?: number; output_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }): void {
    this.db.prepare(`
      INSERT INTO daily_activity (date, sessions, prompts, tool_calls, errors, duration_seconds, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        sessions = sessions + excluded.sessions,
        prompts = prompts + excluded.prompts,
        tool_calls = tool_calls + excluded.tool_calls,
        errors = errors + excluded.errors,
        duration_seconds = duration_seconds + excluded.duration_seconds,
        input_tokens = input_tokens + excluded.input_tokens,
        output_tokens = output_tokens + excluded.output_tokens,
        cache_creation_input_tokens = cache_creation_input_tokens + excluded.cache_creation_input_tokens,
        cache_read_input_tokens = cache_read_input_tokens + excluded.cache_read_input_tokens
    `).run(
      date,
      increments.sessions ?? 0,
      increments.prompts ?? 0,
      increments.tool_calls ?? 0,
      increments.errors ?? 0,
      increments.duration_seconds ?? 0,
      increments.input_tokens ?? 0,
      increments.output_tokens ?? 0,
      increments.cache_creation_input_tokens ?? 0,
      increments.cache_read_input_tokens ?? 0,
    )
  }

  getDailyActivity(date: string): DailyActivityRow | null {
    return this.db.prepare('SELECT * FROM daily_activity WHERE date = ?').get(date) as DailyActivityRow | null
  }

  getAllDailyActivity(days?: number): DailyActivityRow[] {
    if (days) {
      return this.db.prepare('SELECT * FROM daily_activity ORDER BY date DESC LIMIT ?').all(days) as DailyActivityRow[]
    }
    return this.db.prepare('SELECT * FROM daily_activity ORDER BY date DESC').all() as DailyActivityRow[]
  }

  // === Achievement Unlocks ===

  insertUnlock(badgeId: string, tier: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO achievement_unlocks (badge_id, tier, unlocked_at) VALUES (?, ?, ?)
    `).run(badgeId, tier, localNow())
  }

  getUnlocks(): AchievementUnlockRow[] {
    return this.db.prepare('SELECT * FROM achievement_unlocks ORDER BY unlocked_at DESC').all() as AchievementUnlockRow[]
  }

  getUnnotifiedUnlocks(): AchievementUnlockRow[] {
    return this.db.prepare('SELECT * FROM achievement_unlocks WHERE notified = 0').all() as AchievementUnlockRow[]
  }

  markNotified(badgeId: string, tier: number): void {
    this.db.prepare('UPDATE achievement_unlocks SET notified = 1 WHERE badge_id = ? AND tier = ?').run(badgeId, tier)
  }

  // === Metadata ===

  setMetadata(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)').run(key, value)
  }

  getMetadata(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  // === Weekly Goals ===

  insertWeeklyGoal(weekStart: string, challengeId: string, xpReward: number): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO weekly_goals (week_start, challenge_id, xp_reward) VALUES (?, ?, ?)
    `).run(weekStart, challengeId, xpReward)
  }

  completeWeeklyGoal(weekStart: string, challengeId: string): void {
    this.db.prepare('UPDATE weekly_goals SET completed = 1 WHERE week_start = ? AND challenge_id = ?').run(weekStart, challengeId)
  }

  getWeeklyGoals(weekStart: string): WeeklyGoalRow[] {
    return this.db.prepare('SELECT * FROM weekly_goals WHERE week_start = ?').all(weekStart) as WeeklyGoalRow[]
  }

  // === Weekly XP ===

  upsertWeeklyXP(weekStart: string, baseXP: number, multiplier: number, bonusXP: number): void {
    this.db.prepare(`
      INSERT INTO weekly_xp (week_start, base_xp, multiplier, bonus_xp) VALUES (?, ?, ?, ?)
      ON CONFLICT(week_start) DO UPDATE SET base_xp = ?, multiplier = ?, bonus_xp = ?
    `).run(weekStart, baseXP, multiplier, bonusXP, baseXP, multiplier, bonusXP)
  }

  getWeeklyXP(weekStart: string): WeeklyXPRow | null {
    return this.db.prepare('SELECT * FROM weekly_xp WHERE week_start = ?').get(weekStart) as WeeklyXPRow | null
  }

  // === Raw DB access for stats engine ===

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql)
  }
}
