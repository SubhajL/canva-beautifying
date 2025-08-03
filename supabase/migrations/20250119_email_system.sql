-- Email preferences table
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enhancement_completed BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  weekly_digest BOOLEAN DEFAULT true,
  system_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Email logs table for tracking deliveries
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  success BOOLEAN NOT NULL,
  message_id VARCHAR(255),
  error TEXT,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email templates table for dynamic content
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  variables JSONB, -- List of required variables for this template
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scheduled emails table
CREATE TABLE IF NOT EXISTS public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  email_type VARCHAR(50) NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  data JSONB NOT NULL, -- Template data
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_preferences_user_id ON public.email_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON public.email_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_scheduled_for ON public.scheduled_emails(scheduled_for) WHERE sent = false;

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies for email preferences
CREATE POLICY "Users can view own email preferences" ON public.email_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own email preferences" ON public.email_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert email preferences" ON public.email_preferences
  FOR INSERT WITH CHECK (true); -- Service role can insert

-- RLS policies for email logs
CREATE POLICY "Users can view own email logs" ON public.email_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true); -- Service role can insert

-- RLS policies for scheduled emails
CREATE POLICY "Users can view own scheduled emails" ON public.scheduled_emails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage scheduled emails" ON public.scheduled_emails
  FOR ALL USING (true); -- Service role has full access

-- Function to automatically create email preferences for new users
CREATE OR REPLACE FUNCTION create_email_preferences_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.email_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create email preferences when a new user is created
CREATE TRIGGER create_email_preferences_on_user_insert
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_email_preferences_for_user();

-- Function to get email delivery stats
CREATE OR REPLACE FUNCTION get_email_delivery_stats(
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  email_type VARCHAR,
  total_sent BIGINT,
  successful BIGINT,
  failed BIGINT,
  success_rate DECIMAL,
  opened BIGINT,
  open_rate DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.email_type,
    COUNT(*) as total_sent,
    COUNT(*) FILTER (WHERE el.success = true) as successful,
    COUNT(*) FILTER (WHERE el.success = false) as failed,
    ROUND(COUNT(*) FILTER (WHERE el.success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100, 2) as success_rate,
    COUNT(*) FILTER (WHERE el.opened_at IS NOT NULL) as opened,
    ROUND(COUNT(*) FILTER (WHERE el.opened_at IS NOT NULL)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE el.success = true), 0) * 100, 2) as open_rate
  FROM public.email_logs el
  WHERE el.sent_at >= CURRENT_DATE - INTERVAL '1 day' * p_days
  GROUP BY el.email_type
  ORDER BY total_sent DESC;
END;
$$;

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, description, variables) VALUES
  ('enhancement-completed', 'Your enhanced document is ready!', 'Sent when document enhancement is completed', 
   '{"required": ["userName", "documentName", "enhancementUrl", "processingTime", "improvementScore"], "optional": ["originalPreviewUrl", "enhancedPreviewUrl"]}'::jsonb),
  
  ('welcome', 'Welcome to BeautifyAI!', 'Sent when a new user signs up',
   '{"required": ["userName", "userTier", "monthlyCredits"], "optional": []}'::jsonb),
  
  ('password-reset', 'Reset your BeautifyAI password', 'Sent when user requests password reset',
   '{"required": ["userName", "resetUrl"], "optional": ["ipAddress", "userAgent"]}'::jsonb),
  
  ('subscription-created', 'Welcome to BeautifyAI Premium!', 'Sent when user upgrades subscription',
   '{"required": ["userName", "planName", "monthlyCredits", "amount", "billingCycle", "nextBillingDate"], "optional": ["invoiceUrl"]}'::jsonb)
ON CONFLICT (name) DO NOTHING;