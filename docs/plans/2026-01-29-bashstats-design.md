# bashstats - Design Document

> Obsessive stat tracking, achievements, and badges for Claude Code users.
> Think Skyrim/GTA5 stat screens, but for your coding sessions.

## Overview

**bashstats** is an npm package that silently captures data from every Claude Code session via hooks, stores it in SQLite, and presents it through a terminal TUI and browser dashboard. Users accumulate stats, earn achievements, unlock badges, and climb rank tiers -- turning daily Claude Code usage into a gamified experience.

**Distribution:** `npm install -g bashstats`
**Storage:** `~/.bashstats/bashstats.db` (SQLite)
**Hooks:** Installed into `~/.claude/settings.json`
**Dashboard:** TUI (default) + Browser (`--web` flag)

---

## Architecture

### Tech Stack

- **Language:** TypeScript, compiled to JavaScript
- **Database:** SQLite via `better-sqlite3`
- **TUI:** Ink (React for terminals)
- **Web Dashboard:** Single HTML file SPA, vanilla JS, Express backend (matching bashbros pattern)
- **Package:** Single npm package, zero external services for v1

### Data Flow

```
Claude Code session
  -> Hook fires (stdin JSON from Claude Code)
  -> Node.js hook script parses event data
  -> INSERT into SQLite (~/.bashstats/bashstats.db)
  -> Dashboard reads SQLite on demand (TUI or browser)
```

### Hook Installation

On `bashstats init`, the tool:

1. Reads `~/.claude/settings.json`
2. Merges bashstats hook configurations for all 12 events (does NOT overwrite existing hooks)
3. Creates `~/.bashstats/` directory and SQLite database
4. Prints welcome message with "Launch Day" secret achievement

Each hook is a Node.js script that reads stdin JSON, extracts relevant data, and inserts into SQLite. Non-blocking -- hooks exit immediately so Claude Code is never slowed down.

### Hooks Captured

All 12 Claude Code hook events:

| Hook Event | Data Captured |
|-----------|---------------|
| **SessionStart** | Session ID, model, source (startup/resume/clear/compact) |
| **UserPromptSubmit** | Full prompt text, character count, word count |
| **PreToolUse** | Tool name, tool input (command, file path, etc.), tool_use_id |
| **PostToolUse** | Tool name, input, output, exit code, success status |
| **PostToolUseFailure** | Failed tool name, input, error details |
| **PermissionRequest** | Permission type, tool involved |
| **SubagentStart** | Agent ID, agent type |
| **SubagentStop** | Agent ID, transcript path |
| **Stop** | Stop reason, session duration |
| **PreCompact** | Trigger (manual/auto), indicates context overflow |
| **Notification** | Message, notification type (error, rate_limit, etc.) |
| **Setup** | Trigger (init/maintenance) |

Additional data available from hook input on every event:
- `session_id` - unique session identifier
- `transcript_path` - path to conversation JSONL
- `cwd` - current working directory
- `permission_mode` - current permission settings

---

## CLI Commands

```
bashstats init            # Install hooks, create DB, first-time setup
bashstats                 # Open TUI dashboard (default)
bashstats web             # Open browser dashboard on localhost
bashstats stats           # Quick one-shot summary (no interactive TUI)
bashstats achievements    # List all badges with progress
bashstats streak          # Show current/longest streak
bashstats export          # Export all data as JSON
bashstats reset           # Wipe data (with confirmation)
bashstats uninstall       # Remove hooks and data cleanly
```

---

## Stat Categories

### Lifetime Totals

- Total sessions started
- Total time in Claude Code (hours, minutes, seconds)
- Total prompts submitted
- Total characters typed (across all prompts)
- Total tool calls made
- Total files read / written / edited / created
- Total Bash commands executed
- Total web searches / web fetches
- Total subagents spawned
- Total context compactions triggered
- Total errors encountered
- Total rate limits hit

### Tool Mastery (per-tool counters)

