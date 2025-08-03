-- Support ticket categories enum
CREATE TYPE support_category AS ENUM (
  'general',
  'technical',
  'billing',
  'feature',
  'bug'
);

-- Support ticket priority enum
CREATE TYPE support_priority AS ENUM (
  'low',
  'medium',
  'high',
  'urgent'
);

-- Support ticket status enum
CREATE TYPE support_status AS ENUM (
  'open',
  'in_progress',
  'resolved',
  'closed'
);

-- Support agents table
CREATE TABLE support_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  specialties TEXT[],
  max_concurrent_tickets INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES support_agents(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category support_category DEFAULT 'general',
  priority support_priority DEFAULT 'medium',
  status support_status DEFAULT 'open',
  tags TEXT[],
  sla_deadline TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support messages table
CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('user', 'agent')),
  message TEXT NOT NULL,
  attachments TEXT[],
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Knowledge base articles
CREATE TABLE kb_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[],
  author_id UUID REFERENCES support_agents(id),
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Article feedback
CREATE TABLE kb_article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES kb_articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

-- SLA configurations for beta users
CREATE TABLE sla_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tier TEXT NOT NULL,
  priority support_priority NOT NULL,
  response_time_minutes INTEGER NOT NULL,
  resolution_time_hours INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_tier, priority)
);

-- Insert default SLA configurations for beta users
INSERT INTO sla_configs (user_tier, priority, response_time_minutes, resolution_time_hours) VALUES
  ('beta', 'urgent', 30, 4),
  ('beta', 'high', 60, 8),
  ('beta', 'medium', 120, 24),
  ('beta', 'low', 240, 48);

-- Agent performance metrics
CREATE TABLE agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES support_agents(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tickets_handled INTEGER DEFAULT 0,
  avg_response_time_minutes INTEGER,
  avg_resolution_time_hours INTEGER,
  satisfaction_rating DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

-- Create indexes
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);
CREATE INDEX idx_kb_articles_slug ON kb_articles(slug);
CREATE INDEX idx_kb_articles_published ON kb_articles(is_published);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_article_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support tickets
CREATE POLICY "Users can view their own tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Support agents can view all tickets" ON support_tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_agents
      WHERE support_agents.user_id = auth.uid()
      AND support_agents.is_active = true
    )
  );

CREATE POLICY "Support agents can update tickets" ON support_tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM support_agents
      WHERE support_agents.user_id = auth.uid()
      AND support_agents.is_active = true
    )
  );

-- RLS Policies for support messages
CREATE POLICY "Users can view messages for their tickets" ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages for their tickets" ON support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = ticket_id
      AND support_tickets.user_id = auth.uid()
    )
    AND sender_id = auth.uid()
    AND sender_type = 'user'
  );

CREATE POLICY "Support agents can view all messages" ON support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_agents
      WHERE support_agents.user_id = auth.uid()
      AND support_agents.is_active = true
    )
  );

CREATE POLICY "Support agents can create messages" ON support_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_agents
      WHERE support_agents.user_id = auth.uid()
      AND support_agents.is_active = true
    )
    AND sender_id = auth.uid()
    AND sender_type = 'agent'
  );

-- Function to automatically set SLA deadline
CREATE OR REPLACE FUNCTION set_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Set SLA deadline based on user tier and priority
  SELECT NOW() + (response_time_minutes || ' minutes')::INTERVAL
  INTO NEW.sla_deadline
  FROM sla_configs
  WHERE user_tier = 'beta'
  AND priority = NEW.priority;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sla_deadline_trigger
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_sla_deadline();

-- Function to auto-assign tickets to agents
CREATE OR REPLACE FUNCTION auto_assign_ticket()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Only auto-assign if no agent is already assigned
  IF NEW.assigned_to IS NULL THEN
    -- Find the agent with the least active tickets
    SELECT sa.id INTO v_agent_id
    FROM support_agents sa
    LEFT JOIN (
      SELECT assigned_to, COUNT(*) as ticket_count
      FROM support_tickets
      WHERE status IN ('open', 'in_progress')
      GROUP BY assigned_to
    ) tc ON sa.id = tc.assigned_to
    WHERE sa.is_active = true
    AND COALESCE(tc.ticket_count, 0) < sa.max_concurrent_tickets
    ORDER BY COALESCE(tc.ticket_count, 0) ASC
    LIMIT 1;
    
    NEW.assigned_to := v_agent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_assign_ticket_trigger
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_ticket();

-- Function to update ticket status when first response is sent
CREATE OR REPLACE FUNCTION update_ticket_on_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Update ticket status and first response time
  UPDATE support_tickets
  SET 
    status = CASE 
      WHEN status = 'open' THEN 'in_progress'
      ELSE status
    END,
    first_response_at = CASE
      WHEN first_response_at IS NULL AND NEW.sender_type = 'agent' THEN NOW()
      ELSE first_response_at
    END,
    updated_at = NOW()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ticket_on_response_trigger
  AFTER INSERT ON support_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_on_response();