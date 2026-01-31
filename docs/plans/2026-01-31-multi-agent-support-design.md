# Multi-Agent Support Design

## Overview

Add support for tracking Gemini CLI, Copilot CLI, and OpenCode alongside Claude Code. All agent data flows into the same SQLite database. The dashboard provides a dropdown filter to view stats per-agent or combined, with N/A for stats that don't apply to a given agent.

## Integration Strategy

Hybrid approach:
- **Gemini CLI and Copilot CLI** use the same stdin-JSON hook script pattern as Claude Code, with a normalization layer that translates their event names and payload shapes into the internal format.
- **OpenCode** gets a dedicated TypeScript plugin that runs in-process via OpenCode's native plugin system, calling the writer/DB layer directly.

## Event Normalization

### Gemini CLI (11 events)

| Gemini Event | Internal Event | Field Mappings |
|---|---|---|
| `SessionStart` | `SessionStart` | `source`, `session_id` -- identical |
| `SessionEnd` | `Stop` | `reason` -> `stop_reason` |
| `BeforeAgent` | `UserPromptSubmit` | `prompt` -- identical |
| `BeforeTool` | `PreToolUse` | `tool_name`, `tool_input` -- identical |
| `AfterTool` | `PostToolUse` | `tool_name`, `tool_input`, `tool_response` -- identical |
| `AfterModel` | *(token extraction)* | `llm_response.usageMetadata` -- no transcript parsing needed |
| `PreCompress` | `PreCompact` | `trigger` -- identical |
| `Notification` | `Notification` | `message`, `notification_type` -- identical |

Agent detection: Gemini sets `GEMINI_SESSION_ID` and `GEMINI_PROJECT_DIR` env vars automatically.

### Copilot CLI (6 events)

| Copilot Event | Internal Event | Field Mappings |
|---|---|---|
| `sessionStart` | `SessionStart` | `source`, `timestamp` |
| `sessionEnd` | `Stop` | `reason` -> `stop_reason` |
| `userPromptSubmitted` | `UserPromptSubmit` | `prompt` -- identical |
| `preToolUse` | `PreToolUse` | `toolName` -> `tool_name`, `toolArgs` -> `JSON.parse(tool_input)` |
| `postToolUse` | `PostToolUse` | `toolName`, `toolArgs`, `toolResult` -> `tool_response` |
| `errorOccurred` | `PostToolUseFailure` | `error.message`, `error.name` |

Key difference: Copilot's `toolArgs` is a stringified JSON string, not an object. The normalizer `JSON.parse`s it.

Not available from Copilot hooks: subagents, compactions, permission requests, token counts. Token data can be parsed from `~/.copilot/session-state/` JSONL files at session end as a fallback.

### OpenCode (plugin, not hooks)

| OpenCode Event | Writer Method |
|---|---|
| `session.created` | `writer.recordSessionStart()` |
| `tool.execute.before` | `writer.recordToolUse()` (PreToolUse) |
| `tool.execute.after` | `writer.recordToolUse()` (PostToolUse) |
| `session.idle` | `writer.recordSessionEnd()` |
| `session.error` | `writer.recordToolUse()` (failure) |
| `session.compacted` | `writer.recordCompaction()` |
| `message.updated` | `writer.recordPrompt()` (user role only) |

The plugin imports `BashStatsDB` and `BashStatsWriter` directly and calls writer methods in-process. No stdin/stdout.

## Data Model

No schema changes needed. The existing `sessions.agent` column already stores the agent type. The `events` table records everything per-session.

### N/A Stats by Agent

| Stat | Claude Code | Gemini CLI | Copilot CLI | OpenCode |
|---|---|---|---|---|
| Subagents | Yes | Yes | N/A | Yes (via parentID) |
| Compactions | Yes | Yes | N/A | Yes |
| Token breakdown (cache) | Yes | N/A (total only) | N/A | N/A |
| Permission requests | Yes | Yes | N/A | Yes |
| Error hook | N/A | N/A | Yes (dedicated) | Yes |

## New Multi-Agent Stats

- **Favorite Agent** -- agent with the most sessions
- **Sessions per agent** -- count breakdown
- **Time per agent** -- total hours in each
- **Agent diversity score** -- number of distinct agents used

## New Multi-Agent Badges

| Badge | Description | Tiers (B/S/G/D/Singularity) |
|---|---|---|
| Polyglot Agent | Use N distinct agents | 2 / 3 / 4 / - / - |
| Gemini Whisperer | Complete N sessions in Gemini CLI | 10 / 50 / 200 / 1000 / 5000 |
| Copilot Rider | Complete N sessions in Copilot CLI | 10 / 50 / 200 / 1000 / 5000 |
| Open Source Spirit | Complete N sessions in OpenCode | 10 / 50 / 200 / 1000 / 5000 |
| Agent Hopper | Switch agents N times in a single day | 2 / 4 / 6 / 8 / 10 |
| Double Agent | Use 2+ agents in the same day | 5 / 25 / 100 / 250 / 500 |

