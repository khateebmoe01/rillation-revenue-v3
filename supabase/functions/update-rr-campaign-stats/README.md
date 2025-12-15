# Update Rillation Revenue Campaign Stats

This edge function updates campaign statistics for all Rillation Revenue campaigns across all dates in the `campaign_reporting` table.

## Purpose

- Fetches all existing campaign rows for "Rillation Revenue" from `campaign_reporting`
- For each unique campaign-date combination, calls the API to get latest stats
- Updates the `campaign_reporting` table with correct `total_leads_contacted` and other metrics
- Ensures `total_leads_contacted` is correctly extracted (should be roughly half of `emails_sent`)

## Deployment

```bash
supabase functions deploy update-rr-campaign-stats
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/update-rr-campaign-stats \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

## Response

Returns JSON with processing statistics:
- `processed`: Number of rows processed
- `updated`: Number of rows successfully updated
- `skipped`: Number of rows skipped (no sequence, errors, etc.)
- `errors`: Array of errors encountered
- `results`: Sample of first 10 results

