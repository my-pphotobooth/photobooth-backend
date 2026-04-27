-- Up Migration

CREATE TABLE frames (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  category_id      TEXT NOT NULL REFERENCES frame_categories(id) ON DELETE RESTRICT,
  background_color TEXT NOT NULL,
  text_color       TEXT NOT NULL,
  footer_text      TEXT NOT NULL,
  overlays         JSONB,
  available_from   TIMESTAMPTZ,
  available_until  TIMESTAMPTZ,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX frames_category_sort_idx ON frames (category_id, sort_order);

-- Down Migration

DROP TABLE frames;