Badges and XP are unified across all agents. A session in any agent earns the same XP.

## Installers

### `bashstats init` behavior

Auto-detect which agents are installed:
- Check `~/.gemini/` exists -> install Gemini hooks
- Check `copilot` binary on PATH -> install Copilot hooks
- Check `~/.config/opencode/` exists -> install OpenCode plugin
- Claude Code hooks always installed (current behavior)

Output: "Installed hooks for: Claude Code, Gemini CLI. Copilot CLI not found, skipping."

### Gemini CLI installer

Merge hook entries into `~/.gemini/settings.json` under the `hooks` key. Same read-merge-write pattern as the Claude installer. Hook commands point to the `bashstats` binary. Agent detection uses Gemini's env vars (`GEMINI_SESSION_ID`, `GEMINI_PROJECT_DIR`).

### Copilot CLI installer

Write a `bashstats-hooks.json` file to `.github/hooks/` (or a global equivalent). Format:
```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "type": "command", "bash": "bashstats hook sessionStart", "powershell": "bashstats hook sessionStart" }],
    "sessionEnd": [...],
    "userPromptSubmitted": [...],
    "preToolUse": [...],
    "postToolUse": [...],
    "errorOccurred": [...]
  }
}
```

### OpenCode plugin

Drop a `bashstats.ts` file into `~/.config/opencode/plugins/`. Self-contained module that subscribes to OpenCode's event bus and writes to the bashstats SQLite database directly.

## Hook Scripts & Entry Points

### Gemini and Copilot (stdin-JSON pattern)

Reuse the existing hook scripts. Add a normalization step at the top of `handleHookEvent`:

1. `detectAgent()` identifies the agent via env vars
2. If not Claude Code, run the payload through `normalizeGeminiEvent(raw)` or `normalizeCopilotEvent(raw)`
3. Normalized payload matches the internal shape
4. Existing switch statement handles it unchanged

Normalizer functions live in `src/hooks/normalizers/gemini.ts` and `src/hooks/normalizers/copilot.ts`.

### OpenCode (plugin pattern)

Separate file: `src/plugins/opencode.ts`. Exports a plugin function that:
1. Imports `BashStatsDB` and `BashStatsWriter`
2. Opens the database at `~/.bashstats/bashstats.db`
3. Returns hook handlers that call writer methods directly
4. Closes DB on `session.idle` or `session.deleted`

## Dashboard UI Changes

### Agent filter dropdown

Dropdown in the header: "All Agents", "Claude Code", "Gemini CLI", "Copilot CLI", "OpenCode". Selection adds `?agent=<value>` to all API calls. Stats unavailable for the selected agent render as "N/A" with muted styling.

### Agent breakdown panel

Visible only when "All Agents" is selected:
- Favorite agent with icon
- Sessions per agent (horizontal bar chart)
- Hours per agent
- Agent diversity badge progress

Collapses when filtered to a single agent.

### Agent indicator on sessions

Each session entry in history/activity feed gets a small agent icon or label.

### API changes

- All existing endpoints (`/api/stats`, `/api/achievements`, `/api/activity`) accept optional `?agent=<agent-type>` query param
- Stats engine adds `WHERE agent = ?` when filter is present
- New endpoint: `GET /api/agents` returns per-agent breakdown (session counts, hours, favorite)

## File Changes Summary

### New files
- `src/hooks/normalizers/gemini.ts` -- Gemini payload normalizer
- `src/hooks/normalizers/copilot.ts` -- Copilot payload normalizer
- `src/plugins/opencode.ts` -- OpenCode plugin
- `src/installer/gemini.ts` -- Gemini hook installer
- `src/installer/copilot.ts` -- Copilot hook installer
- `src/installer/opencode.ts` -- OpenCode plugin installer

### Modified files
- `src/hooks/handler.ts` -- add normalization step before switch
- `src/installer/installer.ts` -- auto-detect agents, call per-agent installers
- `src/stats/engine.ts` -- add agent filter param, add multi-agent stats
- `src/achievements/compute.ts` -- add multi-agent badges
- `src/constants.ts` -- add multi-agent badge definitions
- `src/dashboard/server.ts` -- add `?agent` param to endpoints, add `/api/agents`
- `src/dashboard/static/index.html` -- agent dropdown, breakdown panel, session labels
- `src/commands/init.ts` -- auto-detect and install for multiple agents
- `src/commands/uninstall.ts` -- remove hooks for all agents
