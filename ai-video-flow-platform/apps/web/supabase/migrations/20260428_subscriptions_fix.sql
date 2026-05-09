-- ─────────────────────────────────────────────────────────────────────────────
-- Subscriptions fix — run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add videos_limit column (nullable = unlimited for scale tier)
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS videos_limit integer;

-- Set defaults from tier
UPDATE subscriptions SET videos_limit = 30  WHERE tier = 'starter' AND videos_limit IS NULL;
UPDATE subscriptions SET videos_limit = 60  WHERE tier = 'growth'  AND videos_limit IS NULL;
UPDATE subscriptions SET videos_limit = NULL WHERE tier = 'scale'  AND videos_limit IS NULL;

-- ── Auto-create a starter subscription for users who don't have one ──────────
-- Run this to create a dev/test subscription for your user:
-- INSERT INTO subscriptions (user_id, tier, status, videos_limit, videos_used_this_cycle)
-- VALUES ('<YOUR_USER_UUID>', 'starter', 'active', 30, 0)
-- ON CONFLICT (user_id) DO NOTHING;

-- Helper function to upsert a dev subscription (call from SQL editor)
CREATE OR REPLACE FUNCTION create_dev_subscription(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO subscriptions (
    user_id, tier, status, videos_limit, videos_used_this_cycle,
    cycle_reset_date, created_at, updated_at
  ) VALUES (
    p_user_id, 'starter', 'active', 30, 0,
    (now() + interval '30 days')::date, now(), now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'active',
    updated_at = now();
END;
$$;
