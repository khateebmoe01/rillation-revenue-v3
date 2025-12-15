-- Infrastructure Operational Hub - Database Schema
-- Creates all tables needed for domains, inboxes, orders, and analytics

-- 1. domains table
CREATE TABLE IF NOT EXISTS domains (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('porkbun', 'inboxkit', 'missioninbox', 'other')),
    client TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('active', 'expired', 'pending', 'transferred')),
    expiration_date DATE,
    registration_date DATE,
    dns_configured BOOLEAN DEFAULT false,
    spf_configured BOOLEAN DEFAULT false,
    dkim_configured BOOLEAN DEFAULT false,
    dmarc_configured BOOLEAN DEFAULT false,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'warning', 'critical', 'unknown')),
    porkbun_domain_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for domains
CREATE INDEX IF NOT EXISTS idx_domains_client ON domains(client);
CREATE INDEX IF NOT EXISTS idx_domains_provider ON domains(provider);
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);
CREATE INDEX IF NOT EXISTS idx_domains_domain_name ON domains(domain_name);

-- 2. domain_generations table
CREATE TABLE IF NOT EXISTS domain_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client TEXT,
    base_name TEXT NOT NULL,
    prefixes JSONB DEFAULT '[]'::jsonb,
    suffixes JSONB DEFAULT '[]'::jsonb,
    generated_count INTEGER DEFAULT 0,
    available_count INTEGER DEFAULT 0,
    checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for domain_generations
CREATE INDEX IF NOT EXISTS idx_domain_generations_client ON domain_generations(client);
CREATE INDEX IF NOT EXISTS idx_domain_generations_base_name ON domain_generations(base_name);

-- 3. domain_availability_checks table
CREATE TABLE IF NOT EXISTS domain_availability_checks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    domain_name TEXT NOT NULL UNIQUE,
    is_available BOOLEAN,
    price NUMERIC,
    provider TEXT DEFAULT 'porkbun',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Indexes for domain_availability_checks
CREATE INDEX IF NOT EXISTS idx_domain_checks_domain ON domain_availability_checks(domain_name);
CREATE INDEX IF NOT EXISTS idx_domain_checks_expires ON domain_availability_checks(expires_at);
CREATE INDEX IF NOT EXISTS idx_domain_checks_available ON domain_availability_checks(is_available) WHERE is_available = true;

-- 4. inbox_orders table
CREATE TABLE IF NOT EXISTS inbox_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL CHECK (provider IN ('missioninbox', 'inboxkit')),
    client TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    domain TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    provider_order_id TEXT,
    total_cost NUMERIC,
    inboxes_created INTEGER DEFAULT 0,
    order_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for inbox_orders
CREATE INDEX IF NOT EXISTS idx_inbox_orders_client ON inbox_orders(client);
CREATE INDEX IF NOT EXISTS idx_inbox_orders_provider ON inbox_orders(provider);
CREATE INDEX IF NOT EXISTS idx_inbox_orders_status ON inbox_orders(status);
CREATE INDEX IF NOT EXISTS idx_inbox_orders_order_number ON inbox_orders(order_number);

-- 5. inbox_providers table
CREATE TABLE IF NOT EXISTS inbox_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_name TEXT NOT NULL UNIQUE CHECK (provider_name IN ('missioninbox', 'inboxkit')),
    api_key TEXT NOT NULL,
    api_secret TEXT,
    workspace_id TEXT,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INTEGER DEFAULT 60,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. inbox_analytics table
CREATE TABLE IF NOT EXISTS inbox_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    inbox_id INTEGER,
    client TEXT,
    provider TEXT CHECK (provider IN ('missioninbox', 'inboxkit', 'bison')),
    date DATE NOT NULL,
    emails_sent INTEGER DEFAULT 0,
    replies_received INTEGER DEFAULT 0,
    bounce_count INTEGER DEFAULT 0,
    bounce_rate NUMERIC DEFAULT 0,
    deliverability_score NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(inbox_id, date)
);

-- Indexes for inbox_analytics
CREATE INDEX IF NOT EXISTS idx_inbox_analytics_client_date ON inbox_analytics(client, date);
CREATE INDEX IF NOT EXISTS idx_inbox_analytics_provider ON inbox_analytics(provider);
CREATE INDEX IF NOT EXISTS idx_inbox_analytics_inbox_id ON inbox_analytics(inbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_analytics_date ON inbox_analytics(date);

-- 7. domain_providers table
CREATE TABLE IF NOT EXISTS domain_providers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider_name TEXT NOT NULL UNIQUE CHECK (provider_name IN ('porkbun', 'other')),
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updated_at triggers for all tables
CREATE TRIGGER update_domains_updated_at 
    BEFORE UPDATE ON domains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_orders_updated_at 
    BEFORE UPDATE ON inbox_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_providers_updated_at 
    BEFORE UPDATE ON inbox_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_domain_providers_updated_at 
    BEFORE UPDATE ON domain_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_availability_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for now (adjust based on security needs)
CREATE POLICY "Allow all operations on domains" ON domains
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on domain_generations" ON domain_generations
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on domain_availability_checks" ON domain_availability_checks
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on inbox_orders" ON inbox_orders
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on inbox_providers" ON inbox_providers
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on inbox_analytics" ON inbox_analytics
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on domain_providers" ON domain_providers
    FOR ALL USING (true) WITH CHECK (true);

-- Insert initial provider credentials
-- Note: These should be updated with actual credentials
INSERT INTO inbox_providers (provider_name, api_key, workspace_id, is_active)
VALUES
    ('inboxkit', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZDFkYjYzOWZiMjI0YWJlN2JkNDg0MSIsInR5cGUiOiJhcGkiLCJyb3RhdGlvbiI6IjNhM2U0YjZkLWQwODctNGQ1Zi1iZmQyLTllZDFmNmE1MjllYyIsImlhdCI6MTc1ODU4MzY1MX0.2kgP2RYV3lzF5nj3AO80TwFdGBDb4RfuZ9ZsKd_kuAI', NULL, true),
    ('missioninbox', '', '2de80119-8155-4525-a775-55d8a7382ad3', true)
ON CONFLICT (provider_name) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    workspace_id = EXCLUDED.workspace_id,
    updated_at = NOW();

-- Insert Porkbun provider credentials
-- Note: Replace 'YOUR_PORKBUN_API_KEY' and 'YOUR_PORKBUN_API_SECRET' with actual credentials
INSERT INTO domain_providers (provider_name, api_key, api_secret, is_active)
VALUES
    ('porkbun', 'YOUR_PORKBUN_API_KEY', 'YOUR_PORKBUN_API_SECRET', true)
ON CONFLICT (provider_name) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    api_secret = EXCLUDED.api_secret,
    updated_at = NOW();