- Bash calls, Read calls, Write calls, Edit calls, Grep calls, Glob calls, WebFetch calls, WebSearch calls, Task calls, NotebookEdit calls, Skill calls, EnterPlanMode calls, ExitPlanMode calls, AskUserQuestion calls

### Code Fingerprint

- Lines of code written (via Write tool)
- Lines of code modified (via Edit tool)
- Unique files touched
- Unique file extensions worked with
- Most edited file (all-time)
- Most read file (all-time)
- Languages used (inferred from file extensions)
- Primary language

### Prompt Intelligence

- Average / shortest / longest prompt length
- Total characters typed
- Single-word prompt count
- Prompts ending in "?" (questions vs commands)
- Most common opening words
- Vocabulary diversity score
- Prompts mentioning specific tech (keyword extraction: React, Python, Docker, etc.)

### Behavioral Patterns

- Creature of Habit score (repeated prompt similarity)
- Unique vs repeated prompt ratio
- Most repeated phrase/instruction
- Workflow style: Planner vs Diver (based on EnterPlanMode usage)
- Delegation style (subagent spawn frequency)
- Edit-to-read ratio (readers vs divers)

### Time & Rhythm

- Current daily streak (consecutive days with activity)
- Longest daily streak ever
- Peak hour (most active hour of day)
- Night owl count (prompts between midnight-5am)
- Early bird count (prompts between 5am-8am)
- Weekend sessions count
- Most active day of week
- Busiest single day ever (date + count)
- Average gap between sessions
- Session start time distribution

### Multi-Agent Stats

- Concurrent agent sessions (2+ running at once)
- Total subagents spawned
- Subagent types used (Explore, Plan, Bash, etc.)
- Deepest subagent nesting
- Favorite subagent type

### Session Records

- Longest session (duration)
- Most productive session (most tool calls)
- Most prompts in a single session
- Fastest completion (shortest session with successful output)
- Average duration / prompts per session / tools per session

### Project Stats

- Unique projects worked on
- Most visited project
- Sessions per project breakdown
- Project switching frequency

### Error & Recovery

- Total errors
- Error-free session count
- Longest error-free streak (by tool calls)
- Most common error type
- Tool failure rates
- Permission denials
- Rate limit frequency

### Git & Shipping

- Commits made via Claude (detected from Bash git commands)
- PRs created
- Branches touched
- Repos worked on

---

## Achievement & Badge System

53 total badges across 10 categories. Each standard badge has 5 tiers: **Bronze -> Silver -> Gold -> Diamond -> Obsidian**.

### Volume (5 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| First Prompt | prompts | 1 | 100 | 1K | 5K | 25K |
| Tool Time | tool calls | 10 | 500 | 5K | 25K | 100K |
| Marathon | session hours | 1 | 10 | 100 | 500 | 2K |
| Wordsmith | chars typed | 1K | 50K | 500K | 2M | 10M |
| Session Vet | sessions | 1 | 50 | 500 | 2K | 10K |

### Tool Mastery (7 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Shell Lord | Bash calls | 10 | 100 | 500 | 2K | 10K |
| Bookworm | files read | 25 | 250 | 1K | 5K | 25K |
| Editor-in-Chief | files edited | 10 | 100 | 500 | 2K | 10K |
| Architect | files created | 10 | 50 | 200 | 1K | 5K |
| Detective | search calls | 25 | 250 | 1K | 5K | 25K |
| Web Crawler | web fetches | 5 | 50 | 200 | 1K | 5K |
| Delegator | subagents | 5 | 50 | 200 | 1K | 5K |

### Time & Streaks (4 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Iron Streak | consecutive days | 3 | 7 | 30 | 100 | 365 |
| Night Owl | midnight-5am prompts | 10 | 50 | 200 | 1K | 5K |
| Early Bird | 5-8am prompts | 10 | 50 | 200 | 1K | 5K |
| Weekend Warrior | weekend sessions | 5 | 25 | 100 | 500 | 2K |

