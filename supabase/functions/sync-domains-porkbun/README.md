# Sync Domains from Porkbun

This Supabase Edge Function syncs all domains from the Porkbun API into the `domains` table.

## How It Works

1. Fetches Porkbun API credentials from `domain_providers` table
2. Calls Porkbun API to get all domains
3. Upserts domains into `domains` table
4. Updates `synced_at` timestamp
5. Updates provider's `last_sync_at`

## Deployment

```bash
supabase functions deploy sync-domains-porkbun
```

## Invocation

### Manual (HTTP POST)
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-domains-porkbun \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

### Scheduled (Cron)
Set up a cron job to run every 5 minutes:
- Via Supabase Dashboard: Database → Cron Jobs
- Or external scheduler calling the HTTP endpoint

## Response Format

```json
{
  "message": "Domains synced successfully",
  "domains_synced": 150,
  "total_domains": 150
}
```

## Prerequisites

- `domain_providers` table must have Porkbun entry with `api_key` and `api_secret`
- Porkbun API credentials must be valid

