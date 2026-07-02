-- Up Migration
-- 슬롯 위치는 그대로 두고 캔버스 높이만 1950 -> 1900

UPDATE frames
SET layout = jsonb_set(layout, '{canvas,height}', '1900'::jsonb)
WHERE layout->'canvas'->>'height' = '1950';

-- Down Migration

UPDATE frames
SET layout = jsonb_set(layout, '{canvas,height}', '1950'::jsonb)
WHERE layout->'canvas'->>'height' = '1900';
