#!/usr/bin/env python3
"""
Sync Campaign Stats from Rillation Revenue API to Supabase
Fetches campaign statistics for a specific date and updates campaign_reporting table.
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
    'campaigns_processed': 0,
    'campaigns_skipped': 0,
    'campaigns_updated': 0,
    'campaigns_inserted': 0,
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


def get_existing_campaign_rows(client_name: str, date: str) -> List[Dict]:
    """Get existing campaign_reporting rows for a specific client and date"""
    print(f"📋 Fetching existing campaign rows for {client_name} on {date}...")
    
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    # Build query parameters
    query_params = {
        'client': f'eq.{client_name}',
        'date': f'eq.{date}',
        'select': 'id,campaign_id,campaign_name,client,date'
    }
    
    query_string = '&'.join([f'{k}={v}' for k, v in query_params.items()])
    url_with_params = f'{url}?{query_string}'
    
    try:
        response = requests.get(url_with_params, headers=SUPABASE_HEADERS, timeout=10)
        
        if not response.ok:
            if response.status_code == 404:
                print(f"⚠️  No existing rows found for {client_name} on {date}")
                return []
            raise Exception(f'Failed to fetch campaign rows: HTTP {response.status_code} - {response.text[:200]}')
        
        rows = response.json()
        print(f"✅ Found {len(rows)} existing campaign rows")
        return rows
        
    except Exception as e:
        print(f"⚠️  Error fetching existing campaign rows: {e}")
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
        print(f"  📡 Fetching stats for campaign_id {campaign_id}...")
        response = requests.post(url, headers=headers, json=body, timeout=30)
        
        if not response.ok:
            error_msg = f"API error for campaign_id {campaign_id}: HTTP {response.status_code} - {response.text[:200]}"
            print(f"  ❌ {error_msg}")
            stats['errors'].append(error_msg)
            return None
        
        data = response.json()
        
        # Handle different response formats
        if isinstance(data, dict):
            # API response might be wrapped in 'data' key
            api_data = data.get('data') or data
        else:
            api_data = data
        
        print(f"  ✅ Successfully fetched stats for campaign_id {campaign_id}")
        return api_data
        
    except requests.exceptions.RequestException as e:
        error_msg = f"Request error for campaign_id {campaign_id}: {e}"
        print(f"  ❌ {error_msg}")
        stats['errors'].append(error_msg)
        return None
    except Exception as e:
        error_msg = f"Error fetching stats for campaign_id {campaign_id}: {e}"
        print(f"  ❌ {error_msg}")
        stats['errors'].append(error_msg)
        return None


def map_api_response_to_campaign_reporting(
    api_data: Dict, 
    campaign_id: int, 
    campaign_name: str, 
    client: str, 
    date: str,
    row_id: Optional[str] = None
) -> Dict:
    """Map API response data to campaign_reporting table format"""
    
    # Helper function to safely get numeric value
    def get_numeric_value(value, default=0):
        if value is None:
            return default
        try:
            # Handle string numbers like "10"
            if isinstance(value, str):
                return float(value) if '.' in value else int(value)
            return float(value) if isinstance(value, (int, float)) else default
        except (ValueError, TypeError):
            return default
    
    # Extract data from API response
    # API response structure based on documentation:
    # data.emails_sent, data.total_leads_contacted, etc.
    data = api_data.get('data', api_data) if isinstance(api_data, dict) else api_data
    
    campaign_row = {
        'campaign_id': campaign_id,
        'campaign_name': campaign_name,
        'client': client,
        'date': date,
        'emails_sent': get_numeric_value(data.get('emails_sent')),
        'total_leads_contacted': get_numeric_value(data.get('total_leads_contacted')),
        'opened': get_numeric_value(data.get('opened')),
        'opened_percentage': get_numeric_value(data.get('opened_percentage')),
        'unique_opens_per_contact': get_numeric_value(data.get('unique_opens_per_contact')),
        'unique_opens_per_contact_percentage': get_numeric_value(data.get('unique_opens_per_contact_percentage')),
        'unique_replies_per_contact': get_numeric_value(data.get('unique_replies_per_contact')),
        'unique_replies_per_contact_percentage': get_numeric_value(data.get('unique_replies_per_contact_percentage')),
        'bounced': get_numeric_value(data.get('bounced')),
        'bounced_percentage': get_numeric_value(data.get('bounced_percentage')),
        'unsubscribed': get_numeric_value(data.get('unsubscribed')),
        'unsubscribed_percentage': get_numeric_value(data.get('unsubscribed_percentage')),
        'interested': get_numeric_value(data.get('interested')),
        'interested_percentage': get_numeric_value(data.get('interested_percentage'))
    }
    
    # Include id if provided (for updating existing rows)
    if row_id:
        campaign_row['id'] = row_id
    
    return campaign_row


def upsert_campaign_reporting(rows: List[Dict]) -> int:
    """Upsert campaign reporting rows into Supabase"""
    if not rows:
        return 0
    
    url = f'{SUPABASE_URL}/rest/v1/campaign_reporting'
    
    # Use upsert headers - merge on conflict
    upsert_headers = {
        **SUPABASE_HEADERS,
        'Prefer': 'resolution=merge-duplicates'
    }
    
    # Insert in batches to avoid payload size issues
    batch_size = 50
    upserted_count = 0
    
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        
        try:
            response = requests.post(
                url,
                headers=upsert_headers,
                json=batch,
                timeout=30
            )
            
            if response.ok:
                upserted_count += len(batch)
                print(f"  ✅ Upserted batch of {len(batch)} rows")
            else:
                # Try inserting one by one to identify problematic records
                print(f"  ⚠️  Batch upsert failed ({response.status_code}), trying individual upserts...")
                for row in batch:
                    try:
                        individual_response = requests.post(
                            url,
                            headers=upsert_headers,
                            json=row,
                            timeout=10
                        )
                        if individual_response.ok:
                            upserted_count += 1
                        else:
                            error_msg = f"Failed to upsert campaign_id {row.get('campaign_id')}: {individual_response.text[:200]}"
                            print(f"  ❌ {error_msg}")
                            stats['errors'].append(error_msg)
                    except Exception as e:
                        error_msg = f"Error upserting campaign_id {row.get('campaign_id')}: {e}"
                        print(f"  ❌ {error_msg}")
                        stats['errors'].append(error_msg)
                        
        except Exception as e:
            error_msg = f"Error upserting batch: {e}"
            print(f"  ❌ {error_msg}")
            stats['errors'].append(error_msg)
    
    return upserted_count


def main():
    """Main sync function"""
    print("=" * 60)
    print("Campaign Stats Sync to Supabase")
    print("=" * 60)
    
    # Configuration
    client_name = "Rillation Revenue"
    target_date = "2025-11-13"
    
    print(f"Target: {client_name}")
    print(f"Date: {target_date}")
    print()
    
    # Get API token for the client
    api_token = get_client_api_token(client_name)
    if not api_token:
        print(f"❌ Cannot proceed without API token for {client_name}")
        return
    
    # Get existing campaign rows
    existing_rows = get_existing_campaign_rows(client_name, target_date)
    
    if not existing_rows:
        print(f"⚠️  No existing rows found for {client_name} on {target_date}")
        print("   The script will attempt to fetch stats for campaigns, but campaign_id and campaign_name")
        print("   must be provided. Consider running a different sync first to create initial rows.")
        return
    
    # Get unique campaign_ids
    campaign_map = {}
    for row in existing_rows:
        campaign_id = row.get('campaign_id')
        if campaign_id:
            if campaign_id not in campaign_map:
                campaign_map[campaign_id] = {
                    'campaign_id': campaign_id,
                    'campaign_name': row.get('campaign_name', 'Unknown'),
                    'id': row.get('id')  # Keep track of existing row ID for potential updates
                }
    
    print(f"\n🔄 Found {len(campaign_map)} unique campaigns to process\n")
    
    # Fetch stats and prepare rows for upsert
    rows_to_upsert = []
    
    for campaign_id, campaign_info in campaign_map.items():
        try:
            # Fetch stats from API
            api_data = fetch_campaign_stats(api_token, campaign_id, target_date, target_date)
            
            if not api_data:
                stats['campaigns_skipped'] += 1
                continue
            
            # Map to campaign_reporting format
            campaign_row = map_api_response_to_campaign_reporting(
                api_data,
                campaign_id,
                campaign_info['campaign_name'],
                client_name,
                target_date,
                campaign_info.get('id')  # Include id if available for proper update
            )
            
            rows_to_upsert.append(campaign_row)
            stats['campaigns_processed'] += 1
            
            # Small delay to avoid rate limiting
            time.sleep(0.3)
            
        except Exception as e:
            error_msg = f"Error processing campaign_id {campaign_id}: {e}"
            print(f"  ❌ {error_msg}")
            stats['errors'].append(error_msg)
            stats['campaigns_skipped'] += 1
    
    # Upsert all rows
    if rows_to_upsert:
        print(f"\n📤 Upserting {len(rows_to_upsert)} rows to campaign_reporting...")
        upserted = upsert_campaign_reporting(rows_to_upsert)
        stats['campaigns_updated'] = upserted
        print(f"✅ Successfully upserted {upserted} rows")
    else:
        print("\n⚠️  No rows to upsert")
    
    # Print summary
    print("\n" + "=" * 60)
    print("SYNC SUMMARY")
    print("=" * 60)
    print(f"Campaigns processed: {stats['campaigns_processed']}")
    print(f"Campaigns skipped: {stats['campaigns_skipped']}")
    print(f"Rows upserted: {stats['campaigns_updated']}")
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

