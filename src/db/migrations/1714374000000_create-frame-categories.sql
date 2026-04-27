-- Up Migration

CREATE TABLE frame_categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX frame_categories_sort_order_idx ON frame_categories (sort_order);

-- Down Migration

DROP TABLE frame_categories;
