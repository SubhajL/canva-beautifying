-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_ai_usage_user_id ON public.ai_usage_tracking(user_id);
CREATE INDEX idx_ai_usage_document_id ON public.ai_usage_tracking(document_id);
CREATE INDEX idx_ai_usage_created_at ON public.ai_usage_tracking(created_at);
CREATE INDEX idx_ai_usage_model ON public.ai_usage_tracking(model);

-- Add RLS policies
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own AI usage" ON public.ai_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can insert usage records
CREATE POLICY "Service role can insert AI usage" ON public.ai_usage_tracking
  FOR INSERT WITH CHECK (true);

-- Create a view for aggregated usage statistics
CREATE OR REPLACE VIEW public.ai_usage_summary AS
SELECT 
  user_id,
  model,
  DATE_TRUNC('day', created_at) as usage_date,
  COUNT(*) as request_count,
  SUM(tokens_used) as total_tokens,
  SUM(cost) as total_cost
FROM public.ai_usage_tracking
GROUP BY user_id, model, DATE_TRUNC('day', created_at);

-- Grant access to the view
GRANT SELECT ON public.ai_usage_summary TO authenticated;