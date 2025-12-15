// Supabase Edge Function: Check Domain Availability via Porkbun API
// Checks domain availability in real-time and caches results

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PorkbunCheckResponse {
  status: string;
  available?: boolean;
  price?: string;
  message?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { domains } = await req.json()
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      throw new Error('domains array is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Porkbun API credentials
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

    const results = []
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour cache

    // Check each domain
    for (const domain of domains) {
      // Check cache first
      const { data: cached } = await supabase
        .from('domain_availability_checks')
        .select('*')
        .eq('domain_name', domain)
        .gt('expires_at', now.toISOString())
        .single()

      if (cached) {
        results.push({
          domain,
          is_available: cached.is_available,
          price: cached.price,
          cached: true,
        })
        continue
      }

      // Call Porkbun API
      try {
        const porkbunUrl = 'https://porkbun.com/api/json/v3/domain/check'

        // Log for debugging (mask sensitive parts)
        console.log(`Checking domain: ${domain}`)
        console.log(`API Key present: ${!!apiKey}, length: ${apiKey?.length}`)
        console.log(`API Secret present: ${!!apiSecret}, length: ${apiSecret?.length}`)

        const requestBody = {
          apikey: apiKey,
          secretapikey: apiSecret,
          domain: domain,
        }

        const porkbunResponse = await fetch(porkbunUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        })

        console.log(`Porkbun response status: ${porkbunResponse.status}`)

        if (!porkbunResponse.ok) {
          const errorText = await porkbunResponse.text()
          console.error(`Porkbun API error response: ${errorText}`)
          throw new Error(`Porkbun API error: ${porkbunResponse.status} - ${errorText}`)
        }

        const porkbunData: PorkbunCheckResponse = await porkbunResponse.json()
        console.log(`Porkbun response data:`, porkbunData)

        const isAvailable = porkbunData.status === 'SUCCESS' && porkbunData.available === true
        const price = porkbunData.price ? parseFloat(porkbunData.price) : null

        // Cache the result
        await supabase
          .from('domain_availability_checks')
          .upsert({
            domain_name: domain,
            is_available: isAvailable,
            price: price,
            provider: 'porkbun',
            checked_at: now.toISOString(),
            expires_at: expiresAt.toISOString(),
          }, {
            onConflict: 'domain_name',
          })

        results.push({
          domain,
          is_available: isAvailable,
          price: price,
          cached: false,
        })

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error checking domain ${domain}:`, error)
        results.push({
          domain,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Domain availability checked',
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

