-- Create funnel_stage_targets table for Pipeline Funnel targets
CREATE TABLE IF NOT EXISTS funnel_stage_targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    total_sent INTEGER DEFAULT 0,
    unique_contacts INTEGER DEFAULT 0,
    real_replies INTEGER DEFAULT 0,
    positive_replies INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    showed_up_to_disco INTEGER DEFAULT 0,
    qualified INTEGER DEFAULT 0,
    demo_booked INTEGER DEFAULT 0,
    showed_up_to_demo INTEGER DEFAULT 0,
    proposal_sent INTEGER DEFAULT 0,
    closed INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row with zero targets
INSERT INTO funnel_stage_targets (total_sent) VALUES (0)
ON CONFLICT DO NOTHING;

-- Enable RLS (Row Level Security) - allow all operations for now
ALTER TABLE funnel_stage_targets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on funnel_stage_targets" ON funnel_stage_targets
    FOR ALL USING (true) WITH CHECK (true);


