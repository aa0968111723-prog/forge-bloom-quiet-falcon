create table if not exists pilgrimage (
  user_id text primary key,
  visited jsonb not null default '[]'::jsonb,
  play_seconds integer not null default 0,
  updated_at timestamptz not null default now()
);
