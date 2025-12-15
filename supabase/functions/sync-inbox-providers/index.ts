// Supabase Edge Function: Sync Inbox Data from Providers
// Syncs inbox data from Mission Inbox and InboxKit APIs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get all active inbox providers
    const { data: providers, error: providersError } = await supabase
      .from('inbox_providers')
      .select('*')
      .eq('is_active', true)

    if (providersError) {
      throw new Error(`Error fetching providers: ${providersError.message}`)
    }

    const results = {
      missioninbox: { synced: 0, errors: [] },
      inboxkit: { synced: 0, errors: [] },
    }

    // Sync each provider
    for (const provider of providers || []) {
      try {
        if (provider.provider_name === 'missioninbox') {
          // Mission Inbox: Single workspace, clients are "Projects"
          const missionUrl = `https://api.missioninbox.com/v1/workspaces/${provider.workspace_id}/projects` // Placeholder URL
          
          const missionResponse = await fetch(missionUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${provider.api_key}`,
              'Content-Type': 'application/json',
            },
          })

          if (missionResponse.ok) {
            const missionData = await missionResponse.json()
            const projects = missionData.projects || missionData || []

            for (const project of projects) {
              // Get inboxes for this project
              const inboxesUrl = `https://api.missioninbox.com/v1/projects/${project.id}/inboxes` // Placeholder URL
              const inboxesResponse = await fetch(inboxesUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${provider.api_key}`,
                  'Content-Type': 'application/json',
                },
              })

              if (inboxesResponse.ok) {
                const inboxesData = await inboxesResponse.json()
                const inboxes = inboxesData.inboxes || inboxesData || []

                // Upsert inboxes
                for (const inbox of inboxes) {
                  await supabase
                    .from('inboxes')
                    .upsert({
                      bison_inbox_id: inbox.id || inbox.inbox_id,
                      workspace: project.name || project.client || inbox.client,
                      email: inbox.email,
                      name: inbox.name || inbox.email,
                      status: inbox.status || 'active',
                      type: 'missioninbox',
                      provider: 'missioninbox',
                      synced_at: new Date().toISOString(),
                    }, {
                      onConflict: 'bison_inbox_id',
                    })
                }

                results.missioninbox.synced += inboxes.length
              }
            }
          } else {
            results.missioninbox.errors.push(`API error: ${missionResponse.status}`)
          }

        } else if (provider.provider_name === 'inboxkit') {
          // InboxKit: May have multiple workspaces
          const inboxkitUrl = `https://api.inboxkit.com/v1/workspaces` // Placeholder URL
          
          const inboxkitResponse = await fetch(inboxkitUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${provider.api_key}`,
              'Content-Type': 'application/json',
            },
          })

          if (inboxkitResponse.ok) {
            const inboxkitData = await inboxkitResponse.json()
            const workspaces = inboxkitData.workspaces || inboxkitData || []

            for (const workspace of workspaces) {
              // Get inboxes for this workspace
              const inboxesUrl = `https://api.inboxkit.com/v1/workspaces/${workspace.id}/inboxes` // Placeholder URL
              const inboxesResponse = await fetch(inboxesUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${provider.api_key}`,
                  'Content-Type': 'application/json',
                },
              })

              if (inboxesResponse.ok) {
                const inboxesData = await inboxesResponse.json()
                const inboxes = inboxesData.inboxes || inboxesData || []

                // Upsert inboxes
                for (const inbox of inboxes) {
                  await supabase
                    .from('inboxes')
                    .upsert({
                      bison_inbox_id: inbox.id || inbox.inbox_id,
                      workspace: workspace.name || workspace.client || inbox.client,
                      email: inbox.email,
                      name: inbox.name || inbox.email,
                      status: inbox.status || 'active',
                      type: 'inboxkit',
                      provider: 'inboxkit',
                      synced_at: new Date().toISOString(),
                    }, {
                      onConflict: 'bison_inbox_id',
                    })
                }

                results.inboxkit.synced += inboxes.length
              }
            }
          } else {
            results.inboxkit.errors.push(`API error: ${inboxkitResponse.status}`)
          }
        }

        // Update last_sync_at
        await supabase
          .from('inbox_providers')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', provider.id)

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        results[provider.provider_name as keyof typeof results].errors.push(errorMsg)
        console.error(`Error syncing ${provider.provider_name}:`, error)
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Inbox providers synced',
        results: results,
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

