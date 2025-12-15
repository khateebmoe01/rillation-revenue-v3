# Generate Domains

This Supabase Edge Function generates domain name combinations from base name + prefixes/suffixes.

## How It Works

1. Accepts base_name, prefixes array, suffixes array
2. Generates all combinations (prefix + base + .co, base + suffix + .co)
3. Optionally checks availability in bulk
4. Stores generation session in `domain_generations` table
5. Returns generated domains with availability status

## Deployment

```bash
supabase functions deploy generate-domains
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/generate-domains \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "base_name": "sbxpartner",
    "prefixes": ["try", "use", "join"],
    "suffixes": ["go", "max"],
    "client": "AKELA Laser",
    "check_availability": false
  }'
```

## Request Format

```json
{
  "base_name": "sbxpartner",
  "prefixes": ["try", "use", "join", "grow"],
  "suffixes": ["go", "max", "pro"],
  "client": "AKELA Laser",
  "check_availability": true
}
```

## Response Format

```json
{
  "message": "Domains generated successfully",
  "base_name": "sbxpartner",
  "generated_count": 7,
  "available_count": 5,
  "domains": [
    {
      "domain": "trysbxpartner.co",
      "is_available": true,
      "price": 12.99,
      "cached": false
    },
    {
      "domain": "sbxpartnergo.co",
      "is_available": false,
      "price": null,
      "cached": false
    }
  ],
  "generation_id": "uuid-here"
}
```

