-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'premium');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE enhancement_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  subscription_tier subscription_tier DEFAULT 'free',
  subscription_status subscription_status DEFAULT 'active',
  usage_count INTEGER DEFAULT 0,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhancements table
CREATE TABLE public.enhancements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  original_key TEXT NOT NULL,
  enhanced_url TEXT,
  enhanced_key TEXT,
  status enhancement_status DEFAULT 'pending',
  analysis_data JSONB,
  enhancement_data JSONB,
  model_used VARCHAR(100),
  processing_time INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enhancement assets table
CREATE TABLE public.enhancement_assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  enhancement_id UUID NOT NULL REFERENCES public.enhancements(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL,
  asset_url TEXT NOT NULL,
  asset_key TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enhancement_id UUID REFERENCES public.enhancements(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  credits_used INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription limits table
CREATE TABLE public.subscription_limits (
  tier subscription_tier PRIMARY KEY,
  monthly_credits INTEGER NOT NULL,
  max_file_size_mb INTEGER NOT NULL,
  batch_size INTEGER NOT NULL,
  features JSONB NOT NULL
);

-- Insert subscription tier limits
INSERT INTO public.subscription_limits (tier, monthly_credits, max_file_size_mb, batch_size, features) VALUES
  ('free', 10, 10, 1, '{"models": ["gemini-2.0-flash"], "export_formats": ["png", "jpg"], "priority": "low"}'),
  ('basic', 100, 25, 5, '{"models": ["gemini-2.0-flash", "gpt-4.1-mini"], "export_formats": ["png", "jpg", "pdf"], "priority": "medium"}'),
  ('pro', 500, 50, 10, '{"models": ["gemini-2.0-flash", "gpt-4.1-mini", "claude-3.5-sonnet"], "export_formats": ["png", "jpg", "pdf", "canva"], "priority": "high"}'),
  ('premium', 2000, 50, 10, '{"models": ["all"], "export_formats": ["all"], "priority": "highest", "api_access": true}');

-- Row Level Security (RLS) Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhancements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhancement_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Enhancements policies
CREATE POLICY "Users can view own enhancements" ON public.enhancements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own enhancements" ON public.enhancements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enhancements" ON public.enhancements
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own enhancements" ON public.enhancements
  FOR DELETE USING (auth.uid() = user_id);

-- Enhancement assets policies
CREATE POLICY "Users can view assets of own enhancements" ON public.enhancement_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.enhancements
      WHERE enhancements.id = enhancement_assets.enhancement_id
      AND enhancements.user_id = auth.uid()
    )
  );

-- Usage tracking policies
CREATE POLICY "Users can view own usage" ON public.usage_tracking
  FOR SELECT USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check usage limits
CREATE OR REPLACE FUNCTION public.check_usage_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_tier subscription_tier;
  v_monthly_credits INTEGER;
  v_current_usage INTEGER;
  v_month_start DATE;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO v_tier
  FROM public.users
  WHERE id = p_user_id;
  
  -- Get monthly credit limit
  SELECT monthly_credits INTO v_monthly_credits
  FROM public.subscription_limits
  WHERE tier = v_tier;
  
  -- Calculate start of current month
  v_month_start := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Get current month usage
  SELECT COALESCE(SUM(credits_used), 0) INTO v_current_usage
  FROM public.usage_tracking
  WHERE user_id = p_user_id
  AND created_at >= v_month_start;
  
  -- Return true if under limit
  RETURN v_current_usage < v_monthly_credits;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id UUID,
  p_enhancement_id UUID DEFAULT NULL,
  p_action VARCHAR DEFAULT 'enhancement',
  p_credits INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Insert usage record
  INSERT INTO public.usage_tracking (user_id, enhancement_id, action, credits_used)
  VALUES (p_user_id, p_enhancement_id, p_action, p_credits);
  
  -- Update user usage count
  UPDATE public.users
  SET usage_count = usage_count + p_credits,
      updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX idx_users_subscription ON public.users(subscription_tier, subscription_status);
CREATE INDEX idx_enhancements_user_id ON public.enhancements(user_id);
CREATE INDEX idx_enhancements_status ON public.enhancements(status);
CREATE INDEX idx_enhancements_created_at ON public.enhancements(created_at);
CREATE INDEX idx_enhancements_user_created ON public.enhancements(user_id, created_at DESC);
CREATE INDEX idx_enhancement_assets_enhancement_id ON public.enhancement_assets(enhancement_id);
CREATE INDEX idx_enhancement_assets_asset_type ON public.enhancement_assets(asset_type);
CREATE INDEX idx_usage_tracking_user_usage ON public.usage_tracking(user_id, created_at);
CREATE INDEX idx_usage_tracking_action ON public.usage_tracking(action);
CREATE INDEX idx_usage_tracking_month ON public.usage_tracking(user_id, created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.enhancements;