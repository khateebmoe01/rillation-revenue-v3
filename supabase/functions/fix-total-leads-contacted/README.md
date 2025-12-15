# Fix Total Leads Contacted

This edge function fixes the `total_leads_contacted` metric across all campaigns in the `campaign_reporting` table.

## Problem

The `total_leads_contacted` field was using the top-level API value which includes follow-up emails. The correct value should represent "new leads contacted" for that day, which excludes follow-up emails (those with "Re:" in the subject).

## Solution

The function:
1. Fetches all rows from `campaign_reporting`
2. For each row, calls the API to get campaign stats
3. Extracts the `sequence_step_stats` array from the response
4. Filters entries where `email_subject` does NOT contain "Re:"
5. Sums the `sent` values from the filtered entries
6. Updates only the `total_leads_contacted` field in the database

## Deployment

```bash
supabase functions deploy fix-total-leads-contacted
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/fix-total-leads-contacted \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

## Response

Returns JSON with processing statistics:
- `processed`: Number of rows processed
- `updated`: Number of rows successfully updated
- `skipped`: Number of rows skipped (no sequence, errors, etc.)
- `errors`: Array of errors encountered (first 50)
- `results`: Sample of first 20 results

## Performance

- Processes all rows in the `campaign_reporting` table
- Caches API tokens per client to avoid repeated lookups
- Adds 300ms delay between API calls to avoid rate limiting
- May take several minutes to complete depending on number of rows