### Behavioral (5 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Creature of Habit | most-repeated prompt count | 25 | 100 | 500 | 2K | 10K |
| Explorer | unique tools used | 3 | 5 | 8 | 11 | 14 |
| Planner | plan mode uses | 5 | 25 | 100 | 500 | 2K |
| Novelist | prompts >1K chars | 5 | 25 | 100 | 500 | 2K |
| Speed Demon | sessions <5min w/ output | 5 | 25 | 100 | 500 | 2K |

### Resilience (3 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Clean Hands | error-free streak | 50 | 200 | 500 | 2K | 10K |
| Resilient | total errors survived | 10 | 50 | 200 | 1K | 5K |
| Rate Limited | rate limits hit | 3 | 10 | 25 | 50 | 100 |

### Shipping & Projects (4 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Shipper | commits via Claude | 5 | 50 | 200 | 1K | 5K |
| PR Machine | PRs created | 3 | 25 | 100 | 500 | 2K |
| Empire | unique projects | 2 | 5 | 10 | 25 | 50 |
| Polyglot | languages used | 2 | 3 | 5 | 8 | 12 |

### Multi-Agent (2 badges)

| Badge | Stat | Bronze | Silver | Gold | Diamond | Obsidian |
|-------|------|--------|--------|------|---------|----------|
| Buddy System | concurrent agents used | 1 | 5 | 25 | 100 | 500 |
| Hive Mind | total subagents | 10 | 100 | 500 | 2K | 10K |

### Public Humor (7 badges)

| Badge | Stat | B | S | G | D | O | Description |
|-------|------|---|---|---|---|---|-------------|
| Please and Thank You | polite prompts | 10 | 50 | 200 | 1K | 5K | "You're polite to the AI. When they take over, you'll be spared." |
| Wall of Text | prompts >5K chars | 1 | 10 | 50 | 200 | 1K | "Claude read your entire novel and didn't even complain." |
| The Fixer | same-file edits/session | 10 | 20 | 50 | 100 | 200 | "At this point just rewrite the whole thing." |
| What Day Is It? | sessions >8hrs | 1 | 5 | 25 | 100 | 500 | "Your chair is now a part of you." |
| Copy Pasta | same prompt repeated | 3 | 10 | 50 | 200 | 1K | "Maybe if I ask again it'll work differently." |
| Error Magnet | errors in single session | 10 | 25 | 50 | 100 | 200 | "At this point, the errors are a feature." |
| Creature of Habit | most-repeated count | 25 | 100 | 500 | 2K | 10K | "You have a type. And it's the same prompt." |

### Ultra-High Aspirational (6 badges)

Single-tier (Obsidian only) badges that represent lifetime mastery:

| Badge | Threshold | Description |
|-------|-----------|-------------|
| The Machine | 100,000 tool calls | "You are no longer using the tool. You are the tool." |
| Year of Code | 365-day streak | "365 days. No breaks. Absolute unit." |
| Million Words | 10,000,000 chars typed | "You've written more to Claude than most people write in a lifetime." |
| Lifer | 10,000 sessions | "At this point, Claude is your cofounder." |
| Transcendent | 100,000 XP | "You've reached the peak. The view is nice up here." |
| Omniscient | all tool badges at Obsidian | "You've mastered every tool. There is nothing left to teach you." |

### Secret Achievements (10 badges)

Hidden until unlocked. Not shown in the badge wall until triggered.

| Badge | Trigger | Description |
|-------|---------|-------------|
| rm -rf Survivor | Dangerous Bash command blocked | "You almost mass deleted that folder. But you didn't. And honestly, we're all better for it." |
| Touch Grass | Return after 7+ day break | "Welcome back. The codebase missed you. (It didn't change, but still.)" |
| 3am Coder | Prompt between 2:55-3:05 AM | "Nothing good happens at 3am. Except shipping code, apparently." |
| Night Shift | Session spanning midnight | "Started yesterday, finishing today. Time is a construct." |
| Inception | Subagent spawns a subagent | "We need to go deeper." |
| Holiday Hacker | Active on a major holiday | "Your family is wondering where you are. You're deploying." |
| Speed Run Any% | Session <30s with successful tool use | "In and out. Twenty-second adventure." |
| Full Send | Every tool type used in one session | "Bash, Read, Write, Edit, Grep, Glob, WebFetch -- the whole buffet." |
| Launch Day | First bashstats session ever | "Welcome to bashstats. Your stats are now being watched. Forever." |
| The Completionist | All non-secret badges at Gold+ | "You absolute legend." |

