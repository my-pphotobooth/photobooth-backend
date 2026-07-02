-- Up Migration

CREATE TABLE tape_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tape_categories_sort_idx ON tape_categories (sort_order);

-- 기본 분류 시드
INSERT INTO tape_categories (id, name, sort_order) VALUES ('basic', '기본', 0);

-- 테이프에 분류 연결 + 기존 테이프 backfill
ALTER TABLE tapes
  ADD COLUMN category_id TEXT REFERENCES tape_categories(id) ON DELETE RESTRICT;

UPDATE tapes SET category_id = 'basic' WHERE category_id IS NULL;

ALTER TABLE tapes ALTER COLUMN category_id SET NOT NULL;

CREATE INDEX tapes_category_sort_idx ON tapes (category_id, sort_order);

-- Down Migration

DROP INDEX tapes_category_sort_idx;
ALTER TABLE tapes DROP COLUMN category_id;
DROP TABLE tape_categories;
