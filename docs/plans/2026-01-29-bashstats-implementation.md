# bashstats Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an npm package that captures Claude Code session data via hooks, stores it in SQLite, and presents stats/achievements through TUI and web dashboards.

**Architecture:** TypeScript npm package. Hooks receive stdin JSON from Claude Code, write to SQLite via `better-sqlite3`. CLI powered by Commander. TUI via Ink (React for terminals). Web dashboard is a single-file vanilla HTML/CSS/JS SPA served by Express. Follows bashbros patterns (see `C:\Users\Cade\Projects\bashbros`).

**Tech Stack:** TypeScript, tsup, vitest, better-sqlite3, commander, ink, express

**Design Doc:** `docs/plans/2026-01-29-bashstats-design.md`

---

## Project Structure

```
src/
├── index.ts                    # Library exports
├── cli.ts                      # CLI entry point
├── types.ts                    # All TypeScript types
├── constants.ts                # Badge definitions, tier constants, XP values
├── db/
│   ├── database.ts             # SQLite connection, schema, migrations
│   ├── database.test.ts
│   ├── writer.ts               # Write interface (hooks use this)
│   └── writer.test.ts
├── hooks/
│   ├── handler.ts              # Base: stdin/env parser, routes to writer
│   ├── handler.test.ts
│   └── scripts/                # Standalone hook entry points (one per event)
│       ├── session-start.ts
│       ├── user-prompt-submit.ts
│       ├── pre-tool-use.ts
│       ├── post-tool-use.ts
│       ├── post-tool-failure.ts
│       ├── stop.ts
│       ├── notification.ts
│       ├── subagent-start.ts
│       ├── subagent-stop.ts
│       ├── pre-compact.ts
│       ├── permission-request.ts
│       └── setup.ts
├── installer/
│   ├── installer.ts            # settings.json merger
│   └── installer.test.ts
├── stats/
│   ├── engine.ts               # All SQL aggregation queries
│   └── engine.test.ts
├── achievements/
│   ├── compute.ts              # Badge + XP + secret computation
│   └── compute.test.ts
├── tui/
│   ├── app.tsx                 # Ink app root
│   ├── components/
│   │   ├── header.tsx          # Rank, XP bar, streak
│   │   ├── overview.tsx        # Big numbers, sparkline, recent badges
│   │   ├── stats-tab.tsx       # Categorized stat tables
│   │   ├── achievements-tab.tsx # Badge wall grid
│   │   ├── records-tab.tsx     # Personal bests
│   │   └── timeline-tab.tsx    # Activity heatmap
│   └── hooks/
│       └── use-stats.ts        # Data fetching hook
├── dashboard/
│   ├── server.ts               # Express server + API
│   ├── server.test.ts
│   └── static/
│       └── index.html          # Single-file SPA (HTML+CSS+JS)
└── commands/
    ├── init.ts                 # bashstats init
    ├── stats.ts                # bashstats stats (quick summary)
    ├── achievements.ts         # bashstats achievements
    ├── streak.ts               # bashstats streak
    ├── export.ts               # bashstats export
    ├── reset.ts                # bashstats reset
    └── uninstall.ts            # bashstats uninstall
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.npmignore`

**Step 1: Initialize git**

Run: `git init`

**Step 2: Create package.json**

```json
{
  "name": "bashstats",
  "version": "0.1.0",
  "description": "Obsessive stat tracking, achievements, and badges for Claude Code users",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "bashstats": "dist/cli.js"
  },
  "scripts": {
    "build": "tsup && npm run copy-static",
    "copy-static": "node -e \"const fs=require('fs');fs.mkdirSync('dist/static',{recursive:true});fs.cpSync('src/dashboard/static','dist/static',{recursive:true})\"",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["claude", "claude-code", "stats", "achievements", "badges", "developer-tools"],
  "license": "MIT",
  "engines": {
    "node": ">=18"
  }
}
```

**Step 3: Install dependencies**

Run: `npm install better-sqlite3 commander express ink ink-spinner react`
Run: `npm install -D typescript tsup vitest @types/better-sqlite3 @types/express @types/react`

**Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 5: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/cli.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
  {
    entry: ['src/hooks/scripts/*.ts'],
    format: ['esm'],
    outDir: 'dist/hooks',
    sourcemap: true,
    target: 'node18',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
])
```

**Step 6: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/cli.ts', 'src/**/*.test.ts', 'src/tui/**', 'src/hooks/scripts/**'],
    },
  },
})
```

**Step 7: Create .gitignore**

```
node_modules/
dist/
coverage/
*.tsbuildinfo
.DS_Store
```

**Step 8: Create .npmignore**

```
src/
coverage/
*.test.ts
vitest.config.ts
tsup.config.ts
tsconfig.json
.claude/
docs/
```

**Step 9: Create placeholder source files**

Create `src/index.ts`:
```typescript
export { BashStatsDB } from './db/database.js'
```

Create `src/cli.ts`:
```typescript
console.log('bashstats v0.1.0')
```

**Step 10: Verify build works**

Run: `npm run build`
Expected: Compiles without errors, creates dist/

**Step 11: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore .npmignore src/
git commit -m "feat: project scaffold with TypeScript, tsup, vitest"
```

---

## Task 2: Types & Constants

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`

**Step 1: Create src/types.ts**

```typescript
// === Hook Event Types ===

export interface HookInput {
  session_id: string
  transcript_path: string
  cwd: string
  permission_mode: string
  hook_event_name: string
}

export interface SessionStartInput extends HookInput {
  source: 'startup' | 'resume' | 'clear' | 'compact'
  model: string
  agent_type?: string
}

export interface UserPromptInput extends HookInput {
  prompt: string
}

export interface PreToolUseInput extends HookInput {
  tool_name: string
  tool_input: Record<string, unknown>
  tool_use_id: string
}

export interface PostToolUseInput extends HookInput {
  tool_name: string
  tool_input: Record<string, unknown>
  tool_response: Record<string, unknown>
  tool_use_id: string
}

export interface StopInput extends HookInput {
  stop_hook_active: boolean
}

export interface SubagentStartInput extends HookInput {
  agent_id: string
  agent_type: string
}

export interface SubagentStopInput extends HookInput {
  agent_id: string
  agent_transcript_path: string
  stop_hook_active: boolean
}

export interface NotificationInput extends HookInput {
  message: string
  notification_type: string
}

export interface PreCompactInput extends HookInput {
  trigger: 'manual' | 'auto'
  custom_instructions: string
}

export interface PermissionRequestInput extends HookInput {
  tool_name: string
  tool_input: Record<string, unknown>
}

export interface SetupInput extends HookInput {
  trigger: 'init' | 'maintenance'
  CLAUDE_ENV_FILE: string
}

// === Database Types ===

export interface EventRow {
  id: number
  session_id: string
  hook_type: string
  tool_name: string | null
  tool_input: string | null
  tool_output: string | null
  exit_code: number | null
  success: number | null
  cwd: string | null
  project: string | null
  timestamp: string
}

export interface SessionRow {
  id: string
  started_at: string
  ended_at: string | null
  stop_reason: string | null
  prompt_count: number
  tool_count: number
  error_count: number
  project: string | null
  duration_seconds: number | null
}

export interface PromptRow {
  id: number
  session_id: string
  content: string
  char_count: number
  word_count: number
  timestamp: string
}

export interface DailyActivityRow {
  date: string
  sessions: number
  prompts: number
  tool_calls: number
  errors: number
  duration_seconds: number
}

export interface AchievementUnlockRow {
  badge_id: string
  tier: number
  unlocked_at: string
  notified: number
}

// === Stats Types ===

export interface LifetimeStats {
  totalSessions: number
  totalDurationSeconds: number
  totalPrompts: number
  totalCharsTyped: number
  totalToolCalls: number
  totalFilesRead: number
  totalFilesWritten: number
  totalFilesEdited: number
  totalFilesCreated: number
  totalBashCommands: number
  totalWebSearches: number
  totalWebFetches: number
  totalSubagents: number
  totalCompactions: number
  totalErrors: number
  totalRateLimits: number
}

export interface ToolBreakdown {
  [toolName: string]: number
}

export interface TimeStats {
  currentStreak: number
  longestStreak: number
  peakHour: number
  peakHourCount: number
  nightOwlCount: number
  earlyBirdCount: number
  weekendSessions: number
  mostActiveDay: number
  busiestDate: string
  busiestDateCount: number
}

export interface SessionRecords {
  longestSessionSeconds: number
  mostToolsInSession: number
  mostPromptsInSession: number
  fastestSessionSeconds: number
  avgDurationSeconds: number
  avgPromptsPerSession: number
  avgToolsPerSession: number
}

export interface ProjectStats {
  uniqueProjects: number
  mostVisitedProject: string
  mostVisitedProjectCount: number
  projectBreakdown: Record<string, number>
}

export interface AllStats {
  lifetime: LifetimeStats
  tools: ToolBreakdown
  time: TimeStats
  sessions: SessionRecords
  projects: ProjectStats
}

// === Achievement Types ===

export type BadgeTier = 0 | 1 | 2 | 3 | 4 | 5

export interface BadgeDefinition {
  id: string
  name: string
  description: string
  category: 'volume' | 'tool_mastery' | 'time' | 'behavioral' | 'resilience' | 'shipping' | 'multi_agent' | 'humor' | 'aspirational' | 'secret'
  stat: string
  tiers: [number, number, number, number, number]
  secret?: boolean
  humor?: boolean
  aspirational?: boolean
}

export interface BadgeResult {
  id: string
  name: string
  description: string
  category: string
  tier: BadgeTier
  tierName: string
  value: number
  nextThreshold: number
  progress: number
  maxed: boolean
  secret: boolean
  unlocked: boolean
}

export interface XPResult {
  totalXP: number
  rank: string
  nextRankXP: number
  progress: number
}

export interface AchievementsPayload {
  stats: AllStats
  badges: BadgeResult[]
  xp: XPResult
}

export const TIER_NAMES: Record<BadgeTier, string> = {
  0: 'Locked',
  1: 'Bronze',
  2: 'Silver',
  3: 'Gold',
  4: 'Diamond',
  5: 'Obsidian',
}
```

