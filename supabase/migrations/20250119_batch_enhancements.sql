-- Create batch_enhancements table for tracking batch operations
CREATE TABLE IF NOT EXISTS public.batch_enhancements (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_count INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial', 'cancelled')),
    enhancement_ids TEXT[] NOT NULL,
    options JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Add batch_id column to enhancements table if it doesn't exist
ALTER TABLE public.enhancements 
ADD COLUMN IF NOT EXISTS batch_id TEXT REFERENCES public.batch_enhancements(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_enhancements_user_id ON public.batch_enhancements(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_enhancements_status ON public.batch_enhancements(status);
CREATE INDEX IF NOT EXISTS idx_batch_enhancements_created_at ON public.batch_enhancements(created_at);
CREATE INDEX IF NOT EXISTS idx_enhancements_batch_id ON public.enhancements(batch_id);

-- Enable RLS
ALTER TABLE public.batch_enhancements ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own batch enhancements" 
    ON public.batch_enhancements 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own batch enhancements" 
    ON public.batch_enhancements 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own batch enhancements" 
    ON public.batch_enhancements 
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Create function to update batch status based on enhancement statuses
CREATE OR REPLACE FUNCTION update_batch_status()
RETURNS TRIGGER AS $$
DECLARE
    batch_record RECORD;
    completed_count INTEGER;
    error_count INTEGER;
    total_count INTEGER;
    new_status TEXT;
BEGIN
    -- Only proceed if batch_id is set
    IF NEW.batch_id IS NOT NULL THEN
        -- Get batch info
        SELECT * INTO batch_record FROM public.batch_enhancements WHERE id = NEW.batch_id;
        
        IF batch_record IS NOT NULL THEN
            -- Count statuses
            SELECT 
                COUNT(*) FILTER (WHERE status = 'completed'),
                COUNT(*) FILTER (WHERE status = 'error'),
                COUNT(*)
            INTO completed_count, error_count, total_count
            FROM public.enhancements 
            WHERE batch_id = NEW.batch_id;
            
            -- Determine new batch status
            IF completed_count + error_count = total_count THEN
                IF error_count = total_count THEN
                    new_status := 'failed';
                ELSIF completed_count = total_count THEN
                    new_status := 'completed';
                ELSE
                    new_status := 'partial';
                END IF;
                
                -- Update batch status
                UPDATE public.batch_enhancements 
                SET 
                    status = new_status,
                    completed_at = CASE 
                        WHEN new_status != 'processing' THEN TIMEZONE('utc', NOW())
                        ELSE NULL
                    END,
                    metadata = jsonb_set(
                        COALESCE(metadata, '{}'::jsonb),
                        '{completedCount}',
                        to_jsonb(completed_count)
                    ) || jsonb_build_object('errorCount', error_count)
                WHERE id = NEW.batch_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update batch status when enhancement status changes
CREATE TRIGGER update_batch_status_trigger
AFTER UPDATE OF status ON public.enhancements
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION update_batch_status();

-- Add comment
COMMENT ON TABLE public.batch_enhancements IS 'Tracks batch enhancement operations for multiple files';