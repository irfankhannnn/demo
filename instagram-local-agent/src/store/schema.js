/**
 * The full SQLite DDL for the laptop agent (ARCHITECTURE section 5).
 *
 * Every table in the contract is here:
 *   accounts, tokens, media, media_metrics, account_metrics, conversations,
 *   messages, comments, enquiries, drafts, outbox, rules, sync_state,
 *   audit_log, upload_queue
 *
 * Conventions
 *  - Times are unix milliseconds in INTEGER columns. Dated snapshot rows also
 *    carry a `metric_date` TEXT 'YYYY-MM-DD' because that is the grain the CRM
 *    projection uses (SNAP#...#<YYYY-MM-DD>).
 *  - Booleans are INTEGER 0/1 with CHECK constraints.
 *  - Enumerations use CHECK constraints so a bad write fails here, not in the cloud.
 *  - JSON blobs are TEXT. SQLite has no JSON type and we do not need one.
 *  - Indexes exist for the queries the collectors and the console actually run;
 *    each one is annotated with its caller.
 */

export const SCHEMA_VERSION = 1;

export const INITIAL_SCHEMA = `
-- ---------------------------------------------------------------------------
-- accounts : connected Instagram professional accounts (multi-account, F51)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounts (
  ig_user_id          TEXT PRIMARY KEY,
  username            TEXT,
  name                TEXT,
  biography           TEXT,
  profile_picture_url TEXT,
  account_type        TEXT,
  followers_count     INTEGER,
  follows_count       INTEGER,
  media_count         INTEGER,
  tenant_id           TEXT,
  token_expires_at    INTEGER,
  status              TEXT NOT NULL DEFAULT 'connected'
                      CHECK (status IN ('connected','reconnect_required','revoked','disabled')),
  connected_at        INTEGER,
  last_sync_at        INTEGER,
  last_error          TEXT,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
-- console token-health panel and the daily refresh check both scan by expiry
CREATE INDEX IF NOT EXISTS idx_accounts_token_expiry ON accounts (token_expires_at);

-- ---------------------------------------------------------------------------
-- tokens : encrypted access tokens. AES-256-GCM, key in ~/.ig-agent/vault.key.
-- These never leave the laptop and are never uploaded.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  ig_user_id        TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'long_lived'
                    CHECK (kind IN ('short_lived','long_lived')),
  alg               TEXT NOT NULL DEFAULT 'aes-256-gcm',
  iv                TEXT NOT NULL,
  tag               TEXT NOT NULL,
  ciphertext        TEXT NOT NULL,
  key_id            TEXT,
  scopes            TEXT,
  issued_at         INTEGER NOT NULL,
  expires_at        INTEGER,
  refresh_after     INTEGER,
  last_refreshed_at INTEGER,
  refresh_failures  INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  PRIMARY KEY (ig_user_id, kind),
  FOREIGN KEY (ig_user_id) REFERENCES accounts (ig_user_id) ON DELETE CASCADE
);
-- the refresh scheduler asks "which tokens are due?" (day 50 of a 60-day token)
CREATE INDEX IF NOT EXISTS idx_tokens_refresh_after ON tokens (refresh_after);

-- ---------------------------------------------------------------------------
-- media : every post and reel (A3)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  media_id           TEXT PRIMARY KEY,
  ig_user_id         TEXT NOT NULL,
  caption            TEXT,
  media_type         TEXT,
  media_product_type TEXT,
  permalink          TEXT,
  thumbnail_url      TEXT,
  media_url          TEXT,
  published_at       INTEGER,
  comment_count      INTEGER NOT NULL DEFAULT 0,
  dm_count           INTEGER NOT NULL DEFAULT 0,
  enquiry_count      INTEGER NOT NULL DEFAULT 0,
  last_metrics_at    INTEGER,
  first_seen_at      INTEGER NOT NULL,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  FOREIGN KEY (ig_user_id) REFERENCES accounts (ig_user_id) ON DELETE CASCADE
);
-- media collector: "what have I got, newest first" plus the <30d refresh window
CREATE INDEX IF NOT EXISTS idx_media_account_published ON media (ig_user_id, published_at DESC);
-- comment watcher: "recent reels to poll comments on"
CREATE INDEX IF NOT EXISTS idx_media_published ON media (published_at DESC);
-- console reel leaderboard (F29) sorts by enquiries, not views
CREATE INDEX IF NOT EXISTS idx_media_enquiry_count ON media (ig_user_id, enquiry_count DESC);

-- ---------------------------------------------------------------------------
-- media_metrics : one row per media per day. Kept forever - Instagram keeps ~90d.
-- missing_metrics records what Meta refused, so a removed metric (impressions,
-- plays - gone Apr 2025) degrades to a gap and never a failed sync.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS media_metrics (
  media_id            TEXT NOT NULL,
  metric_date         TEXT NOT NULL,
  views               INTEGER,
  reach               INTEGER,
  likes               INTEGER,
  comments            INTEGER,
  saved               INTEGER,
  shares              INTEGER,
  total_interactions  INTEGER,
  avg_watch_time_ms   INTEGER,
  total_watch_time_ms INTEGER,
  missing_metrics     TEXT,
  collected_at        INTEGER NOT NULL,
  PRIMARY KEY (media_id, metric_date),
  FOREIGN KEY (media_id) REFERENCES media (media_id) ON DELETE CASCADE
);
-- console timeseries: "all media metrics across a date range"
CREATE INDEX IF NOT EXISTS idx_media_metrics_date ON media_metrics (metric_date);

-- ---------------------------------------------------------------------------
-- account_metrics : nightly account snapshot (A2, F36/F37)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_metrics (
  ig_user_id            TEXT NOT NULL,
  metric_date           TEXT NOT NULL,
  followers_count       INTEGER,
  follows_count         INTEGER,
  media_count           INTEGER,
  reach                 INTEGER,
  views                 INTEGER,
  accounts_engaged      INTEGER,
  total_interactions    INTEGER,
  follows_and_unfollows INTEGER,
  profile_links_taps    INTEGER,
  demographics          TEXT,
  missing_metrics       TEXT,
  collected_at          INTEGER NOT NULL,
  PRIMARY KEY (ig_user_id, metric_date),
  FOREIGN KEY (ig_user_id) REFERENCES accounts (ig_user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_account_metrics_date ON account_metrics (metric_date);

-- ---------------------------------------------------------------------------
-- conversations : DM threads and their send window (A5, A7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  conversation_id      TEXT PRIMARY KEY,
  ig_user_id           TEXT NOT NULL,
  participant_id       TEXT,
  participant_username TEXT,
  message_count        INTEGER NOT NULL DEFAULT 0,
  last_inbound_at      INTEGER,
  last_outbound_at     INTEGER,
  last_comment_at      INTEGER,
  last_comment_id      TEXT,
  human_agent_until    INTEGER,
  window_state         TEXT NOT NULL DEFAULT 'CLOSED'
                       CHECK (window_state IN ('STANDARD','COMMENT_REPLY','HUMAN_AGENT','CLOSED')),
  window_expires_at    INTEGER,
  unanswered           INTEGER NOT NULL DEFAULT 0 CHECK (unanswered IN (0,1)),
  source_media_id      TEXT,
  first_seen_at        INTEGER NOT NULL,
  last_synced_at       INTEGER,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL,
  FOREIGN KEY (ig_user_id) REFERENCES accounts (ig_user_id) ON DELETE CASCADE
);
-- console inbox plus the missed-DM rescue queue (F5): unanswered, most recent first
CREATE INDEX IF NOT EXISTS idx_conversations_unanswered ON conversations (unanswered, last_inbound_at DESC);
-- sender and the window sweeper both filter on state
CREATE INDEX IF NOT EXISTS idx_conversations_window ON conversations (window_state, window_expires_at);
-- conversations collector: incremental cursor over recent activity
CREATE INDEX IF NOT EXISTS idx_conversations_account_activity ON conversations (ig_user_id, last_inbound_at DESC);

-- ---------------------------------------------------------------------------
-- messages : individual DMs, both directions (A5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  message_id      TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  ig_user_id      TEXT NOT NULL,
  direction       TEXT NOT NULL CHECK (direction IN ('in','out')),
  sender_id       TEXT,
  sender_username TEXT,
  recipient_id    TEXT,
  text            TEXT,
  attachments     TEXT,
  is_story_reply  INTEGER NOT NULL DEFAULT 0 CHECK (is_story_reply IN (0,1)),
  created_at      INTEGER NOT NULL,
  inserted_at     INTEGER NOT NULL,
  raw             TEXT,
  FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id) ON DELETE CASCADE
);
-- thread view, and the drafter building context in message order
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (conversation_id, created_at);
-- incremental sync: "anything newer than my cursor?"
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at);
-- response-time stats and the unanswered sweep
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages (conversation_id, direction, created_at DESC);

-- ---------------------------------------------------------------------------
-- comments : comments on our own media, trigger match, private-reply state (A4)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  comment_id          TEXT PRIMARY KEY,
  media_id            TEXT NOT NULL,
  ig_user_id          TEXT NOT NULL,
  parent_id           TEXT,
  from_id             TEXT,
  from_username       TEXT,
  text                TEXT,
  matched_rule_id     TEXT,
  public_reply_state  TEXT NOT NULL DEFAULT 'none'
                      CHECK (public_reply_state IN ('none','pending','sent','failed','skipped')),
  public_reply_id     TEXT,
  private_reply_state TEXT NOT NULL DEFAULT 'none'
                      CHECK (private_reply_state IN ('none','pending','sent','failed','expired','skipped')),
  private_reply_at    INTEGER,
  conversation_id     TEXT,
  hidden              INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0,1)),
  created_at          INTEGER NOT NULL,
  inserted_at         INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media (media_id) ON DELETE CASCADE
);
-- comment watcher: newest comments per media
CREATE INDEX IF NOT EXISTS idx_comments_media_created ON comments (media_id, created_at DESC);
-- the lead engine: "which matched comments still owe a private reply?"
CREATE INDEX IF NOT EXISTS idx_comments_private_reply ON comments (private_reply_state, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_rule ON comments (matched_rule_id);
-- attribution from a DM thread back to the comment that opened it
CREATE INDEX IF NOT EXISTS idx_comments_conversation ON comments (conversation_id);

-- ---------------------------------------------------------------------------
-- enquiries : structured leads extracted from threads (A8). NOT CRM leads -
-- the scope rule keeps this table isolated from the Leads pipeline.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id        TEXT PRIMARY KEY,
  ig_user_id        TEXT NOT NULL,
  conversation_id   TEXT,
  ig_sender_id      TEXT,
  ig_username       TEXT,
  name              TEXT,
  phone             TEXT,
  phone_raw         TEXT,
  intent            TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (intent IN ('buy','rent','heavy_deposit_ok','sell','unknown')),
  budget_min        INTEGER,
  budget_max        INTEGER,
  budget_bracket    TEXT,
  preferred_area    TEXT,
  temperature       TEXT NOT NULL DEFAULT 'cold' CHECK (temperature IN ('hot','warm','cold')),
  score             INTEGER NOT NULL DEFAULT 0,
  source_media_id   TEXT,
  source_comment_id TEXT,
  status            TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','contacted','qualified','site_visit','won','lost','spam')),
  notes             TEXT,
  extracted         TEXT,
  extractor         TEXT NOT NULL DEFAULT 'deterministic',
  confidence        REAL,
  dedupe_key        TEXT UNIQUE,
  upload_state      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (upload_state IN ('pending','queued','uploaded','failed')),
  uploaded_at       INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  FOREIGN KEY (ig_user_id) REFERENCES accounts (ig_user_id) ON DELETE CASCADE
);
-- console enquiry list, filtered and sorted the way the UI shows it
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enquiries_temperature ON enquiries (temperature, created_at DESC);
-- reel leaderboard joins enquiries back onto media
CREATE INDEX IF NOT EXISTS idx_enquiries_source_media ON enquiries (source_media_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_conversation ON enquiries (conversation_id);
-- uploader picks up whatever has not reached the cloud yet
CREATE INDEX IF NOT EXISTS idx_enquiries_upload_state ON enquiries (upload_state, created_at);
CREATE INDEX IF NOT EXISTS idx_enquiries_phone ON enquiries (phone);

-- ---------------------------------------------------------------------------
-- drafts : AI-drafted replies awaiting approval (A6). Stored, never sent from
-- here - a draft only becomes traffic by being queued into outbox.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drafts (
  draft_id           TEXT PRIMARY KEY,
  conversation_id    TEXT NOT NULL,
  ig_user_id         TEXT NOT NULL,
  trigger_message_id TEXT,
  body               TEXT NOT NULL,
  edited_body        TEXT,
  language           TEXT,
  category           TEXT,
  drafter            TEXT NOT NULL DEFAULT 'template',
  model              TEXT,
  rationale          TEXT,
  confidence         REAL,
  auto_send_eligible INTEGER NOT NULL DEFAULT 0 CHECK (auto_send_eligible IN (0,1)),
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','sent','superseded','expired')),
  approved_by        TEXT,
  approved_at        INTEGER,
  outbox_id          TEXT,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id) ON DELETE CASCADE
);
-- console drafts screen: pending first, oldest first (clear the queue in order)
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts (status, created_at);
CREATE INDEX IF NOT EXISTS idx_drafts_conversation ON drafts (conversation_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- outbox : queued outbound sends. EVERY outbound message is a row here, and
-- every row passes the window classifier before it leaves (A7 / F59).
-- human_approved is the hard gate for HUMAN_AGENT sends.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox (
  outbox_id             TEXT PRIMARY KEY,
  kind                  TEXT NOT NULL CHECK (kind IN ('dm','private_reply','comment_reply')),
  ig_user_id            TEXT NOT NULL,
  conversation_id       TEXT,
  recipient_id          TEXT,
  comment_id            TEXT,
  draft_id              TEXT,
  body                  TEXT NOT NULL,
  attachments           TEXT,
  window_state_at_queue TEXT
                        CHECK (window_state_at_queue IN ('STANDARD','COMMENT_REPLY','HUMAN_AGENT','CLOSED')),
  window_state_at_send  TEXT
                        CHECK (window_state_at_send IN ('STANDARD','COMMENT_REPLY','HUMAN_AGENT','CLOSED')),
  human_approved        INTEGER NOT NULL DEFAULT 0 CHECK (human_approved IN (0,1)),
  approved_by           TEXT,
  approved_at           INTEGER,
  status                TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued','sending','sent','failed','blocked','cancelled','dry_run')),
  attempts              INTEGER NOT NULL DEFAULT 0,
  not_before            INTEGER,
  last_error            TEXT,
  last_error_code       TEXT,
  provider_message_id   TEXT,
  dry_run               INTEGER NOT NULL DEFAULT 0 CHECK (dry_run IN (0,1)),
  sent_at               INTEGER,
  created_at            INTEGER NOT NULL,
  updated_at            INTEGER NOT NULL
);
-- the sender's work query: sendable rows, oldest first
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox (status, not_before, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_conversation ON outbox (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_comment ON outbox (comment_id);

-- ---------------------------------------------------------------------------
-- rules : keyword rules, authored in the CRM and pulled down (A4, GET /agent/rules)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rules (
  rule_id      TEXT PRIMARY KEY,
  keyword      TEXT NOT NULL,
  match_type   TEXT NOT NULL DEFAULT 'contains'
               CHECK (match_type IN ('exact','contains','startswith','regex')),
  public_reply TEXT,
  dm_message   TEXT,
  media_scope  TEXT NOT NULL DEFAULT 'all',
  enabled      INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  priority     INTEGER NOT NULL DEFAULT 100,
  source       TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local','cloud')),
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
-- comment watcher loads the enabled set in priority order on every poll
CREATE INDEX IF NOT EXISTS idx_rules_enabled ON rules (enabled, priority);

-- ---------------------------------------------------------------------------
-- sync_state : per-collector, per-account cursors. This is what makes every
-- collector incremental and restartable.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sync_state (
  collector          TEXT NOT NULL,
  ig_user_id         TEXT NOT NULL,
  cursor             TEXT,
  cursor_time        INTEGER,
  last_run_at        INTEGER,
  last_success_at    INTEGER,
  last_error         TEXT,
  consecutive_errors INTEGER NOT NULL DEFAULT 0,
  items_seen         INTEGER NOT NULL DEFAULT 0,
  backfill_complete  INTEGER NOT NULL DEFAULT 0 CHECK (backfill_complete IN (0,1)),
  state              TEXT,
  updated_at         INTEGER NOT NULL,
  PRIMARY KEY (collector, ig_user_id)
);

-- ---------------------------------------------------------------------------
-- audit_log : every API call and every message. Local, forever (F62).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,
  scope        TEXT NOT NULL,
  action       TEXT NOT NULL,
  actor        TEXT NOT NULL DEFAULT 'agent' CHECK (actor IN ('agent','human','system')),
  ig_user_id   TEXT,
  subject_type TEXT,
  subject_id   TEXT,
  outcome      TEXT NOT NULL DEFAULT 'ok'
               CHECK (outcome IN ('ok','error','blocked','dry_run','skipped')),
  http_status  INTEGER,
  error_code   TEXT,
  detail       TEXT
);
-- console audit view: newest first, optionally filtered by scope or subject
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_scope_ts ON audit_log (scope, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_subject ON audit_log (subject_type, subject_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_outcome ON audit_log (outcome, ts DESC);

-- ---------------------------------------------------------------------------
-- upload_queue : pending cloud uploads (A9). The local DB is authoritative;
-- a failed upload is a retry, never a data loss.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS upload_queue (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint         TEXT NOT NULL,
  method           TEXT NOT NULL DEFAULT 'POST',
  payload          TEXT NOT NULL,
  idempotency_key  TEXT UNIQUE,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','inflight','done','failed','dead')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  INTEGER NOT NULL,
  last_error       TEXT,
  last_status_code INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL,
  completed_at     INTEGER
);
-- uploader drains due rows oldest-first
CREATE INDEX IF NOT EXISTS idx_upload_queue_due ON upload_queue (status, next_attempt_at, id);
`;

/** Table list used by the migration self-check and by `ig-agent doctor`. */
export const CONTRACT_TABLES = [
  'accounts', 'tokens', 'media', 'media_metrics', 'account_metrics',
  'conversations', 'messages', 'comments', 'enquiries', 'drafts',
  'outbox', 'rules', 'sync_state', 'audit_log', 'upload_queue',
];
