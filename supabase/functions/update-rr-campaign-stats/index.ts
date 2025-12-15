import { createClient } from "npm:@supabase/supabase-js@2.26.0";

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

// --------------------------------------------------

async function getAllRRCampaignRows() {
  try {
    const result = await supabase
      .from("campaign_reporting")
      .select("id, campaign_id, campaign_name, client, date, emails_sent, total_leads_contacted")
      .eq("client", "Rillation Revenue")
      .order("date", { ascending: false })
      .order("campaign_id", { ascending: true });

    if (!result) {
      console.error("No result from campaign_reporting query");
      return [];
    }

    if (result.error) {
      console.error("Error fetching campaign rows:", result.error);
      return [];
    }

    return result.data || [];
  } catch (err) {
    console.error("Exception in getAllRRCampaignRows:", err);
    return [];
  }
}

// --------------------------------------------------

async function getApiKey(clientName: string) {
  if (!clientName) return null;

  try {
    const result = await supabase
      .from("Clients")
      .select('"Api Key - Bison"')
      .eq("Business", clientName)
      .single();

    if (!result) {
      return null;
    }

    if (result.error || !result.data) {
      return null;
    }

    return result.data["Api Key - Bison"] || null;
  } catch (err) {
    console.error("Exception in getApiKey:", err);
    return null;
  }
}

// --------------------------------------------------

