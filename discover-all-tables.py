#!/usr/bin/env python3
"""Discover all Supabase tables by checking common names and hints"""

import requests
import json

SUPABASE_URL = 'https://pfxgcavxdktxooiqthoi.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeGdjYXZ4ZGt0eG9vaXF0aG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5OTUxMDEsImV4cCI6MjA3ODU3MTEwMX0.yERGiW82Qn751vqZvSPIe0TMaL24C-lRgZEh3KoJl5Y'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

def check_table(table_name):
    """Check if table exists and get its columns"""
    url = f'{SUPABASE_URL}/rest/v1/{table_name}?select=*&limit=1'
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.ok:
            data = response.json()
            if isinstance(data, list):
                if len(data) > 0:
                    return {'exists': True, 'columns': list(data[0].keys()), 'row_count': 'has_data'}
                else:
                    return {'exists': True, 'columns': [], 'row_count': 'empty'}
            return {'exists': True, 'columns': [], 'row_count': 'unknown'}
        return {'exists': False, 'error': response.status_code}
    except Exception as e:
        return {'exists': False, 'error': str(e)}

# Tables to check based on hints and common patterns
tables_to_check = [
    'storeleads',  # Hint from leads error
    'Campaigns',    # Hint from companies error
    'campaigns',    # lowercase version
    'CampaignReporting',  # alternative casing
    'Replies',      # alternative casing
    'MeetingsBooked',  # alternative casing
]

print('=' * 80)
print('DISCOVERING ADDITIONAL TABLES')
print('=' * 80)

found_tables = {}
for table in tables_to_check:
    print(f'\nChecking: {table}')
    result = check_table(table)
    if result.get('exists'):
        found_tables[table] = result
        print(f'  ✅ EXISTS - {len(result.get("columns", []))} columns')
        if result.get('columns'):
            print(f'  Columns: {", ".join(result["columns"][:10])}...')
    else:
        print(f'  ❌ Not found')

print('\n' + '=' * 80)
print('ADDITIONAL TABLES FOUND')
print('=' * 80)
for table, info in found_tables.items():
    print(f'\n{table}:')
    print(f'  Columns: {len(info.get("columns", []))}')
    if info.get('columns'):
        print(f'  {", ".join(info["columns"])}')


