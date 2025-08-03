-- Add beta user fields to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS is_beta_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS beta_joined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS beta_invitation_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS beta_referral_source TEXT,
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS beta_feedback_count INTEGER DEFAULT 0;

-- Create index for beta users
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_beta_user ON user_profiles(is_beta_user);
CREATE INDEX IF NOT EXISTS idx_user_profiles_beta_invitation_code ON user_profiles(beta_invitation_code);

-- Create beta feedback table
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT CHECK (feedback_type IN ('bug', 'feature', 'improvement', 'general')),
  category TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  browser_info JSONB,
  attachments JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'wont_fix')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  admin_notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for feedback
CREATE INDEX idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX idx_beta_feedback_created_at ON beta_feedback(created_at);
CREATE INDEX idx_beta_feedback_feedback_type ON beta_feedback(feedback_type);

-- RLS for beta feedback
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON beta_feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own feedback
CREATE POLICY "Users can create own feedback" ON beta_feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending feedback
CREATE POLICY "Users can update own pending feedback" ON beta_feedback
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Create beta analytics table
CREATE TABLE IF NOT EXISTS beta_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_category TEXT,
  event_action TEXT,
  event_label TEXT,
  event_value NUMERIC,
  page_url TEXT,
  session_id TEXT,
  user_agent TEXT,
  browser_info JSONB,
  device_info JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX idx_beta_analytics_user_id ON beta_analytics(user_id);
CREATE INDEX idx_beta_analytics_event_type ON beta_analytics(event_type);
CREATE INDEX idx_beta_analytics_created_at ON beta_analytics(created_at);
CREATE INDEX idx_beta_analytics_session_id ON beta_analytics(session_id);

-- Create beta invitations table
CREATE TABLE IF NOT EXISTS beta_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'accepted', 'expired')),
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

-- Create indexes for invitations
CREATE INDEX idx_beta_invitations_code ON beta_invitations(code);
CREATE INDEX idx_beta_invitations_status ON beta_invitations(status);
CREATE INDEX idx_beta_invitations_email ON beta_invitations(email);

-- Function to validate beta invitation
CREATE OR REPLACE FUNCTION validate_beta_invitation(
  p_code TEXT,
  p_email TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM beta_invitations
  WHERE code = p_code
    AND status IN ('pending', 'sent')
    AND (expires_at IS NULL OR expires_at > NOW())
    AND used_count < max_uses;
    
  IF v_invitation IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if email matches (if specified)
  IF p_email IS NOT NULL AND v_invitation.email IS NOT NULL THEN
    IF LOWER(p_email) != LOWER(v_invitation.email) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept beta invitation
CREATE OR REPLACE FUNCTION accept_beta_invitation(
  p_code TEXT,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Validate invitation
  SELECT * INTO v_invitation
  FROM beta_invitations
  WHERE code = p_code
    AND status IN ('pending', 'sent')
    AND (expires_at IS NULL OR expires_at > NOW())
    AND used_count < max_uses
  FOR UPDATE;
    
  IF v_invitation IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update invitation
  UPDATE beta_invitations
  SET used_count = used_count + 1,
      status = CASE WHEN used_count + 1 >= max_uses THEN 'accepted' ELSE status END,
      used_at = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{accepted_by}',
        to_jsonb(array_append(
          COALESCE((metadata->>'accepted_by')::uuid[], ARRAY[]::uuid[]),
          p_user_id
        ))
      )
  WHERE id = v_invitation.id;
  
  -- Update user profile
  UPDATE user_profiles
  SET is_beta_user = TRUE,
      beta_joined_at = NOW(),
      beta_invitation_code = p_code,
      beta_referral_source = COALESCE(v_invitation.metadata->>'source', 'invitation')
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track beta analytics
CREATE OR REPLACE FUNCTION track_beta_analytics(
  p_user_id UUID,
  p_event_type TEXT,
  p_event_category TEXT DEFAULT NULL,
  p_event_action TEXT DEFAULT NULL,
  p_event_label TEXT DEFAULT NULL,
  p_event_value NUMERIC DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO beta_analytics (
    user_id,
    event_type,
    event_category,
    event_action,
    event_label,
    event_value,
    metadata
  ) VALUES (
    p_user_id,
    p_event_type,
    p_event_category,
    p_event_action,
    p_event_label,
    p_event_value,
    p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for beta user statistics
CREATE OR REPLACE VIEW beta_user_stats AS
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  p.is_beta_user,
  p.beta_joined_at,
  p.beta_invitation_code,
  p.beta_referral_source,
  p.beta_feedback_count,
  COUNT(DISTINCT d.id) as documents_created,
  COUNT(DISTINCT e.id) as enhancements_completed,
  COUNT(DISTINCT f.id) as feedback_submitted,
  COUNT(DISTINCT a.id) as analytics_events,
  MAX(e.created_at) as last_activity_at
FROM auth.users u
JOIN user_profiles p ON u.id = p.id
LEFT JOIN documents d ON u.id = d.user_id
LEFT JOIN enhancements e ON u.id = e.user_id AND e.status = 'completed'
LEFT JOIN beta_feedback f ON u.id = f.user_id
LEFT JOIN beta_analytics a ON u.id = a.user_id
WHERE p.is_beta_user = TRUE
GROUP BY u.id, u.email, p.full_name, p.is_beta_user, p.beta_joined_at, 
         p.beta_invitation_code, p.beta_referral_source, p.beta_feedback_count;

-- Grant access to view for authenticated users
GRANT SELECT ON beta_user_stats TO authenticated;