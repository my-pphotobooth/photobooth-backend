-- Up Migration

ALTER TABLE frames ADD COLUMN slot_color TEXT;

UPDATE frames
SET slot_color = CASE
  WHEN background_color = '#ffffff' THEN '#e5e7eb'
  ELSE '#3f3f46'
END;

ALTER TABLE frames ALTER COLUMN slot_color SET NOT NULL;

-- Down Migration

ALTER TABLE frames DROP COLUMN slot_color;
