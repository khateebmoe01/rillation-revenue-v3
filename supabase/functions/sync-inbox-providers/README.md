# Sync Inbox Providers

This Supabase Edge Function syncs inbox data from Mission Inbox and InboxKit APIs.

## How It Works

1. Gets all active inbox providers from `inbox_providers` table
2. For Mission Inbox: Gets all projects (clients) and their inboxes
3. For InboxKit: Gets all workspaces and their inboxes
4. Upserts inboxes into `inboxes` table
5. Updates provider's `last_sync_at`

## Deployment

```bash
supabase functions deploy sync-inbox-providers
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/sync-inbox-providers \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json"
```

## Response Format

```json
{
  "message": "Inbox providers synced",
  "results": {
    "missioninbox": {
      "synced": 150,
      "errors": []
    },
    "inboxkit": {
      "synced": 75,
      "errors": []
    }
  }
}
```

## Schedule

Recommended: Run every hour or on-demand via button click in UI.

## Notes

- Mission Inbox: Single workspace, clients are "Projects"
- InboxKit: May have multiple workspaces
- Actual API endpoints need to be determined from provider documentation
- Inboxes are matched by `bison_inbox_id` or provider's inbox ID