async function fetchStats(id: number, key: string, date: string) {
  const res = await fetch(`https://send.rillationrevenue.com/api/campaigns/${id}/stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify({
      start_date: date,
      end_date: date
    })
  });

  // === SKIP IF NO SEQUENCE ===
  if (res.status === 400) {
    const txt = await res.text();
    if (txt.includes("can only be viewed for campaigns with a sequence")) {
      return null; // skip
    }
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`fetchStats error for campaign ${id} (${date}): ${res.status} - ${txt}`);
  }

  const json = await res.json();

  // Extract data from response - ensure we get the correct structure
  const statsData = json.data || json;

  if (!statsData || typeof statsData !== 'object') {
    return null;
  }

  // Helper function to convert string numbers to integers
  const toInt = (val: any) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 0 : parsed;
    }
    return typeof val === 'number' ? val : 0;
  };

  // Helper function to convert string numbers to floats
  const toFloat = (val: any) => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    }
    return typeof val === 'number' ? val : 0;
  };

  // Extract and convert all fields properly
  const emailsSent = toInt(statsData.emails_sent);
  const totalLeadsContacted = toInt(statsData.total_leads_contacted);

  // Log to verify extraction (for debugging)
  console.log(`Campaign ${id} on ${date}: emails_sent=${emailsSent}, total_leads_contacted=${totalLeadsContacted} (raw: ${statsData.total_leads_contacted})`);

  // Warn if total_leads_contacted seems incorrect (should be roughly half of emails_sent)
  if (emailsSent > 0 && totalLeadsContacted > 0) {
    const ratio = totalLeadsContacted / emailsSent;
    if (ratio > 0.8 || ratio < 0.2) {
      console.warn(`⚠️ Campaign ${id} on ${date}: total_leads_contacted (${totalLeadsContacted}) seems unusual relative to emails_sent (${emailsSent}). Ratio: ${(ratio * 100).toFixed(1)}%`);
    }
  }

  return {
    emails_sent: emailsSent,
    total_leads_contacted: totalLeadsContacted,
    opened: toInt(statsData.opened),
    opened_percentage: toFloat(statsData.opened_percentage),
    unique_opens_per_contact: toInt(statsData.unique_opens_per_contact),
    unique_opens_per_contact_percentage: toFloat(statsData.unique_opens_per_contact_percentage),
    unique_replies_per_contact: toInt(statsData.unique_replies_per_contact),
    unique_replies_per_contact_percentage: toFloat(statsData.unique_replies_per_contact_percentage),
    bounced: toInt(statsData.bounced),
    bounced_percentage: toFloat(statsData.bounced_percentage),
    unsubscribed: toInt(statsData.unsubscribed),
    unsubscribed_percentage: toFloat(statsData.unsubscribed_percentage),
    interested: toInt(statsData.interested),
    interested_percentage: toFloat(statsData.interested_percentage)
  };
}

// --------------------------------------------------

async function storeSummary(c: any, data: any, date: string) {
  try {
    const row = {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      client: c.client,
      date,
      emails_sent: data.emails_sent || 0,
      total_leads_contacted: data.total_leads_contacted || 0,
      opened: data.opened || 0,
      opened_percentage: data.opened_percentage || 0,
      unique_opens_per_contact: data.unique_opens_per_contact || 0,
      unique_opens_per_contact_percentage: data.unique_opens_per_contact_percentage || 0,
      unique_replies_per_contact: data.unique_replies_per_contact || 0,
      unique_replies_per_contact_percentage: data.unique_replies_per_contact_percentage || 0,
      bounced: data.bounced || 0,
      bounced_percentage: data.bounced_percentage || 0,
      unsubscribed: data.unsubscribed || 0,
      unsubscribed_percentage: data.unsubscribed_percentage || 0,
      interested: data.interested || 0,
      interested_percentage: data.interested_percentage || 0
    };

    const result = await supabase.from("campaign_reporting").upsert(row, {
      onConflict: "campaign_id,client,date"
    });

    if (result.error) {
      console.error(`Error storing summary for campaign ${c.campaign_id} on ${date}:`, result.error);
      throw result.error;
    }
  } catch (err) {
    console.error(`Exception in storeSummary for campaign ${c.campaign_id} on ${date}:`, err);
    throw err;
  }
}

// --------------------------------------------------

async function processCampaigns() {
  try {
    console.log("Starting Rillation Revenue campaign-stats update...");

    // Check env vars
    if (!Deno.env.get("SUPABASE_URL")) {
      throw new Error("SUPABASE_URL not set");
    }
    if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
    }

    console.log(`Fetching all Rillation Revenue campaign rows...`);
    const campaignRows = await getAllRRCampaignRows();
    console.log(`Found ${campaignRows.length} campaign rows`);

    if (campaignRows.length === 0) {
      console.log("No campaign rows found for Rillation Revenue");
      return { processed: 0, updated: 0, skipped: 0, errors: [] };
    }

    const apiKey = await getApiKey("Rillation Revenue");
    if (!apiKey) {
      throw new Error("No API key found for Rillation Revenue");
    }

    const results: any[] = [];
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Group rows by campaign_id and date to avoid duplicates
    const uniqueRows = new Map<string, any>();
    for (const row of campaignRows) {
      const key = `${row.campaign_id}_${row.date}`;
      if (!uniqueRows.has(key)) {
        uniqueRows.set(key, row);
      }
    }

    console.log(`Processing ${uniqueRows.size} unique campaign-date combinations...`);

    for (const [key, row] of uniqueRows) {
      const { campaign_id, campaign_name, date, emails_sent, total_leads_contacted } = row;

      try {
        console.log(`Processing campaign: ${campaign_id} - ${campaign_name} on ${date} (current: emails_sent=${emails_sent}, total_leads_contacted=${total_leads_contacted})`);

        const stats = await fetchStats(campaign_id, apiKey, date);

        // skip campaigns with no sequence
        if (!stats) {
          console.log(`  ⏭️  Skipped - no sequence`);
          results.push({
            campaign_id,
            date,
            skipped: true,
            reason: "no sequence"
          });
          skipped++;
          continue;
        }

        // Update the row with new stats
        await storeSummary(
          { campaign_id, campaign_name, client: "Rillation Revenue" },
          stats,
          date
        );

        results.push({
          campaign_id,
          campaign_name,
          client: "Rillation Revenue",
          date,
          stats,
          previous_total_leads_contacted: total_leads_contacted,
          new_total_leads_contacted: stats.total_leads_contacted
        });

        console.log(`  ✓ Updated - total_leads_contacted: ${total_leads_contacted} → ${stats.total_leads_contacted}`);
        updated++;
        processed++;

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

      } catch (err: any) {
        const errorMsg = `Error processing campaign ${campaign_id} on ${date}: ${err.message}`;
        console.error(`  ❌ ${errorMsg}`);
        errors.push({
          campaign_id,
          date,
          error: err.message
        });
        skipped++;
      }
    }

    console.log(`Completed processing: ${processed} updated, ${skipped} skipped, ${errors.length} errors`);

    return {
      processed,
      updated,
      skipped,
      errors,
      results: results.slice(0, 10) // Return first 10 results as sample
    };

  } catch (err: any) {
    console.error("FATAL ERROR:", err.message, err.stack);
    throw err;
  }
}

// --------------------------------------------------

Deno.serve(async () => {
  // Start processing in background and return immediately
  const result = await processCampaigns().catch(err => {
    console.error("Background processing error:", err);
    return { error: err.message };
  });

  return new Response(JSON.stringify({
    ok: true,
    message: "Processing completed",
    ...result
  }, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
});

