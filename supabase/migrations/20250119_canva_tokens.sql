-- Create canva_tokens table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS public.canva_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.canva_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own tokens" ON public.canva_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.canva_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.canva_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.canva_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_canva_tokens_user_id ON public.canva_tokens(user_id);

-- Create updated_at trigger
CREATE TRIGGER update_canva_tokens_updated_at
  BEFORE UPDATE ON public.canva_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();