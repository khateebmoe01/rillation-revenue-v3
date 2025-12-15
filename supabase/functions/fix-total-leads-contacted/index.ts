import { createClient } from "npm:@supabase/supabase-js@2.26.0";

const supabase = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");

// --------------------------------------------------

async function getAllCampaignRows() {
  try {
    const result = await supabase
      .from("campaign_reporting")
      .select("id, campaign_id, campaign_name, client, date, total_leads_contacted")
      .order("client", { ascending: true })
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
    console.error("Exception in getAllCampaignRows:", err);
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
    console.error(`Exception in getApiKey for ${clientName}:`, err);
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

  return statsData;
}

// --------------------------------------------------

function calculateNewLeadsContacted(statsData: any): number {
  const sequenceSteps = statsData.sequence_step_stats || [];
  
  if (!Array.isArray(sequenceSteps) || sequenceSteps.length === 0) {
    console.warn("No sequence_step_stats found in API response");
    return 0;
  }
  
  // Filter out follow-up emails (those with "Re:" in subject)
  const newLeadSteps = sequenceSteps.filter((step: any) => {
    const subject = (step.email_subject || '').toLowerCase();
    return !subject.includes('re:');
  });
  
  if (newLeadSteps.length === 0) {
    console.warn("No new lead steps found (all had 'Re:' in subject)");
    return 0;
  }
  
  // Sum the 'sent' values from new lead steps
  const total = newLeadSteps.reduce((sum: number, step: any) => {
    const sent = step.sent;
    let sentValue = 0;
    
    // Handle string numbers like "1" or numeric values
    if (typeof sent === 'string') {
      const parsed = parseInt(sent, 10);
      sentValue = isNaN(parsed) ? 0 : parsed;
    } else if (typeof sent === 'number') {
      sentValue = sent;
    }
    
    return sum + sentValue;
  }, 0);
  
  return total;
}

// --------------------------------------------------

async function updateTotalLeadsContacted(rowId: string, newValue: number) {
  try {
    const result = await supabase
      .from("campaign_reporting")
      .update({ total_leads_contacted: newValue })
      .eq("id", rowId);

    if (result.error) {
      console.error(`Error updating row ${rowId}:`, result.error);
      throw result.error;
    }

    return true;
  } catch (err) {
    console.error(`Exception in updateTotalLeadsContacted for row ${rowId}:`, err);
    throw err;
  }
}

// --------------------------------------------------

async function processCampaigns() {
  try {
    console.log("Starting fix-total-leads-contacted process...");

    // Check env vars
    if (!Deno.env.get("SUPABASE_URL")) {
      throw new Error("SUPABASE_URL not set");
    }
    if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
    }

    console.log("Fetching all campaign rows...");
    const allRows = await getAllCampaignRows();
    console.log(`Found ${allRows.length} campaign rows`);

    if (allRows.length === 0) {
      console.log("No campaign rows found");
      return { processed: 0, updated: 0, skipped: 0, errors: [] };
    }

    // Group rows by client for efficient API token caching
    const rowsByClient = new Map<string, any[]>();
    for (const row of allRows) {
      const client = row.client || 'Unknown';
      if (!rowsByClient.has(client)) {
        rowsByClient.set(client, []);
      }
      rowsByClient.get(client)!.push(row);
    }

    console.log(`Processing ${rowsByClient.size} clients...`);

    const results: any[] = [];
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    const errors: any[] = [];

    // Cache for API tokens per client
    const apiKeyCache = new Map<string, string | null>();

    // Process each client's rows
    for (const [clientName, rows] of rowsByClient) {
      console.log(`\nProcessing client: ${clientName} (${rows.length} rows)`);

      // Get API key for this client (with caching)
      let apiKey = apiKeyCache.get(clientName);
      if (apiKey === undefined) {
        apiKey = await getApiKey(clientName);
        apiKeyCache.set(clientName, apiKey);
      }

      if (!apiKey) {
        console.log(`  ⚠️  No API key found for client: ${clientName}`);
        skipped += rows.length;
        for (const row of rows) {
          errors.push({
            campaign_id: row.campaign_id,
            date: row.date,
            error: `No API key for client: ${clientName}`
          });
        }
        continue;
      }

      // Process each row for this client
      for (const row of rows) {
        const { id, campaign_id, campaign_name, date, total_leads_contacted: currentValue } = row;

        try {
          console.log(`  Processing campaign ${campaign_id} (${campaign_name}) on ${date} (current: ${currentValue})`);

          // Fetch stats from API
          const statsData = await fetchStats(campaign_id, apiKey, date);

          // Skip campaigns with no sequence
          if (!statsData) {
            console.log(`    ⏭️  Skipped - no sequence`);
            results.push({
              campaign_id,
              date,
              skipped: true,
              reason: "no sequence"
            });
            skipped++;
            continue;
          }

          // Calculate new leads contacted from sequence_step_stats
          const newValue = calculateNewLeadsContacted(statsData);

          console.log(`    Calculated new value: ${newValue} (was: ${currentValue})`);

          // Update if value changed
          if (newValue !== currentValue) {
            await updateTotalLeadsContacted(id, newValue);
            console.log(`    ✅ Updated: ${currentValue} → ${newValue}`);
            updated++;
          } else {
            console.log(`    ✓ Already correct: ${newValue}`);
          }

          results.push({
            campaign_id,
            campaign_name,
            client: clientName,
            date,
            previous_value: currentValue,
            new_value: newValue,
            updated: newValue !== currentValue
          });

          processed++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));

        } catch (err: any) {
          const errorMsg = `Error processing campaign ${campaign_id} on ${date}: ${err.message}`;
          console.error(`    ❌ ${errorMsg}`);
          errors.push({
            campaign_id,
            date,
            error: err.message
          });
          skipped++;
        }
      }
    }

    console.log(`\nCompleted processing: ${processed} processed, ${updated} updated, ${skipped} skipped, ${errors.length} errors`);

    return {
      processed,
      updated,
      skipped,
      errors: errors.slice(0, 50), // Return first 50 errors
      results: results.slice(0, 20) // Return first 20 results as sample
    };

  } catch (err: any) {
    console.error("FATAL ERROR:", err.message, err.stack);
    throw err;
  }
}

// --------------------------------------------------

Deno.serve(async () => {
  try {
    const result = await processCampaigns();
    
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
  } catch (err: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message
    }, null, 2), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});

