#!/usr/bin/env python3
"""
Fix Total Leads Contacted Metric
Updates the total_leads_contacted field across all campaign_reporting rows
by extracting the correct value from sequence_step_stats (sum of sent values
where email_subject does NOT contain "Re:").
"""

import requests
import json
from typing import List, Dict, Optional
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
    'rows_processed': 0,
    'rows_updated': 0,
    'rows_skipped': 0,
    'errors': []
}


def get_all_campaign_rows() -> List[Dict]:
    """Get all campaign_reporting rows from Supabase"""
    print("📋 Fetching all campaign rows...")
    
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    query_params = {
        'select': 'id,campaign_id,campaign_name,client,date,total_leads_contacted',
        'order': 'client.asc,date.desc,campaign_id.asc'
    }
    
    query_string = '&'.join([f'{k}={v}' for k, v in query_params.items()])
    url_with_params = f'{url}?{query_string}'
    
    try:
        # Fetch all pages
        all_rows = []
        page = 0
        page_size = 1000
        
        while True:
            paginated_url = f'{url_with_params}&limit={page_size}&offset={page * page_size}'
            response = requests.get(paginated_url, headers=SUPABASE_HEADERS, timeout=10)
            
            if not response.ok:
                if page == 0:
                    if response.status_code == 404:
                        print("⚠️  No rows found")
                        return []
                    raise Exception(f'Failed to fetch campaign rows: HTTP {response.status_code} - {response.text[:200]}')
                break
            
            rows = response.json()
            if not rows:
                break
            
            all_rows.extend(rows)
            
            # If we got fewer than page_size, we've reached the end
            if len(rows) < page_size:
                break
            
            page += 1
        
        print(f"✅ Found {len(all_rows)} campaign rows")
        return all_rows
        
    except Exception as e:
        print(f"❌ Error fetching campaign rows: {e}")
        stats['errors'].append(f"Error fetching campaign rows: {e}")
        return []


def get_client_api_token(client_name: str) -> Optional[str]:
    """Get API token for a specific client from Supabase Clients table"""
    # Try Clients (capital C) first
    url = f'{SUPABASE_URL}/rest/v1/Clients?select=*'
    
    try:
        response = requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
        
        # If that fails, try lowercase
        if not response.ok:
            url = f'{SUPABASE_URL}/rest/v1/clients?select=*'
            response = requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
        
        if not response.ok:
            return None
        
        clients_data = response.json()
        
        # Find the matching client
        for client_row in clients_data:
            # Get client name from Business field
            row_client_name = (
                client_row.get('Business') or 
                client_row.get('business') or 
                client_row.get('name') or 
                client_row.get('client_name')
            )
            
            if row_client_name == client_name:
                # Get API token from various possible field names
                api_token = (
                    client_row.get('Api Key - Bison') or 
                    client_row.get('api_key_bison') or 
                    client_row.get('api_token') or 
                    client_row.get('api_secret') or 
                    client_row.get('token') or 
                    client_row.get('secret')
                )
                
                return api_token if api_token else None
        
        return None
        
    except Exception as e:
        print(f"⚠️  Error fetching API token for {client_name}: {e}")
        return None


def fetch_stats(api_token: str, campaign_id: int, start_date: str, end_date: str) -> Optional[Dict]:
    """Fetch campaign statistics from the API"""
    url = f'{BISON_API_BASE}/campaigns/{campaign_id}/stats'
    
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json'
    }
    
    body = {
        'start_date': start_date,
        'end_date': end_date
    }
    
    try:
        response = requests.post(url, headers=headers, json=body, timeout=30)
        
        # Skip if no sequence
        if response.status_code == 400:
            txt = response.text
            if 'can only be viewed for campaigns with a sequence' in txt:
                return None
        
        if not response.ok:
            error_msg = f"API error for campaign_id {campaign_id} on {start_date}: HTTP {response.status_code} - {response.text[:200]}"
            stats['errors'].append(error_msg)
            return None
        
        data = response.json()
        
        # Handle different response formats
        if isinstance(data, dict):
            # API response might be wrapped in 'data' key
            api_data = data.get('data') or data
        else:
            api_data = data
        
        return api_data
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Request error for campaign_id {campaign_id} on {start_date}: {e}"
        stats['errors'].append(error_msg)
        return None
    except Exception as e:
        error_msg = f"Error fetching stats for campaign_id {campaign_id} on {start_date}: {e}"
        stats['errors'].append(error_msg)
        return None


def calculate_new_leads_contacted(stats_data: Dict) -> int:
    """Calculate new leads contacted from sequence_step_stats"""
    sequence_steps = stats_data.get('sequence_step_stats', [])
    
    if not isinstance(sequence_steps, list) or len(sequence_steps) == 0:
        return 0
    
    # Filter out follow-up emails (those with "Re:" in subject)
    new_lead_steps = []
    for step in sequence_steps:
        email_subject = (step.get('email_subject') or '').lower()
        if 're:' not in email_subject:
            new_lead_steps.append(step)
    
    if len(new_lead_steps) == 0:
        return 0
    
    # Sum the 'sent' values from new lead steps
    total = 0
    for step in new_lead_steps:
        sent = step.get('sent', 0)
        
        # Handle string numbers like "1" or numeric values
        if isinstance(sent, str):
            try:
                sent_value = int(sent)
            except (ValueError, TypeError):
                sent_value = 0
        elif isinstance(sent, (int, float)):
            sent_value = int(sent)
        else:
            sent_value = 0
        
        total += sent_value
    
    return total


