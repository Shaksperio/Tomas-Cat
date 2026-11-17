-- 0001_cowila_world_core.sql
-- Authoritative operational store for Tomas Vagabundo.
-- Firebase is a read-only mirror; never accept client writes as authority.

CREATE TABLE IF NOT EXISTS player_accounts (
  firebase_uid TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  google_email_verified INTEGER NOT NULL CHECK (google_email_verified IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_player_accounts_email ON player_accounts(email_normalized);

CREATE TABLE IF NOT EXISTS character_ownership (
  character_id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  firebase_uid TEXT NOT NULL REFERENCES player_accounts(firebase_uid),
  source TEXT NOT NULL DEFAULT 'migration' CHECK (source IN ('migration','server_created','admin_recovery')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(firebase_uid, character_id, world_id)
);
CREATE INDEX IF NOT EXISTS idx_character_ownership_uid ON character_ownership(firebase_uid);

CREATE TABLE IF NOT EXISTS world_sessions (
  session_id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL REFERENCES player_accounts(firebase_uid),
  character_id TEXT NOT NULL REFERENCES character_ownership(character_id),
  world_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('player_active','absence_grace','cowila_piloting','returning','suspended','closed')),
  heartbeat_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_world_sessions_owner ON world_sessions(firebase_uid, character_id, world_id);
CREATE INDEX IF NOT EXISTS idx_world_sessions_expiry ON world_sessions(state, expires_at);

CREATE TABLE IF NOT EXISTS embodiment_leases (
  lease_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES world_sessions(session_id),
  firebase_uid TEXT NOT NULL REFERENCES player_accounts(firebase_uid),
  character_id TEXT NOT NULL REFERENCES character_ownership(character_id),
  world_id TEXT NOT NULL,
  fencing_token INTEGER NOT NULL,
  controller TEXT NOT NULL CHECK (controller IN ('player','cowila')),
  state TEXT NOT NULL CHECK (state IN ('active','revoked','expired','suspended')),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(character_id, fencing_token)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_character_lease ON embodiment_leases(character_id) WHERE state='active';

CREATE TABLE IF NOT EXISTS character_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  firebase_uid TEXT NOT NULL REFERENCES player_accounts(firebase_uid),
  character_id TEXT NOT NULL REFERENCES character_ownership(character_id),
  world_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_character_snapshots_owner ON character_snapshots(firebase_uid, character_id, created_at);

CREATE TABLE IF NOT EXISTS activity_journal (
  event_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  firebase_uid TEXT NOT NULL REFERENCES player_accounts(firebase_uid),
  character_id TEXT NOT NULL REFERENCES character_ownership(character_id),
  world_id TEXT NOT NULL,
  session_id TEXT REFERENCES world_sessions(session_id),
  lease_id TEXT REFERENCES embodiment_leases(lease_id),
  actor TEXT NOT NULL CHECK (actor IN ('player','cowila','system')),
  event_type TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('proposed','accepted','rejected','completed','cancelled','failed','handoff')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_journal_character ON activity_journal(character_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_journal_uid ON activity_journal(firebase_uid, created_at);

CREATE TABLE IF NOT EXISTS firebase_mirror_outbox (
  outbox_id TEXT PRIMARY KEY,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  firebase_uid TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','synced','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  last_error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_firebase_mirror_outbox_pending ON firebase_mirror_outbox(state, next_attempt_at);

CREATE TABLE IF NOT EXISTS firebase_mirror_cursors (
  firebase_uid TEXT PRIMARY KEY,
  last_synced_at TEXT,
  last_event_id TEXT,
  updated_at TEXT NOT NULL
);
