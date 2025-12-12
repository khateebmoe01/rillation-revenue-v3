# Rillation Revenue Analytics v3

Complete package for accessing the Rillation Revenue Analytics dashboard and Supabase database.

## 📁 Folder Contents

### Main Application Files
- **`rillation-analyticsv2.html`** - Main analytics dashboard HTML file
- **`config.js`** - Supabase configuration with credentials for project `pfxgcavxdktxooiqthoi`
- **`js/`** - JavaScript modules for the analytics dashboard:
  - `analytics-core.js` - Core analytics functionality
  - `performance-overview.js` - Performance metrics
  - `targets-config.js` - Target configuration management
  - `quick-view.js` - Quick view components
  - `gtm-scoreboard.js` - GTM scoreboard
  - `funnel-spreadsheet.js` - Funnel analysis
  - `campaigns-analytics.js` - Campaign analytics
  - `campaigns.js` - Campaign management
  - `gtm-scoreboard-debug.js` - Debug utilities

### Supabase Configuration
- **`.cursor/mcp.json`** - MCP server configuration (URL-based)
- **`.cursor/.cursor/mcp.json`** - MCP server configuration (command-based with full credentials)
- **`supabase/`** - Supabase project files:
  - `functions/sync-leads/` - Edge function for syncing leads
  - `funnel_forecasts_table.sql` - SQL schema
  - `.temp/project-ref` - Project reference: `pfxgcavxdktxooiqthoi`

### Python Scripts
- **`sync-bison-replies.py`** - Syncs Email Bison replies to Supabase
- **`query-replies-schema.py`** - Queries Supabase replies table schema

## 🚀 Quick Start

### 1. Open the Analytics Dashboard

Simply open `rillation-analyticsv2.html` in your web browser. The file is self-contained and will automatically load:
- Supabase client library (from CDN)
- Chart.js library (from CDN)
- All JavaScript modules from the `js/` folder
- Configuration from `config.js`

**Note:** The HTML references `styles.css` which doesn't exist, but the dashboard will still function (it has inline styles as fallback).

### 2. Access Supabase Database

#### Option A: Via MCP (Model Context Protocol) in Cursor

The folder includes two MCP configuration files:

**For URL-based MCP:**
- Location: `.cursor/mcp.json`
- Uses: `https://mcp.supabase.com/mcp?project_ref=pfxgcavxdktxooiqthoi`

**For Command-based MCP (with full credentials):**
- Location: `.cursor/.cursor/mcp.json`
- Includes access token and service role key

To use in Cursor:
1. Copy the MCP configuration to your Cursor settings
2. The MCP server will allow you to query and interact with the Supabase database directly from Cursor

#### Option B: Via JavaScript/HTML

The `config.js` file contains all necessary credentials:
- **Project URL:** `https://pfxgcavxdktxooiqthoi.supabase.co`
- **Anon Key:** Available in `config.js`
- **Access Token:** Available in `config.js`
- **Service Role Key:** Available in `config.js` (for backend use only)

You can use these in your code:
```javascript
// Load config.js first
<script src="config.js"></script>

// Then use Supabase
const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
```

#### Option C: Via Python Scripts

The Python scripts (`sync-bison-replies.py`, `query-replies-schema.py`) contain hardcoded Supabase credentials and can be run directly:

```bash
python3 sync-bison-replies.py
python3 query-replies-schema.py
```

### 3. Supabase Project Details

- **Project Reference:** `pfxgcavxdktxooiqthoi`
- **Dashboard URL:** https://supabase.com/dashboard/project/pfxgcavxdktxooiqthoi
- **API URL:** `https://pfxgcavxdktxooiqthoi.supabase.co`

## 📋 File Descriptions

### Configuration Files

**`config.js`**
- Contains Supabase URL, anon key, and access token
- Used by the HTML dashboard to connect to Supabase
- Project: `pfxgcavxdktxooiqthoi`

**`.cursor/mcp.json`**
- MCP server configuration for Cursor IDE
- URL-based connection to Supabase MCP server

**`.cursor/.cursor/mcp.json`**
- Alternative MCP configuration with full credentials
- Command-based connection using `@supabase/mcp-server-supabase`
- Includes access token and service role key

### Supabase Files

**`supabase/functions/sync-leads/index.ts`**
- Edge function that syncs leads from external API
- Processes `booked_meetings` table and enriches data

**`supabase/funnel_forecasts_table.sql`**
- SQL schema for funnel forecasts table

**`supabase/.temp/project-ref`**
- Contains the project reference ID

### Python Scripts

**`sync-bison-replies.py`**
- Syncs Email Bison API replies to Supabase `replies` table
- Fetches replies from last 3 days across all clients
- Maps Email Bison data format to Supabase schema

**`query-replies-schema.py`**
- Utility script to query and inspect the Supabase `replies` table schema
- Useful for debugging and understanding the data structure

## 🔧 Setup Instructions

### For Web Dashboard

1. Ensure all files are in the same directory structure:
   ```
   rillation-revenue-v3/
   ├── rillation-analyticsv2.html
   ├── config.js
   └── js/
       └── [all JS files]
   ```

2. Open `rillation-analyticsv2.html` in a web browser
3. The dashboard should automatically connect to Supabase using credentials from `config.js`

### For MCP in Cursor

1. Copy the MCP configuration from `.cursor/.cursor/mcp.json` to your Cursor MCP settings
2. Restart Cursor
3. You should now be able to query Supabase directly from Cursor using MCP

### For Python Scripts

1. Install required Python packages:
   ```bash
   pip3 install requests
   ```

2. Run the scripts:
   ```bash
   python3 sync-bison-replies.py
   python3 query-replies-schema.py
   ```

## 🔐 Security Notes

⚠️ **Important:** This folder contains sensitive credentials:
- Supabase API keys
- Access tokens
- Service role keys

**Do NOT commit these files to public repositories!**

The service role key has full database access and should only be used in secure backend environments.

## 📊 Database Access

All credentials needed to access the Supabase database are included:
- ✅ Project URL
- ✅ Anon key (for frontend)
- ✅ Service role key (for backend)
- ✅ Access token (for MCP)
- ✅ Project reference ID

You can access the database via:
- Web dashboard (HTML file)
- MCP in Cursor IDE
- Python scripts
- Direct API calls using the credentials in `config.js`

## 🆘 Troubleshooting

### Dashboard not loading
- Check that `config.js` is in the same directory as the HTML file
- Check browser console for errors
- Verify that `js/` folder contains all required JavaScript files

### MCP not working
- Verify MCP configuration is correct in Cursor settings
- Check that access token is valid
- Restart Cursor after adding MCP configuration

### Python scripts failing
- Ensure `requests` library is installed: `pip3 install requests`
- Check that Supabase credentials are correct in the script
- Verify network connectivity to Supabase API

## 📝 Notes

- The HTML file references `styles.css` which doesn't exist, but inline styles provide fallback
- All Supabase credentials are for project: `pfxgcavxdktxooiqthoi`
- The MCP configuration includes two different formats - use the one that works best for your setup

