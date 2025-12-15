#!/usr/bin/env python3
import os
import json
import re
from supabase import create_client, Client

# Load config
with open('config.js', 'r') as f:
    content = f.read()
    # Extract SUPABASE_URL and SUPABASE_KEY from config.js
    url_match = re.search(r'SUPABASE_URL\s*[:=]\s*["\']([^"\']+)["\']', content)
    key_match = re.search(r'SUPABASE_KEY\s*[:=]\s*["\']([^"\']+)["\']', content)
    
    if url_match and key_match:
        SUPABASE_URL = url_match.group(1)
        SUPABASE_KEY = key_match.group(1)
        
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Query engaged_leads table structure
        try:
            result = supabase.table('engaged_leads').select('*').limit(1).execute()
            if result.data and len(result.data) > 0:
                print('Table: engaged_leads')
                print('Columns:', list(result.data[0].keys()))
                print('\nSample row:')
                print(json.dumps(result.data[0], indent=2, default=str))
            else:
                print('Table exists but is empty')
        except Exception as e:
            print(f'Error querying table: {e}')
    else:
        print('Could not extract Supabase credentials from config.js')

