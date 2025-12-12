#!/usr/bin/env python3
"""
Sync Email Bison Replies to Supabase
Fetches replies from Email Bison API for the last 3 days across all clients
and syncs missing replies to Supabase replies table.
"""

import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set
import time
import sys

# Supabase Configuration
SUPABASE_URL = 'https://pfxgcavxdktxooiqthoi.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeGdjYXZ4ZGt0eG9vaXF0aG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5OTUxMDEsImV4cCI6MjA3ODU3MTEwMX0.yERGiW82Qn751vqZvSPIe0TMaL24C-lRgZEh3KoJl5Y'

# Email Bison API Base URL
BISON_API_BASE = 'https://send.rillationrevenue.com/api'

# Supabase headers
SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

# Statistics tracking
stats = {
    'clients_processed': 0,
    'clients_skipped': 0,
    'total_replies_fetched': 0,
    'replies_already_exist': 0,
    'replies_inserted': 0,
    'errors': []
}


def get_all_clients() -> List[Dict]:
    """Get all clients from Supabase Clients table with their API tokens"""
    print("📋 Fetching clients from Supabase...")
    
    # Try Clients (capital C) first
    url = f'{SUPABASE_URL}/rest/v1/Clients?select=*'
    
    try:
        response = requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
        
        # If that fails, try lowercase
        if not response.ok:
            url = f'{SUPABASE_URL}/rest/v1/clients?select=*'
            response = requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
        
        if not response.ok:
            raise Exception(f'Failed to fetch clients: HTTP {response.status_code} - {response.text[:200]}')
        
        clients_data = response.json()
        
        # Extract clients with API tokens
        clients = []
        for client_row in clients_data:
            # Get client name from Business field
            client_name = client_row.get('Business') or client_row.get('business') or client_row.get('name') or client_row.get('client_name')
            
            # Get API token from various possible field names
            api_token = (
                client_row.get('Api Key - Bison') or 
                client_row.get('api_key_bison') or 
                client_row.get('api_token') or 
                client_row.get('api_secret') or 
                client_row.get('token') or 
                client_row.get('secret')
            )
            
            if client_name and api_token:
                clients.append({
                    'name': client_name,
                    'api_token': api_token
                })
            else:
                if client_name:
                    print(f"⚠️  Skipping client '{client_name}': No API token found")
                    stats['clients_skipped'] += 1
        
        print(f"✅ Found {len(clients)} clients with API tokens")
        return clients
        
    except Exception as e:
        print(f"❌ Error fetching clients: {e}")
        stats['errors'].append(f"Error fetching clients: {e}")
        return []


def get_existing_replies(client_name: str) -> Set[int]:
    """Get all existing reply_ids from Supabase for a client"""
    url = f'{SUPABASE_URL}/rest/v1/replies'
    
    # Build query string - get all replies for this client
    query_parts = [
        "select=reply_id",
        f"client=eq.{client_name}"
    ]
    url_with_params = f'{url}?{"&".join(query_parts)}'
    
    try:
        # Fetch all pages (Supabase may paginate)
        all_reply_ids = set()
        page = 0
        page_size = 1000
        
        while True:
            # Add pagination
            paginated_url = f'{url_with_params}&limit={page_size}&offset={page * page_size}'
            response = requests.get(paginated_url, headers=SUPABASE_HEADERS, timeout=10)
            
            if not response.ok:
                if page == 0:
                    # If error on first page, return empty set (will try to insert all)
                    print(f"⚠️  Warning: Could not fetch existing replies for {client_name}: {response.status_code}")
                    if response.status_code != 404:
                        print(f"    Response: {response.text[:200]}")
                break
            
            replies = response.json()
            if not replies:
                break
            
            page_reply_ids = {reply.get('reply_id') for reply in replies if reply.get('reply_id')}
            all_reply_ids.update(page_reply_ids)
            
            # If we got fewer than page_size, we've reached the end
            if len(replies) < page_size:
                break
            
            page += 1
        
        return all_reply_ids
        
    except Exception as e:
        print(f"⚠️  Warning: Error fetching existing replies for {client_name}: {e}")
        return set()


