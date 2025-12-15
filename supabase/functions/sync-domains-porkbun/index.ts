// Supabase Edge Function: Sync Domains from Porkbun API
// Syncs all domains from Porkbun every 5 minutes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PorkbunDomain {
  domain: string;
  status: string;
  create_date: string;
  expire_date: string;
  security: {
    lock: boolean;
  };
}

interface PorkbunResponse {
  status: string;
  domains?: PorkbunDomain[];
  message?: string;
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

    // Get Porkbun API credentials from domain_providers table
    const { data: provider, error: providerError } = await supabase
      .from('domain_providers')
      .select('*')
      .eq('provider_name', 'porkbun')
      .eq('is_active', true)
      .single()

    if (providerError || !provider) {
      throw new Error(`Porkbun provider not configured: ${providerError?.message || 'not found'}`)
    }

    const apiKey = provider.api_key
    const apiSecret = provider.api_secret

    if (!apiKey || !apiSecret) {
      throw new Error('Porkbun API credentials not configured')
    }

    // Call Porkbun API to get all domains
    console.log('Fetching domains from Porkbun API...')
    const porkbunUrl = 'https://porkbun.com/api/json/v3/domain/listAll'
    
    const porkbunResponse = await fetch(porkbunUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: apiKey,
        secretapikey: apiSecret,
      }),
    })

    if (!porkbunResponse.ok) {
      const errorText = await porkbunResponse.text()
      throw new Error(`Porkbun API error: ${porkbunResponse.status} - ${errorText}`)
    }

    const porkbunData: PorkbunResponse = await porkbunResponse.json()

    if (porkbunData.status !== 'SUCCESS' || !porkbunData.domains) {
      throw new Error(`Porkbun API returned error: ${porkbunData.message || 'Unknown error'}`)
    }

    console.log(`Found ${porkbunData.domains.length} domains from Porkbun`)

    // Process and upsert domains
    const domainsToUpsert = porkbunData.domains.map((domain: PorkbunDomain) => {
      // Parse dates
      const registrationDate = domain.create_date ? new Date(domain.create_date).toISOString().split('T')[0] : null
      const expirationDate = domain.expire_date ? new Date(domain.expire_date).toISOString().split('T')[0] : null
      
      // Determine status
      let status = 'active'
      if (domain.status === 'expired') {
        status = 'expired'
      } else if (domain.status === 'pending') {
        status = 'pending'
      }

      return {
        domain_name: domain.domain,
        provider: 'porkbun',
        status: status,
        expiration_date: expirationDate,
        registration_date: registrationDate,
        porkbun_domain_id: domain.domain, // Using domain as ID for now
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    // Upsert domains (update if exists, insert if new)
    const { data: upsertedDomains, error: upsertError } = await supabase
      .from('domains')
      .upsert(domainsToUpsert, {
        onConflict: 'domain_name',
        ignoreDuplicates: false,
      })
      .select()

    if (upsertError) {
      throw new Error(`Error upserting domains: ${upsertError.message}`)
    }

    // Update last_sync_at for provider
    await supabase
      .from('domain_providers')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('provider_name', 'porkbun')

    return new Response(
      JSON.stringify({
        message: 'Domains synced successfully',
        domains_synced: upsertedDomains?.length || 0,
        total_domains: porkbunData.domains.length,
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

