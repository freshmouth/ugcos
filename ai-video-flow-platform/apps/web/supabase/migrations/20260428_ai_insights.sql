CREATE TABLE IF NOT EXISTS ai_insights (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  insight    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own insights" ON ai_insights
  FOR SELECT USING (auth.uid() = user_id);
