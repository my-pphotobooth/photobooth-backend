-- Up Migration
-- 슬롯 위치는 그대로 두고 캔버스 높이만 1800 -> 1950 (하단 여백 확장)

UPDATE frames
SET layout = jsonb_set(layout, '{canvas,height}', '1950'::jsonb)
WHERE layout->'canvas'->>'height' = '1800';

-- Down Migration

UPDATE frames
SET layout = jsonb_set(layout, '{canvas,height}', '1800'::jsonb)
WHERE layout->'canvas'->>'height' = '1950';
