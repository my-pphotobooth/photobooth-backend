-- Up Migration

-- 색 없는 기본 규격(레이아웃)
CREATE TABLE basic_layouts (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  layout      JSONB NOT NULL,
  footer_text TEXT NOT NULL DEFAULT 'my-photobooth',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX basic_layouts_sort_idx ON basic_layouts (sort_order);

-- 편집 단계에서 고르는 색 세트
CREATE TABLE color_chips (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  background_color TEXT NOT NULL,
  slot_color       TEXT NOT NULL,
  text_color       TEXT NOT NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX color_chips_sort_idx ON color_chips (sort_order);

-- 기본 규격+칩 방식으로 동작하는 카테고리 표시
ALTER TABLE frame_categories ADD COLUMN is_basic BOOLEAN NOT NULL DEFAULT false;

UPDATE frame_categories SET is_basic = true WHERE id = 'basic';

-- 규격 3종 시드
INSERT INTO basic_layouts (id, name, layout, footer_text, sort_order) VALUES
  ('strip-4', '말랭이', '{
    "canvas": { "width": 600, "height": 1900 },
    "shotCount": 8,
    "slots": [
      { "x": 40, "y": 60,   "width": 520, "height": 390, "shape": "rect", "radius": 0 },
      { "x": 40, "y": 470,  "width": 520, "height": 390, "shape": "rect", "radius": 0 },
      { "x": 40, "y": 880,  "width": 520, "height": 390, "shape": "rect", "radius": 0 },
      { "x": 40, "y": 1290, "width": 520, "height": 390, "shape": "rect", "radius": 0 }
    ]
  }'::jsonb, 'my-photobooth', 0),
  ('grid-4', '뚱땡이', '{
    "canvas": { "width": 1200, "height": 1900 },
    "shotCount": 8,
    "slots": [
      { "x": 45,  "y": 210, "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 610, "y": 210, "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 45,  "y": 960, "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 610, "y": 960, "width": 545, "height": 730, "shape": "rect", "radius": 0 }
    ]
  }'::jsonb, 'my-photobooth', 1),
  ('grid-4-offset', '삐뚤 뚱땡이', '{
    "canvas": { "width": 1200, "height": 1900 },
    "shotCount": 8,
    "slots": [
      { "x": 45,  "y": 270,  "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 610, "y": 151,  "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 45,  "y": 1020, "width": 545, "height": 730, "shape": "rect", "radius": 0 },
      { "x": 610, "y": 901,  "width": 545, "height": 730, "shape": "rect", "radius": 0 }
    ]
  }'::jsonb, 'my-photobooth', 2);

-- 컬러칩 시드 (기존 basic-white/black 색 이관)
INSERT INTO color_chips (id, name, background_color, slot_color, text_color, sort_order) VALUES
  ('white', '화이트', '#ffffff', '#e5e7eb', '#1f2937', 0),
  ('black', '블랙',   '#18181b', '#3f3f46', '#f4f4f5', 1);

-- Down Migration

ALTER TABLE frame_categories DROP COLUMN is_basic;
DROP TABLE color_chips;
DROP TABLE basic_layouts;
