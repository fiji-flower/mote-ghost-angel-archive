-- Ghost Angel Archive — one table for rituals, one for Ko-fi orders.
-- Optional: the Worker runs these statements itself on the first request.
-- Only needed by hand:
--   npx wrangler d1 execute ghost-angel-archive --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS rituals (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  spirit      TEXT NOT NULL DEFAULT '',
  answers     TEXT NOT NULL DEFAULT '[]',
  palette     TEXT NOT NULL DEFAULT '[]',
  gift        INTEGER NOT NULL DEFAULT 0,
  gift_for    TEXT NOT NULL DEFAULT '',
  gift_about  TEXT NOT NULL DEFAULT '',
  whisper     TEXT NOT NULL DEFAULT '',
  avoid       TEXT NOT NULL DEFAULT '',
  is_public   INTEGER NOT NULL DEFAULT 0,
  ip_hash     TEXT NOT NULL DEFAULT '',
  order_id    TEXT
);

CREATE INDEX IF NOT EXISTS rituals_created ON rituals (created_at DESC);
CREATE INDEX IF NOT EXISTS rituals_public ON rituals (is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS rituals_open ON rituals (order_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id          TEXT PRIMARY KEY,
  kofi_id     TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  amount      TEXT NOT NULL DEFAULT '',
  currency    TEXT NOT NULL DEFAULT '',
  from_name   TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  message     TEXT NOT NULL DEFAULT '',
  item_code   TEXT NOT NULL DEFAULT '',
  ritual_id   TEXT,
  match_kind  TEXT
);

CREATE INDEX IF NOT EXISTS orders_created ON orders (created_at DESC);
