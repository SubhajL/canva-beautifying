-- Function to get user support statistics
CREATE OR REPLACE FUNCTION get_user_support_stats(p_user_id UUID)
RETURNS TABLE (
  total_tickets INTEGER,
  open_tickets INTEGER,
  avg_response_time TEXT,
  avg_resolution_time TEXT,
  satisfaction_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_tickets,
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::INTEGER as open_tickets,
    COALESCE(
      TO_CHAR(
        AVG(
          EXTRACT(EPOCH FROM (first_response_at - created_at))
        ) FILTER (WHERE first_response_at IS NOT NULL),
        'HH24h MIm'
      ),
      'N/A'
    ) as avg_response_time,
    COALESCE(
      TO_CHAR(
        AVG(
          EXTRACT(EPOCH FROM (resolved_at - created_at))
        ) FILTER (WHERE resolved_at IS NOT NULL),
        'HH24h MIm'
      ),
      'N/A'
    ) as avg_resolution_time,
    COALESCE(
      ROUND(AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL), 1),
      0
    ) as satisfaction_score
  FROM support_tickets
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get support dashboard statistics
CREATE OR REPLACE FUNCTION get_support_dashboard_stats()
RETURNS TABLE (
  total_open_tickets INTEGER,
  urgent_tickets INTEGER,
  sla_at_risk INTEGER,
  avg_wait_time TEXT,
  agents_online INTEGER,
  tickets_resolved_today INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status IN ('open', 'in_progress'))::INTEGER as total_open_tickets,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status IN ('open', 'in_progress'))::INTEGER as urgent_tickets,
    COUNT(*) FILTER (
      WHERE status IN ('open', 'in_progress') 
      AND sla_deadline < NOW() + INTERVAL '1 hour'
    )::INTEGER as sla_at_risk,
    COALESCE(
      TO_CHAR(
        AVG(
          EXTRACT(EPOCH FROM (
            COALESCE(first_response_at, NOW()) - created_at
          ))
        ) FILTER (WHERE status = 'open'),
        'HH24h MIm'
      ),
      '0h 0m'
    ) as avg_wait_time,
    (SELECT COUNT(*)::INTEGER FROM support_agents WHERE is_active = true) as agents_online,
    COUNT(*) FILTER (
      WHERE resolved_at IS NOT NULL 
      AND DATE(resolved_at) = CURRENT_DATE
    )::INTEGER as tickets_resolved_today
  FROM support_tickets;
END;
$$ LANGUAGE plpgsql;

-- Function to get agent performance statistics
CREATE OR REPLACE FUNCTION get_agent_performance_stats()
RETURNS TABLE (
  agent_id UUID,
  agent_name TEXT,
  active_tickets INTEGER,
  resolved_today INTEGER,
  avg_response_time TEXT,
  satisfaction_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id as agent_id,
    sa.full_name as agent_name,
    COUNT(st.id) FILTER (WHERE st.status IN ('open', 'in_progress'))::INTEGER as active_tickets,
    COUNT(st.id) FILTER (
      WHERE st.resolved_at IS NOT NULL 
      AND DATE(st.resolved_at) = CURRENT_DATE
    )::INTEGER as resolved_today,
    COALESCE(
      TO_CHAR(
        AVG(
          EXTRACT(EPOCH FROM (st.first_response_at - st.created_at))
        ) FILTER (WHERE st.first_response_at IS NOT NULL),
        'HH24h MIm'
      ),
      'N/A'
    ) as avg_response_time,
    COALESCE(
      ROUND(AVG(st.satisfaction_rating) FILTER (WHERE st.satisfaction_rating IS NOT NULL), 1),
      0
    ) as satisfaction_rating
  FROM support_agents sa
  LEFT JOIN support_tickets st ON sa.id = st.assigned_to
  WHERE sa.is_active = true
  GROUP BY sa.id, sa.full_name
  ORDER BY active_tickets DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check and notify about SLA breaches
CREATE OR REPLACE FUNCTION check_sla_breaches()
RETURNS TABLE (
  ticket_id UUID,
  subject TEXT,
  priority support_priority,
  time_remaining INTERVAL,
  assigned_agent_id UUID,
  user_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    st.id as ticket_id,
    st.subject,
    st.priority,
    st.sla_deadline - NOW() as time_remaining,
    st.assigned_to as assigned_agent_id,
    u.email as user_email
  FROM support_tickets st
  JOIN auth.users u ON st.user_id = u.id
  WHERE st.status IN ('open', 'in_progress')
  AND st.sla_deadline IS NOT NULL
  AND st.sla_deadline < NOW() + INTERVAL '1 hour'
  ORDER BY st.sla_deadline ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-escalate tickets based on SLA
CREATE OR REPLACE FUNCTION auto_escalate_tickets()
RETURNS void AS $$
BEGIN
  -- Escalate tickets that are 50% past their SLA deadline
  UPDATE support_tickets
  SET 
    priority = CASE
      WHEN priority = 'low' THEN 'medium'
      WHEN priority = 'medium' THEN 'high'
      WHEN priority = 'high' THEN 'urgent'
      ELSE priority
    END,
    updated_at = NOW()
  WHERE status IN ('open', 'in_progress')
  AND sla_deadline IS NOT NULL
  AND NOW() > sla_deadline - ((sla_deadline - created_at) * 0.5)
  AND priority != 'urgent';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to check SLA breaches (requires pg_cron extension)
-- This is an example - adjust based on your PostgreSQL setup
/*
SELECT cron.schedule(
  'check-sla-breaches',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT check_sla_breaches();$$
);

SELECT cron.schedule(
  'auto-escalate-tickets',
  '*/30 * * * *', -- Every 30 minutes
  $$SELECT auto_escalate_tickets();$$
);
*/