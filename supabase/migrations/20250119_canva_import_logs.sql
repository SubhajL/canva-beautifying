-- Create canva_import_logs table for tracking import attempts
CREATE TABLE IF NOT EXISTS public.canva_import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  design_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'api_failed', 'manual_required')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.canva_import_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own import logs" ON public.canva_import_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import logs" ON public.canva_import_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for faster lookups
CREATE INDEX idx_canva_import_logs_user_id ON public.canva_import_logs(user_id);
CREATE INDEX idx_canva_import_logs_design_id ON public.canva_import_logs(design_id);
CREATE INDEX idx_canva_import_logs_timestamp ON public.canva_import_logs(timestamp DESC);