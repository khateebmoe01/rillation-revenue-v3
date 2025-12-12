# Troubleshooting - Infrastructure Tab Not Showing

## Quick Checks

### 1. Verify Database Tables Exist
Run this in Supabase SQL Editor:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'domains', 
    'domain_providers', 
    'domain_generations',
    'domain_availability_checks',
    'inbox_orders',
    'inbox_providers',
    'inbox_analytics'
);
```

All 7 tables should be listed.

### 2. Add Porkbun API Key
Run `add-porkbun-api.sql` in Supabase SQL Editor (you'll need to add your Porkbun Secret Key).

Or manually:
```sql
INSERT INTO domain_providers (provider_name, api_key, api_secret, is_active)
VALUES (
    'porkbun',
    'pk1_43969474039c7e28cc009730f0f93f8c3bf346848c9d037fdbb154872af6f47a',
    'YOUR_SECRET_KEY',  -- Get this from Porkbun dashboard
    true
)
ON CONFLICT (provider_name) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    api_secret = EXCLUDED.api_secret;
```

### 3. Check Browser Console
Open browser DevTools (F12) and check:
- Are there any JavaScript errors?
- Do you see "🚀 Initializing Domains tab..." when clicking Domains?
- Are the script files loading? (Check Network tab)

### 4. Verify Edge Functions Are Deployed
Go to: https://supabase.com/dashboard/project/pfxgcavxdktxooiqthoi/functions

You should see:
- ✅ sync-domains-porkbun
- ✅ check-domain-availability
- ✅ generate-domains
- ✅ order-inboxes-bulk
- ✅ sync-inbox-providers

### 5. Test Edge Function Directly
Open browser console and run:
```javascript
const client = window.getSupabaseClient();
const { data, error } = await client.functions.invoke('generate-domains', {
    body: {
        base_name: 'test',
        prefixes: ['try'],
        suffixes: ['go']
    }
});
console.log('Result:', data, error);
```

### 6. Check Supabase Client
In browser console:
```javascript
console.log('Supabase URL:', window.SUPABASE_URL);
console.log('Supabase Key:', window.SUPABASE_KEY);
console.log('Client:', window.getSupabaseClient());
```

All should return values (not null/undefined).

### 7. Verify HTML Structure
When you click "Infrastructure" → "Domains", you should see:
- Domain Generator section with input fields
- Domain Management section with table

If you don't see these, the HTML might not be loading.

### 8. Check Local Server
Make sure the local server is running:
```bash
cd /Users/mokhateeb/rillation-revenue-v3
python3 -m http.server 8000 --bind 0.0.0.0
```

Then open: http://localhost:8000/rillation-analyticsv2.html

## Common Issues

### Issue: "Supabase client not available"
**Fix:** Make sure `config.js` exists and has valid values.

### Issue: Edge function returns 404
**Fix:** Redeploy the function:
```bash
supabase functions deploy [function-name]
```

### Issue: Tables don't exist
**Fix:** Run the migration SQL file in Supabase SQL Editor.

### Issue: UI elements are empty
**Fix:** Check browser console for errors. Make sure all JavaScript files are loading.

### Issue: "Cannot read property of undefined"
**Fix:** The HTML structure might not match what JavaScript expects. Check element IDs match.

## Still Not Working?

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click Infrastructure → Domains
4. Copy all error messages
5. Check Network tab for failed requests

