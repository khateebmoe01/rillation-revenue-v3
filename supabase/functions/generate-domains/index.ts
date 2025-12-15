// Supabase Edge Function: Generate Domain Names
// Generates domain combinations from base name + prefixes/suffixes

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
    const { base_name, prefixes, suffixes, client, check_availability } = await req.json()
    
    if (!base_name) {
      throw new Error('base_name is required')
    }

    const prefixList = prefixes || []
    const suffixList = suffixes || []
    const tld = '.co' // Default TLD, can be made configurable

    // Generate domain combinations
    const generatedDomains: string[] = []

    // Prefix combinations: prefix + base_name + tld
    for (const prefix of prefixList) {
      if (prefix && prefix.trim()) {
        generatedDomains.push(`${prefix}${base_name}${tld}`)
      }
    }

    // Suffix combinations: base_name + suffix + tld
    for (const suffix of suffixList) {
      if (suffix && suffix.trim()) {
        generatedDomains.push(`${base_name}${suffix}${tld}`)
      }
    }

    // Store generation session
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // If check_availability is true, check availability for all domains
    let availabilityResults = null
    if (check_availability && generatedDomains.length > 0) {
      // Call check-domain-availability function
      const checkUrl = `${supabaseUrl}/functions/v1/check-domain-availability`
      const checkResponse = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domains: generatedDomains }),
      })

      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        availabilityResults = checkData.results || []
      }
    }

    // Store generation session
    const { data: generation, error: genError } = await supabase
      .from('domain_generations')
      .insert({
        client: client || null,
        base_name: base_name,
        prefixes: prefixList,
        suffixes: suffixList,
        generated_count: generatedDomains.length,
        available_count: availabilityResults ? availabilityResults.filter((r: any) => r.is_available).length : 0,
        checked_at: check_availability ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (genError) {
      console.error('Error storing generation:', genError)
      // Continue even if storage fails
    }

    // Combine domains with availability results
    const domainsWithAvailability = generatedDomains.map((domain) => {
      const availability = availabilityResults?.find((r: any) => r.domain === domain)
      return {
        domain,
        is_available: availability?.is_available ?? null,
        price: availability?.price ?? null,
        cached: availability?.cached ?? false,
      }
    })

    return new Response(
      JSON.stringify({
        message: 'Domains generated successfully',
        base_name,
        generated_count: generatedDomains.length,
        available_count: availabilityResults ? availabilityResults.filter((r: any) => r.is_available).length : null,
        domains: domainsWithAvailability,
        generation_id: generation?.id || null,
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

