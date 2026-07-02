-- Up Migration
-- 예전 프레임 layout에 shotCount가 없으면 기본값(max(8, 슬롯수))을 채운다.
-- getShotCount 폴백과 동일하게 맞춰 편집기/부스 촬영 횟수 불일치 제거.

UPDATE frames
SET layout = jsonb_set(
  layout,
  '{shotCount}',
  to_jsonb(GREATEST(8, jsonb_array_length(layout->'slots')))
)
WHERE layout->'shotCount' IS NULL;

-- Down Migration

UPDATE frames
SET layout = layout - 'shotCount';