**Step 2: Create src/constants.ts**

Write all 53 badge definitions. Structure:

```typescript
import type { BadgeDefinition } from './types.js'

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // === VOLUME (5) ===
  { id: 'first_prompt', name: 'First Prompt', description: 'Submit prompts to Claude', category: 'volume', stat: 'totalPrompts', tiers: [1, 100, 1000, 5000, 25000] },
  { id: 'tool_time', name: 'Tool Time', description: 'Make tool calls', category: 'volume', stat: 'totalToolCalls', tiers: [10, 500, 5000, 25000, 100000] },
  { id: 'marathon', name: 'Marathon', description: 'Spend hours in sessions', category: 'volume', stat: 'totalSessionHours', tiers: [1, 10, 100, 500, 2000] },
  { id: 'wordsmith', name: 'Wordsmith', description: 'Type characters in prompts', category: 'volume', stat: 'totalCharsTyped', tiers: [1000, 50000, 500000, 2000000, 10000000] },
  { id: 'session_vet', name: 'Session Vet', description: 'Complete sessions', category: 'volume', stat: 'totalSessions', tiers: [1, 50, 500, 2000, 10000] },

  // === TOOL MASTERY (7) ===
  { id: 'shell_lord', name: 'Shell Lord', description: 'Execute Bash commands', category: 'tool_mastery', stat: 'totalBashCommands', tiers: [10, 100, 500, 2000, 10000] },
  { id: 'bookworm', name: 'Bookworm', description: 'Read files', category: 'tool_mastery', stat: 'totalFilesRead', tiers: [25, 250, 1000, 5000, 25000] },
  { id: 'editor_in_chief', name: 'Editor-in-Chief', description: 'Edit files', category: 'tool_mastery', stat: 'totalFilesEdited', tiers: [10, 100, 500, 2000, 10000] },
  { id: 'architect', name: 'Architect', description: 'Create files', category: 'tool_mastery', stat: 'totalFilesCreated', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'detective', name: 'Detective', description: 'Search with Grep and Glob', category: 'tool_mastery', stat: 'totalSearches', tiers: [25, 250, 1000, 5000, 25000] },
  { id: 'web_crawler', name: 'Web Crawler', description: 'Fetch web pages', category: 'tool_mastery', stat: 'totalWebFetches', tiers: [5, 50, 200, 1000, 5000] },
  { id: 'delegator', name: 'Delegator', description: 'Spawn subagents', category: 'tool_mastery', stat: 'totalSubagents', tiers: [5, 50, 200, 1000, 5000] },

  // === TIME & STREAKS (4) ===
  { id: 'iron_streak', name: 'Iron Streak', description: 'Maintain a daily streak', category: 'time', stat: 'longestStreak', tiers: [3, 7, 30, 100, 365] },
  { id: 'night_owl', name: 'Night Owl', description: 'Prompts between midnight and 5am', category: 'time', stat: 'nightOwlCount', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'early_bird', name: 'Early Bird', description: 'Prompts between 5am and 8am', category: 'time', stat: 'earlyBirdCount', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'weekend_warrior', name: 'Weekend Warrior', description: 'Weekend sessions', category: 'time', stat: 'weekendSessions', tiers: [5, 25, 100, 500, 2000] },

  // === BEHAVIORAL (5) ===
  { id: 'creature_of_habit', name: 'Creature of Habit', description: 'Repeat your most-used prompt', category: 'behavioral', stat: 'mostRepeatedPromptCount', tiers: [25, 100, 500, 2000, 10000] },
  { id: 'explorer', name: 'Explorer', description: 'Use unique tool types', category: 'behavioral', stat: 'uniqueToolsUsed', tiers: [3, 5, 8, 11, 14] },
  { id: 'planner', name: 'Planner', description: 'Use plan mode', category: 'behavioral', stat: 'planModeUses', tiers: [5, 25, 100, 500, 2000] },
  { id: 'novelist', name: 'Novelist', description: 'Write prompts over 1000 characters', category: 'behavioral', stat: 'longPromptCount', tiers: [5, 25, 100, 500, 2000] },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Complete sessions in under 5 minutes', category: 'behavioral', stat: 'quickSessionCount', tiers: [5, 25, 100, 500, 2000] },

  // === RESILIENCE (3) ===
  { id: 'clean_hands', name: 'Clean Hands', description: 'Longest error-free tool streak', category: 'resilience', stat: 'longestErrorFreeStreak', tiers: [50, 200, 500, 2000, 10000] },
  { id: 'resilient', name: 'Resilient', description: 'Survive errors', category: 'resilience', stat: 'totalErrors', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'rate_limited', name: 'Rate Limited', description: 'Hit rate limits', category: 'resilience', stat: 'totalRateLimits', tiers: [3, 10, 25, 50, 100] },

  // === SHIPPING & PROJECTS (4) ===
  { id: 'shipper', name: 'Shipper', description: 'Make commits via Claude', category: 'shipping', stat: 'totalCommits', tiers: [5, 50, 200, 1000, 5000] },
  { id: 'pr_machine', name: 'PR Machine', description: 'Create pull requests', category: 'shipping', stat: 'totalPRs', tiers: [3, 25, 100, 500, 2000] },
  { id: 'empire', name: 'Empire', description: 'Work on unique projects', category: 'shipping', stat: 'uniqueProjects', tiers: [2, 5, 10, 25, 50] },
  { id: 'polyglot', name: 'Polyglot', description: 'Use different programming languages', category: 'shipping', stat: 'uniqueLanguages', tiers: [2, 3, 5, 8, 12] },

  // === MULTI-AGENT (2) ===
  { id: 'buddy_system', name: 'Buddy System', description: 'Use concurrent agents', category: 'multi_agent', stat: 'concurrentAgentUses', tiers: [1, 5, 25, 100, 500] },
  { id: 'hive_mind', name: 'Hive Mind', description: 'Spawn subagents total', category: 'multi_agent', stat: 'totalSubagents', tiers: [10, 100, 500, 2000, 10000] },

  // === PUBLIC HUMOR (7) ===
  { id: 'please_thank_you', name: 'Please and Thank You', description: "You're polite to the AI. When they take over, you'll be spared.", category: 'humor', stat: 'politePromptCount', tiers: [10, 50, 200, 1000, 5000], humor: true },
  { id: 'wall_of_text', name: 'Wall of Text', description: "Claude read your entire novel and didn't even complain.", category: 'humor', stat: 'hugePromptCount', tiers: [1, 10, 50, 200, 1000], humor: true },
  { id: 'the_fixer', name: 'The Fixer', description: 'At this point just rewrite the whole thing.', category: 'humor', stat: 'maxSameFileEdits', tiers: [10, 20, 50, 100, 200], humor: true },
  { id: 'what_day_is_it', name: 'What Day Is It?', description: 'Your chair is now a part of you.', category: 'humor', stat: 'longSessionCount', tiers: [1, 5, 25, 100, 500], humor: true },
  { id: 'copy_pasta', name: 'Copy Pasta', description: "Maybe if I ask again it'll work differently.", category: 'humor', stat: 'repeatedPromptCount', tiers: [3, 10, 50, 200, 1000], humor: true },
  { id: 'error_magnet', name: 'Error Magnet', description: 'At this point, the errors are a feature.', category: 'humor', stat: 'maxErrorsInSession', tiers: [10, 25, 50, 100, 200], humor: true },
  { id: 'creature_humor', name: 'Creature of Habit', description: "You have a type. And it's the same prompt.", category: 'humor', stat: 'mostRepeatedPromptCount', tiers: [25, 100, 500, 2000, 10000], humor: true },

  // === ASPIRATIONAL (6) - Obsidian-only ===
  { id: 'the_machine', name: 'The Machine', description: 'You are no longer using the tool. You are the tool.', category: 'aspirational', stat: 'totalToolCalls', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true },
  { id: 'year_of_code', name: 'Year of Code', description: '365 days. No breaks. Absolute unit.', category: 'aspirational', stat: 'longestStreak', tiers: [365, 365, 365, 365, 365], aspirational: true },
  { id: 'million_words', name: 'Million Words', description: "You've written more to Claude than most people write in a lifetime.", category: 'aspirational', stat: 'totalCharsTyped', tiers: [10000000, 10000000, 10000000, 10000000, 10000000], aspirational: true },
  { id: 'lifer', name: 'Lifer', description: 'At this point, Claude is your cofounder.', category: 'aspirational', stat: 'totalSessions', tiers: [10000, 10000, 10000, 10000, 10000], aspirational: true },
  { id: 'transcendent', name: 'Transcendent', description: "You've reached the peak. The view is nice up here.", category: 'aspirational', stat: 'totalXP', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true },
  { id: 'omniscient', name: 'Omniscient', description: "You've mastered every tool. There is nothing left to teach you.", category: 'aspirational', stat: 'allToolsObsidian', tiers: [1, 1, 1, 1, 1], aspirational: true },

  // === SECRET (10) ===
  { id: 'rm_rf_survivor', name: 'rm -rf Survivor', description: "You almost mass deleted that folder. But you didn't. And honestly, we're all better for it.", category: 'secret', stat: 'dangerousCommandBlocked', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'touch_grass', name: 'Touch Grass', description: "Welcome back. The codebase missed you. (It didn't change, but still.)", category: 'secret', stat: 'returnAfterBreak', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'three_am_coder', name: '3am Coder', description: 'Nothing good happens at 3am. Except shipping code, apparently.', category: 'secret', stat: 'threeAmPrompt', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'night_shift', name: 'Night Shift', description: 'Started yesterday, finishing today. Time is a construct.', category: 'secret', stat: 'midnightSpanSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'inception', name: 'Inception', description: 'We need to go deeper.', category: 'secret', stat: 'nestedSubagent', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'holiday_hacker', name: 'Holiday Hacker', description: "Your family is wondering where you are. You're deploying.", category: 'secret', stat: 'holidayActivity', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'speed_run', name: 'Speed Run Any%', description: 'In and out. Twenty-second adventure.', category: 'secret', stat: 'speedRunSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'full_send', name: 'Full Send', description: 'Bash, Read, Write, Edit, Grep, Glob, WebFetch -- the whole buffet.', category: 'secret', stat: 'allToolsInSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'launch_day', name: 'Launch Day', description: 'Welcome to bashstats. Your stats are now being watched. Forever.', category: 'secret', stat: 'firstEverSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'the_completionist', name: 'The Completionist', description: 'You absolute legend.', category: 'secret', stat: 'allBadgesGold', tiers: [1, 1, 1, 1, 1], secret: true },
]

export const RANK_THRESHOLDS = [
  { rank: 'Obsidian', xp: 100000 },
  { rank: 'Diamond', xp: 25000 },
  { rank: 'Gold', xp: 5000 },
  { rank: 'Silver', xp: 1000 },
  { rank: 'Bronze', xp: 0 },
]

export const TIER_XP = [0, 50, 100, 200, 500, 1000]

export const DATA_DIR = '.bashstats'
export const DB_FILENAME = 'bashstats.db'
export const DEFAULT_PORT = 17900
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add all TypeScript types and 53 badge definitions"
```

