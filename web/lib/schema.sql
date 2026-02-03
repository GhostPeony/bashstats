CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  github_id      INTEGER UNIQUE NOT NULL,
  username       VARCHAR(39) UNIQUE NOT NULL,
  display_name   VARCHAR(100),
  avatar_url     TEXT,

  -- Denormalized leaderboard fields (updated each upload)
  total_xp       INTEGER NOT NULL DEFAULT 0,
  rank_number    INTEGER NOT NULL DEFAULT 0,
  rank_tier      VARCHAR(20) NOT NULL DEFAULT 'Unranked',
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_prompts  INTEGER NOT NULL DEFAULT 0,
  total_hours    REAL NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  badges_unlocked INTEGER NOT NULL DEFAULT 0,
  total_tokens   BIGINT NOT NULL DEFAULT 0,

  -- Full snapshot for profile rendering (~60KB JSON)
  snapshot       JSONB,

  -- Profile
  bio            TEXT,
  location       VARCHAR(100),
  website        VARCHAR(200),
  twitter        VARCHAR(39),
  github_url     TEXT,

  -- Privacy
  is_public           BOOLEAN NOT NULL DEFAULT true,
  show_on_leaderboard BOOLEAN NOT NULL DEFAULT true,
  anonymous_display   BOOLEAN NOT NULL DEFAULT false,

  -- Auth
  api_token      VARCHAR(64) UNIQUE NOT NULL,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_upload_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_total_xp ON users(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_rank_number ON users(rank_number DESC);
CREATE INDEX IF NOT EXISTS idx_users_longest_streak ON users(longest_streak DESC);
CREATE INDEX IF NOT EXISTS idx_users_badges_unlocked ON users(badges_unlocked DESC);

-- Analytics events
CREATE TABLE IF NOT EXISTS events (
  id         SERIAL PRIMARY KEY,
  event      VARCHAR(50) NOT NULL,
  user_id    INTEGER REFERENCES users(id),
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
