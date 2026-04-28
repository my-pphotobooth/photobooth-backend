-- Up Migration

CREATE TABLE tapes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  filename    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tapes_active_sort_idx ON tapes (active, sort_order);

-- Down Migration

DROP TABLE tapes;