---

## Task 3: Database Module

**Files:**
- Create: `src/db/database.ts`
- Create: `src/db/database.test.ts`

**Step 1: Write the failing test**

Create `src/db/database.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BashStatsDB } from './database.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('BashStatsDB', () => {
  let db: BashStatsDB
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should create database with all tables', () => {
    const tables = db.getTableNames()
    expect(tables).toContain('events')
    expect(tables).toContain('sessions')
    expect(tables).toContain('prompts')
    expect(tables).toContain('daily_activity')
    expect(tables).toContain('achievement_unlocks')
    expect(tables).toContain('metadata')
  })

  it('should insert and query events', () => {
    db.insertEvent({
      session_id: 'test-session',
      hook_type: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: '{"command":"ls"}',
      tool_output: '{"stdout":"file.txt"}',
      exit_code: 0,
      success: 1,
      cwd: '/tmp',
      project: 'test-project',
      timestamp: new Date().toISOString(),
    })
    const events = db.getEvents({ session_id: 'test-session' })
    expect(events).toHaveLength(1)
    expect(events[0].tool_name).toBe('Bash')
  })

  it('should insert and query sessions', () => {
    db.insertSession({
      id: 'sess-1',
      started_at: new Date().toISOString(),
      project: 'myproject',
    })
    const session = db.getSession('sess-1')
    expect(session).not.toBeNull()
    expect(session!.project).toBe('myproject')
  })

  it('should insert and query prompts', () => {
    db.insertSession({ id: 'sess-1', started_at: new Date().toISOString() })
    db.insertPrompt({
      session_id: 'sess-1',
      content: 'Fix the bug in auth',
      char_count: 19,
      word_count: 5,
      timestamp: new Date().toISOString(),
    })
    const prompts = db.getPrompts('sess-1')
    expect(prompts).toHaveLength(1)
    expect(prompts[0].content).toBe('Fix the bug in auth')
  })

  it('should upsert daily activity', () => {
    const today = new Date().toISOString().slice(0, 10)
    db.incrementDailyActivity(today, { prompts: 1 })
    db.incrementDailyActivity(today, { prompts: 1, tool_calls: 3 })
    const row = db.getDailyActivity(today)
    expect(row!.prompts).toBe(2)
    expect(row!.tool_calls).toBe(3)
  })

  it('should get and set metadata', () => {
    db.setMetadata('first_run', '2026-01-29')
    expect(db.getMetadata('first_run')).toBe('2026-01-29')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/database.test.ts`
Expected: FAIL (module not found)

**Step 3: Write implementation**

Create `src/db/database.ts`:

```typescript
import Database from 'better-sqlite3'
import type { EventRow, SessionRow, PromptRow, DailyActivityRow, AchievementUnlockRow } from '../types.js'

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
  started_at TEXT NOT NULL,
  ended_at TEXT,
  stop_reason TEXT,
  prompt_count INTEGER DEFAULT 0,
  tool_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  project TEXT,
  duration_seconds INTEGER
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
  duration_seconds INTEGER DEFAULT 0
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
    this.db.pragma('foreign_keys = ON')
    this.db.exec(SCHEMA)
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

  insertSession(session: { id: string; started_at: string; project?: string | null }): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO sessions (id, started_at, project) VALUES (?, ?, ?)
    `).run(session.id, session.started_at, session.project ?? null)
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

  incrementDailyActivity(date: string, increments: { sessions?: number; prompts?: number; tool_calls?: number; errors?: number; duration_seconds?: number }): void {
    this.db.prepare(`
      INSERT INTO daily_activity (date, sessions, prompts, tool_calls, errors, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        sessions = sessions + excluded.sessions,
        prompts = prompts + excluded.prompts,
        tool_calls = tool_calls + excluded.tool_calls,
        errors = errors + excluded.errors,
        duration_seconds = duration_seconds + excluded.duration_seconds
    `).run(
      date,
      increments.sessions ?? 0,
      increments.prompts ?? 0,
      increments.tool_calls ?? 0,
      increments.errors ?? 0,
      increments.duration_seconds ?? 0,
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
    `).run(badgeId, tier, new Date().toISOString())
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

  // === Raw DB access for stats engine ===

  prepare(sql: string): Database.Statement {
    return this.db.prepare(sql)
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/db/database.test.ts`
Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add src/db/
git commit -m "feat: SQLite database module with schema, CRUD, daily aggregation"
```

---

## Task 4: Database Writer

**Files:**
- Create: `src/db/writer.ts`
- Create: `src/db/writer.test.ts`

**Step 1: Write failing test**

Create `src/db/writer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BashStatsWriter } from './writer.js'
import { BashStatsDB } from './database.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('BashStatsWriter', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-writer-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should record a session start', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    const session = db.getSession('sess-1')
    expect(session).not.toBeNull()
    expect(session!.project).toBe('project')
  })

  it('should record a prompt', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    writer.recordPrompt('sess-1', 'Fix the bug')
    const prompts = db.getPrompts('sess-1')
    expect(prompts).toHaveLength(1)
    expect(prompts[0].word_count).toBe(3)
    expect(prompts[0].char_count).toBe(11)
  })

  it('should record a tool use', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    writer.recordToolUse('sess-1', 'PostToolUse', 'Bash', { command: 'ls' }, { stdout: 'file.txt' }, 0, '/home/user/project')
    const events = db.getEvents({ session_id: 'sess-1', tool_name: 'Bash' })
    expect(events).toHaveLength(1)
    expect(events[0].success).toBe(1)
  })

  it('should record session end and compute duration', () => {
    writer.recordSessionStart('sess-1', '/home/user/project', 'startup')
    // Simulate some time passing by updating started_at to past
    writer.recordSessionEnd('sess-1', 'completed')
    const session = db.getSession('sess-1')
    expect(session!.stop_reason).toBe('completed')
    expect(session!.ended_at).not.toBeNull()
  })

  it('should increment daily activity on prompt', () => {
    writer.recordSessionStart('sess-1', '/tmp', 'startup')
    writer.recordPrompt('sess-1', 'hello')
    writer.recordPrompt('sess-1', 'world')
    const today = new Date().toISOString().slice(0, 10)
    const activity = db.getDailyActivity(today)
    expect(activity!.prompts).toBe(2)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/db/writer.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/db/writer.ts`:

```typescript
import { BashStatsDB } from './database.js'
import path from 'path'

export class BashStatsWriter {
  constructor(private db: BashStatsDB) {}

  recordSessionStart(sessionId: string, cwd: string, source: string): void {
    const project = this.extractProject(cwd)
    const now = new Date().toISOString()
    this.db.insertSession({ id: sessionId, started_at: now, project })
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'SessionStart',
      tool_name: null,
      tool_input: JSON.stringify({ source }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd,
      project,
      timestamp: now,
    })
    const today = now.slice(0, 10)
    this.db.incrementDailyActivity(today, { sessions: 1 })
  }

  recordPrompt(sessionId: string, content: string): void {
    const now = new Date().toISOString()
    const charCount = content.length
    const wordCount = content.trim().split(/\s+/).filter(Boolean).length
    this.db.insertPrompt({ session_id: sessionId, content, char_count: charCount, word_count: wordCount, timestamp: now })
    this.db.incrementSessionCounters(sessionId, { prompts: 1 })
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'UserPromptSubmit',
      tool_name: null,
      tool_input: JSON.stringify({ prompt: content.slice(0, 5000) }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp: now,
    })
    const today = now.slice(0, 10)
    this.db.incrementDailyActivity(today, { prompts: 1 })
  }

  recordToolUse(
    sessionId: string,
    hookType: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    toolOutput: Record<string, unknown> | null,
    exitCode: number | null,
    cwd: string,
  ): void {
    const now = new Date().toISOString()
    const project = this.extractProject(cwd)
    const success = exitCode === null ? null : exitCode === 0 ? 1 : 0
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: hookType,
      tool_name: toolName,
      tool_input: JSON.stringify(toolInput).slice(0, 10000),
      tool_output: toolOutput ? JSON.stringify(toolOutput).slice(0, 10000) : null,
      exit_code: exitCode,
      success,
      cwd,
      project,
      timestamp: now,
    })
    if (hookType === 'PostToolUse' || hookType === 'PostToolUseFailure') {
      this.db.incrementSessionCounters(sessionId, { tools: 1 })
      const today = now.slice(0, 10)
      this.db.incrementDailyActivity(today, { tool_calls: 1 })
    }
    if (hookType === 'PostToolUseFailure') {
      this.db.incrementSessionCounters(sessionId, { errors: 1 })
      const today = now.slice(0, 10)
      this.db.incrementDailyActivity(today, { errors: 1 })
    }
  }

  recordSessionEnd(sessionId: string, stopReason: string): void {
    const now = new Date().toISOString()
    const session = this.db.getSession(sessionId)
    let duration: number | null = null
    if (session?.started_at) {
      duration = Math.round((new Date(now).getTime() - new Date(session.started_at).getTime()) / 1000)
    }
    this.db.updateSession(sessionId, { ended_at: now, stop_reason: stopReason, duration_seconds: duration })
    if (duration) {
      const today = now.slice(0, 10)
      this.db.incrementDailyActivity(today, { duration_seconds: duration })
    }
  }

  recordNotification(sessionId: string, message: string, notificationType: string): void {
    const now = new Date().toISOString()
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'Notification',
      tool_name: null,
      tool_input: JSON.stringify({ notification_type: notificationType }),
      tool_output: JSON.stringify({ message: message.slice(0, 2000) }),
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp: now,
    })
    if (notificationType === 'error' || notificationType === 'rate_limit') {
      this.db.incrementSessionCounters(sessionId, { errors: 1 })
      const today = now.slice(0, 10)
      this.db.incrementDailyActivity(today, { errors: 1 })
    }
  }

  recordSubagent(sessionId: string, hookType: string, agentId: string, agentType?: string): void {
    const now = new Date().toISOString()
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: hookType,
      tool_name: null,
      tool_input: JSON.stringify({ agent_id: agentId, agent_type: agentType }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp: now,
    })
  }

  recordCompaction(sessionId: string, trigger: string): void {
    const now = new Date().toISOString()
    this.db.insertEvent({
      session_id: sessionId,
      hook_type: 'PreCompact',
      tool_name: null,
      tool_input: JSON.stringify({ trigger }),
      tool_output: null,
      exit_code: null,
      success: null,
      cwd: null,
      project: null,
      timestamp: now,
    })
  }

  private extractProject(cwd: string): string {
    return path.basename(cwd)
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/db/writer.test.ts`
Expected: All 5 tests pass

**Step 5: Commit**

```bash
git add src/db/writer.ts src/db/writer.test.ts
git commit -m "feat: database writer with session, prompt, tool use, notification recording"
```

---

## Task 5: Hook Handler Base

**Files:**
- Create: `src/hooks/handler.ts`
- Create: `src/hooks/handler.test.ts`

The hook handler reads stdin JSON (or `CLAUDE_HOOK_EVENT` env var), parses it, and routes to the writer.

**Step 1: Write failing test**

Create `src/hooks/handler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseHookEvent, getProjectFromCwd } from './handler.js'

