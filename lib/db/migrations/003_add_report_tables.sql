-- Enhancement Reports table
CREATE TABLE IF NOT EXISTS enhancement_reports (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES enhancements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_report_per_document UNIQUE (document_id, user_id)
);

-- Add indexes
CREATE INDEX idx_enhancement_reports_user_id ON enhancement_reports(user_id);
CREATE INDEX idx_enhancement_reports_document_id ON enhancement_reports(document_id);
CREATE INDEX idx_enhancement_reports_created_at ON enhancement_reports(created_at DESC);

-- Shareable Report Links table
CREATE TABLE IF NOT EXISTS shareable_report_links (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES enhancement_reports(id) ON DELETE CASCADE,
  short_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  password TEXT, -- Will store hashed password
  access_count INTEGER DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX idx_shareable_links_short_code ON shareable_report_links(short_code);
CREATE INDEX idx_shareable_links_report_id ON shareable_report_links(report_id);
CREATE INDEX idx_shareable_links_expires_at ON shareable_report_links(expires_at);

-- Add RLS policies
ALTER TABLE enhancement_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shareable_report_links ENABLE ROW LEVEL SECURITY;

-- Policy for enhancement_reports
CREATE POLICY "Users can view their own reports" ON enhancement_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports" ON enhancement_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" ON enhancement_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" ON enhancement_reports
  FOR DELETE USING (auth.uid() = user_id);

-- Policy for shareable_report_links  
CREATE POLICY "Users can view their own shareable links" ON shareable_report_links
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create shareable links for their reports" ON shareable_report_links
  FOR INSERT WITH CHECK (
    auth.uid() = created_by AND 
    EXISTS (
      SELECT 1 FROM enhancement_reports 
      WHERE id = report_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own shareable links" ON shareable_report_links
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own shareable links" ON shareable_report_links
  FOR DELETE USING (auth.uid() = created_by);

-- Public access for shareable links (read-only by short_code)
CREATE POLICY "Public can view shareable links by short_code" ON shareable_report_links
  FOR SELECT USING (true);

-- Add columns to enhancements table to store enhanced analysis data
ALTER TABLE enhancements 
ADD COLUMN IF NOT EXISTS enhanced_analysis_data JSONB;