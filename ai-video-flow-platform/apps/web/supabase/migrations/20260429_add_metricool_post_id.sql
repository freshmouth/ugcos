-- Add metricool_post_id to videos so hover-play can match our generated video to its Metricool post
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS metricool_post_id text;

CREATE INDEX IF NOT EXISTS idx_videos_metricool_post_id ON videos(metricool_post_id);
