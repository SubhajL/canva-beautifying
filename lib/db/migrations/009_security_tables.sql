-- Create table for blocked IPs
CREATE TABLE IF NOT EXISTS blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip INET NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  blocked_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_blocked_ips_ip ON blocked_ips(ip);
CREATE INDEX idx_blocked_ips_expires_at ON blocked_ips(expires_at) WHERE expires_at IS NOT NULL;

-- Create security events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip INET,
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  path TEXT,
  method TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for security events
CREATE INDEX idx_security_events_ip ON security_events(ip);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_severity ON security_events(severity);

-- Create auth attempts table
CREATE TABLE IF NOT EXISTS auth_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip INET,
  success BOOLEAN NOT NULL,
  method TEXT CHECK (method IN ('password', 'oauth', 'magic_link')),
  error_code TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for auth attempts
CREATE INDEX idx_auth_attempts_email ON auth_attempts(email);
CREATE INDEX idx_auth_attempts_ip ON auth_attempts(ip);
CREATE INDEX idx_auth_attempts_success ON auth_attempts(success);
CREATE INDEX idx_auth_attempts_created_at ON auth_attempts(created_at);

-- RLS Policies
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_attempts ENABLE ROW LEVEL SECURITY;

-- Only admins can manage blocked IPs
CREATE POLICY "Admins can manage blocked IPs" ON blocked_ips
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Security events are admin-only
CREATE POLICY "Admins can view security events" ON security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Auth attempts are admin-only
CREATE POLICY "Admins can view auth attempts" ON auth_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(check_ip INET)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blocked_ips
    WHERE ip = check_ip
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log security event
CREATE OR REPLACE FUNCTION log_security_event(
  p_ip INET,
  p_event_type TEXT,
  p_severity TEXT DEFAULT 'low',
  p_path TEXT DEFAULT NULL,
  p_method TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    ip,
    user_id,
    event_type,
    severity,
    path,
    method,
    user_agent,
    metadata
  ) VALUES (
    p_ip,
    auth.uid(),
    p_event_type,
    p_severity,
    p_path,
    p_method,
    p_user_agent,
    p_metadata
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log auth attempt
CREATE OR REPLACE FUNCTION log_auth_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip INET DEFAULT NULL,
  p_method TEXT DEFAULT 'password',
  p_error_code TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
  INSERT INTO auth_attempts (
    email,
    ip,
    success,
    method,
    error_code,
    user_agent,
    metadata
  ) VALUES (
    p_email,
    p_ip,
    p_success,
    p_method,
    p_error_code,
    p_user_agent,
    p_metadata
  );
  
  -- Check for suspicious patterns
  IF NOT p_success THEN
    -- Count recent failed attempts
    DECLARE
      v_recent_failures INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_recent_failures
      FROM auth_attempts
      WHERE email = p_email
      AND success = FALSE
      AND created_at > NOW() - INTERVAL '15 minutes';
      
      -- Log security event if threshold exceeded
      IF v_recent_failures >= 5 THEN
        PERFORM log_security_event(
          p_ip,
          'excessive_failed_logins',
          'high',
          '/auth/login',
          'POST',
          p_user_agent,
          jsonb_build_object(
            'email', p_email,
            'failures', v_recent_failures
          )
        );
      END IF;
    END;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add role column to user_profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator'));
  END IF;
END $$;