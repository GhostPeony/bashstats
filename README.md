# bashstats
<img width="1727" height="916" alt="bashstats2" src="https://github.com/user-attachments/assets/4029e711-f559-4771-9490-dedd4aeec1ee" />

Track every prompt, tool call, and late-night coding session. Earn badges. Build streaks. Watch your rank climb from Bronze to Obsidian.
bashstats hooks into Claude Code and quietly records everything — sessions, prompts, tool usage, errors, and streaks. It then turns it all into stats,
achievements, and a dashboard you'll check way too often.
  
## Install

```bash
npm install -g bashstats
bashstats init
```

`bashstats init` installs Claude Code hooks and creates the local database at `~/.bashstats/bashstats.db`. Stats begin recording immediately.

## CLI Commands

| Command | Description |
|---|---|
| `bashstats init` | Install hooks and set up database |
| `bashstats stats` | Quick stat summary in your terminal |
| `bashstats achievements` | List all badges with progress bars |
| `bashstats streak` | Show current and longest daily streak |
| `bashstats web` | Launch the browser dashboard |
| `bashstats export` | Export all data as JSON |
| `bashstats reset` | Wipe all data |
| `bashstats uninstall` | Remove hooks and data |

### Options

```bash
bashstats web --port 8080    # Custom port (default: 17900)
bashstats web --no-open      # Don't auto-open browser
```

## Dashboard

The browser dashboard at `http://localhost:17900` includes:

- **Overview** - Recent badges, rank progress, stat cards, activity heatmap, and recent sessions at a glance
- **Stats** - Lifetime totals, tool breakdowns, time analysis, session records, and project stats in a 2x2 grid
- **Achievements** - All 53 badges with tier progress, organized by category
- **Timeline** - Activity heatmap and session history with sparkline charts

## What Gets Tracked

bashstats hooks into 12 Claude Code events:

| Event | What it records |
|---|---|
| SessionStart | Session creation, project, agent type |
| UserPromptSubmit | Prompt content, character/word counts |
| PreToolUse | Tool invocations (Bash, Read, Edit, etc.) |
| PostToolUse | Tool results and exit codes |
| PostToolUseFailure | Failed tool calls |
| Stop | Session end time and duration |
| Notification | Errors and rate limits |
| SubagentStart | Subagent spawns |
| SubagentStop | Subagent completions |
| PreCompact | Context compactions |
| PermissionRequest | Permission prompts |
| Setup | Initialization events |

## Achievements
<img width="1732" height="917" alt="bashstats" src="https://github.com/user-attachments/assets/63591b76-54ff-4659-b81a-e6310810e364" />

53 badges across 10 categories, each with 5 tiers: Bronze, Silver, Gold, Diamond, Obsidian.

### Volume
- **First Prompt** - Submit prompts to Claude
- **Tool Time** - Make tool calls
- **Marathon** - Spend hours in sessions
- **Wordsmith** - Type characters in prompts
- **Session Vet** - Complete sessions

### Tool Mastery
- **Shell Lord** - Execute Bash commands
- **Bookworm** - Read files
- **Editor-in-Chief** - Edit files
- **Architect** - Create files
- **Detective** - Search with Grep and Glob
- **Web Crawler** - Fetch web pages
- **Delegator** - Spawn subagents

### Time & Streaks
- **Iron Streak** - Maintain a daily streak
- **Night Owl** - Prompts between midnight and 5am
- **Early Bird** - Prompts between 5am and 8am
- **Weekend Warrior** - Weekend sessions

### Behavioral
- **Creature of Habit** - Repeat your most-used prompt
- **Explorer** - Use unique tool types
- **Planner** - Use plan mode
- **Novelist** - Write prompts over 1000 characters
- **Speed Demon** - Complete sessions in under 5 minutes

### Resilience
- **Clean Hands** - Longest error-free tool streak
- **Resilient** - Survive errors
- **Rate Limited** - Hit rate limits

### Shipping & Projects
- **Shipper** - Make commits via Claude
- **PR Machine** - Create pull requests
- **Empire** - Work on unique projects
- **Polyglot** - Use different programming languages

### Multi-Agent
- **Buddy System** - Use concurrent agents
- **Hive Mind** - Spawn subagents total

### Humor
- **Please and Thank You** - "You're polite to the AI. When they take over, you'll be spared."
- **Wall of Text** - "Claude read your entire novel and didn't even complain."
- **The Fixer** - "At this point just rewrite the whole thing."
- **What Day Is It?** - "Your chair is now a part of you."
- **Copy Pasta** - "Maybe if I ask again it'll work differently."
- **Error Magnet** - "At this point, the errors are a feature."

### Aspirational (Obsidian-only)
- **The Machine** - "You are no longer using the tool. You are the tool."
- **Year of Code** - "365 days. No breaks. Absolute unit."
- **Million Words** - "You've written more to Claude than most people write in a lifetime."
- **Lifer** - "At this point, Claude is your cofounder."
- **Transcendent** - "You've reached the peak. The view is nice up here."
- **Omniscient** - "You've mastered every tool. There is nothing left to teach you."

### Secret
10 hidden badges unlocked by specific behaviors. Discover them yourself.

## Rank System

XP is earned from badge tiers. Your rank progresses through:

| Rank | XP Required |
|---|---|
| Bronze | 0 |
| Silver | 1,000 |
| Gold | 5,000 |
| Diamond | 25,000 |
| Obsidian | 100,000 |

## Agent Support

bashstats detects which CLI agent is running:

- Claude Code (default)
- Gemini CLI
- Copilot CLI
- OpenCode

## Data Storage

All data is stored locally in `~/.bashstats/bashstats.db` (SQLite with WAL mode). Nothing is sent anywhere. Tables:

- `events` - Every hook event with full context
- `sessions` - Session lifecycle (start, end, duration, counts)
- `prompts` - Prompt content and word/char counts
- `daily_activity` - Aggregated daily stats
- `achievement_unlocks` - Badge tier unlock timestamps

## Tech Stack

- TypeScript + Node.js 18+
- SQLite via `better-sqlite3`
- Express for the dashboard server
- Commander for the CLI
- tsup for bundling
- vitest for tests

## Development

```bash
git clone https://github.com/GhostPeony/bashstats.git
cd bashstats
npm install
npm run build
npm link
bashstats init
```

## License

MIT
