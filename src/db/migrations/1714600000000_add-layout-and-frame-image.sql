-- Up Migration

ALTER TABLE frames ADD COLUMN layout JSONB;
ALTER TABLE frames ADD COLUMN frame_image_url TEXT;

-- 기존 프레임에 현재 고정 레이아웃(600x1800, 4슬롯)을 backfill
UPDATE frames
SET layout = '{
  "canvas": { "width": 600, "height": 1800 },
  "slots": [
    { "x": 40, "y": 60,   "width": 520, "height": 390, "shape": "rect", "radius": 0 },
    { "x": 40, "y": 470,  "width": 520, "height": 390, "shape": "rect", "radius": 0 },
    { "x": 40, "y": 880,  "width": 520, "height": 390, "shape": "rect", "radius": 0 },
    { "x": 40, "y": 1290, "width": 520, "height": 390, "shape": "rect", "radius": 0 }
  ]
}'::jsonb
WHERE layout IS NULL;

ALTER TABLE frames ALTER COLUMN layout SET NOT NULL;

-- Down Migration

ALTER TABLE frames DROP COLUMN frame_image_url;
ALTER TABLE frames DROP COLUMN layout;
