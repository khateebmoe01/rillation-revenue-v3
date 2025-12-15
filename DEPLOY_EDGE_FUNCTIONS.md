# Deploy Edge Functions - Quick Guide

## Prerequisites

1. **Supabase CLI installed**
   ```bash
   npm install -g supabase
   ```

2. **Logged into Supabase**
   ```bash
   supabase login
   ```

3. **Linked to your project**
   ```bash
   supabase link --project-ref pfxgcavxdktxooiqthoi
   ```

## Deploy All Functions

Run these commands from the project root:

```bash
# Deploy sync-domains-porkbun
supabase functions deploy sync-domains-porkbun

# Deploy check-domain-availability
supabase functions deploy check-domain-availability

# Deploy generate-domains
supabase functions deploy generate-domains

# Deploy order-inboxes-bulk
supabase functions deploy order-inboxes-bulk

# Deploy sync-inbox-providers
supabase functions deploy sync-inbox-providers
```

## Or Deploy All at Once

```bash
supabase functions deploy sync-domains-porkbun check-domain-availability generate-domains order-inboxes-bulk sync-inbox-providers
```

## Add Porkbun API Credentials

After deploying, you need to add Porkbun API credentials to the database.

### Option 1: Via Supabase Dashboard
1. Go to Table Editor
2. Open `domain_providers` table
3. Insert/Update row:
   - `provider_name`: `porkbun`
   - `api_key`: `pk1_43969474039c7e28cc009730f0f93f8c3bf346848c9d037fdbb154872af6f47a`
   - `api_secret`: `[Your Porkbun Secret Key]`
   - `is_active`: `true`

### Option 2: Via SQL
```sql
INSERT INTO domain_providers (provider_name, api_key, api_secret, is_active)
VALUES (
    'porkbun',
    'pk1_43969474039c7e28cc009730f0f93f8c3bf346848c9d037fdbb154872af6f47a',
    'YOUR_SECRET_KEY_HERE',  -- Replace with actual secret key
    true
)
ON CONFLICT (provider_name) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    api_secret = EXCLUDED.api_secret,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();
```

## Verify Deployment

After deploying, test the functions:

```bash
# Test sync-domains-porkbun
curl -X POST https://pfxgcavxdktxooiqthoi.supabase.co/functions/v1/sync-domains-porkbun \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# Test check-domain-availability
curl -X POST https://pfxgcavxdktxooiqthoi.supabase.co/functions/v1/check-domain-availability \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["test.co"]}'
```

## Troubleshooting

If functions don't deploy:
1. Check you're logged in: `supabase status`
2. Check project is linked: `supabase projects list`
3. Verify function files exist: `ls supabase/functions/`

