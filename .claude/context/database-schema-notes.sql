-- AI Video Flow Platform — Database Schema Reference
-- This file is the source of truth for the DB structure.
-- Always refer to this before writing any Supabase query.

-- TABLES
-- profiles           (1:1 with auth.users)
-- projects           (N:1 with profiles)
-- product_images     (N:1 with projects)
-- credits            (1:1 with profiles)
-- credit_transactions (N:1 with profiles)
-- videos             (N:1 with projects)

-- KEY RELATIONSHIPS
-- profiles.id = auth.users.id
-- projects.user_id = profiles.id
-- product_images.project_id = projects.id
-- product_images.user_id = profiles.id
-- credits.user_id = profiles.id (unique)
-- credit_transactions.user_id = profiles.id
-- videos.project_id = projects.id
-- videos.user_id = profiles.id

-- VIDEO STATUS VALUES
-- 'pending' | 'generating' | 'processing' | 'uploading' | 'captioning' | 'posting' | 'done' | 'failed'

-- CREDIT TRANSACTION REASONS
-- 'signup_bonus' | 'purchase' | 'video_generated' | 'refund'

-- CONTENT TYPES
-- 'informative' | 'viral' | 'shocking' | 'emotional' | 'transformation' | 'humor' | 'sales'

-- POSTING FREQUENCY
-- 'daily' | 'manual'

-- POSTING TIME
-- 'morning' (8-10 AM) | 'afternoon' (12-2 PM) | 'evening' (6-8 PM)
-- All times in Mexico City timezone (UTC-6)

-- CREDIT MATH
-- 1 video = 30 credits
-- $10 USD = 60 credits (Starter)
-- $20 USD = 150 credits (Growth)
-- $40 USD = 360 credits (Pro)
-- New user signup = 30 credits free (1 video)

-- RLS: ALL tables have RLS enabled
-- Rule: auth.uid() = user_id on every operation
-- Exception: webhook route uses service_role_key to bypass RLS
