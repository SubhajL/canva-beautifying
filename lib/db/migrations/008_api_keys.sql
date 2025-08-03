-- Create table for storing encrypted API keys
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE, -- For quick lookup
  encrypted_key TEXT NOT NULL, -- Encrypted API key
  permissions TEXT[] DEFAULT ARRAY['read', 'write'],
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_service ON api_keys(service);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Create RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API keys
CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own API keys
CREATE POLICY "Users can create own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own API keys
CREATE POLICY "Users can update own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own API keys
CREATE POLICY "Users can delete own API keys" ON api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update last_used_at
CREATE OR REPLACE FUNCTION update_api_key_last_used()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_used_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create audit log for API key usage
CREATE TABLE IF NOT EXISTS api_key_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  error_message TEXT,
  request_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for usage logs
CREATE INDEX idx_api_key_usage_logs_api_key_id ON api_key_usage_logs(api_key_id);
CREATE INDEX idx_api_key_usage_logs_user_id ON api_key_usage_logs(user_id);
CREATE INDEX idx_api_key_usage_logs_created_at ON api_key_usage_logs(created_at);

-- RLS for usage logs
ALTER TABLE api_key_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API key usage
CREATE POLICY "Users can view own API key usage" ON api_key_usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Function to check API key validity
CREATE OR REPLACE FUNCTION verify_api_key(
  p_key_hash TEXT,
  p_service TEXT
) RETURNS TABLE (
  is_valid BOOLEAN,
  user_id UUID,
  permissions TEXT[],
  metadata JSONB
) AS $$
DECLARE
  v_api_key RECORD;
BEGIN
  -- Find API key by hash
  SELECT * INTO v_api_key
  FROM api_keys
  WHERE key_hash = p_key_hash
    AND service = p_service
    AND (expires_at IS NULL OR expires_at > NOW());
  
  IF v_api_key IS NULL THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, NULL::UUID, NULL::TEXT[], NULL::JSONB;
  ELSE
    -- Update last used timestamp
    UPDATE api_keys 
    SET last_used_at = NOW() 
    WHERE id = v_api_key.id;
    
    RETURN QUERY SELECT 
      TRUE::BOOLEAN,
      v_api_key.user_id,
      v_api_key.permissions,
      v_api_key.metadata;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rotate API key
CREATE OR REPLACE FUNCTION rotate_api_key(
  p_api_key_id UUID,
  p_new_key_hash TEXT,
  p_new_encrypted_key TEXT
) RETURNS UUID AS $$
DECLARE
  v_old_key RECORD;
  v_new_id UUID;
BEGIN
  -- Get old key details
  SELECT * INTO v_old_key
  FROM api_keys
  WHERE id = p_api_key_id
    AND user_id = auth.uid();
  
  IF v_old_key IS NULL THEN
    RAISE EXCEPTION 'API key not found or access denied';
  END IF;
  
  -- Create new key with same settings
  INSERT INTO api_keys (
    user_id,
    name,
    service,
    key_hash,
    encrypted_key,
    permissions,
    metadata
  ) VALUES (
    v_old_key.user_id,
    v_old_key.name || ' (rotated)',
    v_old_key.service,
    p_new_key_hash,
    p_new_encrypted_key,
    v_old_key.permissions,
    jsonb_build_object(
      'rotated_from', v_old_key.id,
      'rotated_at', NOW()
    ) || COALESCE(v_old_key.metadata, '{}'::jsonb)
  ) RETURNING id INTO v_new_id;
  
  -- Mark old key as expired
  UPDATE api_keys
  SET expires_at = NOW(),
      metadata = jsonb_build_object(
        'rotated_to', v_new_id,
        'rotated_at', NOW()
      ) || COALESCE(metadata, '{}'::jsonb)
  WHERE id = p_api_key_id;
  
  RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;