# Order Inboxes Bulk

This Supabase Edge Function places bulk inbox orders with Mission Inbox or InboxKit.

## How It Works

1. Validates order (minimum 100 inboxes)
2. Gets provider API credentials from `inbox_providers` table
3. Creates order record in `inbox_orders` table
4. Calls provider API to place order
5. Updates order with provider response
6. Returns order confirmation

## Deployment

```bash
supabase functions deploy order-inboxes-bulk
```

## Invocation

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/order-inboxes-bulk \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "missioninbox",
    "quantity": 500,
    "domain": "example.co",
    "client": "AKELA Laser"
  }'
```

## Request Format

```json
{
  "provider": "missioninbox",
  "quantity": 500,
  "domain": "example.co",
  "client": "AKELA Laser"
}
```

## Response Format

```json
{
  "message": "Order placed successfully",
  "order_number": "MISSIONINBOX-1234567890-abc123",
  "order_id": "uuid-here",
  "provider_order_id": "provider-order-123",
  "status": "processing",
  "quantity": 500,
  "inboxes_created": 0,
  "total_cost": 250.00
}
```

## Validation

- Minimum quantity: 100 inboxes
- Provider must be 'missioninbox' or 'inboxkit'
- All fields required

## Notes

- Actual API endpoints for Mission Inbox and InboxKit need to be determined from their documentation
- Order status updates may require webhooks or polling

