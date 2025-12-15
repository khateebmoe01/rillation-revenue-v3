# Sync Leads Edge Function

This Supabase Edge Function syncs lead data from the external Rillation Revenue API into the `booked_meetings` table.

## How It Works

1. **Queries `booked_meetings`** - Gets all rows with email addresses
2. **Looks up leads** - For each email:
   - First tries to find a match in `leads` table by `email`
   - If no match, tries to find by `domain` (extracted from email)
3. **Gets client token** - Uses `last_client` from the matched lead to query `clients` table for API token
4. **Calls external API** - Makes GET request to `https://send.rillationrevenue.com/api/leads/{email}` with client's token
5. **Updates `booked_meetings`** - Fills in missing/null fields with API response data

## Deployment

### Prerequisites
- Supabase CLI installed
- Supabase project initialized

### Deploy Command
```bash
supabase functions deploy sync-leads
```

### Environment Variables
The function uses these Supabase environment variables (automatically available):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## Usage

### Invoke via HTTP
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/sync-leads \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

### Response Format
```json
{
  "message": "Sync completed",
  "processed": 10,
  "updated": 8,
  "skipped": 2,
  "errors": [
    {
      "email": "example@domain.com",
      "error": "Error message"
    }
  ]
}
```

## Notes

- The function only updates fields that are currently `NULL` in `booked_meetings`
- Client API tokens are cached to avoid repeated database queries
- Processing continues even if individual leads fail
- All errors are logged and returned in the response

