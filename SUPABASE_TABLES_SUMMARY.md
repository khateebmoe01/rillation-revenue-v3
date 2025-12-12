# Supabase Tables Inventory

**Project:** pfxgcavxdktxooiqthoi  
**URL:** https://pfxgcavxdktxooiqthoi.supabase.co  
**Date:** December 11, 2025

---

## ✅ Existing Tables (9 total)

### 1. **campaign_reporting** (21 columns)
Main campaign performance metrics table.

**Columns:**
- `id`, `campaign_id`, `campaign_name`, `client`, `date`
- `emails_sent`, `total_leads_contacted`
- `opened`, `opened_percentage`
- `unique_opens_per_contact`, `unique_opens_per_contact_percentage`
- `unique_replies_per_contact`, `unique_replies_per_contact_percentage`
- `bounced`, `bounced_percentage`
- `unsubscribed`, `unsubscribed_percentage`
- `interested`, `interested_percentage`
- `created_at`, `updated_at`

**Purpose:** Daily campaign performance metrics

---

### 2. **replies** (13 columns)
Email reply tracking table.

**Columns:**
- `reply_id`, `type`, `lead_id`, `subject`, `category`
- `text_body`, `campaign_id`, `date_received`
- `from_email`, `primary_to_email`
- `created_at`, `updated_at`, `client`

**Purpose:** Tracks all email replies with categorization (Interested, OOO, etc.)

---

### 3. **meetings_booked** (13 columns)
Booked meetings/discovery calls table.

**Columns:**
- `first_name`, `last_name`, `full_name`, `title`
- `company`, `company_linkedin`, `company_domain`
- `campaign_name`, `profile_url`, `client`
- `created_time`, `campaign_id`, `email`

**Purpose:** Tracks all booked meetings with contact information

---

### 4. **Clients** (4 columns) ⚠️ Case-sensitive
Client configuration table with API credentials.

**Columns:**
- `Business` (client name)
- `Api Key - Bison`
- `Client ID - Bison`
- `App URL- Bison`

**Purpose:** Stores client API credentials for Bison integration

**Note:** Table name is case-sensitive (`Clients` not `clients`)

---

### 5. **client_targets** (9 columns)
Daily performance targets per client.

**Columns:**
- `id`, `client`
- `emails_per_day`, `prospects_per_day`
- `replies_per_day`, `bounces_per_day`, `meetings_per_day`
- `updated_at`, `created_at`

**Purpose:** Configuration for daily targets used in Quick View dashboard

---

### 6. **funnel_forecasts** (13 columns)
Monthly funnel forecasting and tracking.

**Columns:**
- `id`, `month`, `year`, `metric_key`
- `estimate_low`, `estimate_avg`, `estimate_high`
- `estimate_1`, `estimate_2`
- `actual`, `projected`
- `created_at`, `updated_at`

**Purpose:** Used in Pipeline View for monthly funnel projections

---

### 7. **inboxes** (26 columns)
Email inbox configuration and statistics.

**Columns:**
- `id`, `bison_inbox_id`, `workspace`, `name`, `email`
- `email_signature`, `imap_server`, `imap_port`
- `smtp_server`, `smtp_port`, `daily_limit`, `type`, `status`
- `emails_sent_count`, `total_replied_count`, `total_opened_count`
- `unsubscribed_count`, `bounced_count`
- `unique_replied_count`, `unique_opened_count`
- `total_leads_contacted_count`, `interested_leads_count`
- `tags`, `created_at`, `updated_at`, `synced_at`

**Purpose:** Infrastructure management - inbox configuration and metrics

---

### 8. **storeleads** (80 columns) 🔍 Discovered
Comprehensive lead/company data table.

**Key Columns:**
- `id`, `domain`, `emails`, `phones`
- `company_location`, `state`, `street_address`, `zip`
- `description`, `about_us_url`, `contact_page_url`
- `platform`, `plan`, `status`
- `products_sold`, `estimated_monthly_sales`, `estimated_monthly_pageviews`
- `facebook`, `instagram`, `twitter`, `linkedin_account`, `youtube`, `tiktok`, `pinterest`
- `created`, `technologies`, `technologies_count`
- ... (80 total columns)

**Purpose:** Rich lead/company database with social media, e-commerce, and contact data

**Note:** This is the actual table name (not `leads` or `companies`)

---

### 9. **Campaigns** (5 columns) 🔍 Discovered
Campaign master list.

**Columns:**
- `campaign_name`, `campaign_id`, `uuid`
- `client`, `created_at`

**Purpose:** Campaign reference/master data

**Note:** Table name is case-sensitive (`Campaigns` not `campaigns`)

---

## ❌ Missing Tables (Referenced in code but don't exist)

These tables are referenced in the codebase but don't exist in Supabase:

1. **`booked_meetings`** - Used in sync-leads function (use `meetings_booked` instead)
2. **`clients`** (lowercase) - Use `Clients` (capital C) instead
3. **`leads`** - Use `storeleads` instead
4. **`companies`** - Use `storeleads` instead
5. **`domains`** - Infrastructure table (not created yet)
6. **`inbox_health_metrics`** - Infrastructure table (not created yet)
7. **`domain_health_metrics`** - Infrastructure table (not created yet)
8. **`automation_settings`** - Infrastructure table (not created yet)
9. **`MeetingBooked`** - Use `meetings_booked` instead

---

## 📊 Summary Statistics

- **Total Tables Found:** 9
- **Core Analytics Tables:** 3 (campaign_reporting, replies, meetings_booked)
- **Configuration Tables:** 3 (Clients, client_targets, Campaigns)
- **Data Tables:** 1 (storeleads - 80 columns!)
- **Infrastructure Tables:** 1 (inboxes)
- **Forecasting Tables:** 1 (funnel_forecasts)

---

## 🔧 Recommendations

1. **Table Name Consistency:**
   - Code references `leads` but table is `storeleads`
   - Code references `companies` but table is `storeleads`
   - Code references `clients` (lowercase) but table is `Clients` (capital C)
   - Code references `booked_meetings` but table is `meetings_booked`

2. **Missing Infrastructure Tables:**
   - Consider creating: `domains`, `inbox_health_metrics`, `domain_health_metrics`, `automation_settings`

3. **Code Updates Needed:**
   - Update references from `leads` → `storeleads`
   - Update references from `companies` → `storeleads`
   - Update references from `clients` → `Clients`
   - Update references from `booked_meetings` → `meetings_booked`

---

## 📝 Notes

- Table names are **case-sensitive** in Supabase
- `storeleads` is a very comprehensive table with 80 columns
- Most infrastructure tables (domains, health metrics, automation) are not yet created
- The codebase has some inconsistencies with actual table names