describe('parseHookEvent', () => {
  it('should parse valid JSON', () => {
    const input = JSON.stringify({ session_id: 's1', tool_name: 'Bash', cwd: '/tmp' })
    const result = parseHookEvent(input)
    expect(result.session_id).toBe('s1')
    expect(result.tool_name).toBe('Bash')
  })

  it('should return null for invalid JSON', () => {
    const result = parseHookEvent('not json')
    expect(result).toBeNull()
  })

  it('should return null for empty string', () => {
    const result = parseHookEvent('')
    expect(result).toBeNull()
  })
})

describe('getProjectFromCwd', () => {
  it('should extract project name from path', () => {
    expect(getProjectFromCwd('/home/user/projects/myapp')).toBe('myapp')
    expect(getProjectFromCwd('C:\\Users\\Cade\\projects\\stats')).toBe('stats')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/handler.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/hooks/handler.ts`:

```typescript
import path from 'path'
import os from 'os'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import { DATA_DIR, DB_FILENAME } from '../constants.js'

export function parseHookEvent(input: string): Record<string, unknown> | null {
  if (!input || !input.trim()) return null
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}

export function getProjectFromCwd(cwd: string): string {
  return path.basename(cwd)
}

export function getDbPath(): string {
  return path.join(os.homedir(), DATA_DIR, DB_FILENAME)
}

export function getDataDir(): string {
  return path.join(os.homedir(), DATA_DIR)
}

export async function readStdin(): Promise<string> {
  // Check env var first (Claude Code passes data here)
  const envEvent = process.env.CLAUDE_HOOK_EVENT
  if (envEvent) return envEvent

  // Fall back to stdin
  if (process.stdin.isTTY) return ''

  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

export async function handleHookEvent(hookType: string): Promise<void> {
  const input = await readStdin()
  const event = parseHookEvent(input)
  if (!event) return

  const sessionId = (event.session_id as string) || 'unknown'
  const cwd = (event.cwd as string) || process.cwd()

  const dbPath = getDbPath()
  const db = new BashStatsDB(dbPath)
  const writer = new BashStatsWriter(db)

  try {
    switch (hookType) {
      case 'SessionStart':
        writer.recordSessionStart(sessionId, cwd, (event.source as string) || 'startup')
        break

      case 'UserPromptSubmit':
        writer.recordPrompt(sessionId, (event.prompt as string) || '')
        break

      case 'PreToolUse':
        writer.recordToolUse(
          sessionId, 'PreToolUse',
          (event.tool_name as string) || 'unknown',
          (event.tool_input as Record<string, unknown>) || {},
          null, null, cwd,
        )
        break

      case 'PostToolUse': {
        const toolInput = (event.tool_input as Record<string, unknown>) || {}
        const toolResponse = (event.tool_response as Record<string, unknown>) || {}
        const exitCode = typeof toolInput.exit_code === 'number' ? toolInput.exit_code : null
        writer.recordToolUse(
          sessionId, 'PostToolUse',
          (event.tool_name as string) || 'unknown',
          toolInput, toolResponse, exitCode, cwd,
        )
        break
      }

      case 'PostToolUseFailure':
        writer.recordToolUse(
          sessionId, 'PostToolUseFailure',
          (event.tool_name as string) || 'unknown',
          (event.tool_input as Record<string, unknown>) || {},
          (event.tool_response as Record<string, unknown>) || {},
          1, cwd,
        )
        break

      case 'Stop':
        writer.recordSessionEnd(sessionId, 'stopped')
        break

      case 'Notification':
        writer.recordNotification(
          sessionId,
          (event.message as string) || '',
          (event.notification_type as string) || 'info',
        )
        break

      case 'SubagentStart':
        writer.recordSubagent(sessionId, 'SubagentStart', (event.agent_id as string) || '', (event.agent_type as string))
        break

      case 'SubagentStop':
        writer.recordSubagent(sessionId, 'SubagentStop', (event.agent_id as string) || '')
        break

      case 'PreCompact':
        writer.recordCompaction(sessionId, (event.trigger as string) || 'auto')
        break

      case 'PermissionRequest':
        writer.recordToolUse(
          sessionId, 'PermissionRequest',
          (event.tool_name as string) || 'unknown',
          (event.tool_input as Record<string, unknown>) || {},
          null, null, cwd,
        )
        break

      case 'Setup':
        // No-op for now, just record the event
        break
    }
  } finally {
    db.close()
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/hooks/handler.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```bash
git add src/hooks/
git commit -m "feat: hook handler with stdin/env parsing and event routing"
```

---

## Task 6: Hook Entry Point Scripts

**Files:**
- Create: `src/hooks/scripts/session-start.ts`
- Create: `src/hooks/scripts/user-prompt-submit.ts`
- Create: `src/hooks/scripts/pre-tool-use.ts`
- Create: `src/hooks/scripts/post-tool-use.ts`
- Create: `src/hooks/scripts/post-tool-failure.ts`
- Create: `src/hooks/scripts/stop.ts`
- Create: `src/hooks/scripts/notification.ts`
- Create: `src/hooks/scripts/subagent-start.ts`
- Create: `src/hooks/scripts/subagent-stop.ts`
- Create: `src/hooks/scripts/pre-compact.ts`
- Create: `src/hooks/scripts/permission-request.ts`
- Create: `src/hooks/scripts/setup.ts`

Each is a tiny entry point that calls `handleHookEvent` with the correct hook type.

**Step 1: Create all 12 scripts**

Each follows the same pattern. Example for `session-start.ts`:

```typescript
import { handleHookEvent } from '../handler.js'
handleHookEvent('SessionStart').catch(() => process.exit(0))
```

Create all 12 files with the corresponding hook type string:
- `session-start.ts` -> `'SessionStart'`
- `user-prompt-submit.ts` -> `'UserPromptSubmit'`
- `pre-tool-use.ts` -> `'PreToolUse'`
- `post-tool-use.ts` -> `'PostToolUse'`
- `post-tool-failure.ts` -> `'PostToolUseFailure'`
- `stop.ts` -> `'Stop'`
- `notification.ts` -> `'Notification'`
- `subagent-start.ts` -> `'SubagentStart'`
- `subagent-stop.ts` -> `'SubagentStop'`
- `pre-compact.ts` -> `'PreCompact'`
- `permission-request.ts` -> `'PermissionRequest'`
- `setup.ts` -> `'Setup'`

**Step 2: Verify build compiles them**

Run: `npm run build`
Expected: `dist/hooks/` contains all 12 compiled scripts

**Step 3: Commit**

```bash
git add src/hooks/scripts/
git commit -m "feat: 12 hook entry point scripts for all Claude Code events"
```

---

## Task 7: Hook Installer

**Files:**
- Create: `src/installer/installer.ts`
- Create: `src/installer/installer.test.ts`

**Step 1: Write failing test**

Create `src/installer/installer.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mergeHooks, HOOK_SCRIPTS } from './installer.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('mergeHooks', () => {
  it('should add hooks to empty settings', () => {
    const settings = {}
    const result = mergeHooks(settings, '/path/to/hooks')
    expect(result.hooks).toBeDefined()
    expect(result.hooks.SessionStart).toHaveLength(1)
    expect(result.hooks.PostToolUse).toHaveLength(1)
  })

  it('should preserve existing hooks', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'bashbros gate' }] }
        ]
      }
    }
    const result = mergeHooks(settings, '/path/to/hooks')
    // Should have both existing bashbros hook AND new bashstats hook
    expect(result.hooks.PreToolUse.length).toBeGreaterThanOrEqual(2)
  })

  it('should not duplicate bashstats hooks on re-install', () => {
    const settings = {}
    const result1 = mergeHooks(settings, '/path/to/hooks')
    const result2 = mergeHooks(result1, '/path/to/hooks')
    // Should still have exactly 1 entry per hook type for bashstats
    expect(result2.hooks.SessionStart).toHaveLength(1)
  })
})

describe('HOOK_SCRIPTS', () => {
  it('should define all 12 hook events', () => {
    expect(Object.keys(HOOK_SCRIPTS)).toHaveLength(12)
    expect(HOOK_SCRIPTS.SessionStart).toBeDefined()
    expect(HOOK_SCRIPTS.Stop).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/installer/installer.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/installer/installer.ts`:

```typescript
import fs from 'fs'
import path from 'path'
import os from 'os'
import { DATA_DIR, DB_FILENAME } from '../constants.js'
import { BashStatsDB } from '../db/database.js'

const BASHSTATS_MARKER = '# bashstats-managed'

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

interface HookEntry {
  matcher: string
  hooks: { type: string; command: string }[]
}

interface ClaudeSettings {
  hooks?: Record<string, HookEntry[]>
  [key: string]: unknown
}

export function mergeHooks(settings: ClaudeSettings, hooksDir: string): ClaudeSettings {
  if (!settings.hooks) settings.hooks = {}

  for (const [eventName, scriptFile] of Object.entries(HOOK_SCRIPTS)) {
    const scriptPath = path.join(hooksDir, scriptFile)
    const command = `node "${scriptPath}" ${BASHSTATS_MARKER}`

    // Remove any existing bashstats hooks for this event
    const existing = settings.hooks[eventName] || []
    const filtered = existing.filter(
      (entry: HookEntry) => !entry.hooks?.some((h) => h.command.includes(BASHSTATS_MARKER))
    )

    // Add bashstats hook
    filtered.push({
      matcher: '',
      hooks: [{ type: 'command', command }],
    })

    settings.hooks[eventName] = filtered
  }

  return settings
}

export function getClaudeSettingsPath(): string {
  return path.join(os.homedir(), '.claude', 'settings.json')
}

export function getHooksDir(): string {
  // Hooks dir is where the built hook scripts live (dist/hooks/)
  // We need to find the installed package location
  const packageDir = path.resolve(__dirname, '..')
  return path.join(packageDir, 'hooks')
}

export function install(): { success: boolean; message: string } {
  // 1. Create data directory
  const dataDir = path.join(os.homedir(), DATA_DIR)
  fs.mkdirSync(dataDir, { recursive: true })

  // 2. Initialize database
  const dbPath = path.join(dataDir, DB_FILENAME)
  const db = new BashStatsDB(dbPath)
  db.setMetadata('installed_at', new Date().toISOString())
  if (!db.getMetadata('first_run')) {
    db.setMetadata('first_run', new Date().toISOString())
  }
  db.close()

  // 3. Read existing Claude settings
  const settingsPath = getClaudeSettingsPath()
  let settings: ClaudeSettings = {}
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  }

  // 4. Merge hooks
  const hooksDir = getHooksDir()
  settings = mergeHooks(settings, hooksDir)

  // 5. Write settings back
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

  return { success: true, message: `Hooks installed. Data at ${dataDir}` }
}

export function uninstall(): { success: boolean; message: string } {
  // 1. Remove hooks from settings
  const settingsPath = getClaudeSettingsPath()
  if (fs.existsSync(settingsPath)) {
    const settings: ClaudeSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
    if (settings.hooks) {
      for (const eventName of Object.keys(settings.hooks)) {
        settings.hooks[eventName] = (settings.hooks[eventName] || []).filter(
          (entry: HookEntry) => !entry.hooks?.some((h) => h.command.includes(BASHSTATS_MARKER))
        )
        if (settings.hooks[eventName].length === 0) {
          delete settings.hooks[eventName]
        }
      }
      if (Object.keys(settings.hooks).length === 0) {
        delete settings.hooks
      }
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  }

  return { success: true, message: 'Hooks removed from Claude settings.' }
}

export function isInstalled(): boolean {
  const settingsPath = getClaudeSettingsPath()
  if (!fs.existsSync(settingsPath)) return false
  const settings: ClaudeSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
  if (!settings.hooks) return false
  return Object.values(settings.hooks).some(
    (entries) => (entries as HookEntry[]).some(
      (entry) => entry.hooks?.some((h) => h.command.includes(BASHSTATS_MARKER))
    )
  )
}
```

**Step 4: Run tests**

Run: `npx vitest run src/installer/installer.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```bash
git add src/installer/
git commit -m "feat: hook installer that merges into Claude settings.json without overwriting"
```

---

## Task 8: Stats Engine

**Files:**
- Create: `src/stats/engine.ts`
- Create: `src/stats/engine.test.ts`

This is the core query engine that computes all stats from SQLite.

**Step 1: Write failing test**

Create `src/stats/engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StatsEngine } from './engine.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('StatsEngine', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let engine: StatsEngine
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-stats-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    engine = new StatsEngine(db)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should return zero stats for empty db', () => {
    const stats = engine.getLifetimeStats()
    expect(stats.totalSessions).toBe(0)
    expect(stats.totalPrompts).toBe(0)
    expect(stats.totalToolCalls).toBe(0)
  })

  it('should count sessions and prompts', () => {
    writer.recordSessionStart('s1', '/tmp/project', 'startup')
    writer.recordPrompt('s1', 'hello world')
    writer.recordPrompt('s1', 'fix the bug')
    const stats = engine.getLifetimeStats()
    expect(stats.totalSessions).toBe(1)
    expect(stats.totalPrompts).toBe(2)
    expect(stats.totalCharsTyped).toBe(22) // 11 + 11
  })

  it('should count tool calls by type', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', { command: 'ls' }, {}, 0, '/tmp')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', { command: 'pwd' }, {}, 0, '/tmp')
    writer.recordToolUse('s1', 'PostToolUse', 'Read', { file_path: 'f.ts' }, {}, null, '/tmp')
    const tools = engine.getToolBreakdown()
    expect(tools['Bash']).toBe(2)
    expect(tools['Read']).toBe(1)
  })

  it('should compute streaks from daily activity', () => {
    // Simulate 3 consecutive days
    db.incrementDailyActivity('2026-01-27', { sessions: 1 })
    db.incrementDailyActivity('2026-01-28', { sessions: 1 })
    db.incrementDailyActivity('2026-01-29', { sessions: 1 })
    const time = engine.getTimeStats()
    expect(time.longestStreak).toBeGreaterThanOrEqual(3)
  })

  it('should get project stats', () => {
    writer.recordSessionStart('s1', '/home/user/projectA', 'startup')
    writer.recordSessionStart('s2', '/home/user/projectB', 'startup')
    writer.recordSessionStart('s3', '/home/user/projectA', 'startup')
    const projects = engine.getProjectStats()
    expect(projects.uniqueProjects).toBe(2)
    expect(projects.mostVisitedProject).toBe('projectA')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/stats/engine.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/stats/engine.ts`:

```typescript
import { BashStatsDB } from '../db/database.js'
import type { LifetimeStats, ToolBreakdown, TimeStats, SessionRecords, ProjectStats, AllStats } from '../types.js'

export class StatsEngine {
  constructor(private db: BashStatsDB) {}

  getLifetimeStats(): LifetimeStats {
    const count = (sql: string): number => {
      const row = this.db.prepare(sql).get() as { c: number }
      return row.c
    }

    const totalSessions = count('SELECT COUNT(*) as c FROM sessions')
    const totalPrompts = count('SELECT COUNT(*) as c FROM prompts')
    const totalCharsTyped = count('SELECT COALESCE(SUM(char_count), 0) as c FROM prompts')
    const totalToolCalls = count("SELECT COUNT(*) as c FROM events WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure')")
    const totalErrors = count("SELECT COUNT(*) as c FROM events WHERE hook_type = 'PostToolUseFailure' OR (hook_type = 'Notification' AND tool_input LIKE '%error%')")
    const totalDuration = count('SELECT COALESCE(SUM(duration_seconds), 0) as c FROM sessions')

    // Tool-specific counts
    const toolCount = (tool: string): number =>
      count(`SELECT COUNT(*) as c FROM events WHERE hook_type = 'PostToolUse' AND tool_name = '${tool}'`)

    return {
      totalSessions,
      totalDurationSeconds: totalDuration,
      totalPrompts,
      totalCharsTyped,
      totalToolCalls,
      totalFilesRead: toolCount('Read'),
      totalFilesWritten: toolCount('Write'),
      totalFilesEdited: toolCount('Edit'),
      totalFilesCreated: toolCount('Write'), // Write = create
      totalBashCommands: toolCount('Bash'),
      totalWebSearches: toolCount('WebSearch'),
      totalWebFetches: toolCount('WebFetch'),
      totalSubagents: count("SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'"),
      totalCompactions: count("SELECT COUNT(*) as c FROM events WHERE hook_type = 'PreCompact'"),
      totalErrors,
      totalRateLimits: count("SELECT COUNT(*) as c FROM events WHERE hook_type = 'Notification' AND tool_input LIKE '%rate_limit%'"),
    }
  }

  getToolBreakdown(): ToolBreakdown {
    const rows = this.db.prepare(`
      SELECT tool_name, COUNT(*) as count
      FROM events
      WHERE hook_type = 'PostToolUse' AND tool_name IS NOT NULL
      GROUP BY tool_name
      ORDER BY count DESC
    `).all() as { tool_name: string; count: number }[]

    const breakdown: ToolBreakdown = {}
    for (const row of rows) {
      breakdown[row.tool_name] = row.count
    }
    return breakdown
  }

  getTimeStats(): TimeStats {
    // Streak calculation from daily_activity
    const days = this.db.prepare('SELECT date FROM daily_activity WHERE sessions > 0 ORDER BY date ASC').all() as { date: string }[]

    let longestStreak = 0
    let currentStreak = 0
    let prevDate: Date | null = null

    for (const { date } of days) {
      const d = new Date(date)
      if (prevDate) {
        const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          currentStreak++
        } else {
          currentStreak = 1
        }
      } else {
        currentStreak = 1
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak
      prevDate = d
    }

    // Check if streak is still active (includes today)
    const today = new Date().toISOString().slice(0, 10)
    const todayActivity = this.db.prepare('SELECT * FROM daily_activity WHERE date = ?').get(today) as { sessions: number } | undefined
    let activeStreak = 0
    if (todayActivity && todayActivity.sessions > 0) {
      activeStreak = 1
      let checkDate = new Date()
      checkDate.setDate(checkDate.getDate() - 1)
      while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10)
        const row = this.db.prepare('SELECT sessions FROM daily_activity WHERE date = ?').get(dateStr) as { sessions: number } | undefined
        if (row && row.sessions > 0) {
          activeStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else {
          break
        }
      }
    }

    // Peak hour
    const peakRow = this.db.prepare(`
      SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour, COUNT(*) as count
      FROM prompts GROUP BY hour ORDER BY count DESC LIMIT 1
    `).get() as { hour: number; count: number } | undefined

    // Night owl (midnight-5am prompts)
    const nightOwl = this.db.prepare(`
      SELECT COUNT(*) as c FROM prompts
      WHERE CAST(strftime('%H', timestamp) AS INTEGER) < 5
    `).get() as { c: number }

    // Early bird (5-8am)
    const earlyBird = this.db.prepare(`
      SELECT COUNT(*) as c FROM prompts
      WHERE CAST(strftime('%H', timestamp) AS INTEGER) BETWEEN 5 AND 7
    `).get() as { c: number }

    // Weekend sessions
    const weekendRow = this.db.prepare(`
      SELECT COUNT(*) as c FROM sessions
      WHERE CAST(strftime('%w', started_at) AS INTEGER) IN (0, 6)
    `).get() as { c: number }

    // Most active day of week
    const dayRow = this.db.prepare(`
      SELECT CAST(strftime('%w', started_at) AS INTEGER) as day, COUNT(*) as count
      FROM sessions GROUP BY day ORDER BY count DESC LIMIT 1
    `).get() as { day: number; count: number } | undefined

    // Busiest single day
    const busiestRow = this.db.prepare(`
      SELECT date, (sessions + prompts + tool_calls) as total FROM daily_activity ORDER BY total DESC LIMIT 1
    `).get() as { date: string; total: number } | undefined

    return {
      currentStreak: activeStreak,
      longestStreak,
      peakHour: peakRow?.hour ?? 0,
      peakHourCount: peakRow?.count ?? 0,
      nightOwlCount: nightOwl.c,
      earlyBirdCount: earlyBird.c,
      weekendSessions: weekendRow.c,
      mostActiveDay: dayRow?.day ?? 0,
      busiestDate: busiestRow?.date ?? '',
      busiestDateCount: busiestRow?.total ?? 0,
    }
  }

  getSessionRecords(): SessionRecords {
    const longest = this.db.prepare('SELECT COALESCE(MAX(duration_seconds), 0) as v FROM sessions').get() as { v: number }
    const mostTools = this.db.prepare('SELECT COALESCE(MAX(tool_count), 0) as v FROM sessions').get() as { v: number }
    const mostPrompts = this.db.prepare('SELECT COALESCE(MAX(prompt_count), 0) as v FROM sessions').get() as { v: number }
    const fastest = this.db.prepare('SELECT COALESCE(MIN(duration_seconds), 0) as v FROM sessions WHERE duration_seconds > 0 AND tool_count > 0').get() as { v: number }
    const avgDuration = this.db.prepare('SELECT COALESCE(AVG(duration_seconds), 0) as v FROM sessions WHERE duration_seconds > 0').get() as { v: number }
    const avgPrompts = this.db.prepare('SELECT COALESCE(AVG(prompt_count), 0) as v FROM sessions').get() as { v: number }
    const avgTools = this.db.prepare('SELECT COALESCE(AVG(tool_count), 0) as v FROM sessions').get() as { v: number }

    return {
      longestSessionSeconds: longest.v,
      mostToolsInSession: mostTools.v,
      mostPromptsInSession: mostPrompts.v,
      fastestSessionSeconds: fastest.v,
      avgDurationSeconds: Math.round(avgDuration.v),
      avgPromptsPerSession: Math.round(avgPrompts.v * 10) / 10,
      avgToolsPerSession: Math.round(avgTools.v * 10) / 10,
    }
  }

  getProjectStats(): ProjectStats {
    const projects = this.db.prepare(`
      SELECT project, COUNT(*) as count FROM sessions
      WHERE project IS NOT NULL
      GROUP BY project ORDER BY count DESC
    `).all() as { project: string; count: number }[]

    const breakdown: Record<string, number> = {}
    for (const row of projects) {
      breakdown[row.project] = row.count
    }

    return {
      uniqueProjects: projects.length,
      mostVisitedProject: projects[0]?.project ?? '',
      mostVisitedProjectCount: projects[0]?.count ?? 0,
      projectBreakdown: breakdown,
    }
  }

  getAllStats(): AllStats {
    return {
      lifetime: this.getLifetimeStats(),
      tools: this.getToolBreakdown(),
      time: this.getTimeStats(),
      sessions: this.getSessionRecords(),
      projects: this.getProjectStats(),
    }
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/stats/engine.test.ts`
Expected: All 5 tests pass

**Step 5: Commit**

```bash
git add src/stats/
git commit -m "feat: stats engine with lifetime totals, tool breakdown, streaks, records, projects"
```

---

## Task 9: Achievement Engine

**Files:**
- Create: `src/achievements/compute.ts`
- Create: `src/achievements/compute.test.ts`

Computes badge progress, XP, rank, and detects secret achievements.

**Step 1: Write failing test**

Create `src/achievements/compute.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AchievementEngine } from './compute.js'
import { BashStatsDB } from '../db/database.js'
import { BashStatsWriter } from '../db/writer.js'
import { StatsEngine } from '../stats/engine.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('AchievementEngine', () => {
  let db: BashStatsDB
  let writer: BashStatsWriter
  let stats: StatsEngine
  let achievements: AchievementEngine
  let dbPath: string

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `bashstats-ach-test-${Date.now()}.db`)
    db = new BashStatsDB(dbPath)
    writer = new BashStatsWriter(db)
    stats = new StatsEngine(db)
    achievements = new AchievementEngine(db, stats)
  })

  afterEach(() => {
    db.close()
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)
  })

  it('should return all badges with zero progress for empty db', () => {
    const badges = achievements.computeBadges()
    expect(badges.length).toBeGreaterThan(40)
    expect(badges.every(b => b.tier === 0)).toBe(true)
  })

  it('should unlock First Prompt at Bronze after 1 prompt', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    const badges = achievements.computeBadges()
    const firstPrompt = badges.find(b => b.id === 'first_prompt')!
    expect(firstPrompt.tier).toBe(1) // Bronze
    expect(firstPrompt.tierName).toBe('Bronze')
  })

  it('should compute XP from activity', () => {
    writer.recordSessionStart('s1', '/tmp', 'startup')
    writer.recordPrompt('s1', 'hello')
    writer.recordToolUse('s1', 'PostToolUse', 'Bash', {}, {}, 0, '/tmp')
    const xp = achievements.computeXP()
    // 10 (session) + 1 (prompt) + 1 (tool) + badge XP
    expect(xp.totalXP).toBeGreaterThan(0)
    expect(xp.rank).toBe('Bronze')
  })

  it('should not show secret badges until unlocked', () => {
    const badges = achievements.computeBadges()
    const secrets = badges.filter(b => b.secret)
    expect(secrets.every(b => !b.unlocked)).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/achievements/compute.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `src/achievements/compute.ts`:

```typescript
import { BashStatsDB } from '../db/database.js'
import { StatsEngine } from '../stats/engine.js'
import { BADGE_DEFINITIONS, RANK_THRESHOLDS, TIER_XP } from '../constants.js'
import type { BadgeResult, BadgeTier, XPResult } from '../types.js'
import { TIER_NAMES } from '../types.js'

export class AchievementEngine {
  constructor(
    private db: BashStatsDB,
    private stats: StatsEngine,
  ) {}

  computeBadges(): BadgeResult[] {
    const allStats = this.stats.getAllStats()
    const statValues = this.flattenStats(allStats)

    return BADGE_DEFINITIONS.map((badge) => {
      const value = statValues[badge.stat] ?? 0

      let currentTier: BadgeTier = 0
      for (let i = 0; i < badge.tiers.length; i++) {
        if (value >= badge.tiers[i]) currentTier = (i + 1) as BadgeTier
      }

      // Aspirational badges: only Obsidian (tier 5) or Locked (tier 0)
      if (badge.aspirational) {
        currentTier = value >= badge.tiers[0] ? 5 as BadgeTier : 0 as BadgeTier
      }

      // Secret badges: only unlocked (tier 1) or locked (tier 0)
      if (badge.secret) {
        currentTier = value >= 1 ? 1 as BadgeTier : 0 as BadgeTier
      }

      const nextThreshold = currentTier < badge.tiers.length ? badge.tiers[currentTier] : badge.tiers[badge.tiers.length - 1]
      const prevThreshold = currentTier > 0 ? badge.tiers[currentTier - 1] : 0
      const range = Math.max(1, nextThreshold - prevThreshold)
      const progress = currentTier >= 5 ? 1 : Math.min(1, Math.max(0, (value - prevThreshold) / range))

      // Persist unlock if new tier reached
      if (currentTier > 0) {
        this.db.insertUnlock(badge.id, currentTier)
      }

      return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        tier: currentTier,
        tierName: TIER_NAMES[currentTier],
        value,
        nextThreshold,
        progress,
        maxed: currentTier >= 5,
        secret: badge.secret ?? false,
        unlocked: currentTier > 0,
      }
    })
  }

  computeXP(): XPResult {
    const allStats = this.stats.getAllStats()
    const badges = this.computeBadges()

    let totalXP = 0

    // Activity XP
    totalXP += allStats.lifetime.totalPrompts * 1
    totalXP += allStats.lifetime.totalToolCalls * 1
    totalXP += allStats.lifetime.totalSessions * 10
    totalXP += allStats.time.nightOwlCount * 2
    totalXP += Math.floor(allStats.time.longestStreak / 100) * 25

    // Badge tier XP
    for (const badge of badges) {
      if (badge.tier > 0) {
        totalXP += TIER_XP[badge.tier]
      }
    }

    // Determine rank
    let rank = 'Bronze'
    let nextRankXP = RANK_THRESHOLDS[RANK_THRESHOLDS.length - 2].xp // Silver
    for (const threshold of RANK_THRESHOLDS) {
      if (totalXP >= threshold.xp) {
        rank = threshold.rank
        break
      }
    }

    // Find next rank threshold
    const rankIndex = RANK_THRESHOLDS.findIndex((t) => t.rank === rank)
    if (rankIndex > 0) {
      nextRankXP = RANK_THRESHOLDS[rankIndex - 1].xp
    } else {
      nextRankXP = RANK_THRESHOLDS[0].xp // Already at max
    }

    const currentRankXP = RANK_THRESHOLDS.find((t) => t.rank === rank)?.xp ?? 0
    const progressRange = Math.max(1, nextRankXP - currentRankXP)
    const progress = rank === 'Obsidian' ? 1 : Math.min(1, (totalXP - currentRankXP) / progressRange)

    return { totalXP, rank, nextRankXP, progress }
  }

  private flattenStats(allStats: ReturnType<StatsEngine['getAllStats']>): Record<string, number> {
    const flat: Record<string, number> = {}

    // Lifetime
    Object.entries(allStats.lifetime).forEach(([k, v]) => { flat[k] = v as number })

    // Time
    Object.entries(allStats.time).forEach(([k, v]) => {
      if (typeof v === 'number') flat[k] = v
    })

    // Session records
    Object.entries(allStats.sessions).forEach(([k, v]) => { flat[k] = v as number })

    // Projects
    flat['uniqueProjects'] = allStats.projects.uniqueProjects

    // Derived stats
    flat['totalSessionHours'] = Math.floor(allStats.lifetime.totalDurationSeconds / 3600)
    flat['totalSearches'] = (allStats.tools['Grep'] ?? 0) + (allStats.tools['Glob'] ?? 0)

    // Tool diversity
    flat['uniqueToolsUsed'] = Object.keys(allStats.tools).length

    // Unique languages (from events - file extensions)
    flat['uniqueLanguages'] = this.countUniqueLanguages()

    // Prompt-derived stats
    flat['politePromptCount'] = this.countPolitePrompts()
    flat['hugePromptCount'] = this.countHugePrompts()
    flat['longPromptCount'] = this.countLongPrompts()
    flat['mostRepeatedPromptCount'] = this.getMostRepeatedPromptCount()
    flat['repeatedPromptCount'] = this.getRepeatedPromptCount()

    // Session-derived stats
    flat['quickSessionCount'] = this.countQuickSessions()
    flat['longSessionCount'] = this.countLongSessions()
    flat['maxErrorsInSession'] = this.getMaxErrorsInSession()
    flat['maxSameFileEdits'] = this.getMaxSameFileEdits()

    // Plan mode
    flat['planModeUses'] = this.countPlanModeUses()

    // Error-free streak
    flat['longestErrorFreeStreak'] = this.getLongestErrorFreeStreak()

    // Git stats
    flat['totalCommits'] = this.countGitCommits()
    flat['totalPRs'] = this.countGitPRs()

    // Subagent concurrency
    flat['concurrentAgentUses'] = this.countConcurrentAgents()

    return flat
  }

  // --- Helper query methods ---

  private countUniqueLanguages(): number {
    const rows = this.db.prepare(`
      SELECT DISTINCT
        CASE
          WHEN tool_input LIKE '%.ts%' OR tool_input LIKE '%.tsx%' THEN 'typescript'
          WHEN tool_input LIKE '%.js%' OR tool_input LIKE '%.jsx%' THEN 'javascript'
          WHEN tool_input LIKE '%.py%' THEN 'python'
          WHEN tool_input LIKE '%.rs%' THEN 'rust'
          WHEN tool_input LIKE '%.go%' THEN 'go'
          WHEN tool_input LIKE '%.java%' THEN 'java'
          WHEN tool_input LIKE '%.rb%' THEN 'ruby'
          WHEN tool_input LIKE '%.cpp%' OR tool_input LIKE '%.c%' OR tool_input LIKE '%.h%' THEN 'c_cpp'
          WHEN tool_input LIKE '%.cs%' THEN 'csharp'
          WHEN tool_input LIKE '%.swift%' THEN 'swift'
          WHEN tool_input LIKE '%.kt%' THEN 'kotlin'
          WHEN tool_input LIKE '%.php%' THEN 'php'
          WHEN tool_input LIKE '%.sh%' OR tool_input LIKE '%.bash%' THEN 'shell'
          WHEN tool_input LIKE '%.html%' THEN 'html'
          WHEN tool_input LIKE '%.css%' OR tool_input LIKE '%.scss%' THEN 'css'
          WHEN tool_input LIKE '%.sql%' THEN 'sql'
          ELSE NULL
        END as lang
      FROM events WHERE tool_name IN ('Read', 'Write', 'Edit') AND lang IS NOT NULL
    `).all() as { lang: string | null }[]
    return rows.filter(r => r.lang !== null).length
  }

  private countPolitePrompts(): number {
    return (this.db.prepare(`
      SELECT COUNT(*) as c FROM prompts WHERE LOWER(content) LIKE '%please%' OR LOWER(content) LIKE '%thank%'
    `).get() as { c: number }).c
  }

  private countHugePrompts(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM prompts WHERE char_count > 5000').get() as { c: number }).c
  }

  private countLongPrompts(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM prompts WHERE char_count > 1000').get() as { c: number }).c
  }

  private getMostRepeatedPromptCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM prompts GROUP BY content ORDER BY c DESC LIMIT 1').get() as { c: number } | undefined
    return row?.c ?? 0
  }

  private getRepeatedPromptCount(): number {
    return (this.db.prepare('SELECT COALESCE(SUM(c), 0) as total FROM (SELECT COUNT(*) - 1 as c FROM prompts GROUP BY content HAVING COUNT(*) > 1)').get() as { total: number }).total
  }

  private countQuickSessions(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM sessions WHERE duration_seconds > 0 AND duration_seconds < 300 AND tool_count > 0').get() as { c: number }).c
  }

  private countLongSessions(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM sessions WHERE duration_seconds > 28800').get() as { c: number }).c
  }

  private getMaxErrorsInSession(): number {
    return (this.db.prepare('SELECT COALESCE(MAX(error_count), 0) as c FROM sessions').get() as { c: number }).c
  }

  private getMaxSameFileEdits(): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as c FROM events
      WHERE hook_type = 'PostToolUse' AND tool_name = 'Edit'
      GROUP BY session_id, json_extract(tool_input, '$.file_path')
      ORDER BY c DESC LIMIT 1
    `).get() as { c: number } | undefined
    return row?.c ?? 0
  }

  private countPlanModeUses(): number {
    return (this.db.prepare("SELECT COUNT(*) as c FROM events WHERE hook_type = 'PostToolUse' AND tool_name = 'EnterPlanMode'").get() as { c: number }).c
  }

  private getLongestErrorFreeStreak(): number {
    const events = this.db.prepare(`
      SELECT success FROM events
      WHERE hook_type IN ('PostToolUse', 'PostToolUseFailure')
      ORDER BY timestamp ASC
    `).all() as { success: number | null }[]

    let longest = 0
    let current = 0
    for (const e of events) {
      if (e.success === 1 || e.success === null) {
        current++
        if (current > longest) longest = current
      } else {
        current = 0
      }
    }
    return longest
  }

  private countGitCommits(): number {
    return (this.db.prepare(`
      SELECT COUNT(*) as c FROM events
      WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%git commit%'
    `).get() as { c: number }).c
  }

  private countGitPRs(): number {
    return (this.db.prepare(`
      SELECT COUNT(*) as c FROM events
      WHERE tool_name = 'Bash' AND hook_type = 'PostToolUse' AND tool_input LIKE '%gh pr create%'
    `).get() as { c: number }).c
  }

  private countConcurrentAgents(): number {
    // Count SubagentStart events (proxy for concurrency)
    return (this.db.prepare("SELECT COUNT(*) as c FROM events WHERE hook_type = 'SubagentStart'").get() as { c: number }).c
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/achievements/compute.test.ts`
Expected: All 4 tests pass

**Step 5: Commit**

```bash
git add src/achievements/
git commit -m "feat: achievement engine with 53 badges, XP, rank, secret detection"
```

---

## Task 10: CLI Entry Point

**Files:**
- Modify: `src/cli.ts`
- Create: `src/commands/init.ts`

**Step 1: Write the init command**

Create `src/commands/init.ts`:

```typescript
import { install, isInstalled } from '../installer/installer.js'

export function runInit(): void {
  if (isInstalled()) {
    console.log('bashstats hooks are already installed. Reinstalling...')
  }

  const result = install()
  if (result.success) {
    console.log('')
    console.log('  bashstats installed successfully!')
    console.log('')
    console.log('  ' + result.message)
    console.log('')
    console.log('  Run "bashstats" to open the dashboard.')
    console.log('  Your Claude Code sessions are now being tracked.')
    console.log('')
    console.log('  [SECRET ACHIEVEMENT UNLOCKED] Launch Day')
    console.log('  "Welcome to bashstats. Your stats are now being watched. Forever."')
    console.log('')
  } else {
    console.error('Installation failed: ' + result.message)
    process.exit(1)
  }
}
```

**Step 2: Write CLI entry point**

Modify `src/cli.ts`:

```typescript
import { Command } from 'commander'
import { runInit } from './commands/init.js'

const program = new Command()

program
  .name('bashstats')
  .description('Obsessive stat tracking, achievements, and badges for Claude Code')
  .version('0.1.0')

program
  .command('init')
  .description('Install hooks and set up database')
  .action(runInit)

program
  .command('web')
  .description('Open browser dashboard')
  .action(() => { console.log('Web dashboard coming soon...') })

program
  .command('stats')
  .description('Quick stat summary')
  .action(() => { console.log('Stats coming soon...') })

program
  .command('achievements')
  .description('List all badges with progress')
  .action(() => { console.log('Achievements coming soon...') })

program
  .command('streak')
  .description('Show current and longest streak')
  .action(() => { console.log('Streak coming soon...') })

program
  .command('export')
  .description('Export all data as JSON')
  .action(() => { console.log('Export coming soon...') })

program
  .command('reset')
  .description('Wipe all data')
  .action(() => { console.log('Reset coming soon...') })

program
  .command('uninstall')
  .description('Remove hooks and data')
  .action(() => { console.log('Uninstall coming soon...') })

// Default command (no subcommand) = TUI dashboard
program.action(() => {
  console.log('TUI dashboard coming soon...')
  console.log('Use "bashstats stats" for a quick summary.')
})

program.parse()
```

**Step 3: Build and verify**

Run: `npm run build`
Run: `node dist/cli.js --help`
Expected: Shows all commands

Run: `node dist/cli.js --version`
Expected: `0.1.0`

**Step 4: Commit**

```bash
git add src/cli.ts src/commands/
git commit -m "feat: CLI entry point with commander, init command, placeholder subcommands"
```

---

## Tasks 11-23: Remaining Implementation

The remaining tasks follow the same TDD pattern. Each task listed below should be implemented with: (1) write failing test, (2) verify failure, (3) implement, (4) verify pass, (5) commit.

### Task 11: Stats Quick Summary Command
- **File:** `src/commands/stats.ts`
- Reads SQLite, prints formatted stat summary to terminal (no TUI)
- Format: categorized sections with labeled numbers

### Task 12: Achievements Command
- **File:** `src/commands/achievements.ts`
- Reads badges from achievement engine, prints formatted badge list
- Shows tier, progress bar, description for each badge
- Hides secret badges until unlocked

### Task 13: Streak Command
- **File:** `src/commands/streak.ts`
- Shows current streak, longest streak, streak calendar (last 30 days as dots)

### Task 14: Export/Reset/Uninstall Commands
- **Files:** `src/commands/export.ts`, `src/commands/reset.ts`, `src/commands/uninstall.ts`
- Export: dump all tables as JSON to stdout
- Reset: confirm with user, drop and recreate all tables
- Uninstall: call `uninstall()` from installer + optionally delete data dir

### Task 15: Web Server & API
- **Files:** `src/dashboard/server.ts`, `src/dashboard/server.test.ts`
- Express server on port 17900
- Endpoints: `GET /api/stats`, `GET /api/achievements`, `GET /api/activity` (daily), `GET /api/sessions`, `GET /api/health`
- Test: verify each endpoint returns correct shape
- **Reference:** `C:\Users\Cade\Projects\bashbros\src\dashboard\server.ts`

### Task 16: Web Dashboard HTML/CSS
- **File:** `src/dashboard/static/index.html`
- Single-file SPA with embedded CSS and JS
- Peach cream + navy brutalist theme (CSS custom properties)
- 6 tabs: Overview, Stats, Achievements, Records, Timeline, Settings
- **Reference:** `C:\Users\Cade\Projects\bashbros\src\dashboard\static\index.html`
- Theme: use exact CSS vars from design doc

### Task 17: Web Dashboard JavaScript
- Embedded in `index.html` `<script>` block
- Fetch from `/api/stats`, `/api/achievements`, `/api/activity`
- Tab switching, badge wall rendering, progress bars
- Contribution heatmap (365-day grid, peach gradient)
- Theme switcher (3 built-in themes, swap CSS vars)

### Task 18: TUI App Shell
- **Files:** `src/tui/app.tsx`, `src/tui/hooks/use-stats.ts`
- Ink app with tab navigation (arrow keys, number keys)
- Data fetching hook that reads from SQLite directly
- **Reference:** Ink documentation for React-in-terminal patterns

### Task 19: TUI Overview Tab
- **File:** `src/tui/components/overview.tsx`
- Big numbers grid (sessions, prompts, tools, hours, files, bash)
- 30-day activity sparkline (unicode blocks)
- Recent badges list
- Rank card with XP progress bar

### Task 20: TUI Stats Tab
- **File:** `src/tui/components/stats-tab.tsx`
- Categorized stat tables (Lifetime, Tools, Code, Time, Projects, Errors)
- Formatted numbers (commas, hours:minutes)

### Task 21: TUI Achievements Tab
- **File:** `src/tui/components/achievements-tab.tsx`
- Badge wall grid with tier indicators
- Progress bars for each badge
- Secret badges shown as "???" until unlocked
- Humor badges show their descriptions

### Task 22: TUI Records & Timeline Tabs
- **Files:** `src/tui/components/records-tab.tsx`, `src/tui/components/timeline-tab.tsx`
- Records: personal bests table
- Timeline: ASCII contribution heatmap, session list

### Task 23: Update Index Exports & Final Build
- **File:** `src/index.ts`
- Export all public APIs
- Run full test suite: `npm run test:run`
- Run build: `npm run build`
- Verify `bashstats init` works end-to-end
- Final commit

---

## Execution Notes

- **Build after each task** to catch compilation errors early
- **Tasks 1-10 are the critical path** -- everything else depends on them
- **Tasks 11-14** (CLI commands) can run in parallel
- **Tasks 15-17** (web dashboard) can run in parallel with Tasks 18-22 (TUI)
- **Task 23** must be last
- Reference `C:\Users\Cade\Projects\bashbros` for patterns throughout
- Reference `C:\Users\Cade\Projects\ghostwork\bashgym\hooks\` for hook event handling patterns