---

## XP & Rank System

### XP Sources

| Source | XP |
|--------|-----|
| Per prompt submitted | +1 |
| Per tool call | +1 |
| Per session completed | +10 |
| Per night owl prompt (midnight-5am) | +2 |
| Per 100 error-free streak | +25 |
| Badge tier: Bronze | +50 |
| Badge tier: Silver | +100 |
| Badge tier: Gold | +200 |
| Badge tier: Diamond | +500 |
| Badge tier: Obsidian | +1000 |

### Rank Thresholds

| Rank | XP Required |
|------|-------------|
| Bronze | 0 |
| Silver | 1,000 |
| Gold | 5,000 |
| Diamond | 25,000 |
| Obsidian | 100,000 |

---

## SQLite Schema

```sql
-- Every hook event captured
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
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

-- Session lifecycle
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  stop_reason TEXT,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  project TEXT,
  duration_seconds INTEGER
);

-- User prompts (from UserPromptSubmit hook)
CREATE TABLE prompts (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  word_count INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Daily activity (pre-aggregated for streak/heatmap)
CREATE TABLE daily_activity (
  date TEXT PRIMARY KEY,
  sessions INTEGER DEFAULT 0,
  prompts INTEGER DEFAULT 0,
  tool_calls INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0
);

-- Achievement unlocks (persisted for notification tracking)
CREATE TABLE achievement_unlocks (
  badge_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL,
  notified INTEGER DEFAULT 0,
  PRIMARY KEY (badge_id, tier)
);

-- Metadata (settings, first-run date, etc.)
CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### Indexes

```sql
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_hook_type ON events(hook_type);
CREATE INDEX idx_events_tool_name ON events(tool_name);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_project ON events(project);
CREATE INDEX idx_prompts_session ON prompts(session_id);
CREATE INDEX idx_prompts_timestamp ON prompts(timestamp);
CREATE INDEX idx_daily_activity_date ON daily_activity(date);
```

### Query Pattern

Stats are computed on-demand via SQL aggregations (same pattern as bashbros). The `daily_activity` table is pre-aggregated by hooks on each event for fast heatmap and streak queries. The `achievement_unlocks` table persists unlock timestamps for "new!" badge notifications and unlock history.

---

## Web Dashboard Design

### Tech Approach

Single HTML file SPA following bashbros pattern:
- Vanilla HTML/CSS/JavaScript (no framework)
- Express.js backend on localhost (port TBD)
- REST API endpoints for all data
- All styling and logic in one file

### Color Theme: Peach & Cream with Sultry Navy

```css
:root {
  /* Primary Theme: Peach Cream */
  --bg-primary: #FFF8F0;
  --bg-card: #FFFFFF;
  --bg-accent: #FFE5D0;
  --border: #1B2A4A;
  --shadow: #1B2A4A;
  --text-primary: #1B2A4A;
  --text-secondary: #5A6B8A;
  --accent: #FF8C5A;
  --accent-light: #FFBF9B;
  --success: #22c55e;
  --error: #ef4444;
  --warning: #fbbf24;

  /* Tier Colors */
  --tier-bronze: #CD7F32;
  --tier-silver: #C0C0C0;
  --tier-gold: #FFD700;
  --tier-diamond: #B9F2FF;
  --tier-obsidian: #2D1B69;
}
```

### Theme Swapping

CSS custom properties on `:root` with a theme switcher dropdown in the header. Themes stored as JSON objects, swapped by updating CSS variables at runtime.

Built-in themes:
1. **Peach Cream** (default) -- warm cream background, navy borders, peach accents
2. **Dark Mode** -- dark navy background, cream text, peach accents inverted
3. **Classic Teal** -- bashbros-style teal palette for familiarity

Users can define custom themes via JSON config in `~/.bashstats/themes/`.

### Visual Style

Matches bashbros brutalist aesthetic:
- 3px solid navy borders
- 6px offset hard shadows
- JetBrains Mono for numbers/code, Inter for body text
- Dense information layout, minimal whitespace
- Retro/brutalist card design with hard shadows

### Dashboard Tabs

1. **Overview** -- Big stat numbers, activity sparkline (last 30 days), recent badge unlocks, rank card with XP progress bar
2. **Stats** -- Full categorized stat tables organized by category (Lifetime, Tool Mastery, Code, Prompts, Time, Projects, etc.)
3. **Achievements** -- Badge wall grid with tier dots, progress bars, humor descriptions. Secret achievements shown as locked silhouettes until unlocked.
4. **Records** -- Personal bests: longest session, most productive session, longest streak, most prompts in a session, fastest completion
5. **Timeline** -- GitHub-style contribution heatmap (peach gradient instead of green), session history list with drill-down
6. **Settings** -- Theme switcher, data export, reset options, hook status check

---

## TUI Dashboard Layout

```
+-----------------------------------------------------------+
|  bashstats          Rank: Gold *    XP: 7,234 / 25,000    |
|  ################..........  28.9%    Streak: 14 days      |
+-----------------------------------------------------------+
|  [Overview] [Stats] [Achievements] [Records] [Timeline]    |
+-----------------------------------------------------------+
|                                                            |
|  Sessions: 847    Prompts: 12,304    Tools: 89,211         |
|  Hours: 423.7     Files: 3,891       Bash: 24,019          |
|                                                            |
|  Activity (last 30 days):                                  |
|  ..###.####.##..###.####.##..###                           |
|                                                            |
|  Recent Badges:                                            |
|  [Gold] Shell Lord   [Silver] Bookworm                     |
|  [NEW] Night Owl (Bronze)                                  |
|                                                            |
|  Top Project: ghostwork (312 sessions)                     |
|  Peak Hour: 10pm    Style: Planner                         |
+-----------------------------------------------------------+
```

Tab navigation via arrow keys or number keys. Ink-based React components for each tab view.

---

## v2: Online Platform (Future)

After v1 is stable:

- Web domain where users can create accounts
- `bashstats login` command to authenticate
- Opt-in data streaming from local SQLite to cloud
- Public profile pages with shareable stat cards
- Global leaderboards (opt-in)
- Community achievements (collective milestones)
- Compare stats with friends
- Weekly/monthly stat digests (email or notification)

This is out of scope for v1 but the SQLite schema and data capture are designed to support this transition. The `export` command provides the data format that the cloud sync will use.

---

## Implementation Priority

### Phase 1: Core Infrastructure
- npm package scaffold (TypeScript, build tooling)
- SQLite database setup and schema
- Hook scripts for all 12 events
- `bashstats init` command (hook installation)

### Phase 2: Data Collection
- Event capture from all hooks
- Session lifecycle tracking
- Prompt capture and analysis
- Daily activity pre-aggregation
- Project detection from cwd

### Phase 3: Stats Engine
- SQL aggregation queries for all stat categories
- Achievement computation (badge definitions + tier calculation)
- XP and rank computation
- Streak calculation
- Secret achievement trigger detection

### Phase 4: TUI Dashboard
- Ink-based terminal UI
- Overview tab with big numbers and sparkline
- Stats tab with categorized tables
- Achievements tab with badge grid
- Records and Timeline tabs

### Phase 5: Web Dashboard
- Express server with API endpoints
- Single HTML file SPA
- Peach/cream/navy theme with brutalist styling
- Theme switcher with 3 built-in themes
- All 6 tabs (Overview, Stats, Achievements, Records, Timeline, Settings)
- Contribution heatmap
- Badge showcase

### Phase 6: Polish
- `bashstats stats` quick summary command
- `bashstats achievements` and `bashstats streak` commands
- `bashstats export` and `bashstats reset`
- `bashstats uninstall` cleanup
- Badge unlock notifications
- Error handling and edge cases