def fetch_replies_from_bison(api_token: str, num_pages: int = 10) -> List[Dict]:
    """
    Fetch replies from Email Bison API by fetching the most recent pages.
    Returns all replies from the specified number of pages.
    """
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json'
    }
    
    all_replies = []
    
    # Fetch pages starting from page 1 (most recent)
    for page in range(1, num_pages + 1):
        # Try different pagination parameter names
        page_params = [
            f'page={page}',
            f'page_number={page}',
            f'p={page}',
        ]
        
        page_fetched = False
        
        for page_param in page_params:
            url = f'{BISON_API_BASE}/replies?{page_param}'
            
            try:
                response = requests.get(url, headers=headers, timeout=30)
                
                if response.ok:
                    data = response.json()
                    # Handle different response formats
                    # API docs show response is wrapped in 'data' array
                    if isinstance(data, list):
                        replies = data
                    elif isinstance(data, dict):
                        # API response is wrapped in 'data' key according to docs
                        replies = data.get('data') or data.get('replies') or data.get('results') or []
                        if not isinstance(replies, list):
                            replies = []
                    else:
                        replies = []
                    
                    if replies:
                        all_replies.extend(replies)
                        print(f"  ✅ Page {page}: Fetched {len(replies)} replies")
                        page_fetched = True
                        break
                    else:
                        # Empty page means we've reached the end
                        print(f"  ℹ️  Page {page}: Empty (reached end)")
                        page_fetched = True
                        break
                elif response.status_code == 404:
                    # Try next pagination parameter format
                    continue
                else:
                    # If we get an error, try next pagination format
                    continue
                    
            except requests.exceptions.RequestException as e:
                # Try next pagination format
                continue
        
        if not page_fetched:
            # If all pagination formats failed for this page, we've likely reached the end
            print(f"  ⚠️  Page {page}: Could not fetch (may have reached end)")
            break
        
        # Small delay between pages to avoid rate limiting
        if page < num_pages:
            time.sleep(0.3)
    
    print(f"  📊 Total replies fetched across {len([p for p in range(1, num_pages + 1)])} pages: {len(all_replies)}")
    return all_replies


def categorize_reply(subject: str, text_body: str) -> str:
    """
    Categorize a reply based on subject and body text.
    Returns category like 'Out Of Office', 'Interested', 'Not Interested', etc.
    """
    if not subject:
        subject = ''
    if not text_body:
        text_body = ''
    
    combined_text = (subject + ' ' + text_body).lower()
    
    # Out of Office detection
    ooo_keywords = [
        'out of office', 'out of the office', 'ooo', 'auto-reply', 'automatic reply',
        'vacation', 'away from office', 'away from my desk', 'traveling',
        'limited access to email', 'limited access to internet', 'will be checking',
        'response will be delayed', 'currently away', 'on leave'
    ]
    
    for keyword in ooo_keywords:
        if keyword in combined_text:
            return 'Out Of Office'
    
    # Interested detection
    interested_keywords = [
        'interested', 'yes', 'sounds good', 'let\'s talk', 'let\'s discuss',
        'schedule', 'book a meeting', 'calendly', 'when can we', 'would like to',
        'please send', 'more information', 'tell me more'
    ]
    
    for keyword in interested_keywords:
        if keyword in combined_text:
            return 'Interested'
    
    # Not Interested detection
    not_interested_keywords = [
        'not interested', 'no thanks', 'not a good fit', 'not right now',
        'remove me', 'unsubscribe', 'stop emailing', 'do not contact'
    ]
    
    for keyword in not_interested_keywords:
        if keyword in combined_text:
            return 'Not Interested'
    
    # Default to 'Other' if no category matches
    return 'Other'


