-- ─────────────────────────────────────────────────────────────────────────────
-- Pipeline migration — run this in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add new columns to videos table
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS scene_plan jsonb,
  ADD COLUMN IF NOT EXISTS character_reference_url text,
  ADD COLUMN IF NOT EXISTS assembly_path text;

-- Add new columns to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS character_reference_url text,
  ADD COLUMN IF NOT EXISTS voice_reference_url text,
  ADD COLUMN IF NOT EXISTS hooks_library text[] DEFAULT '{}';

-- Create pipeline_logs table
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      uuid REFERENCES videos(id) ON DELETE CASCADE,
  stage         integer NOT NULL CHECK (stage BETWEEN 1 AND 7),
  stage_name    text NOT NULL,
  status        text NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  duration_ms   integer,
  error_message text,
  metadata      jsonb,
  created_at    timestamptz DEFAULT now()
);

-- Index for realtime dashboard queries
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_video_id ON pipeline_logs(video_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at ON pipeline_logs(created_at DESC);

-- RLS on pipeline_logs — users can only read their own video's logs
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own pipeline logs"
  ON pipeline_logs FOR SELECT
  USING (
    video_id IN (
      SELECT id FROM videos WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert pipeline logs"
  ON pipeline_logs FOR INSERT
  WITH CHECK (true);

-- Create subscriptions table (replaces credits system)
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  tier                    text NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth', 'scale')),
  stripe_subscription_id  text,
  stripe_customer_id      text,
  videos_used_this_cycle  integer NOT NULL DEFAULT 0,
  cycle_reset_date        date,
  status                  text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Helper RPC: increment videos_used counter
CREATE OR REPLACE FUNCTION increment_videos_used(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET
    videos_used_this_cycle = videos_used_this_cycle + 1,
    updated_at = now()
  WHERE user_id = p_user_id AND status = 'active';
END;
$$;

-- Helper: reset video quota on cycle date (called by cron or Stripe webhook)
CREATE OR REPLACE FUNCTION reset_video_quota(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE subscriptions
  SET
    videos_used_this_cycle = 0,
    cycle_reset_date = (now() + interval '1 month')::date,
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Update video status values to include new pipeline stages
-- (no schema change needed — status is text, new values just work)
-- New statuses: 'analyzing' | 'scripting' | 'generating_images' | 'generating_video' | 'assembling'
-- Previous statuses still valid: 'pending' | 'generating' | 'processing' | 'uploading' | 'captioning' | 'posting' | 'done' | 'failed'
