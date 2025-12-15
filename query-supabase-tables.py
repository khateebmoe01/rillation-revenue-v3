#!/usr/bin/env python3
"""Query Supabase to list all tables and their schemas"""

import requests
import json

# Supabase credentials from config.js
SUPABASE_URL = 'https://pfxgcavxdktxooiqthoi.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeGdjYXZ4ZGt0eG9vaXF0aG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5OTUxMDEsImV4cCI6MjA3ODU3MTEwMX0.yERGiW82Qn751vqZvSPIe0TMaL24C-lRgZEh3KoJl5Y'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def get_table_schema(table_name):
    """Get schema for a table by querying one row"""
    url = f'{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=1'
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if not response.ok:
            return {
                'table': table_name,
                'exists': False,
                'error': f'HTTP {response.status_code}: {response.text[:200]}'
            }
        
        data = response.json()
        if data and len(data) > 0:
            columns = list(data[0].keys())
            return {
                'table': table_name,
                'exists': True,
                'columns': columns,
                'column_count': len(columns),
                'sample_row': data[0]
            }
        else:
            # Table exists but is empty - try to get column info from information_schema
            return {
                'table': table_name,
                'exists': True,
                'columns': [],
                'column_count': 0,
                'note': 'Table exists but is empty'
            }
    except Exception as e:
        return {
            'table': table_name,
            'exists': False,
            'error': str(e)
        }

def main():
    # List of tables found in codebase
    tables_to_check = [
        'campaign_reporting',
        'replies',
        'meetings_booked',
        'booked_meetings',
        'Clients',
        'clients',
        'leads',
        'companies',
        'client_targets',
        'funnel_forecasts',
        'domains',
        'inboxes',
        'inbox_health_metrics',
        'domain_health_metrics',
        'automation_settings',
        'MeetingBooked'
    ]
    
    print('=' * 80)
    print('SUPABASE TABLES INVENTORY')
    print('=' * 80)
    print(f'\nSupabase URL: {SUPABASE_URL}\n')
    
    existing_tables = []
    missing_tables = []
    
    for table in tables_to_check:
        print(f'\n📊 Checking table: {table}')
        print('-' * 80)
        
        schema = get_table_schema(table)
        
        if schema.get('exists'):
            existing_tables.append(schema)
            print(f'✅ EXISTS')
            if schema.get('columns'):
                print(f'   Columns ({schema["column_count"]}): {", ".join(schema["columns"])}')
                # Show sample data types
                if schema.get('sample_row'):
                    print(f'   Sample row keys: {list(schema["sample_row"].keys())[:10]}...')
            else:
                print(f'   ⚠️  Table is empty (no columns detected)')
        else:
            missing_tables.append(table)
            print(f'❌ NOT FOUND')
            if schema.get('error'):
                print(f'   Error: {schema["error"]}')
    
    # Summary
    print('\n' + '=' * 80)
    print('SUMMARY')
    print('=' * 80)
    print(f'\n✅ Existing tables: {len(existing_tables)}')
    for table in existing_tables:
        print(f'   - {table["table"]} ({table.get("column_count", 0)} columns)')
    
    print(f'\n❌ Missing tables: {len(missing_tables)}')
    for table in missing_tables:
        print(f'   - {table}')
    
    # Try to discover additional tables using information_schema
    print('\n' + '=' * 80)
    print('ATTEMPTING TO DISCOVER ALL TABLES...')
    print('=' * 80)
    
    # Query information_schema via REST API (if accessible)
    try:
        # Try a direct query to get table list
        # Note: This might not work depending on RLS policies
        info_url = f'{SUPABASE_URL}/rest/v1/rpc/get_tables'
        response = requests.post(info_url, headers=headers, json={}, timeout=10)
        
        if response.ok:
            print('✅ Found additional tables via RPC')
            print(json.dumps(response.json(), indent=2))
        else:
            print('⚠️  RPC method not available, using table list from codebase only')
    except Exception as e:
        print(f'⚠️  Could not query information_schema: {e}')
        print('   (This is normal - information_schema may not be accessible via REST API)')
    
    # Save results to JSON file
    output = {
        'existing_tables': existing_tables,
        'missing_tables': missing_tables,
        'total_checked': len(tables_to_check)
    }
    
    with open('supabase-tables-inventory.json', 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print(f'\n💾 Results saved to: supabase-tables-inventory.json')
    print('\n' + '=' * 80)

if __name__ == '__main__':
    main()

