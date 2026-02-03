// Re-export types needed by the web app
// These mirror the types in ../../src/types.ts

export interface AllStats {
  lifetime: {
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
  tools: Record<string, number>
  time: {
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
  sessions: {
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
  projects: {
    uniqueProjects: number
    mostVisitedProject: string
    mostVisitedProjectCount: number
    projectBreakdown: Record<string, number>
  }
}

export interface ProfileSnapshot {
  uploaded_at: string
  stats: AllStats
  achievements: {
    stats: AllStats
    badges: Array<{
      id: string
      name: string
      icon: string
      description: string
      category: string
      tier: number
      tierName: string
      value: number
      nextThreshold: number
      progress: number
      maxed: boolean
      trigger: string
      secret: boolean
      unlocked: boolean
    }>
    xp: {
      totalXP: number
      rankNumber: number
      rankTier: string
      nextRankXP: number
      progress: number
    }
  }
  activity: Array<{
    date: string
    sessions: number
    prompts: number
    tool_calls: number
    errors: number
    duration_seconds: number
  }>
  sessions: Array<{
    id: string
    agent: string
    started_at: string
    ended_at: string | null
    prompt_count: number
    tool_count: number
    error_count: number
    project: string | null
    duration_seconds: number | null
  }>
  weeklyGoals: {
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
  agents: {
    favoriteAgent: string
    sessionsPerAgent: Record<string, number>
    hoursPerAgent: Record<string, number>
    distinctAgents: number
  }
}
