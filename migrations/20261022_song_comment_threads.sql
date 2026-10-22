ALTER TABLE song_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid NULL,
  ADD COLUMN IF NOT EXISTS timestamp_seconds integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'song_comments_parent_fk'
  ) THEN
    ALTER TABLE song_comments
      ADD CONSTRAINT song_comments_parent_fk
      FOREIGN KEY (parent_comment_id)
      REFERENCES song_comments(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'song_comments_timestamp_seconds_check'
  ) THEN
    ALTER TABLE song_comments
      ADD CONSTRAINT song_comments_timestamp_seconds_check
      CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_song_comments_parent_comment_id
  ON song_comments(parent_comment_id);
