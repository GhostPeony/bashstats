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

// === Token Usage ===

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
}

// === Database Row Types ===

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
  agent: string
  started_at: string
  ended_at: string | null
  stop_reason: string | null
  prompt_count: number
  tool_count: number
  error_count: number
  project: string | null
  duration_seconds: number | null
  input_tokens: number | null
  output_tokens: number | null
  cache_creation_input_tokens: number | null
  cache_read_input_tokens: number | null
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
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
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
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheCreationTokens: number
  totalCacheReadTokens: number
  totalTokens: number
  totalCommits: number
  totalLinesAdded: number
  totalLinesRemoved: number
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
  mostTokensInSession: number
  avgTokensPerSession: number
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

export interface AgentBreakdown {
  favoriteAgent: string
  sessionsPerAgent: Record<string, number>
  hoursPerAgent: Record<string, number>
  distinctAgents: number
}

// === Agent Types ===

export type AgentType =
  | 'claude-code'
  | 'gemini-cli'
  | 'copilot-cli'
  | 'opencode'
  | 'unknown'

export const AGENT_DISPLAY_NAMES: Record<AgentType, string> = {
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'copilot-cli': 'Copilot CLI',
  'opencode': 'OpenCode',
  'unknown': 'Unknown',
}

// === Achievement Types ===

export type BadgeTier = 0 | 1 | 2 | 3 | 4 | 5

export interface BadgeDefinition {
  id: string
  name: string
  icon: string
  description: string
  category: 'volume' | 'tool_mastery' | 'time' | 'behavioral' | 'resilience' | 'shipping' | 'multi_agent' | 'wild_card' | 'aspirational' | 'secret' | 'session_behavior' | 'prompt_patterns' | 'error_recovery' | 'tool_combos' | 'project_dedication' | 'token_usage'
  stat: string
  tiers: [number, number, number, number, number]
  trigger: string
  secret?: boolean
  aspirational?: boolean
}

export interface BadgeResult {
  id: string
  name: string
  icon: string
  description: string
  category: string
  stat: string
  tiers: [number, number, number, number, number]
  tier: BadgeTier
  tierName: string
  value: number
  nextThreshold: number
  progress: number
  maxed: boolean
  trigger: string
  secret: boolean
  unlocked: boolean
}

export interface XPResult {
  totalXP: number
  rankNumber: number
  rankTier: string
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
  5: 'Singularity',
}

// === Weekly Goals Types ===

export interface WeeklyChallenge {
  id: string
  description: string
  stat: string
  threshold: number
  xpReward: number
  weekScoped: boolean
}

export interface WeeklyGoalRow {
  week_start: string
  challenge_id: string
  completed: number
  xp_reward: number
}

export interface WeeklyXPRow {
  week_start: string
  base_xp: number
  multiplier: number
  bonus_xp: number
}

export interface WeeklyGoalsPayload {
  weekStart: string
  daysActive: number
  multiplier: number
  challenges: Array<{
    id: string
    description: string
    xpReward: number
    completed: boolean
    progress: number
    threshold: number
    current: number
  }>
}

// === Rank Tier Bracket ===

export interface RankTierBracket {
  tier: string
  minRank: number
  maxRank: number
}
