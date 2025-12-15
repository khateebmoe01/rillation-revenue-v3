#!/usr/bin/env python3
"""
Update Total Leads Contacted (Unique Contacts) for Rillation Revenue
Fetches campaign statistics from API and updates ONLY the total_leads_contacted field
for all Rillation Revenue campaigns in campaign_reporting.
"""

import requests
import json
from datetime import datetime
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


def get_client_api_token(client_name: str) -> Optional[str]:
    """Get API token for a specific client from Supabase Clients table"""
    print(f"📋 Fetching API token for client: {client_name}...")
    
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
                
                if api_token:
                    print(f"✅ Found API token for {client_name}")
                    return api_token
                else:
                    print(f"⚠️  Client '{client_name}' found but no API token available")
                    return None
        
        print(f"❌ Client '{client_name}' not found in Clients table")
        return None
        
    except Exception as e:
        print(f"❌ Error fetching client API token: {e}")
        stats['errors'].append(f"Error fetching API token for {client_name}: {e}")
        return None


def get_all_rr_campaign_rows(client_name: str) -> List[Dict]:
    """Get all campaign_reporting rows for Rillation Revenue"""
    print(f"📋 Fetching all campaign rows for {client_name}...")
    
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    # Build query parameters - get all rows for this client
    query_params = {
        'client': f'eq.{client_name}',
        'select': 'id,campaign_id,campaign_name,client,date,total_leads_contacted',
        'order': 'date.desc,campaign_id.asc'
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
                        print(f"⚠️  No rows found for {client_name}")
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
        print(f"⚠️  Error fetching campaign rows: {e}")
        stats['errors'].append(f"Error fetching campaign rows: {e}")
        return []


def fetch_campaign_stats(api_token: str, campaign_id: int, start_date: str, end_date: str) -> Optional[Dict]:
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


def update_total_leads_contacted(row_id: str, total_leads_contacted: int) -> bool:
    """Update only the total_leads_contacted field for a specific row"""
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    # Use PATCH to update only the specific field
    patch_url = f'{url}?id=eq.{row_id}'
    
    update_data = {
        'total_leads_contacted': total_leads_contacted
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


def get_numeric_value(value, default=0):
    """Helper function to safely get numeric value"""
    if value is None:
        return default
    try:
        # Handle string numbers like "10"
        if isinstance(value, str):
            return float(value) if '.' in value else int(value)
        return float(value) if isinstance(value, (int, float)) else default
    except (ValueError, TypeError):
        return default


def main():
    """Main sync function"""
    print("=" * 60)
    print("Update Unique Contacts for Rillation Revenue")
    print("=" * 60)
    
    # Configuration
    client_name = "Rillation Revenue"
    
    print(f"Target: {client_name}")
    print()
    
    # Get API token for the client
    api_token = get_client_api_token(client_name)
    if not api_token:
        print(f"❌ Cannot proceed without API token for {client_name}")
        return
    
    # Get all campaign rows for Rillation Revenue
    all_rows = get_all_rr_campaign_rows(client_name)
    
    if not all_rows:
        print(f"⚠️  No rows found for {client_name}")
        return
    
    print(f"\n🔄 Processing {len(all_rows)} rows...\n")
    
    # Process each row
    for idx, row in enumerate(all_rows, 1):
        row_id = row.get('id')
        campaign_id = row.get('campaign_id')
        campaign_name = row.get('campaign_name', 'Unknown')
        date = row.get('date')
        current_value = row.get('total_leads_contacted', 0)
        
        if not row_id or not campaign_id or not date:
            print(f"  ⚠️  Row {idx}: Skipping - missing required fields (id: {row_id}, campaign_id: {campaign_id}, date: {date})")
            stats['rows_skipped'] += 1
            continue
        
        try:
            print(f"  [{idx}/{len(all_rows)}] Campaign {campaign_id} ({campaign_name}) - {date} (current: {current_value})")
            
            # Fetch stats from API
            api_data = fetch_campaign_stats(api_token, campaign_id, date, date)
            
            if not api_data:
                print(f"    ❌ Failed to fetch stats")
                stats['rows_skipped'] += 1
                continue
            
            # Extract total_leads_contacted from API response
            data = api_data.get('data', api_data) if isinstance(api_data, dict) else api_data
            new_value = get_numeric_value(data.get('total_leads_contacted'))
            
            # Update only if the value is different
            if new_value != current_value:
                print(f"    📊 Updating: {current_value} → {new_value}")
                if update_total_leads_contacted(row_id, int(new_value)):
                    print(f"    ✅ Updated successfully")
                    stats['rows_updated'] += 1
                else:
                    print(f"    ❌ Update failed")
                    stats['rows_skipped'] += 1
            else:
                print(f"    ✓ Already correct: {current_value}")
                stats['rows_updated'] += 1  # Count as processed even if no change needed
            
            stats['rows_processed'] += 1
            
            # Small delay to avoid rate limiting
            time.sleep(0.3)
            
        except Exception as e:
            error_msg = f"Error processing row {idx} (campaign_id {campaign_id}, date {date}): {e}"
            print(f"    ❌ {error_msg}")
            stats['errors'].append(error_msg)
            stats['rows_skipped'] += 1
    
    # Print summary
    print("\n" + "=" * 60)
    print("UPDATE SUMMARY")
    print("=" * 60)
    print(f"Rows processed: {stats['rows_processed']}")
    print(f"Rows updated: {stats['rows_updated']}")
    print(f"Rows skipped: {stats['rows_skipped']}")
    print(f"Errors: {len(stats['errors'])}")
    
    if stats['errors']:
        print("\nErrors encountered:")
        for error in stats['errors'][:20]:  # Show first 20 errors
            print(f"  - {error}")
        if len(stats['errors']) > 20:
            print(f"  ... and {len(stats['errors']) - 20} more errors")
    
    print("\n✅ Update completed!")


if __name__ == '__main__':
    main()

