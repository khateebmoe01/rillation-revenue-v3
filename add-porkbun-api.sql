-- Add Porkbun API credentials to domain_providers table
-- Note: You'll need to add your Porkbun Secret Key as well

INSERT INTO domain_providers (provider_name, api_key, api_secret, is_active, created_at, updated_at)
VALUES (
    'porkbun',
    'pk1_43969474039c7e28cc009730f0f93f8c3bf346848c9d037fdbb154872af6f47a',
    'YOUR_SECRET_KEY_HERE',  -- ⚠️ REPLACE THIS with your actual Porkbun Secret Key
    true,
    NOW(),
    NOW()
)
ON CONFLICT (provider_name) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    api_secret = EXCLUDED.api_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Verify it was added
SELECT * FROM domain_providers WHERE provider_name = 'porkbun';