def update_total_leads_contacted(row_id: str, new_value: int) -> bool:
    """Update only the total_leads_contacted field for a specific row"""
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    # Use PATCH to update only the specific field
    patch_url = f'{url}?id=eq.{row_id}'
    
    update_data = {
        'total_leads_contacted': new_value
    }
    
    try:
        response = requests.patch(
            patch_url,
            headers=SUPABASE_HEADERS,
            json=update_data,
            timeout=10
        )
        
        if response.ok:
            return True
        else:
            error_msg = f"Failed to update row {row_id}: HTTP {response.status_code} - {response.text[:200]}"
            stats['errors'].append(error_msg)
            return False
            
    except Exception as e:
        error_msg = f"Error updating row {row_id}: {e}"
        stats['errors'].append(error_msg)
        return False


def main():
    """Main sync function"""
    print("=" * 60)
    print("Fix Total Leads Contacted Metric")
    print("=" * 60)
    print()
    
    # Get all campaign rows
    all_rows = get_all_campaign_rows()
    
    if not all_rows:
        print("⚠️  No rows found to process")
        return
    
    # Group rows by client for efficient API token caching
    rows_by_client = {}
    for row in all_rows:
        client = row.get('client') or 'Unknown'
        if client not in rows_by_client:
            rows_by_client[client] = []
        rows_by_client[client].append(row)
    
    print(f"📊 Processing {len(rows_by_client)} clients with {len(all_rows)} total rows\n")
    
    # Cache for API tokens per client
    api_key_cache = {}
    
    # Process each client's rows
    for client_name, rows in rows_by_client.items():
        print(f"📋 Processing client: {client_name} ({len(rows)} rows)")
        
        # Get API key for this client (with caching)
        if client_name not in api_key_cache:
            api_key = get_client_api_token(client_name)
            api_key_cache[client_name] = api_key
            if api_key:
                print(f"  ✅ Found API token")
            else:
                print(f"  ⚠️  No API token found")
        else:
            api_key = api_key_cache[client_name]
        
        if not api_key:
            print(f"  ⏭️  Skipping all rows for {client_name} (no API token)")
            stats['rows_skipped'] += len(rows)
            for row in rows:
                stats['errors'].append({
                    'campaign_id': row.get('campaign_id'),
                    'date': row.get('date'),
                    'error': f'No API key for client: {client_name}'
                })
            continue
        
        # Process each row for this client
        for idx, row in enumerate(rows, 1):
            row_id = row.get('id')
            campaign_id = row.get('campaign_id')
            campaign_name = row.get('campaign_name', 'Unknown')
            date = row.get('date')
            current_value = row.get('total_leads_contacted', 0)
            
            if not row_id or not campaign_id or not date:
                print(f"  [{idx}/{len(rows)}] ⚠️  Skipping - missing required fields")
                stats['rows_skipped'] += 1
                continue
            
            try:
                print(f"  [{idx}/{len(rows)}] Campaign {campaign_id} ({campaign_name}) - {date} (current: {current_value})")
                
                # Fetch stats from API
                api_data = fetch_stats(api_key, campaign_id, date, date)
                
                if not api_data:
                    print(f"    ⏭️  Skipped - no sequence")
                    stats['rows_skipped'] += 1
                    continue
                
                # Calculate new leads contacted from sequence_step_stats
                new_value = calculate_new_leads_contacted(api_data)
                
                print(f"    📊 Calculated: {new_value} (was: {current_value})")
                
                # Update if value changed
                if new_value != current_value:
                    if update_total_leads_contacted(row_id, new_value):
                        print(f"    ✅ Updated: {current_value} → {new_value}")
                        stats['rows_updated'] += 1
                    else:
                        print(f"    ❌ Update failed")
                        stats['rows_skipped'] += 1
                else:
                    print(f"    ✓ Already correct: {new_value}")
                
                stats['rows_processed'] += 1
                
                # Small delay to avoid rate limiting
                time.sleep(0.3)
                
            except Exception as e:
                error_msg = f"Error processing campaign {campaign_id} on {date}: {e}"
                print(f"    ❌ {error_msg}")
                stats['errors'].append({
                    'campaign_id': campaign_id,
                    'date': date,
                    'error': str(e)
                })
                stats['rows_skipped'] += 1
        
        print()  # Empty line between clients
    
    # Print summary
    print("=" * 60)
    print("UPDATE SUMMARY")
    print("=" * 60)
    print(f"Rows processed: {stats['rows_processed']}")
    print(f"Rows updated: {stats['rows_updated']}")
    print(f"Rows skipped: {stats['rows_skipped']}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats['errors']:
        print("\nErrors encountered:")
        for error in stats['errors'][:20]:  # Show first 20 errors
            if isinstance(error, dict):
                print(f"  - Campaign {error.get('campaign_id')} on {error.get('date')}: {error.get('error')}")
            else:
                print(f"  - {error}")
        if len(stats['errors']) > 20:
            print(f"  ... and {len(stats['errors']) - 20} more errors")
    
    print("\n✅ Update completed!")


if __name__ == '__main__':
    main()

