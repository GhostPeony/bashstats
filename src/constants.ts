import type { BadgeDefinition } from './types.js'
import type { WeeklyChallenge, RankTierBracket } from './types.js'

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // ===================================================================
  // VOLUME (5)
  // ===================================================================
  { id: 'first_prompt', name: 'First Prompt', icon: '\u{1F4AC}', description: 'Submit prompts to Claude', category: 'volume', stat: 'totalPrompts', tiers: [1, 250, 2500, 10000, 50000], trigger: 'Total prompts submitted across all sessions' },
  { id: 'tool_time', name: 'Tool Time', icon: '\u{1F527}', description: 'Make tool calls', category: 'volume', stat: 'totalToolCalls', tiers: [50, 2500, 25000, 100000, 500000], trigger: 'Total tool calls made across all sessions' },
  { id: 'marathon', name: 'Marathon', icon: '\u{1F3C3}', description: 'Spend hours in sessions', category: 'volume', stat: 'totalSessionHours', tiers: [1, 25, 250, 1000, 5000], trigger: 'Total hours spent in sessions (rounded down)' },
  { id: 'wordsmith', name: 'Wordsmith', icon: '\u{270D}', description: 'Type characters in prompts', category: 'volume', stat: 'totalCharsTyped', tiers: [1000, 100000, 1000000, 5000000, 25000000], trigger: 'Total characters typed in prompts' },
  { id: 'session_vet', name: 'Session Vet', icon: '\u{1F3C5}', description: 'Complete sessions', category: 'volume', stat: 'totalSessions', tiers: [1, 50, 500, 2500, 10000], trigger: 'Total sessions completed' },

  // ===================================================================
  // TOOL MASTERY (7)
  // ===================================================================
  { id: 'shell_lord', name: 'Shell Lord', icon: '\u{1F4BB}', description: 'Execute Bash commands', category: 'tool_mastery', stat: 'totalBashCommands', tiers: [25, 250, 2500, 10000, 50000], trigger: 'Bash commands executed via PostToolUse' },
  { id: 'bookworm', name: 'Bookworm', icon: '\u{1F4D6}', description: 'Read files', category: 'tool_mastery', stat: 'totalFilesRead', tiers: [50, 500, 5000, 25000, 100000], trigger: 'Files read with the Read tool' },
  { id: 'editor_in_chief', name: 'Editor-in-Chief', icon: '\u{1F4DD}', description: 'Edit files', category: 'tool_mastery', stat: 'totalFilesEdited', tiers: [25, 250, 2500, 10000, 50000], trigger: 'Files edited with the Edit tool' },
  { id: 'architect', name: 'Architect', icon: '\u{1F3D7}', description: 'Create files', category: 'tool_mastery', stat: 'totalFilesCreated', tiers: [10, 100, 500, 2500, 10000], trigger: 'Files created with the Write tool' },
  { id: 'detective', name: 'Detective', icon: '\u{1F50D}', description: 'Search with Grep and Glob', category: 'tool_mastery', stat: 'totalSearches', tiers: [50, 500, 5000, 25000, 100000], trigger: 'Grep and Glob searches performed' },
  { id: 'web_crawler', name: 'Web Crawler', icon: '\u{1F310}', description: 'Fetch web pages', category: 'tool_mastery', stat: 'totalWebFetches', tiers: [5, 50, 200, 1000, 5000], trigger: 'WebFetch calls made' },
  { id: 'delegator', name: 'Delegator', icon: '\u{1F916}', description: 'Spawn subagents', category: 'tool_mastery', stat: 'totalSubagents', tiers: [10, 100, 500, 2500, 10000], trigger: 'Subagents spawned via SubagentStart events' },

  // ===================================================================
  // TIME & PATTERNS (10)
  // ===================================================================
  { id: 'iron_streak', name: 'Iron Streak', icon: '\u{1F525}', description: 'Maintain a daily streak', category: 'time', stat: 'longestStreak', tiers: [3, 7, 30, 100, 365], trigger: 'Longest streak of consecutive days with activity' },
  { id: 'night_owl', name: 'Night Owl', icon: '\u{1F989}', description: 'Prompts between midnight and 5am', category: 'time', stat: 'nightOwlCount', tiers: [10, 50, 200, 1000, 5000], trigger: 'Prompts submitted between midnight and 5 AM' },
  { id: 'early_bird', name: 'Early Bird', icon: '\u{1F426}', description: 'Prompts between 5am and 8am', category: 'time', stat: 'earlyBirdCount', tiers: [10, 50, 200, 1000, 5000], trigger: 'Prompts submitted between 5 AM and 8 AM' },
  { id: 'weekend_warrior', name: 'Weekend Warrior', icon: '\u{2694}', description: 'Weekend sessions', category: 'time', stat: 'weekendSessions', tiers: [5, 25, 100, 500, 2000], trigger: 'Sessions started on Saturday or Sunday' },
  { id: 'witching_hour', name: 'Witching Hour', icon: '\u{1F9D9}', description: '3 AM hits different when you\'re debugging.', category: 'time', stat: 'witchingHourPrompts', tiers: [1, 10, 50, 200, 1000], trigger: 'Prompts submitted between 2 AM and 4 AM' },
  { id: 'lunch_break_coder', name: 'Lunch Break Coder', icon: '\u{1F354}', description: 'Who needs food when you have Claude?', category: 'time', stat: 'lunchBreakDays', tiers: [5, 15, 30, 60, 120], trigger: 'Distinct days with sessions during 12-1 PM' },
  { id: 'monday_motivation', name: 'Monday Motivation', icon: '\u{1F4AA}', description: 'Starting the week strong (or desperate).', category: 'time', stat: 'mondaySessions', tiers: [5, 25, 75, 200, 500], trigger: 'Sessions started on Monday' },
  { id: 'friday_shipper', name: 'Friday Shipper', icon: '\u{1F6A2}', description: 'Deploy on Friday? You absolute madlad.', category: 'time', stat: 'fridayCommits', tiers: [1, 10, 50, 200, 1000], trigger: 'Git commits made on Friday (via Bash tool)' },
  { id: 'timezone_traveler', name: 'Timezone Traveler', icon: '\u{2708}', description: 'Your sleep schedule is a suggestion.', category: 'time', stat: 'maxUniqueHoursInDay', tiers: [6, 8, 12, 16, 20], trigger: 'Most unique hours with prompts in a single day' },
  { id: 'seasonal_coder', name: 'Seasonal Coder', icon: '\u{1F343}', description: "You've coded through all four seasons.", category: 'time', stat: 'uniqueQuarters', tiers: [1, 2, 4, 6, 8], trigger: 'Unique quarter-year combos (e.g. Q1-2025, Q2-2025) with activity' },

  // ===================================================================
  // SESSION BEHAVIOR (6)
  // ===================================================================
  { id: 'one_more_thing', name: 'One More Thing', icon: '\u{261D}', description: 'You said you were done 5 prompts ago.', category: 'session_behavior', stat: 'extendedSessionCount', tiers: [1, 5, 25, 100, 500], trigger: 'Sessions over 1 hour with 15+ prompts' },
  { id: 'quick_draw', name: 'Quick Draw', icon: '\u{1F52B}', description: 'In and out. 20 second adventure.', category: 'session_behavior', stat: 'quickDrawSessions', tiers: [5, 25, 100, 500, 2500], trigger: 'Sessions under 2 minutes with successful tool use' },
  { id: 'the_pivot', name: 'The Pivot', icon: '\u{1F504}', description: 'Started with CSS, ended with Kubernetes.', category: 'session_behavior', stat: 'diverseToolSessions', tiers: [5, 25, 100, 500, 2500], trigger: 'Sessions using 5+ distinct tool types' },
  { id: 'context_crunch', name: 'Context Crunch', icon: '\u{1F4A6}', description: 'Your context window is sweating.', category: 'session_behavior', stat: 'totalCompactions', tiers: [1, 5, 25, 100, 500], trigger: 'PreCompact events triggered (manual or auto)' },
  { id: 'permission_slip', name: 'Permission Slip', icon: '\u{1F4DD}', description: 'Always asking for permission. So polite.', category: 'session_behavior', stat: 'permissionRequests', tiers: [10, 100, 500, 2500, 10000], trigger: 'PermissionRequest events recorded' },
  { id: 'the_returner', name: 'The Returner', icon: '\u{1F519}', description: 'Back so soon? Missed me?', category: 'session_behavior', stat: 'returnerDays', tiers: [1, 5, 25, 100, 500], trigger: 'Days with 5+ sessions on the same project' },

  // ===================================================================
  // BEHAVIORAL (5)
  // ===================================================================
  { id: 'creature_of_habit', name: 'Creature of Habit', icon: '\u{1F501}', description: 'Repeat your most-used prompt', category: 'behavioral', stat: 'mostRepeatedPromptCount', tiers: [25, 100, 500, 2000, 10000], trigger: 'Count of your single most repeated prompt' },
  { id: 'explorer', name: 'Explorer', icon: '\u{1F9ED}', description: 'Use unique tool types', category: 'behavioral', stat: 'uniqueToolsUsed', tiers: [3, 5, 8, 12, 18], trigger: 'Distinct tool types used across all sessions' },
  { id: 'planner', name: 'Planner', icon: '\u{1F4CB}', description: 'Use plan mode', category: 'behavioral', stat: 'planModeUses', tiers: [5, 25, 100, 500, 2000], trigger: 'Task tool invocations (plan mode)' },
  { id: 'novelist', name: 'Novelist', icon: '\u{1F4D6}', description: 'Write prompts over 1000 characters', category: 'behavioral', stat: 'longPromptCount', tiers: [5, 25, 100, 500, 2000], trigger: 'Prompts with over 1,000 characters' },
  { id: 'speed_demon', name: 'Speed Demon', icon: '\u{26A1}', description: 'Complete sessions in under 5 minutes', category: 'behavioral', stat: 'quickSessionCount', tiers: [5, 25, 100, 500, 2000], trigger: 'Sessions under 5 minutes with tool use' },

  // ===================================================================
  // PROMPT PATTERNS (6)
  // ===================================================================
  { id: 'minimalist', name: 'Minimalist', icon: '\u{1F90F}', description: 'A person of few words.', category: 'prompt_patterns', stat: 'shortPromptCount', tiers: [5, 25, 100, 500, 2000], trigger: 'Prompts with fewer than 10 words' },
  { id: 'question_master', name: 'Question Master', icon: '\u{2753}', description: 'So many questions, so little time.', category: 'prompt_patterns', stat: 'questionPromptCount', tiers: [10, 50, 200, 1000, 5000], trigger: 'Prompts ending with a question mark' },
  { id: 'the_apologizer', name: 'The Apologizer', icon: '\u{1F625}', description: 'Sorry for asking, but...', category: 'prompt_patterns', stat: 'sorryPromptCount', tiers: [1, 10, 50, 200, 1000], trigger: "Prompts containing the word 'sorry'" },
  { id: 'caps_lock_energy', name: 'CAPS LOCK ENERGY', icon: '\u{1F4E2}', description: 'WHY ARE WE YELLING?', category: 'prompt_patterns', stat: 'capsLockPromptCount', tiers: [1, 5, 25, 100, 500], trigger: 'Prompts that are fully uppercase (10+ characters)' },
  { id: 'emoji_whisperer', name: 'Emoji Whisperer', icon: '\u{1F680}', description: 'Deploying vibes', category: 'prompt_patterns', stat: 'emojiPromptCount', tiers: [5, 25, 100, 500, 2000], trigger: 'Prompts containing emoji characters' },
  { id: 'code_dump', name: 'Code Dump', icon: '\u{1F4E6}', description: "Here's 500 lines, figure it out.", category: 'prompt_patterns', stat: 'codeDumpPromptCount', tiers: [1, 10, 50, 200, 1000], trigger: 'Prompts with 50+ lines of text' },

  // ===================================================================
  // RESILIENCE (3)
  // ===================================================================
  { id: 'clean_hands', name: 'Clean Hands', icon: '\u{2728}', description: 'Longest error-free tool streak', category: 'resilience', stat: 'longestErrorFreeStreak', tiers: [50, 200, 500, 2000, 10000], trigger: 'Consecutive successful tool calls without any error' },
  { id: 'resilient', name: 'Resilient', icon: '\u{1F6E1}', description: 'Survive errors', category: 'resilience', stat: 'totalErrors', tiers: [10, 50, 200, 1000, 5000], trigger: 'Total errors survived across all sessions' },
  { id: 'rate_limited', name: 'Rate Limited', icon: '\u{1F6A7}', description: 'Hit rate limits', category: 'resilience', stat: 'totalRateLimits', tiers: [3, 10, 25, 50, 100], trigger: 'Rate limit notification events received' },

  // ===================================================================
  // ERROR & RECOVERY (5)
  // ===================================================================
  { id: 'rubber_duck', name: 'Rubber Duck', icon: '\u{1F986}', description: 'Explaining the problem IS the solution.', category: 'error_recovery', stat: 'rubberDuckCount', tiers: [1, 5, 25, 100, 500], trigger: 'Tool failure followed by same tool success without Edit in between' },
  { id: 'third_times_charm', name: "Third Time's the Charm", icon: '\u{1F340}', description: 'Persistence is a virtue.', category: 'error_recovery', stat: 'thirdTimeCharmCount', tiers: [1, 5, 25, 100, 500], trigger: 'Tool success after 2+ consecutive failures of same tool' },
  { id: 'the_undoer', name: 'The Undoer', icon: '\u{21A9}', description: 'Ctrl+Z energy.', category: 'error_recovery', stat: 'undoEditCount', tiers: [1, 10, 50, 200, 1000], trigger: 'Back-to-back Edit calls on the same file in a session' },
  { id: 'crash_test_dummy', name: 'Crash Test Dummy', icon: '\u{1F4A5}', description: 'Testing in production, I see.', category: 'error_recovery', stat: 'crashySessions', tiers: [1, 5, 25, 100, 500], trigger: 'Sessions with 10+ errors' },
  { id: 'phoenix', name: 'Phoenix', icon: '\u{1F985}', description: 'From the ashes of 100 errors, you rise.', category: 'error_recovery', stat: 'totalLifetimeErrors', tiers: [100, 500, 1000, 5000, 10000], trigger: 'Total lifetime errors survived across all sessions' },

  // ===================================================================
  // TOOL COMBOS (5)
  // ===================================================================
  { id: 'read_edit_run', name: 'Read-Edit-Run', icon: '\u{1F3AF}', description: 'The holy trinity.', category: 'tool_combos', stat: 'readEditRunCount', tiers: [25, 100, 500, 2000, 10000], trigger: 'Read \u2192 Edit \u2192 Bash sequences detected in events' },
  { id: 'grep_ninja', name: 'Grep Ninja', icon: '\u{1F977}', description: 'Finding needles in haystacks since day one.', category: 'tool_combos', stat: 'totalSearches', tiers: [250, 1000, 5000, 25000, 100000], trigger: 'Total Grep and Glob searches performed' },
  { id: 'file_factory', name: 'File Factory', icon: '\u{1F3ED}', description: "You're not creating files, you're creating art.", category: 'tool_combos', stat: 'maxFilesCreatedInSession', tiers: [10, 20, 50, 100, 200], trigger: 'Max Write tool calls in a single session' },
  { id: 'the_refactorer', name: 'The Refactorer', icon: '\u{267B}', description: 'Same file, different day.', category: 'tool_combos', stat: 'maxSameFileEditsLifetime', tiers: [50, 100, 250, 500, 2000], trigger: 'Max Edit calls to any single file path across all sessions' },
  { id: 'search_and_destroy', name: 'Search and Destroy', icon: '\u{1F4A2}', description: 'Grep it, then wreck it.', category: 'tool_combos', stat: 'searchThenEditCount', tiers: [25, 100, 500, 2500, 10000], trigger: 'Grep/Glob followed by Edit within same session' },

  // ===================================================================
  // SHIPPING & PROJECTS (4)
  // ===================================================================
  { id: 'shipper', name: 'Shipper', icon: '\u{1F4E6}', description: 'Make commits via Claude', category: 'shipping', stat: 'totalCommits', tiers: [5, 50, 200, 1000, 5000], trigger: "Bash tool calls containing 'git commit'" },
  { id: 'pr_machine', name: 'PR Machine', icon: '\u{1F500}', description: 'Create pull requests', category: 'shipping', stat: 'totalPRs', tiers: [3, 25, 100, 500, 2000], trigger: "Bash tool calls containing 'gh pr create'" },
  { id: 'empire', name: 'Empire', icon: '\u{1F3F0}', description: 'Work on unique projects', category: 'shipping', stat: 'uniqueProjects', tiers: [2, 5, 10, 25, 50], trigger: 'Unique project directories worked in' },
  { id: 'polyglot', name: 'Polyglot', icon: '\u{1F30D}', description: 'Use different programming languages', category: 'shipping', stat: 'uniqueLanguages', tiers: [3, 5, 8, 15, 25], trigger: 'Distinct file extensions in Edit/Write/Read events' },

  // ===================================================================
  // PROJECT DEDICATION (5)
  // ===================================================================
  { id: 'monogamous', name: 'Monogamous', icon: '\u{1F48D}', description: 'One project. True love.', category: 'project_dedication', stat: 'maxProjectSessions', tiers: [50, 100, 250, 500, 1000], trigger: 'Max sessions on any single project' },
  { id: 'project_hopper', name: 'Project Hopper', icon: '\u{1F407}', description: "Commitment issues? Never heard of her.", category: 'project_dedication', stat: 'maxProjectsInDay', tiers: [3, 5, 8, 10, 15], trigger: 'Max unique projects worked on in a single day' },
  { id: 'the_finisher', name: 'The Finisher', icon: '\u{1F3C1}', description: 'You actually completed something.', category: 'project_dedication', stat: 'finishedProjects', tiers: [1, 3, 5, 10, 25], trigger: 'Projects with git commits followed by 7+ days of inactivity' },
  { id: 'legacy_code', name: 'Legacy Code', icon: '\u{1F9D3}', description: 'Revisiting your past mistakes.', category: 'project_dedication', stat: 'legacyReturns', tiers: [1, 3, 5, 10, 25], trigger: 'Returns to a project after 30+ days of inactivity' },
  { id: 'greenfield', name: 'Greenfield', icon: '\u{1F331}', description: 'That new project smell.', category: 'project_dedication', stat: 'totalUniqueProjects', tiers: [10, 25, 50, 100, 200], trigger: 'Total unique projects initialized' },

  // ===================================================================
  // MULTI-AGENT (6)
  // ===================================================================
  { id: 'buddy_system', name: 'Buddy System', icon: '\u{1F91D}', description: 'Use concurrent agents', category: 'multi_agent', stat: 'concurrentAgentUses', tiers: [1, 5, 25, 100, 500], trigger: 'Sessions with SubagentStart events' },
  { id: 'hive_mind', name: 'Hive Mind', icon: '\u{1F41D}', description: 'Spawn subagents total', category: 'multi_agent', stat: 'totalSubagents', tiers: [25, 250, 1000, 5000, 25000], trigger: 'Total SubagentStart events across all sessions' },
  { id: 'swarm_intelligence', name: 'Swarm Intelligence', icon: '\u{1F41C}', description: "You've built an army.", category: 'multi_agent', stat: 'maxConcurrentSubagents', tiers: [3, 5, 8, 12, 20], trigger: 'Max concurrent subagents active at any point' },
  { id: 'micromanager', name: 'Micromanager', icon: '\u{1F440}', description: 'Let them cook? Never heard of it.', category: 'multi_agent', stat: 'quickSubagentStops', tiers: [1, 5, 25, 100, 500], trigger: 'Subagents stopped within 30 seconds of starting' },
  { id: 'the_orchestrator', name: 'The Orchestrator', icon: '\u{1F3BC}', description: "You don't code. You conduct.", category: 'multi_agent', stat: 'totalSubagentSpawns', tiers: [50, 250, 1000, 5000, 25000], trigger: 'Total subagent spawns across all sessions' },
  { id: 'agent_smith', name: 'Agent Smith', icon: '\u{1F576}', description: "They're multiplying.", category: 'multi_agent', stat: 'maxSubagentsInSession', tiers: [10, 25, 50, 100, 250], trigger: 'Max SubagentStart events in a single session' },

  // --- Cross-agent badges (new) ---
  { id: 'polyglot_agent', name: 'Polyglot Agent', icon: '\u{1F30F}', description: 'A tool for every occasion.', category: 'multi_agent', stat: 'distinctAgentsUsed', tiers: [2, 3, 4, 4, 4], trigger: 'Distinct CLI agents used (Claude Code, Gemini, Copilot, OpenCode)' },
  { id: 'gemini_whisperer', name: 'Gemini Whisperer', icon: '\u{264A}', description: 'The stars aligned for your Gemini sessions.', category: 'multi_agent', stat: 'geminiSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in Gemini CLI' },
  { id: 'copilot_rider', name: 'Copilot Rider', icon: '\u{2708}', description: 'Your copilot is always on duty.', category: 'multi_agent', stat: 'copilotSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in Copilot CLI' },
  { id: 'open_source_spirit', name: 'Open Source Spirit', icon: '\u{1F4A1}', description: 'Freedom in every keystroke.', category: 'multi_agent', stat: 'opencodeSessions', tiers: [10, 50, 200, 1000, 5000], trigger: 'Sessions completed in OpenCode' },
  { id: 'agent_hopper', name: 'Agent Hopper', icon: '\u{1F407}', description: "Can't pick a favorite? Neither can we.", category: 'multi_agent', stat: 'agentSwitchDays', tiers: [2, 4, 6, 8, 10], trigger: 'Days where you used 2+ different CLI agents' },
  { id: 'double_agent', name: 'Double Agent', icon: '\u{1F575}', description: 'Playing both sides. Respect.', category: 'multi_agent', stat: 'doubleAgentDays', tiers: [5, 25, 100, 250, 500], trigger: 'Days with sessions in 2+ different CLI agents' },

  // ===================================================================
  // WILD CARD (12)
  // ===================================================================
  { id: 'please_thank_you', name: 'Please and Thank You', icon: '\u{1F64F}', description: "You're polite to the AI. When they take over, you'll be spared.", category: 'wild_card', stat: 'politePromptCount', tiers: [10, 50, 200, 1000, 5000], trigger: "Prompts containing 'please' or 'thank'" },
  { id: 'wall_of_text', name: 'Wall of Text', icon: '\u{1F4DC}', description: "Claude read your entire novel and didn't even complain.", category: 'wild_card', stat: 'hugePromptCount', tiers: [1, 10, 50, 200, 1000], trigger: 'Prompts over 5,000 characters' },
  { id: 'the_fixer', name: 'The Fixer', icon: '\u{1F6E0}', description: 'At this point just rewrite the whole thing.', category: 'wild_card', stat: 'maxSameFileEdits', tiers: [10, 20, 50, 100, 200], trigger: 'Max Edit calls to a single file' },
  { id: 'what_day_is_it', name: 'What Day Is It?', icon: '\u{1F62B}', description: 'Your chair is now a part of you.', category: 'wild_card', stat: 'longSessionCount', tiers: [1, 5, 25, 100, 500], trigger: 'Sessions exceeding 8 hours' },
  { id: 'copy_pasta', name: 'Copy Pasta', icon: '\u{1F35D}', description: "Maybe if I ask again it'll work differently.", category: 'wild_card', stat: 'repeatedPromptCount', tiers: [3, 10, 50, 200, 1000], trigger: 'Total duplicate prompts submitted' },
  { id: 'error_magnet', name: 'Error Magnet', icon: '\u{1F9F2}', description: 'At this point, the errors are a feature.', category: 'wild_card', stat: 'maxErrorsInSession', tiers: [10, 25, 50, 100, 200], trigger: 'Max errors in a single session' },
  { id: 'deja_vu', name: 'D\u00E9j\u00E0 Vu', icon: '\u{1F408}', description: "Didn't we just do this?", category: 'wild_card', stat: 'dejaVuCount', tiers: [1, 5, 25, 100, 500], trigger: 'Same prompt submitted twice within 5 minutes' },
  { id: 'trust_issues', name: 'Trust Issues', icon: '\u{1F50E}', description: 'You read the file Claude just wrote.', category: 'wild_card', stat: 'trustIssueCount', tiers: [1, 10, 50, 200, 1000], trigger: 'Read immediately after Write on the same file' },
  { id: 'backseat_driver', name: 'Backseat Driver', icon: '\u{1F697}', description: 'Let me tell you exactly how to do your job.', category: 'wild_card', stat: 'backseatDriverCount', tiers: [1, 10, 50, 200, 1000], trigger: "Prompts with numbered step-by-step instructions (e.g. '1.' '2.')" },
  { id: 'the_negotiator', name: 'The Negotiator', icon: '\u{1F91C}', description: 'Can you try again but better?', category: 'wild_card', stat: 'negotiatorCount', tiers: [1, 10, 50, 200, 1000], trigger: "Prompts containing 'try again' or 'one more time'" },
  { id: 'rubber_stamp', name: 'Rubber Stamp', icon: '\u{2705}', description: 'Yes. Yes. Yes. Approved.', category: 'wild_card', stat: 'maxConsecutivePermissions', tiers: [25, 50, 100, 250, 500], trigger: 'Max consecutive PermissionRequest events' },
  { id: 'it_works_on_my_machine', name: 'It Works On My Machine', icon: '\u{1F937}', description: 'The classic excuse.', category: 'wild_card', stat: 'bashRetrySuccessCount', tiers: [1, 10, 50, 200, 1000], trigger: 'Bash success (exit code 0) after a previous Bash failure' },

  // ===================================================================
  // TOKEN USAGE (10)
  // ===================================================================
  { id: 'token_burner', name: 'Token Burner', icon: '\u{1F525}', description: 'Consume tokens across all sessions', category: 'token_usage', stat: 'totalTokens', tiers: [50000000, 500000000, 5000000000, 50000000000, 500000000000], trigger: 'Total tokens consumed (input + output + cache read + cache creation)' },
  { id: 'output_machine', name: 'Output Machine', icon: '\u{1F5A8}', description: 'Generate output tokens from Claude', category: 'token_usage', stat: 'totalOutputTokens', tiers: [1000000, 10000000, 100000000, 500000000, 2000000000], trigger: 'Total output tokens generated by Claude across all sessions' },
  { id: 'cache_royalty', name: 'Cache Royalty', icon: '\u{1F451}', description: 'Read tokens from prompt cache', category: 'token_usage', stat: 'totalCacheReadTokens', tiers: [50000000, 500000000, 5000000000, 50000000000, 500000000000], trigger: 'Total cache read tokens (cached context reused across turns)' },
  { id: 'context_crafter', name: 'Context Crafter', icon: '\u{1F9F1}', description: 'Create new cache entries', category: 'token_usage', stat: 'totalCacheCreationTokens', tiers: [10000000, 100000000, 1000000000, 10000000000, 100000000000], trigger: 'Total cache creation tokens (new context written to cache)' },
  { id: 'token_whale', name: 'Token Whale', icon: '\u{1F40B}', description: 'Massive token consumption in a single session', category: 'token_usage', stat: 'mostTokensInSession', tiers: [10000000, 50000000, 200000000, 500000000, 1000000000], trigger: 'Most total tokens consumed in any single session' },
  { id: 'heavy_hitter', name: 'Heavy Hitter', icon: '\u{1F4AA}', description: 'Sessions exceeding 1M total tokens', category: 'token_usage', stat: 'heavyTokenSessions', tiers: [10, 50, 250, 1000, 5000], trigger: 'Sessions with 1,000,000+ total tokens' },
  { id: 'featherweight', name: 'Featherweight', icon: '\u{1FAB6}', description: 'Lean sessions that still get work done', category: 'token_usage', stat: 'lightTokenSessions', tiers: [1, 10, 50, 200, 1000], trigger: 'Sessions under 50,000 total tokens with at least 1 tool call' },
  { id: 'token_velocity', name: 'Token Velocity', icon: '\u{26A1}', description: 'High average tokens per session', category: 'token_usage', stat: 'avgTokensPerSession', tiers: [5000000, 10000000, 25000000, 50000000, 100000000], trigger: 'Average total tokens per session across all sessions' },
  { id: 'prolific_session', name: 'Prolific', icon: '\u{270D}', description: 'Most output generated in one session', category: 'token_usage', stat: 'maxOutputInSession', tiers: [100000, 500000, 2000000, 10000000, 50000000], trigger: 'Most output tokens generated by Claude in a single session' },
  { id: 'input_flood', name: 'Input Flood', icon: '\u{1F30A}', description: 'Total raw input tokens sent to the API', category: 'token_usage', stat: 'totalInputTokens', tiers: [1000000, 10000000, 100000000, 500000000, 2000000000], trigger: 'Total non-cached input tokens (the small uncached portion of each request)' },

  // ===================================================================
  // ASPIRATIONAL (12) - Singularity-only
  // ===================================================================
  { id: 'the_machine', name: 'The Machine', icon: '\u{2699}', description: 'You are no longer using the tool. You are the tool.', category: 'aspirational', stat: 'totalToolCalls', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true, trigger: 'Reach 100,000 total tool calls' },
  { id: 'year_of_code', name: 'Year of Code', icon: '\u{1F4C5}', description: '365 days. No breaks. Absolute unit.', category: 'aspirational', stat: 'longestStreak', tiers: [365, 365, 365, 365, 365], aspirational: true, trigger: 'Achieve a 365-day consecutive streak' },
  { id: 'million_words', name: 'Million Words', icon: '\u{1F4DA}', description: "You've written more to Claude than most people write in a lifetime.", category: 'aspirational', stat: 'totalCharsTyped', tiers: [10000000, 10000000, 10000000, 10000000, 10000000], aspirational: true, trigger: 'Type 10 million characters in prompts' },
  { id: 'lifer', name: 'Lifer', icon: '\u{1F451}', description: 'At this point, Claude is your cofounder.', category: 'aspirational', stat: 'totalSessions', tiers: [10000, 10000, 10000, 10000, 10000], aspirational: true, trigger: 'Complete 10,000 sessions' },
  { id: 'transcendent', name: 'Transcendent', icon: '\u{2B50}', description: "You've reached the peak. The view is nice up here.", category: 'aspirational', stat: 'totalXP', tiers: [100000, 100000, 100000, 100000, 100000], aspirational: true, trigger: 'Earn 100,000 total XP' },
  { id: 'omniscient', name: 'Omniscient', icon: '\u{1F441}', description: "You've mastered every tool. There is nothing left to teach you.", category: 'aspirational', stat: 'allToolsObsidian', tiers: [1, 1, 1, 1, 1], aspirational: true, trigger: 'All tool mastery badges at Singularity tier' },
  { id: 'ten_thousand_hours', name: '10,000 Hours', icon: '\u{23F0}', description: 'Malcolm Gladwell would be proud.', category: 'aspirational', stat: 'totalSessionHours', tiers: [10000, 10000, 10000, 10000, 10000], aspirational: true, trigger: 'Spend 10,000 hours in sessions' },
  { id: 'master_architect', name: 'The Architect', icon: '\u{1F3DB}', description: "You've built more than most companies ship.", category: 'aspirational', stat: 'totalFilesCreated', tiers: [1000, 1000, 1000, 1000, 1000], aspirational: true, trigger: 'Create 1,000+ files with the Write tool' },
  { id: 'eternal_flame', name: 'Eternal Flame', icon: '\u{1F56F}', description: 'Your streak outlasted relationships.', category: 'aspirational', stat: 'longestStreak', tiers: [180, 180, 180, 180, 180], aspirational: true, trigger: 'Maintain a 180-day consecutive streak' },
  { id: 'the_collector', name: 'The Collector', icon: '\u{1F4BF}', description: "Gotta catch 'em all.", category: 'aspirational', stat: 'allNonSecretBadgesUnlocked', tiers: [1, 1, 1, 1, 1], aspirational: true, trigger: 'Unlock every non-secret, non-aspirational badge' },
  { id: 'centimillionaire', name: 'Centimillionaire', icon: '\u{2328}', description: '100 million characters. Your keyboard weeps.', category: 'aspirational', stat: 'totalCharsTyped', tiers: [100000000, 100000000, 100000000, 100000000, 100000000], aspirational: true, trigger: 'Type 100 million characters in prompts' },
  { id: 'token_billionaire', name: 'Token Billionaire', icon: '\u{1F4B0}', description: 'A billion tokens. You single-handedly funded a GPU cluster.', category: 'aspirational', stat: 'totalTokens', tiers: [1000000000, 1000000000, 1000000000, 1000000000, 1000000000], aspirational: true, trigger: 'Consume 1 billion total tokens' },

  // ===================================================================
  // SECRET (17)
  // ===================================================================
  { id: 'rm_rf_survivor', name: 'rm -rf Survivor', icon: '\u{1F4A3}', description: "You almost mass deleted that folder. But you didn't. And honestly, we're all better for it.", category: 'secret', stat: 'dangerousCommandBlocked', tiers: [1, 1, 1, 1, 1], secret: true, trigger: "rm -rf or rm -r / detected in PreToolUse event" },
  { id: 'touch_grass', name: 'Touch Grass', icon: '\u{1F33F}', description: "Welcome back. The codebase missed you. (It didn't change, but still.)", category: 'secret', stat: 'returnAfterBreak', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Return after 7+ day gap between sessions' },
  { id: 'three_am_coder', name: '3am Coder', icon: '\u{1F319}', description: 'Nothing good happens at 3am. Except shipping code, apparently.', category: 'secret', stat: 'threeAmPrompt', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Submit a prompt at exactly 3 AM' },
  { id: 'night_shift', name: 'Night Shift', icon: '\u{1F303}', description: 'Started yesterday, finishing today. Time is a construct.', category: 'secret', stat: 'midnightSpanSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session that started before midnight and ended after' },
  { id: 'inception', name: 'Inception', icon: '\u{1F300}', description: 'We need to go deeper.', category: 'secret', stat: 'nestedSubagent', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Any SubagentStart event detected' },
  { id: 'holiday_hacker', name: 'Holiday Hacker', icon: '\u{1F384}', description: "Your family is wondering where you are. You're deploying.", category: 'secret', stat: 'holidayActivity', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session on Dec 25, Jan 1, or Jul 4' },
  { id: 'speed_run', name: 'Speed Run Any%', icon: '\u{23F1}', description: 'In and out. Twenty-second adventure.', category: 'secret', stat: 'speedRunSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session under 20 seconds with tool use' },
  { id: 'full_send', name: 'Full Send', icon: '\u{1F680}', description: 'Bash, Read, Write, Edit, Grep, Glob, WebFetch -- the whole buffet.', category: 'secret', stat: 'allToolsInSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Use all 7 core tools in one session' },
  { id: 'launch_day', name: 'Launch Day', icon: '\u{1F389}', description: 'Welcome to bashstats. Your stats are now being watched. Forever.', category: 'secret', stat: 'firstEverSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Complete your first ever session' },
  { id: 'the_completionist', name: 'The Completionist', icon: '\u{1F3C6}', description: 'You absolute legend.', category: 'secret', stat: 'allBadgesGold', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'All non-secret, non-aspirational badges at Gold+ tier' },
  { id: 'easter_egg_hunter', name: 'Easter Egg Hunter', icon: '\u{1F95A}', description: 'You found me!', category: 'secret', stat: 'easterEggActivity', tiers: [1, 1, 1, 1, 1], secret: true, trigger: "Session on Easter, Valentine's Day, or Thanksgiving" },
  { id: 'full_moon_coder', name: 'Full Moon Coder', icon: '\u{1F315}', description: 'Lycanthropic debugging.', category: 'secret', stat: 'fullMoonSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session during a full moon (calculated from lunar cycle)' },
  { id: 'birthday_bash', name: 'Birthday Bash', icon: '\u{1F382}', description: 'Celebrating with Claude.', category: 'secret', stat: 'birthdaySession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session on your bashstats install anniversary' },
  { id: 'lucky_number', name: 'Lucky Number', icon: '\u{1F340}', description: '7-7-7', category: 'secret', stat: 'luckyNumber', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Reach 777 prompts or 7,777 tool calls' },
  { id: 'ghost_session', name: 'Ghost Session', icon: '\u{1F47B}', description: 'Boo!', category: 'secret', stat: 'ghostSessions', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Complete a session with 0 tool calls' },
  { id: 'bullseye', name: 'Bullseye', icon: '\u{1F3AF}', description: 'First try, no errors.', category: 'secret', stat: 'bullseyeSessions', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Session with 1 prompt, 0 errors, and 1+ tool calls' },
  { id: 'token_singularity', name: 'Token Singularity', icon: '\u{1F573}', description: 'The context window stared into the abyss, and the abyss stared back.', category: 'secret', stat: 'hasTenMillionSession', tiers: [1, 1, 1, 1, 1], secret: true, trigger: 'Complete a session exceeding 10 million total tokens' },
]

// ===================================================================
// RANK SYSTEM (1-500)
// ===================================================================

export const RANK_TIER_BRACKETS: RankTierBracket[] = [
  { tier: 'System Anomaly', minRank: 500, maxRank: 500 },
  { tier: 'Obsidian', minRank: 401, maxRank: 499 },
  { tier: 'Diamond', minRank: 301, maxRank: 400 },
  { tier: 'Gold', minRank: 201, maxRank: 300 },
  { tier: 'Silver', minRank: 101, maxRank: 200 },
  { tier: 'Bronze', minRank: 1, maxRank: 100 },
]

export function xpForRank(rank: number): number {
  if (rank <= 0) return 0
  return Math.floor(10 * Math.pow(rank, 2.2))
}

export function rankTierForRank(rank: number): string {
  for (const bracket of RANK_TIER_BRACKETS) {
    if (rank >= bracket.minRank && rank <= bracket.maxRank) {
      return bracket.tier
    }
  }
  return 'Unranked'
}

// ===================================================================
// BADGE TIER XP REWARDS
// ===================================================================

export const TIER_XP = [0, 50, 100, 200, 500, 1000]

// ===================================================================
// WEEKLY GOALS
// ===================================================================

export const ACTIVITY_MULTIPLIERS: Record<number, number> = {
  1: 1.0,
  2: 1.1,
  3: 1.2,
  4: 1.3,
  5: 1.5,
  6: 1.75,
  7: 2.0,
}

export const WEEKLY_CHALLENGES: WeeklyChallenge[] = [
  { id: 'wk_diverse_tools', description: 'Use 5+ distinct tools in a single session', stat: 'diverseToolSessions', threshold: 1, xpReward: 150, weekScoped: true },
  { id: 'wk_50_prompts', description: 'Submit 50 prompts this week', stat: 'totalPrompts', threshold: 50, xpReward: 200, weekScoped: true },
  { id: 'wk_quick_session', description: 'Complete a session under 2 minutes with tool use', stat: 'quickDrawSessions', threshold: 1, xpReward: 100, weekScoped: true },
  { id: 'wk_3_day_commits', description: 'Make a git commit on 3 different days', stat: 'commitDays', threshold: 3, xpReward: 200, weekScoped: true },
  { id: 'wk_7_day_streak', description: 'Be active all 7 days this week', stat: 'daysActive', threshold: 7, xpReward: 300, weekScoped: true },
  { id: 'wk_3_subagents', description: 'Spawn 3+ subagents in one session', stat: 'maxSubagentsInSession', threshold: 3, xpReward: 150, weekScoped: true },
  { id: 'wk_night_code', description: 'Code after midnight twice this week', stat: 'nightOwlDays', threshold: 2, xpReward: 100, weekScoped: true },
  { id: 'wk_100_tools', description: 'Make 100 tool calls this week', stat: 'totalToolCalls', threshold: 100, xpReward: 150, weekScoped: true },
  { id: 'wk_5_sessions', description: 'Complete 5 sessions this week', stat: 'totalSessions', threshold: 5, xpReward: 100, weekScoped: true },
  { id: 'wk_10_sessions', description: 'Complete 10 sessions this week', stat: 'totalSessions', threshold: 10, xpReward: 200, weekScoped: true },
  { id: 'wk_read_50_files', description: 'Read 50 files this week', stat: 'totalFilesRead', threshold: 50, xpReward: 150, weekScoped: true },
  { id: 'wk_edit_20_files', description: 'Edit 20 files this week', stat: 'totalFilesEdited', threshold: 20, xpReward: 150, weekScoped: true },
  { id: 'wk_create_5_files', description: 'Create 5 new files this week', stat: 'totalFilesCreated', threshold: 5, xpReward: 100, weekScoped: true },
  { id: 'wk_2_projects', description: 'Work on 2+ different projects this week', stat: 'uniqueProjects', threshold: 2, xpReward: 100, weekScoped: true },
  { id: 'wk_marathon_session', description: 'Have a session lasting over 1 hour', stat: 'extendedSessionCount', threshold: 1, xpReward: 150, weekScoped: true },
  { id: 'wk_no_errors', description: 'Complete a session with zero errors', stat: 'cleanSessions', threshold: 1, xpReward: 100, weekScoped: true },
  { id: 'wk_3_hour_total', description: 'Spend 3+ total hours in sessions this week', stat: 'totalHours', threshold: 3, xpReward: 150, weekScoped: true },
  { id: 'wk_20_bash', description: 'Run 20 Bash commands this week', stat: 'totalBashCommands', threshold: 20, xpReward: 100, weekScoped: true },
  { id: 'wk_10_searches', description: 'Perform 10 searches (Grep/Glob) this week', stat: 'totalSearches', threshold: 10, xpReward: 100, weekScoped: true },
  { id: 'wk_long_prompt', description: 'Write a prompt over 1000 characters', stat: 'longPromptCount', threshold: 1, xpReward: 100, weekScoped: true },
  { id: 'wk_commit', description: 'Make a git commit this week', stat: 'totalCommits', threshold: 1, xpReward: 100, weekScoped: true },
  { id: 'wk_pr', description: 'Create a pull request this week', stat: 'totalPRs', threshold: 1, xpReward: 200, weekScoped: true },
  { id: 'wk_500_tools', description: 'Make 500 tool calls this week', stat: 'totalToolCalls', threshold: 500, xpReward: 300, weekScoped: true },
  { id: 'wk_weekend_warrior', description: 'Code on both Saturday and Sunday', stat: 'weekendDays', threshold: 2, xpReward: 150, weekScoped: true },
  { id: 'wk_early_bird', description: 'Submit a prompt before 8am', stat: 'earlyBirdDays', threshold: 1, xpReward: 100, weekScoped: true },
]

// ===================================================================
// PATHS
// ===================================================================

export const DATA_DIR = '.bashstats'
export const DB_FILENAME = 'bashstats.db'
export const DEFAULT_PORT = 17900
