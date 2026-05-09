ALTER TABLE insights ADD COLUMN IF NOT EXISTS video_breakdowns jsonb DEFAULT '[]';
