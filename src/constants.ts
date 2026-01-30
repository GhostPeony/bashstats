import type { BadgeDefinition } from './types.js'

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // === VOLUME (5) ===
  { id: 'first_prompt', name: 'First Prompt', icon: '\u{1F4AC}', description: 'Submit prompts to Claude', category: 'volume', stat: 'totalPrompts', tiers: [1, 100, 1000, 5000, 25000] },
  { id: 'tool_time', name: 'Tool Time', icon: '\u{1F527}', description: 'Make tool calls', category: 'volume', stat: 'totalToolCalls', tiers: [10, 500, 5000, 25000, 100000] },
  { id: 'marathon', name: 'Marathon', icon: '\u{1F3C3}', description: 'Spend hours in sessions', category: 'volume', stat: 'totalSessionHours', tiers: [1, 10, 100, 500, 2000] },
  { id: 'wordsmith', name: 'Wordsmith', icon: '\u{270D}', description: 'Type characters in prompts', category: 'volume', stat: 'totalCharsTyped', tiers: [1000, 50000, 500000, 2000000, 10000000] },
  { id: 'session_vet', name: 'Session Vet', icon: '\u{1F3C5}', description: 'Complete sessions', category: 'volume', stat: 'totalSessions', tiers: [1, 50, 500, 2000, 10000] },

  // === TOOL MASTERY (7) ===
  { id: 'shell_lord', name: 'Shell Lord', icon: '\u{1F4BB}', description: 'Execute Bash commands', category: 'tool_mastery', stat: 'totalBashCommands', tiers: [10, 100, 500, 2000, 10000] },
  { id: 'bookworm', name: 'Bookworm', icon: '\u{1F4D6}', description: 'Read files', category: 'tool_mastery', stat: 'totalFilesRead', tiers: [25, 250, 1000, 5000, 25000] },
  { id: 'editor_in_chief', name: 'Editor-in-Chief', icon: '\u{1F4DD}', description: 'Edit files', category: 'tool_mastery', stat: 'totalFilesEdited', tiers: [10, 100, 500, 2000, 10000] },
  { id: 'architect', name: 'Architect', icon: '\u{1F3D7}', description: 'Create files', category: 'tool_mastery', stat: 'totalFilesCreated', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'detective', name: 'Detective', icon: '\u{1F50D}', description: 'Search with Grep and Glob', category: 'tool_mastery', stat: 'totalSearches', tiers: [25, 250, 1000, 5000, 25000] },
  { id: 'web_crawler', name: 'Web Crawler', icon: '\u{1F310}', description: 'Fetch web pages', category: 'tool_mastery', stat: 'totalWebFetches', tiers: [5, 50, 200, 1000, 5000] },
  { id: 'delegator', name: 'Delegator', icon: '\u{1F916}', description: 'Spawn subagents', category: 'tool_mastery', stat: 'totalSubagents', tiers: [5, 50, 200, 1000, 5000] },

  // === TIME & STREAKS (4) ===
  { id: 'iron_streak', name: 'Iron Streak', icon: '\u{1F525}', description: 'Maintain a daily streak', category: 'time', stat: 'longestStreak', tiers: [3, 7, 30, 100, 365] },
  { id: 'night_owl', name: 'Night Owl', icon: '\u{1F989}', description: 'Prompts between midnight and 5am', category: 'time', stat: 'nightOwlCount', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'early_bird', name: 'Early Bird', icon: '\u{1F426}', description: 'Prompts between 5am and 8am', category: 'time', stat: 'earlyBirdCount', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'weekend_warrior', name: 'Weekend Warrior', icon: '\u{2694}', description: 'Weekend sessions', category: 'time', stat: 'weekendSessions', tiers: [5, 25, 100, 500, 2000] },

  // === BEHAVIORAL (5) ===
  { id: 'creature_of_habit', name: 'Creature of Habit', icon: '\u{1F501}', description: 'Repeat your most-used prompt', category: 'behavioral', stat: 'mostRepeatedPromptCount', tiers: [25, 100, 500, 2000, 10000] },
  { id: 'explorer', name: 'Explorer', icon: '\u{1F9ED}', description: 'Use unique tool types', category: 'behavioral', stat: 'uniqueToolsUsed', tiers: [3, 5, 8, 11, 14] },
  { id: 'planner', name: 'Planner', icon: '\u{1F4CB}', description: 'Use plan mode', category: 'behavioral', stat: 'planModeUses', tiers: [5, 25, 100, 500, 2000] },
  { id: 'novelist', name: 'Novelist', icon: '\u{1F4D6}', description: 'Write prompts over 1000 characters', category: 'behavioral', stat: 'longPromptCount', tiers: [5, 25, 100, 500, 2000] },
  { id: 'speed_demon', name: 'Speed Demon', icon: '\u{26A1}', description: 'Complete sessions in under 5 minutes', category: 'behavioral', stat: 'quickSessionCount', tiers: [5, 25, 100, 500, 2000] },

  // === RESILIENCE (3) ===
  { id: 'clean_hands', name: 'Clean Hands', icon: '\u{2728}', description: 'Longest error-free tool streak', category: 'resilience', stat: 'longestErrorFreeStreak', tiers: [50, 200, 500, 2000, 10000] },
  { id: 'resilient', name: 'Resilient', icon: '\u{1F6E1}', description: 'Survive errors', category: 'resilience', stat: 'totalErrors', tiers: [10, 50, 200, 1000, 5000] },
  { id: 'rate_limited', name: 'Rate Limited', icon: '\u{1F6A7}', description: 'Hit rate limits', category: 'resilience', stat: 'totalRateLimits', tiers: [3, 10, 25, 50, 100] },

  // === SHIPPING & PROJECTS (4) ===
  { id: 'shipper', name: 'Shipper', icon: '\u{1F4E6}', description: 'Make commits via Claude', category: 'shipping', stat: 'totalCommits', tiers: [5, 50, 200, 1000, 5000] },
  { id: 'pr_machine', name: 'PR Machine', icon: '\u{1F500}', description: 'Create pull requests', category: 'shipping', stat: 'totalPRs', tiers: [3, 25, 100, 500, 2000] },
  { id: 'empire', name: 'Empire', icon: '\u{1F3F0}', description: 'Work on unique projects', category: 'shipping', stat: 'uniqueProjects', tiers: [2, 5, 10, 25, 50] },
  { id: 'polyglot', name: 'Polyglot', icon: '\u{1F30D}', description: 'Use different programming languages', category: 'shipping', stat: 'uniqueLanguages', tiers: [2, 3, 5, 8, 12] },

  // === MULTI-AGENT (2) ===
  { id: 'buddy_system', name: 'Buddy System', icon: '\u{1F91D}', description: 'Use concurrent agents', category: 'multi_agent', stat: 'concurrentAgentUses', tiers: [1, 5, 25, 100, 500] },
  { id: 'hive_mind', name: 'Hive Mind', icon: '\u{1F41D}', description: 'Spawn subagents total', category: 'multi_agent', stat: 'totalSubagents', tiers: [10, 100, 500, 2000, 10000] },

  // === PUBLIC HUMOR (7) ===
  { id: 'please_thank_you', name: 'Please and Thank You', icon: '\u{1F64F}', description: "You're polite to the AI. When they take over, you'll be spared.", category: 'humor', stat: 'politePromptCount', tiers: [10, 50, 200, 1000, 5000], humor: true },
  { id: 'wall_of_text', name: 'Wall of Text', icon: '\u{1F4DC}', description: "Claude read your entire novel and didn't even complain.", category: 'humor', stat: 'hugePromptCount', tiers: [1, 10, 50, 200, 1000], humor: true },
  { id: 'the_fixer', name: 'The Fixer', icon: '\u{1F6E0}', description: 'At this point just rewrite the whole thing.', category: 'humor', stat: 'maxSameFileEdits', tiers: [10, 20, 50, 100, 200], humor: true },
  { id: 'what_day_is_it', name: 'What Day Is It?', icon: '\u{1F62B}', description: 'Your chair is now a part of you.', category: 'humor', stat: 'longSessionCount', tiers: [1, 5, 25, 100, 500], humor: true },
  { id: 'copy_pasta', name: 'Copy Pasta', icon: '\u{1F35D}', description: "Maybe if I ask again it'll work differently.", category: 'humor', stat: 'repeatedPromptCount', tiers: [3, 10, 50, 200, 1000], humor: true },
  { id: 'error_magnet', name: 'Error Magnet', icon: '\u{1F9F2}', description: 'At this point, the errors are a feature.', category: 'humor', stat: 'maxErrorsInSession', tiers: [10, 25, 50, 100, 200], humor: true },
  { id: 'creature_humor', name: 'Creature of Habit', icon: '\u{1F503}', description: "You have a type. And it's the same prompt.", category: 'humor', stat: 'mostRepeatedPromptCount', tiers: [25, 100, 500, 2000, 10000], humor: true },

  // === ASPIRATIONAL (6) - Obsidian-only ===
  { id: 'the_machine', name: 'The Machine', icon: '\u{2699}', description: 'You are no longer using the tool. You are the tool.', category: 'aspirational', stat: 'totalToolCalls', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true },
  { id: 'year_of_code', name: 'Year of Code', icon: '\u{1F4C5}', description: '365 days. No breaks. Absolute unit.', category: 'aspirational', stat: 'longestStreak', tiers: [365, 365, 365, 365, 365], aspirational: true },
  { id: 'million_words', name: 'Million Words', icon: '\u{1F4DA}', description: "You've written more to Claude than most people write in a lifetime.", category: 'aspirational', stat: 'totalCharsTyped', tiers: [10000000, 10000000, 10000000, 10000000, 10000000], aspirational: true },
  { id: 'lifer', name: 'Lifer', icon: '\u{1F451}', description: 'At this point, Claude is your cofounder.', category: 'aspirational', stat: 'totalSessions', tiers: [10000, 10000, 10000, 10000, 10000], aspirational: true },
  { id: 'transcendent', name: 'Transcendent', icon: '\u{2B50}', description: "You've reached the peak. The view is nice up here.", category: 'aspirational', stat: 'totalXP', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true },
  { id: 'omniscient', name: 'Omniscient', icon: '\u{1F441}', description: "You've mastered every tool. There is nothing left to teach you.", category: 'aspirational', stat: 'allToolsObsidian', tiers: [1, 1, 1, 1, 1], aspirational: true },

  // === SECRET (10) ===
  { id: 'rm_rf_survivor', name: 'rm -rf Survivor', icon: '\u{1F4A3}', description: "You almost mass deleted that folder. But you didn't. And honestly, we're all better for it.", category: 'secret', stat: 'dangerousCommandBlocked', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'touch_grass', name: 'Touch Grass', icon: '\u{1F33F}', description: "Welcome back. The codebase missed you. (It didn't change, but still.)", category: 'secret', stat: 'returnAfterBreak', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'three_am_coder', name: '3am Coder', icon: '\u{1F319}', description: 'Nothing good happens at 3am. Except shipping code, apparently.', category: 'secret', stat: 'threeAmPrompt', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'night_shift', name: 'Night Shift', icon: '\u{1F303}', description: 'Started yesterday, finishing today. Time is a construct.', category: 'secret', stat: 'midnightSpanSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'inception', name: 'Inception', icon: '\u{1F300}', description: 'We need to go deeper.', category: 'secret', stat: 'nestedSubagent', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'holiday_hacker', name: 'Holiday Hacker', icon: '\u{1F384}', description: "Your family is wondering where you are. You're deploying.", category: 'secret', stat: 'holidayActivity', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'speed_run', name: 'Speed Run Any%', icon: '\u{23F1}', description: 'In and out. Twenty-second adventure.', category: 'secret', stat: 'speedRunSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'full_send', name: 'Full Send', icon: '\u{1F680}', description: 'Bash, Read, Write, Edit, Grep, Glob, WebFetch -- the whole buffet.', category: 'secret', stat: 'allToolsInSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'launch_day', name: 'Launch Day', icon: '\u{1F389}', description: 'Welcome to bashstats. Your stats are now being watched. Forever.', category: 'secret', stat: 'firstEverSession', tiers: [1, 1, 1, 1, 1], secret: true },
  { id: 'the_completionist', name: 'The Completionist', icon: '\u{1F3C6}', description: 'You absolute legend.', category: 'secret', stat: 'allBadgesGold', tiers: [1, 1, 1, 1, 1], secret: true },
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
