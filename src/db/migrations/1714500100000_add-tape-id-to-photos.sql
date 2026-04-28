-- Up Migration

ALTER TABLE photos
  ADD COLUMN tape_id TEXT REFERENCES tapes(id) ON DELETE SET NULL;

CREATE INDEX photos_tape_id_idx ON photos (tape_id) WHERE tape_id IS NOT NULL;

-- Down Migration

ALTER TABLE photos DROP COLUMN tape_id;
