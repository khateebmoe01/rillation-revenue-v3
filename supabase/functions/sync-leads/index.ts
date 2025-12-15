// Supabase Edge Function: Sync Leads from External API
// This function processes booked_meetings, looks up leads, gets client tokens, and syncs data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BookedMeeting {
  id: string;
  email: string | null;
  domain: string | null;
  [key: string]: any;
}

interface Lead {
  email: string;
  domain: string | null;
  last_campaign: string | null;
  last_client: string | null;
  [key: string]: any;
}

interface Client {
  name: string;
  api_token: string | null;
  api_secret: string | null;
  [key: string]: any;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Step 1: Query all booked_meetings
    console.log('Querying booked_meetings...')
    const { data: bookedMeetings, error: bookedError } = await supabase
      .from('booked_meetings')
      .select('*')

    if (bookedError) {
      throw new Error(`Error querying booked_meetings: ${bookedError.message}`)
    }

    if (!bookedMeetings || bookedMeetings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No booked meetings found', processed: 0, updated: 0, errors: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Found ${bookedMeetings.length} booked meetings`)

    const results = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ email: string; error: string }>
    }

    // Cache for client tokens to avoid repeated queries
    const clientTokenCache = new Map<string, string>()

    // Step 2: Process each booked meeting
    for (const meeting of bookedMeetings as BookedMeeting[]) {
      const email = meeting.email
      if (!email) {
        console.log(`Skipping meeting ${meeting.id}: no email`)
        results.skipped++
        continue
      }

      results.processed++

      try {
        // Extract domain from email if not present
        let domain = meeting.domain
        if (!domain && email.includes('@')) {
          domain = email.split('@')[1]
        }

        // Step 3: Lookup in leads table - first by email, then by domain
        let lead: Lead | null = null

        // Try by email first
        const { data: leadByEmail, error: emailError } = await supabase
          .from('leads')
          .select('*')
          .eq('email', email)
          .limit(1)
          .single()

        if (!emailError && leadByEmail) {
          lead = leadByEmail as Lead
          console.log(`Found lead by email: ${email}`)
        } else if (domain) {
          // Try by domain if email lookup failed
          const { data: leadByDomain, error: domainError } = await supabase
            .from('leads')
            .select('*')
            .eq('domain', domain)
            .limit(1)
            .single()

          if (!domainError && leadByDomain) {
            lead = leadByDomain as Lead
            console.log(`Found lead by domain: ${domain}`)
          }
        }

        if (!lead) {
          console.log(`No lead found for email: ${email}, domain: ${domain}`)
          results.skipped++
          continue
        }

        // Step 4: Get last_client and last_campaign from lead
        const lastClient = lead.last_client
        const lastCampaign = lead.last_campaign

        if (!lastClient) {
          console.log(`No last_client found for lead: ${email}`)
          results.skipped++
          continue
        }

        // Step 5: Get client API token (with caching)
        let apiToken = clientTokenCache.get(lastClient)
        
        if (!apiToken) {
          // Try exact match first on Business field (client name)
          let { data: client, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('Business', lastClient)
            .limit(1)
            .maybeSingle()

          // If not found, try case-insensitive match on Business field
          if (clientError || !client) {
            const { data: clients, error: searchError } = await supabase
              .from('clients')
              .select('*')
              .ilike('Business', lastClient)
              .limit(1)

            if (!searchError && clients && clients.length > 0) {
              client = clients[0]
              clientError = null
            }
          }

          // Also try matching on 'name' field as fallback (in case some clients use it)
          if (clientError || !client) {
            const { data: clients, error: nameSearchError } = await supabase
              .from('clients')
              .select('*')
              .or(`name.ilike.%${lastClient}%,Business.ilike.%${lastClient}%`)
              .limit(1)

            if (!nameSearchError && clients && clients.length > 0) {
              client = clients[0]
              clientError = null
            }
          }

          if (clientError || !client) {
            throw new Error(`Client not found: ${lastClient}`)
          }

          const clientData = client as any
          // Try "Api Key - Bison" field first (from the clients table schema)
          apiToken = clientData['Api Key - Bison'] || clientData['api_key_bison'] || 
                     clientData.api_token || clientData.api_secret || 
                     clientData.token || clientData.secret || null

          if (!apiToken) {
            throw new Error(`No API token found for client: ${lastClient}. Available fields: ${Object.keys(clientData).join(', ')}`)
          }

          clientTokenCache.set(lastClient, apiToken)
          console.log(`Retrieved API token for client: ${lastClient}`)
        }

        // Step 6: Call external API
        const apiUrl = `https://send.rillationrevenue.com/api/leads/${encodeURIComponent(email)}`
        console.log(`Calling API: ${apiUrl}`)

        const apiResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        })

        if (!apiResponse.ok) {
          const errorText = await apiResponse.text()
          throw new Error(`API call failed: ${apiResponse.status} - ${errorText}`)
        }

        const apiData = await apiResponse.json()
        console.log(`API response received for ${email}:`, JSON.stringify(apiData).substring(0, 200))

        // Step 7: Update booked_meetings with API response data
        // Only update fields that are missing/null in booked_meetings
        const updateData: Record<string, any> = {}

        // Helper to check if value exists and is not null/empty
        const hasValue = (val: any) => val !== null && val !== undefined && val !== ''

        // Map common fields from API response to booked_meetings
        // Check both the field name and if the meeting field is empty
        if (hasValue(apiData.email) && !hasValue(meeting.email)) updateData.email = apiData.email
        if (hasValue(apiData.first_name) && !hasValue(meeting.first_name)) updateData.first_name = apiData.first_name
        if (hasValue(apiData.last_name) && !hasValue(meeting.last_name)) updateData.last_name = apiData.last_name
        if (hasValue(apiData.full_name) && !hasValue(meeting.full_name)) updateData.full_name = apiData.full_name
        if (hasValue(apiData.title) && !hasValue(meeting.title)) updateData.title = apiData.title
        if (hasValue(apiData.job_title) && !hasValue(meeting.job_title)) updateData.job_title = apiData.job_title
        if (hasValue(apiData.company) && !hasValue(meeting.company)) updateData.company = apiData.company
        if (hasValue(apiData.company_name) && !hasValue(meeting.company_name)) updateData.company_name = apiData.company_name
        if (hasValue(apiData.company_domain) && !hasValue(meeting.domain)) updateData.domain = apiData.company_domain
        if (hasValue(apiData.domain) && !hasValue(meeting.domain)) updateData.domain = apiData.domain
        if (hasValue(apiData.company_linkedin) && !hasValue(meeting.company_linkedin)) updateData.company_linkedin = apiData.company_linkedin
        if (hasValue(apiData.profile_url) && !hasValue(meeting.profile_url)) updateData.profile_url = apiData.profile_url
        if (hasValue(apiData.campaigns) && !hasValue(meeting.campaigns)) updateData.campaigns = apiData.campaigns
        if (hasValue(apiData.client) && !hasValue(meeting.client)) updateData.client = apiData.client

        // Always update last_enriched timestamp
        updateData.last_enriched = new Date().toISOString()

        // Always update (at minimum, last_enriched will be set)
        const { error: updateError } = await supabase
          .from('booked_meetings')
          .update(updateData)
          .eq('id', meeting.id)

        if (updateError) {
          throw new Error(`Failed to update booked_meetings: ${updateError.message}`)
        }

        const fieldsUpdated = Object.keys(updateData).length - 1 // minus last_enriched
        if (fieldsUpdated > 0) {
          results.updated++
          console.log(`Updated booked_meetings for ${email} with ${fieldsUpdated} fields`)
        } else {
          console.log(`Updated last_enriched timestamp for ${email} (no new data)`)
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Error processing ${email}:`, errorMessage)
        results.errors.push({
          email: email || 'unknown',
          error: errorMessage
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Sync completed',
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Function error:', errorMessage)
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

