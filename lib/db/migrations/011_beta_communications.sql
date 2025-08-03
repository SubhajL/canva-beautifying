-- Migration: Beta Communications System
-- Description: Add tables for managing beta program communications

-- Create enum for message categories
CREATE TYPE message_category_enum AS ENUM (
  'announcement',
  'feature_update',
  'survey',
  'maintenance',
  'feedback_request',
  'bug_fix',
  'general'
);

-- Create enum for message priority
CREATE TYPE message_priority_enum AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Beta messages table
CREATE TABLE beta_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category message_category_enum NOT NULL DEFAULT 'general',
  priority message_priority_enum NOT NULL DEFAULT 'medium',
  
  -- Targeting options
  target_all_beta BOOLEAN DEFAULT true,
  target_user_ids UUID[] DEFAULT NULL,
  target_tiers subscription_tier_enum[] DEFAULT NULL,
  
  -- Scheduling
  publish_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Email settings
  send_email BOOLEAN DEFAULT false,
  email_subject TEXT,
  email_template TEXT,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_email_settings CHECK (
    (send_email = false) OR 
    (send_email = true AND email_subject IS NOT NULL AND email_template IS NOT NULL)
  )
);

-- Message read status tracking
CREATE TABLE beta_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES beta_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique read records
  UNIQUE(message_id, user_id)
);

-- Message interactions tracking
CREATE TABLE beta_message_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES beta_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL, -- 'click', 'dismiss', 'survey_response', etc.
  interaction_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email send log
CREATE TABLE beta_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES beta_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message TEXT,
  resend_id TEXT, -- Resend API message ID for tracking
  
  -- Prevent duplicate sends
  UNIQUE(message_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_beta_messages_publish_at ON beta_messages(publish_at);
CREATE INDEX idx_beta_messages_expires_at ON beta_messages(expires_at);
CREATE INDEX idx_beta_messages_category ON beta_messages(category);
CREATE INDEX idx_beta_messages_priority ON beta_messages(priority);
CREATE INDEX idx_beta_message_reads_user_id ON beta_message_reads(user_id);
CREATE INDEX idx_beta_message_reads_message_id ON beta_message_reads(message_id);
CREATE INDEX idx_beta_message_interactions_user_id ON beta_message_interactions(user_id);
CREATE INDEX idx_beta_email_log_status ON beta_email_log(email_status);

-- RLS Policies
ALTER TABLE beta_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_message_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_email_log ENABLE ROW LEVEL SECURITY;

-- Beta messages policies (read-only for users, full access for admins)
CREATE POLICY "Users can view published beta messages" ON beta_messages
  FOR SELECT USING (
    publish_at <= NOW() AND
    (expires_at IS NULL OR expires_at > NOW()) AND
    (
      target_all_beta = true OR
      auth.uid() = ANY(target_user_ids) OR
      EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND subscription_tier = ANY(target_tiers)
      )
    )
  );

-- Message reads policies
CREATE POLICY "Users can view their own read status" ON beta_message_reads
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can mark messages as read" ON beta_message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own read status" ON beta_message_reads
  FOR UPDATE USING (user_id = auth.uid());

-- Interactions policies
CREATE POLICY "Users can view their own interactions" ON beta_message_interactions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own interactions" ON beta_message_interactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Email log policies (users can only see their own)
CREATE POLICY "Users can view their own email log" ON beta_email_log
  FOR SELECT USING (user_id = auth.uid());

-- Function to get unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_beta_message_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM beta_messages bm
    WHERE bm.publish_at <= NOW()
      AND (bm.expires_at IS NULL OR bm.expires_at > NOW())
      AND (
        bm.target_all_beta = true OR
        p_user_id = ANY(bm.target_user_ids) OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = p_user_id 
          AND subscription_tier = ANY(bm.target_tiers)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM beta_message_reads bmr
        WHERE bmr.message_id = bm.id
        AND bmr.user_id = p_user_id
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_beta_message_read(p_message_id UUID, p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO beta_message_reads (message_id, user_id)
  VALUES (p_message_id, p_user_id)
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_beta_messages_updated_at
  BEFORE UPDATE ON beta_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();