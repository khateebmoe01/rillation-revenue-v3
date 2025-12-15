# Rillation Revenue Analytics v3 - Complete System Architecture

**Project:** Rillation Revenue Analytics Hub  
**Database:** Supabase (Project: `pfxgcavxdktxooiqthoi`)  
**Date:** December 11, 2025

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Folder Structure](#folder-structure)
3. [Database Architecture (Supabase)](#database-architecture-supabase)
4. [External APIs](#external-apis)
5. [Data Flow Architecture](#data-flow-architecture)
6. [Frontend Application](#frontend-application)
7. [Backend Services & Scripts](#backend-services--scripts)
8. [Complete System Flow](#complete-system-flow)
9. [Component Interactions](#component-interactions)
10. [Configuration & Credentials](#configuration--credentials)

---

## 🎯 System Overview

The Rillation Revenue Analytics v3 is a **comprehensive analytics dashboard** that aggregates, processes, and visualizes lead generation and email campaign performance data. The system integrates multiple data sources through Supabase (PostgreSQL database) and presents them through a single-page web application.

### Key Components:
- **Frontend:** Single-page HTML dashboard with modular JavaScript
- **Database:** Supabase (PostgreSQL) with 9 core tables
- **External APIs:** Email Bison API, Rillation Revenue API
- **Data Sync:** Python scripts and Supabase Edge Functions
- **Visualization:** Chart.js for graphs and charts

---

## 📁 Folder Structure

```
rillation-revenue-v3/
│
├── rillation-analyticsv2.html    # Main dashboard (single-page app)
├── config.js                      # Supabase credentials & configuration
├── README.md                      # Project documentation
│
├── js/                            # Frontend JavaScript modules
│   ├── analytics-core.js         # Core Supabase client & utilities
│   ├── performance-overview.js   # Performance metrics dashboard
│   ├── quick-view.js             # Quick client overview
│   ├── gtm-scoreboard.js         # GTM scoreboard analytics
│   ├── funnel-spreadsheet.js     # Pipeline/funnel visualization
│   ├── targets-config.js          # Client targets management
│   ├── campaigns-analytics.js     # Campaign analytics
│   ├── campaigns.js               # Campaign management
│   └── gtm-scoreboard-debug.js   # Debug utilities
│
├── supabase/                      # Supabase project files
│   ├── functions/
│   │   └── sync-leads/
│   │       ├── index.ts          # Edge function: sync leads from API
│   │       └── README.md         # Function documentation
│   └── funnel_forecasts_table.sql # SQL schema for forecasts
│
├── sync-bison-replies.py          # Python: Sync replies from Bison API
├── query-replies-schema.py        # Python: Query Supabase schema
│
└── [Generated Files]
    ├── SUPABASE_TABLES_SUMMARY.md # Database inventory
    ├── supabase-tables-inventory.json
    └── SYSTEM_ARCHITECTURE.md     # This file
```

---

## 🗄️ Database Architecture (Supabase)

### Database Connection
- **Project ID:** `pfxgcavxdktxooiqthoi`
- **URL:** `https://pfxgcavxdktxooiqthoi.supabase.co`
- **Type:** PostgreSQL (via Supabase)
- **Access:** REST API, JavaScript client, Python scripts

### Core Tables (9 total)

#### 1. **campaign_reporting** (21 columns)
**Purpose:** Daily campaign performance metrics  
**Key Fields:**
- `campaign_id`, `campaign_name`, `client`, `date`
- `emails_sent`, `total_leads_contacted`
- `opened`, `opened_percentage`
- `unique_replies_per_contact`, `unique_replies_per_contact_percentage`
- `bounced`, `bounced_percentage`
- `interested`, `interested_percentage`

**Data Source:** Aggregated from Email Bison API  
**Used By:** Performance Overview, GTM Scoreboard, Quick View

---

#### 2. **replies** (13 columns)
**Purpose:** Email reply tracking with categorization  
**Key Fields:**
- `reply_id`, `type`, `lead_id`, `subject`, `category`
- `text_body`, `campaign_id`, `date_received`
- `from_email`, `primary_to_email`, `client`

**Data Source:** Email Bison API (via `sync-bison-replies.py`)  
**Used By:** Performance Overview, DeepView analytics

---

#### 3. **meetings_booked** (13 columns)
**Purpose:** Booked meetings/discovery calls  
**Key Fields:**
- `first_name`, `last_name`, `full_name`, `title`
- `company`, `company_linkedin`, `company_domain`
- `campaign_name`, `profile_url`, `client`
- `created_time`, `campaign_id`, `email`

**Data Source:** Email Bison API  
**Used By:** Performance Overview, GTM Scoreboard, Quick View

---

#### 4. **Clients** (4 columns) ⚠️ Case-sensitive
**Purpose:** Client configuration with API credentials  
**Key Fields:**
- `Business` (client name)
- `Api Key - Bison` (API token for Bison API)
- `Client ID - Bison`
- `App URL- Bison`

**Data Source:** Manual configuration  
**Used By:** All sync scripts, Edge Functions, Frontend filters

---

#### 5. **client_targets** (9 columns)
**Purpose:** Daily performance targets per client  
**Key Fields:**
- `client`, `emails_per_day`, `prospects_per_day`
- `replies_per_day`, `bounces_per_day`, `meetings_per_day`

**Data Source:** Manual configuration (via Targets Config modal)  
**Used By:** Quick View dashboard

---

#### 6. **funnel_forecasts** (13 columns)
**Purpose:** Monthly funnel forecasting and tracking  
**Key Fields:**
- `month`, `year`, `metric_key`
- `estimate_low`, `estimate_avg`, `estimate_high`
- `estimate_1`, `estimate_2`, `actual`, `projected`

**Data Source:** Manual entry (via Pipeline View spreadsheet)  
**Used By:** Pipeline View dashboard

---

#### 7. **inboxes** (26 columns)
**Purpose:** Email inbox configuration and statistics  
**Key Fields:**
- `bison_inbox_id`, `workspace`, `name`, `email`
- `daily_limit`, `type`, `status`
- `emails_sent_count`, `total_replied_count`, `bounced_count`
- `unique_replied_count`, `interested_leads_count`

**Data Source:** Email Bison API sync  
**Used By:** Infrastructure dashboard

---

#### 8. **storeleads** (80 columns) 🔍
**Purpose:** Comprehensive lead/company database  
**Key Fields:**
- `id`, `domain`, `emails`, `phones`
- `company_location`, `description`
- `platform`, `plan`, `status`
- `products_sold`, `estimated_monthly_sales`
- Social media fields (facebook, instagram, twitter, linkedin, etc.)
- `technologies`, `technologies_count`

**Data Source:** External lead database  
**Used By:** Lead enrichment (via Edge Functions)

---

#### 9. **Campaigns** (5 columns) 🔍
**Purpose:** Campaign master list  
**Key Fields:**
- `campaign_name`, `campaign_id`, `uuid`, `client`, `created_at`

**Data Source:** Email Bison API  
**Used By:** Campaign filters, analytics

---

## 🌐 External APIs

### 1. **Email Bison API**
**Base URL:** `https://send.rillationrevenue.com/api`  
**Authentication:** Bearer token (per client)  
**Purpose:** Email campaign management platform

**Endpoints Used:**
- `GET /replies` - Fetch email replies
- `GET /leads/{email}` - Get lead enrichment data
- (Inbox and campaign data endpoints)

**Authentication:**
- Each client has unique API token stored in `Clients` table
- Token format: `"Api Key - Bison"` field
- Used in: `sync-bison-replies.py`, `sync-leads` Edge Function

---

### 2. **Rillation Revenue API**
**Base URL:** `https://send.rillationrevenue.com/api`  
**Note:** Same domain as Bison API, appears to be the same service  
**Purpose:** Lead enrichment and data sync

**Endpoints Used:**
- `GET /leads/{email}` - Enrich meeting data with lead information

**Used By:** `sync-leads` Supabase Edge Function

---

## 🔄 Data Flow Architecture

### High-Level Data Flow

```
┌─────────────────┐
│  Email Bison    │
│      API        │
└────────┬────────┘
         │
         │ (1) Fetch Replies
         │ (2) Fetch Campaign Data
         │ (3) Fetch Meeting Data
         │
         ▼
┌─────────────────┐
│  Python Scripts │
│  & Edge Funcs    │
└────────┬────────┘
         │
         │ Transform & Map Data
         │
         ▼
┌─────────────────┐
│    Supabase     │
│   (PostgreSQL)  │
│                 │
│  • campaign_    │
│    reporting    │
│  • replies      │
│  • meetings_    │
│    booked       │
│  • inboxes      │
│  • storeleads   │
│  • Clients      │
│  • client_      │
│    targets      │
│  • funnel_      │
│    forecasts    │
│  • Campaigns    │
└────────┬────────┘
         │
         │ Query via REST API
         │ or JavaScript Client
         │
         ▼
┌─────────────────┐
│  Frontend HTML  │
│   Dashboard     │
│                 │
│  • Performance  │
│    Overview     │
│  • Quick View   │
│  • GTM          │
│    Scoreboard   │
│  • Pipeline     │
│    View         │
│  • DeepView     │
└─────────────────┘
```

---

### Detailed Data Flow Paths

#### Path 1: Email Replies Sync
```
Email Bison API
    │
    │ GET /replies?page=1 (with client API token)
    │
    ▼
sync-bison-replies.py
    │
    │ 1. Fetch all clients from Supabase (Clients table)
    │ 2. For each client:
    │    - Fetch replies from Bison API (last 3 days, 10 pages)
    │    - Check existing replies in Supabase
    │    - Map Bison format → Supabase format
    │    - Insert new replies
    │
    ▼
Supabase: replies table
    │
    │ Stored with: reply_id, category, client, date_received, etc.
    │
    ▼
Frontend Dashboard
    │
    │ Queries: SELECT * FROM replies WHERE client = ? AND date_received BETWEEN ? AND ?
    │
    ▼
Performance Overview / DeepView
```

---

#### Path 2: Lead Enrichment (Meetings)
```
meetings_booked table (has email, missing data)
    │
    ▼
Supabase Edge Function: sync-leads
    │
    │ 1. Query all booked_meetings with emails
    │ 2. For each meeting:
    │    - Lookup in storeleads table (by email or domain)
    │    - Get last_client from lead
    │    - Get API token from Clients table
    │    - Call Rillation Revenue API: GET /leads/{email}
    │    - Update booked_meetings with enriched data
    │
    ▼
Rillation Revenue API
    │
    │ Returns: first_name, last_name, company, title, etc.
    │
    ▼
Supabase: meetings_booked table (updated)
    │
    ▼
Frontend Dashboard
```

---

#### Path 3: Campaign Reporting
```
Email Bison API
    │
    │ Campaign metrics aggregated daily
    │
    ▼
[External Process - likely automated]
    │
    │ Aggregates: emails_sent, opens, replies, bounces, etc.
    │
    ▼
Supabase: campaign_reporting table
    │
    │ Daily rows per campaign per client
    │
    ▼
Frontend Dashboard
    │
    │ Queries: SELECT * FROM campaign_reporting WHERE client = ? AND date BETWEEN ? AND ?
    │
    ▼
Performance Overview / GTM Scoreboard / Quick View
    │
    │ Displays: Metrics cards, charts, trends
    │
    ▼
Chart.js Visualization
```

---

#### Path 4: Manual Data Entry
```
User Input (Frontend)
    │
    │ Pipeline View: Edit funnel_forecasts spreadsheet
    │ Quick View: Configure client_targets
    │
    ▼
Frontend JavaScript
    │
    │ funnel-spreadsheet.js → Updates funnel_forecasts
    │ targets-config.js → Updates client_targets
    │
    ▼
Supabase: funnel_forecasts / client_targets tables
    │
    │ Stored for future queries
    │
    ▼
Frontend Dashboard (refreshed)
```

---

## 💻 Frontend Application

### Main File: `rillation-analyticsv2.html`

**Type:** Single-Page Application (SPA)  
**Libraries:**
- Supabase JS Client (v2) - CDN
- Chart.js (v4) - CDN
- Vanilla JavaScript (ES6+)

**Structure:**
```
HTML Structure
├── Header (Title & Description)
├── Sidebar Navigation
│   ├── Reporting Section
│   └── Infrastructure Section
├── Main Content Area
│   ├── Tab Navigation
│   │   ├── Quick View
│   │   ├── Performance Overview
│   │   ├── GTM Scoreboard
│   │   ├── DeepView
│   │   └── Pipeline View
│   └── Dashboard Content (per tab)
└── Modals
    ├── Targets Configuration
    └── Detail Modals
```

---

### JavaScript Modules

#### 1. **analytics-core.js**
**Purpose:** Core Supabase client initialization and utilities

**Functions:**
- `initSupabase()` - Initialize Supabase client
- `getSupabaseClient()` - Get or create client instance
- `formatNumber()`, `formatPercentage()` - Formatting utilities
- `showError()`, `clearError()` - Error handling

**Dependencies:**
- `config.js` (for credentials)
- `@supabase/supabase-js` library

---

#### 2. **performance-overview.js**
**Purpose:** Performance metrics dashboard

**Features:**
- Date range filtering
- Client filtering
- Metric cards (emails, prospects, replies, meetings, bounces)
- Trend charts (Chart.js)
- Meeting detail modal

**Data Sources:**
- `campaign_reporting` table
- `replies` table
- `meetings_booked` table

**Key Functions:**
- `initPerformanceOverview()` - Initialize dashboard
- `loadPerformanceData()` - Query and display data
- `renderTrendChart()` - Create Chart.js visualization

---

#### 3. **quick-view.js**
**Purpose:** Quick client overview with targets comparison

**Features:**
- Client "bubbles" showing metrics vs targets
- Pagination
- Targets configuration modal
- Date range filtering

**Data Sources:**
- `campaign_reporting` table
- `replies` table
- `meetings_booked` table
- `client_targets` table

**Key Functions:**
- `initQuickView()` - Initialize dashboard
- `loadQuickViewData()` - Load client data
- `renderClientBubbles()` - Render client cards

---

#### 4. **gtm-scoreboard.js**
**Purpose:** GTM (Go-To-Market) scoreboard analytics

**Features:**
- High-level performance overview
- Ratio calculations
- Emails sent by date chart
- Client and date filtering

**Data Sources:**
- `campaign_reporting` table
- `meetings_booked` table

---

#### 5. **funnel-spreadsheet.js**
**Purpose:** Pipeline/funnel forecasting spreadsheet

**Features:**
- Editable spreadsheet interface
- Month/year selection
- Estimate vs Actual vs Projected columns
- Auto-save to Supabase

**Data Sources:**
- `funnel_forecasts` table (read/write)

**Key Functions:**
- `loadFunnelDataForMonth()` - Load data for month
- `saveFunnelDataForMonth()` - Save edited values
- `renderFunnelSpreadsheet()` - Render table

---

#### 6. **targets-config.js**
**Purpose:** Client targets configuration

**Features:**
- Modal interface
- Edit targets per client
- Save to Supabase

**Data Sources:**
- `client_targets` table (read/write)
- `Clients` table (for client list)

---

### Frontend Initialization Flow

```
1. HTML loads
   │
   ├── Loads CDN libraries (Supabase, Chart.js)
   ├── Loads config.js (credentials)
   └── Loads all JS modules
   
2. DOMContentLoaded event
   │
   ├── analytics-core.js: initSupabase()
   │   └── Creates Supabase client
   │
   ├── Restore active tab from localStorage
   │
   └── Initialize active dashboard:
       ├── performance-overview.js: initPerformanceOverview()
       ├── quick-view.js: initQuickView()
       ├── gtm-scoreboard.js: initGTMScoreboard()
       └── etc.
       
3. User Interaction
   │
   ├── Tab switching → switchToTab()
   ├── Filter changes → Reload data
   ├── Date preset → setDatePreset()
   └── Modal opens → Load configuration
```

---

## 🔧 Backend Services & Scripts

### 1. **sync-bison-replies.py**

**Purpose:** Sync email replies from Email Bison API to Supabase

**Execution:** Manual (run via command line)

**Flow:**
```
1. Connect to Supabase
2. Fetch all clients from Clients table
3. For each client:
   a. Get API token from Clients table
   b. Fetch replies from Bison API (GET /replies?page=1-10)
   c. Get existing replies from Supabase (by reply_id)
   d. Filter out duplicates
   e. Map Bison format → Supabase format
   f. Insert new replies into Supabase
4. Print statistics
```

**Data Mapping:**
- Bison `id` → Supabase `reply_id`
- Bison `date_received` → Supabase `date_received`
- Bison `interested` → Supabase `category` ("Interested" or "Not Interested")
- Bison `automated_reply` → Supabase `category` ("OOO")

**Frequency:** Manual (typically run daily or weekly)

---

### 2. **Supabase Edge Function: sync-leads**

**Location:** `supabase/functions/sync-leads/index.ts`  
**Type:** Deno TypeScript Edge Function  
**Purpose:** Enrich `meetings_booked` data from Rillation Revenue API

**Execution:** HTTP POST to Edge Function endpoint

**Flow:**
```
1. Query all booked_meetings with email addresses
2. For each meeting:
   a. Lookup in storeleads table (by email, then by domain)
   b. Get last_client from matched lead
   c. Get API token from Clients table (cache tokens)
   d. Call Rillation Revenue API: GET /leads/{email}
   e. Update booked_meetings with enriched data (only null fields)
3. Return statistics
```

**Deployment:**
```bash
supabase functions deploy sync-leads
```

**Invocation:**
```bash
curl -X POST https://pfxgcavxdktxooiqthoi.supabase.co/functions/v1/sync-leads \
  -H "Authorization: Bearer <anon-key>"
```

---

### 3. **query-replies-schema.py**

**Purpose:** Utility script to inspect Supabase table schema  
**Usage:** Debugging and documentation

---

## 🔗 Complete System Flow

### End-to-End: From Email Send to Dashboard Display

```
┌─────────────────────────────────────────────────────────────┐
│                    EMAIL CAMPAIGN SENT                        │
│              (via Email Bison Platform)                       │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ Email sent, opened, replied, etc.
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  EMAIL BISON API                             │
│         (https://send.rillationrevenue.com/api)              │
│                                                               │
│  • Tracks: emails_sent, opens, replies, bounces             │
│  • Stores: campaign data, inbox data, meeting data          │
└───────────────────────┬───────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Python     │ │   Edge       │ │   External   │
│   Script     │ │   Function   │ │   Process    │
│              │ │              │ │              │
│ sync-bison-  │ │ sync-leads   │ │ (Automated   │
│ replies.py   │ │              │ │  aggregation)│
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                 │
       │                │                 │
       ▼                ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│                                                               │
│  replies ────────────┐                                        │
│  campaign_reporting ─┼───────────────────────────────────────┤
│  meetings_booked ────┼──────────────────────────────────────┤
│  inboxes ────────────┼───────────────────────────────────────┤
│  storeleads ────────┘                                        │
│  Clients (config)                                             │
│  client_targets (config)                                     │
│  funnel_forecasts (manual)                                   │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ REST API Queries
                        │ JavaScript Client
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND DASHBOARD                              │
│         (rillation-analyticsv2.html)                        │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Performance Overview                                │    │
│  │  • Metrics cards                                     │    │
│  │  • Trend charts                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Quick View                                          │    │
│  │  • Client bubbles                                    │    │
│  │  • Targets comparison                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  GTM Scoreboard                                      │    │
│  │  • High-level metrics                                │    │
│  │  • Ratios                                            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Pipeline View                                       │    │
│  │  • Funnel spreadsheet                                 │    │
│  │  • Forecasts                                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Component Interactions

### Interaction 1: User Views Performance Overview

```
User Action: Opens "Performance Overview" tab
    │
    ▼
performance-overview.js: initPerformanceOverview()
    │
    ├── Sets up event listeners
    ├── Loads client filter from Clients table
    └── Calls loadPerformanceData()
        │
        ├── Queries campaign_reporting (filtered by client & date)
        ├── Queries replies (for reply counts)
        ├── Queries meetings_booked (for meeting counts)
        │
        └── Updates UI:
            ├── Metric cards (emails, prospects, replies, etc.)
            ├── Trend chart (Chart.js)
            └── Meeting detail modal (on click)
```

---

### Interaction 2: User Configures Targets

```
User Action: Clicks "Configure Targets" button
    │
    ▼
targets-config.js: openTargetsModal()
    │
    ├── Queries client_targets table
    ├── Queries Clients table (for client list)
    │
    └── Renders modal with:
        ├── Client sections
        ├── Input fields (emails_per_day, etc.)
        └── Save button
            │
            User edits values
            │
            User clicks "Save"
            │
            ▼
        targets-config.js: saveTargets()
            │
            └── Upserts to client_targets table
                │
                └── Quick View refreshes with new targets
```

---

### Interaction 3: Data Sync (Python Script)

```
Cron Job / Manual: python3 sync-bison-replies.py
    │
    ▼
sync-bison-replies.py: main()
    │
    ├── get_all_clients()
    │   └── Queries Supabase: Clients table
    │       └── Returns: [{name, api_token}, ...]
    │
    └── For each client:
        │
        ├── fetch_replies_from_bison(api_token)
        │   └── GET https://send.rillationrevenue.com/api/replies?page=1-10
        │       └── Returns: [{id, date_received, interested, ...}, ...]
        │
        ├── get_existing_replies(client_name)
        │   └── Queries Supabase: replies table
        │       └── Returns: Set of reply_ids
        │
        ├── Filter duplicates
        │
        ├── map_bison_reply_to_supabase(bison_reply, client_name)
        │   └── Maps Bison format → Supabase format
        │
        └── Insert to Supabase: replies table
            │
            └── Frontend automatically sees new data on next query
```

---

### Interaction 4: Lead Enrichment (Edge Function)

```
HTTP POST: /functions/v1/sync-leads
    │
    ▼
supabase/functions/sync-leads/index.ts
    │
    ├── Query booked_meetings (all rows with email)
    │
    └── For each meeting:
        │
        ├── Lookup in storeleads (by email, then domain)
        │   └── Get last_client
        │
        ├── Query Clients table (get API token)
        │   └── Cache token for performance
        │
        ├── GET https://send.rillationrevenue.com/api/leads/{email}
        │   └── Authorization: Bearer {api_token}
        │   └── Returns: {first_name, last_name, company, ...}
        │
        └── Update booked_meetings (only null fields)
            │
            └── Frontend sees enriched data on next query
```

---

## 🔐 Configuration & Credentials

### Configuration Files

#### **config.js**
**Location:** Root directory  
**Purpose:** Supabase credentials for frontend

**Contents:**
```javascript
window.SUPABASE_URL = 'https://pfxgcavxdktxooiqthoi.supabase.co';
window.SUPABASE_KEY = 'eyJhbGci...'; // Anon key
window.SUPABASE_ACCESS_TOKEN = 'sbp_...';
```

**Security:** ⚠️ Exposed to frontend (anon key is safe for public use)

---

#### **Python Scripts**
**Files:** `sync-bison-replies.py`, `query-replies-schema.py`  
**Credentials:** Hardcoded in scripts

**Security:** ⚠️ Contains anon key (should use service role key for backend)

---

#### **Supabase Edge Function**
**File:** `supabase/functions/sync-leads/index.ts`  
**Credentials:** Environment variables (automatically available)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Security:** ✅ Uses service role key (secure, backend only)

---

### Credential Types

1. **Anon Key** - Public, used by frontend (limited by RLS policies)
2. **Service Role Key** - Full access, backend only (Edge Functions)
3. **Access Token** - For MCP and advanced operations
4. **Client API Tokens** - Stored in `Clients` table, used to call Bison API

---

## 📊 Data Relationships

```
Clients (1) ──┐
              │
              ├──→ (1:N) campaign_reporting
              ├──→ (1:N) replies
              ├──→ (1:N) meetings_booked
              ├──→ (1:N) inboxes
              ├──→ (1:1) client_targets
              └──→ (1:N) Campaigns

campaign_reporting ──→ (N:1) Campaigns (via campaign_id)

replies ──→ (N:1) Campaigns (via campaign_id)

meetings_booked ──→ (N:1) Campaigns (via campaign_id)

storeleads ──→ (N:1) Clients (via last_client field)

funnel_forecasts ──→ (Independent, no foreign keys)
```

---

## 🚀 Deployment & Hosting

### Frontend
**Current:** Local file (open in browser)  
**Alternative:** Can be hosted on:
- Static hosting (Netlify, Vercel, GitHub Pages)
- Web server (Apache, Nginx)
- Supabase Storage (static files)

**Requirements:**
- All files in same directory structure
- `config.js` accessible
- `js/` folder accessible
- CORS enabled for Supabase API

---

### Backend Scripts
**Current:** Run locally via command line  
**Alternative:** Can be automated via:
- Cron jobs (Linux/Mac)
- Scheduled tasks (Windows)
- GitHub Actions
- Cloud Functions (AWS Lambda, Google Cloud Functions)

---

### Supabase Edge Functions
**Deployment:**
```bash
supabase functions deploy sync-leads
```

**Hosting:** Supabase (automatically hosted)

---

## 🔍 Key System Characteristics

### 1. **Single-Page Application (SPA)**
- No page reloads
- Tab-based navigation
- State managed in localStorage

### 2. **Real-time Data**
- Data fetched on-demand from Supabase
- No WebSocket connections
- Manual refresh required

### 3. **Modular Architecture**
- Each dashboard tab is separate module
- Shared core utilities (analytics-core.js)
- Independent initialization

### 4. **Data Sync Pattern**
- External APIs → Python/Edge Functions → Supabase → Frontend
- Manual sync scripts (not automated)
- Edge Functions for serverless processing

### 5. **Configuration-Driven**
- Client credentials stored in database
- Targets configurable via UI
- Forecasts editable via spreadsheet

---

## 📝 Notes & Considerations

### Current Limitations
1. **Manual Sync:** Python scripts require manual execution
2. **No Real-time Updates:** Frontend doesn't auto-refresh
3. **Case Sensitivity:** Table names are case-sensitive (`Clients` vs `clients`)
4. **Missing Tables:** Some infrastructure tables not yet created
5. **Table Name Mismatches:** Code references `leads` but table is `storeleads`

### Future Enhancements
1. **Automated Sync:** Schedule Python scripts via cron/cloud functions
2. **Real-time Updates:** WebSocket subscriptions to Supabase
3. **Table Name Standardization:** Fix code references to match actual tables
4. **Infrastructure Tables:** Create missing tables (domains, health metrics, etc.)
5. **Error Handling:** Improve error messages and retry logic
6. **Caching:** Implement client-side caching for better performance

---

## 🎯 Summary

The Rillation Revenue Analytics v3 system is a **comprehensive analytics platform** that:

1. **Aggregates** data from Email Bison API into Supabase
2. **Enriches** meeting data via Rillation Revenue API
3. **Stores** all data in 9 core Supabase tables
4. **Visualizes** data through 5 dashboard views
5. **Configures** targets and forecasts via UI

The system follows a **clear data flow**: External APIs → Sync Scripts → Supabase → Frontend Dashboard, with manual configuration and automated data aggregation.

---

**Document Version:** 1.0  
**Last Updated:** December 11, 2025  
**Author:** System Analysis