def map_bison_reply_to_supabase(bison_reply: Dict, client_name: str) -> Optional[Dict]:
    """
    Map Email Bison API reply data to Supabase replies table format.
    Returns None if required fields are missing.
    Based on API documentation: id, date_received, type, subject, text_body, etc.
    """
    # Extract fields from Bison API response (based on API docs: id is the reply ID)
    reply_id = bison_reply.get('id') or bison_reply.get('reply_id') or bison_reply.get('message_id')
    
    if not reply_id:
        print(f"  ⚠️  Skipping reply: No reply_id found")
        return None
    
    # Get date_received - API docs show it's in ISO 8601 format: "2024-09-21T02:10:42.000000Z"
    date_received = (
        bison_reply.get('date_received') or 
        bison_reply.get('received_at') or 
        bison_reply.get('created_at') or 
        bison_reply.get('date') or
        bison_reply.get('timestamp')
    )
    
    # Convert date to YYYY-MM-DD format if it's a timestamp or different format
    if date_received:
        try:
            # If it's a timestamp string (ISO 8601), parse it
            if isinstance(date_received, str) and 'T' in date_received:
                # Handle ISO 8601 format: "2024-09-21T02:10:42.000000Z"
                date_received = date_received.replace('Z', '+00:00')
                dt = datetime.fromisoformat(date_received)
                date_received = dt.date().isoformat()
            elif isinstance(date_received, str) and len(date_received) > 10:
                # Try parsing as datetime string
                dt = datetime.strptime(date_received[:10], '%Y-%m-%d')
                date_received = dt.date().isoformat()
            elif isinstance(date_received, str):
                # Already in YYYY-MM-DD format
                date_received = date_received[:10]
        except Exception as e:
            # If parsing fails, use today's date as fallback
            print(f"  ⚠️  Could not parse date_received '{date_received}', using today's date")
            date_received = datetime.now().date().isoformat()
    else:
        # No date provided, use today
        date_received = datetime.now().date().isoformat()
    
    # Get other fields based on API documentation
    reply_type = bison_reply.get('type') or 'Tracked Reply'  # API docs show "Untracked Reply" or "Tracked Reply"
    lead_id = bison_reply.get('lead_id') or None
    subject = bison_reply.get('subject') or ''
    text_body = bison_reply.get('text_body') or bison_reply.get('body') or bison_reply.get('text') or bison_reply.get('content') or ''
    campaign_id = bison_reply.get('campaign_id') or None
    from_email = bison_reply.get('from_email_address') or bison_reply.get('from_email') or bison_reply.get('from') or bison_reply.get('sender_email') or ''
    primary_to_email = bison_reply.get('primary_to_email_address') or bison_reply.get('primary_to_email') or bison_reply.get('to') or bison_reply.get('to_email') or bison_reply.get('recipient_email') or ''
    
    # Determine category based on API fields or categorize
    category = None
    # API has 'interested' and 'automated_reply' fields
    if bison_reply.get('interested') is True:
        category = 'Interested'
    elif bison_reply.get('automated_reply') is True:
        category = 'Out Of Office'  # Automated replies are often OOO
    else:
        # Use categorize_reply function as fallback
        category = categorize_reply(subject, text_body)
    
    # Build Supabase record
    supabase_reply = {
        'reply_id': int(reply_id),
        'type': reply_type,
        'lead_id': int(lead_id) if lead_id else None,
        'subject': subject,
        'category': category,
        'text_body': text_body,
        'campaign_id': int(campaign_id) if campaign_id else None,
        'date_received': date_received,
        'from_email': from_email,
        'primary_to_email': primary_to_email,
        'client': client_name
    }
    
    return supabase_reply


def insert_replies_to_supabase(replies: List[Dict]) -> int:
    """Insert replies into Supabase. Returns number of successfully inserted replies."""
    if not replies:
        return 0
    
    url = f'{SUPABASE_URL}/rest/v1/replies'
    
    # Insert in batches to avoid payload size issues
    batch_size = 100
    inserted_count = 0
    
    for i in range(0, len(replies), batch_size):
        batch = replies[i:i + batch_size]
        
        try:
            response = requests.post(
                url,
                headers=SUPABASE_HEADERS,
                json=batch,
                timeout=30
            )
            
            if response.ok:
                inserted_count += len(batch)
                print(f"  ✅ Inserted batch of {len(batch)} replies")
            else:
                # Try inserting one by one to identify problematic records
                print(f"  ⚠️  Batch insert failed ({response.status_code}), trying individual inserts...")
                for reply in batch:
                    try:
                        individual_response = requests.post(
                            url,
                            headers=SUPABASE_HEADERS,
                            json=reply,
                            timeout=10
                        )
                        if individual_response.ok:
                            inserted_count += 1
                        else:
                            error_msg = f"Failed to insert reply_id {reply.get('reply_id')}: {individual_response.text[:200]}"
                            print(f"  ❌ {error_msg}")
                            stats['errors'].append(error_msg)
                    except Exception as e:
                        error_msg = f"Error inserting reply_id {reply.get('reply_id')}: {e}"
                        print(f"  ❌ {error_msg}")
                        stats['errors'].append(error_msg)
                        
        except Exception as e:
            error_msg = f"Error inserting batch: {e}"
            print(f"  ❌ {error_msg}")
            stats['errors'].append(error_msg)
    
    return inserted_count


