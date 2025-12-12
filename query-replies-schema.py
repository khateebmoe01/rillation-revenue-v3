#!/usr/bin/env python3
"""Query Supabase replies table to get its schema"""

import requests
import json
from datetime import datetime

SUPABASE_URL = 'https://pfxgcavxdktxooiqthoi.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBmeGdjYXZ4ZGt0eG9vaXF0aG9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5OTUxMDEsImV4cCI6MjA3ODU3MTEwMX0.yERGiW82Qn751vqZvSPIe0TMaL24C-lRgZEh3KoJl5Y'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
}

def get_replies_schema():
    """Get schema for replies table by querying one row"""
    # Try lowercase first (PostgreSQL convention)
    url = f'{SUPABASE_URL}/rest/v1/replies?select=*&limit=1'
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        
        if not response.ok:
            # Try with capital R
            url_capital = f'{SUPABASE_URL}/rest/v1/Replies?select=*&limit=1'
            response = requests.get(url_capital, headers=headers, timeout=10)
        
        if not response.ok:
            return {
                'table': 'replies',
                'error': f'HTTP {response.status_code}: {response.text[:200]}'
            }
        
        data = response.json()
        if data and len(data) > 0:
            columns = list(data[0].keys())
            return {
                'table': 'replies',
                'columns': columns,
                'sample': data[0],
                'column_count': len(columns)
            }
        else:
            # Table exists but is empty - try to get schema from information_schema
            return {
                'table': 'replies',
                'columns': [],
                'note': 'Table exists but is empty - need to check information_schema'
            }
    except Exception as e:
        return {
            'table': 'replies',
            'error': str(e)
        }

def main():
    print('Querying replies table schema from Supabase...\n')
    
    schema = get_replies_schema()
    
    if 'error' in schema:
        print(f'❌ Error: {schema["error"]}')
    elif schema.get('columns'):
        print(f'✅ Found {schema["column_count"]} columns')
        print(f'\nColumns:')
        for col in schema['columns']:
            print(f'  - {col}')
        
        if 'sample' in schema:
            print(f'\nSample row:')
            print(json.dumps(schema['sample'], indent=2, default=str))
    else:
        print(f'⚠️  {schema.get("note", "No columns found")}')
    
    # Save to JSON file
    output_file = 'replies-schema.json'
    with open(output_file, 'w') as f:
        json.dump(schema, f, indent=2, default=str)
    
    print(f'\n✅ Schema saved to {output_file}')
    
    return schema

if __name__ == '__main__':
    main()


