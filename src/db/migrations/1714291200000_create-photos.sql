-- Up Migration

CREATE TABLE photos (
  id          TEXT PRIMARY KEY,
  filename    TEXT NOT NULL,
  mime_type   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX photos_created_at_idx ON photos (created_at DESC) WHERE deleted_at IS NULL;

-- Down Migration

DROP TABLE photos;
