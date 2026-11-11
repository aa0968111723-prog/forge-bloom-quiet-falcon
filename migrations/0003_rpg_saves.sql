-- Optional cloud copy of the browser RPG save (`tamkang-rpg-v2`, content version 2).
-- This is not the pilgrimage table. A legacy pilgrimage blob must never land here.
-- Additive only: no drops, no rewrites of existing rows.

create table if not exists rpg_saves (
  user_id text primary key references "user" ("id") on delete cascade,
  schema_version integer not null,
  content_version integer not null,
  revision bigint not null,
  document jsonb not null,
  document_bytes integer not null,
  content_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists rpg_save_revisions (
  user_id text not null references "user" ("id") on delete cascade,
  revision bigint not null,
  schema_version integer not null,
  content_version integer not null,
  document jsonb not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision)
);

create table if not exists rpg_save_requests (
  user_id text not null references "user" ("id") on delete cascade,
  request_id text not null,
  payload_hash text not null,
  status_code integer not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create table if not exists reward_receipts (
  user_id text not null references "user" ("id") on delete cascade,
  event_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists rpg_save_revisions_user_idx
  on rpg_save_revisions (user_id, revision desc);
