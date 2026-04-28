-- Add columns to videos table for 7-stage pipeline
ALTER TABLE videos ADD COLUMN IF NOT EXISTS scene_plan jsonb;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS character_reference_url text;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS assembly_path text;

-- Add columns to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS character_reference_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS voice_reference_url text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hooks_library text[] DEFAULT '{}';

-- Pipeline logs table for granular per-stage tracking
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      uuid REFERENCES videos(id) ON DELETE CASCADE,
  stage         integer NOT NULL,
  stage_name    text NOT NULL,
  status        text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  duration_ms   integer,
  error_message text,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_logs_video_id ON pipeline_logs(video_id);

-- RLS for pipeline_logs (users can only see their own video logs)
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pipeline logs"
  ON pipeline_logs FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

-- Service role can insert logs (pipeline runs as service role)
CREATE POLICY "Service role can insert pipeline logs"
  ON pipeline_logs FOR INSERT
  WITH CHECK (true);
