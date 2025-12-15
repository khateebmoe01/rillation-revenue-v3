-- Create funnel_forecasts table for monthly funnel data
CREATE TABLE IF NOT EXISTS funnel_forecasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    metric_key TEXT NOT NULL,
    estimate_low NUMERIC DEFAULT 0,
    estimate_avg NUMERIC DEFAULT 0,
    estimate_high NUMERIC DEFAULT 0,
    estimate_1 NUMERIC DEFAULT 0,
    estimate_2 NUMERIC DEFAULT 0,
    actual NUMERIC DEFAULT 0,
    projected NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(month, year, metric_key)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_funnel_forecasts_month_year ON funnel_forecasts(month, year);
CREATE INDEX IF NOT EXISTS idx_funnel_forecasts_metric ON funnel_forecasts(metric_key);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_funnel_forecasts_updated_at 
    BEFORE UPDATE ON funnel_forecasts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security) - adjust policies as needed
ALTER TABLE funnel_forecasts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on funnel_forecasts" ON funnel_forecasts
    FOR ALL
    USING (true)
    WITH CHECK (true);