def sync_client_replies(client_name: str, api_token: str, num_pages: int = 10):
    """Sync replies for a single client by fetching the most recent pages"""
    print(f"\n📧 Processing client: {client_name}")
    
    print(f"  📄 Fetching {num_pages} most recent pages of replies")
    
    # Get all existing replies for this client
    existing_reply_ids = get_existing_replies(client_name)
    print(f"  📊 Found {len(existing_reply_ids)} existing replies in Supabase")
    
    # Fetch replies from Email Bison API (most recent pages)
    bison_replies = fetch_replies_from_bison(api_token, num_pages)
    
    if not bison_replies:
        print(f"  ⚠️  No replies fetched from Email Bison API")
        stats['clients_skipped'] += 1
        return
    
    stats['total_replies_fetched'] += len(bison_replies)
    print(f"  📥 Fetched {len(bison_replies)} replies from Email Bison API")
    
    # Map and filter replies
    supabase_replies = []
    for bison_reply in bison_replies:
        mapped_reply = map_bison_reply_to_supabase(bison_reply, client_name)
        
        if not mapped_reply:
            continue
        
        reply_id = mapped_reply['reply_id']
        
        # Check if already exists
        if reply_id in existing_reply_ids:
            stats['replies_already_exist'] += 1
            continue
        
        supabase_replies.append(mapped_reply)
    
    print(f"  🔍 Found {len(supabase_replies)} new replies to insert")
    
    # Insert new replies
    if supabase_replies:
        inserted = insert_replies_to_supabase(supabase_replies)
        stats['replies_inserted'] += inserted
        print(f"  ✅ Successfully inserted {inserted} replies")
    else:
        print(f"  ℹ️  No new replies to insert")
    
    stats['clients_processed'] += 1
    
    # Small delay to avoid rate limiting
    time.sleep(0.5)


def main():
    """Main sync function"""
    print("=" * 60)
    print("Email Bison Replies Sync to Supabase")
    print("=" * 60)
    print(f"Fetching: 10 most recent pages of replies per client")
    print()
    
    # Get all clients
    clients = get_all_clients()
    
    if not clients:
        print("❌ No clients found with API tokens. Exiting.")
        return
    
    print(f"\n🔄 Starting sync for {len(clients)} clients...\n")
    
    # Process each client
    for client in clients:
        try:
            sync_client_replies(client['name'], client['api_token'], num_pages=10)
        except Exception as e:
            error_msg = f"Error processing client {client['name']}: {e}"
            print(f"❌ {error_msg}")
            stats['errors'].append(error_msg)
            stats['clients_skipped'] += 1
    
    # Print summary
    print("\n" + "=" * 60)
    print("SYNC SUMMARY")
    print("=" * 60)
    print(f"Clients processed: {stats['clients_processed']}")
    print(f"Clients skipped: {stats['clients_skipped']}")
    print(f"Total replies fetched: {stats['total_replies_fetched']}")
    print(f"Replies already exist: {stats['replies_already_exist']}")
    print(f"Replies inserted: {stats['replies_inserted']}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats['errors']:
        print("\nErrors encountered:")
        for error in stats['errors'][:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(stats['errors']) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more errors")
    
    print("\n✅ Sync completed!")


if __name__ == '__main__':
    main()

