-- Create model selection logs table for tracking AI model selection decisions
CREATE TABLE IF NOT EXISTS public.model_selection_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL,
  selected_model VARCHAR(100) NOT NULL,
  user_tier subscription_tier NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  document_complexity VARCHAR(20) NOT NULL,
  processing_priority VARCHAR(20) NOT NULL,
  selection_reason TEXT,
  alternative_models TEXT[],
  experiment_group VARCHAR(50),
  success BOOLEAN NOT NULL,
  response_time INTEGER,
  tokens_used INTEGER,
  cost DECIMAL(10, 6),
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_model_selection_logs_user_id ON public.model_selection_logs(user_id);
CREATE INDEX idx_model_selection_logs_model ON public.model_selection_logs(selected_model);
CREATE INDEX idx_model_selection_logs_created_at ON public.model_selection_logs(created_at);
CREATE INDEX idx_model_selection_logs_experiment ON public.model_selection_logs(experiment_group) WHERE experiment_group IS NOT NULL;

-- Enable RLS
ALTER TABLE public.model_selection_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own model selection logs" ON public.model_selection_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Admin users can view all logs (based on email in metadata)
CREATE POLICY "Admins can view all model selection logs" ON public.model_selection_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = ANY(string_to_array(current_setting('app.admin_emails', true), ','))
    )
  );

-- Add AI usage tracking table if not exists
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  model VARCHAR(100) NOT NULL,
  document_id TEXT,
  tokens_used INTEGER NOT NULL,
  cost DECIMAL(10, 6) NOT NULL,
  purpose VARCHAR(50), -- 'analysis', 'enhancement', 'generation'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for AI usage tracking
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON public.ai_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model ON public.ai_usage_tracking(model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage_tracking(created_at);

-- Enable RLS for AI usage tracking
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies for AI usage tracking
CREATE POLICY "Users can view own AI usage" ON public.ai_usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert AI usage" ON public.ai_usage_tracking
  FOR INSERT WITH CHECK (true); -- Service role can insert

-- Function to get user's AI usage stats
CREATE OR REPLACE FUNCTION get_user_ai_usage_stats(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_tokens BIGINT,
  total_cost DECIMAL,
  model_breakdown JSONB,
  daily_usage JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH usage_data AS (
    SELECT 
      model,
      DATE(created_at) as usage_date,
      SUM(tokens_used) as daily_tokens,
      SUM(cost) as daily_cost
    FROM public.ai_usage_tracking
    WHERE user_id = p_user_id
      AND created_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
    GROUP BY model, DATE(created_at)
  ),
  model_summary AS (
    SELECT 
      model,
      SUM(daily_tokens) as total_tokens,
      SUM(daily_cost) as total_cost
    FROM usage_data
    GROUP BY model
  ),
  daily_summary AS (
    SELECT 
      usage_date,
      SUM(daily_tokens) as tokens,
      SUM(daily_cost) as cost
    FROM usage_data
    GROUP BY usage_date
    ORDER BY usage_date DESC
  )
  SELECT 
    COALESCE(SUM(ms.total_tokens), 0) as total_tokens,
    COALESCE(SUM(ms.total_cost), 0) as total_cost,
    COALESCE(jsonb_object_agg(ms.model, jsonb_build_object('tokens', ms.total_tokens, 'cost', ms.total_cost)), '{}'::jsonb) as model_breakdown,
    COALESCE(jsonb_agg(jsonb_build_object('date', ds.usage_date, 'tokens', ds.tokens, 'cost', ds.cost)), '[]'::jsonb) as daily_usage
  FROM model_summary ms
  CROSS JOIN (SELECT * FROM daily_summary) ds
  GROUP BY ds.usage_date, ds.tokens, ds.cost;
END;
$$;