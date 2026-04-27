-- Up Migration

ALTER TABLE photos
  ADD COLUMN frame_id TEXT REFERENCES frames(id) ON DELETE SET NULL;

CREATE INDEX photos_frame_id_idx ON photos (frame_id) WHERE frame_id IS NOT NULL;

-- Down Migration

ALTER TABLE photos DROP COLUMN frame_id;
