# Check Domain Availability

This Supabase Edge Function checks domain availability via Porkbun API in real-time and caches results.

## How It Works

1. Accepts array of domain names
2. Checks cache first (from `domain_availability_checks` table)
3. For uncached domains, calls Porkbun API
4. Caches results for 1 hour
5. Returns availability status and price

## Deployment

```bash
supabase functions deploy check-domain-availability
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/check-domain-availability \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["example.com", "test.co"]}'
```

## Request Format

```json
{
  "domains": ["example.com", "test.co", "another-domain.co"]
}
```

## Response Format

```json
{
  "message": "Domain availability checked",
  "results": [
    {
      "domain": "example.com",
      "is_available": false,
      "price": null,
      "cached": false
    },
    {
      "domain": "test.co",
      "is_available": true,
      "price": 12.99,
      "cached": false
    }
  ]
}
```

## Rate Limiting

- 100ms delay between API calls
- Results cached for 1 hour
- Check cache before calling API

