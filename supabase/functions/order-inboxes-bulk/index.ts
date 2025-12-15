// Supabase Edge Function: Place Bulk Inbox Orders
// Places bulk orders with Mission Inbox or InboxKit

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
    const { provider, quantity, domain, client } = await req.json()
    
    if (!provider || !quantity || !domain || !client) {
      throw new Error('provider, quantity, domain, and client are required')
    }

    if (quantity < 100) {
      throw new Error('Minimum order quantity is 100 inboxes')
    }

    if (!['missioninbox', 'inboxkit'].includes(provider)) {
      throw new Error('Provider must be missioninbox or inboxkit')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get provider credentials
    const { data: providerData, error: providerError } = await supabase
      .from('inbox_providers')
      .select('*')
      .eq('provider_name', provider)
      .eq('is_active', true)
      .single()

    if (providerError || !providerData) {
      throw new Error(`Provider ${provider} not configured: ${providerError?.message || 'not found'}`)
    }

    // Generate order number
    const orderNumber = `${provider.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Create order record first
    const { data: order, error: orderError } = await supabase
      .from('inbox_orders')
      .insert({
        order_number: orderNumber,
        provider: provider,
        client: client,
        quantity: quantity,
        domain: domain,
        status: 'pending',
        order_data: {},
      })
      .select()
      .single()

    if (orderError) {
      throw new Error(`Error creating order: ${orderError.message}`)
    }

    // Place order with provider API
    let providerOrderId = null
    let totalCost = null
    let inboxesCreated = 0
    let orderDetails: any = {}

    try {
      if (provider === 'missioninbox') {
        // Mission Inbox API call
        // Note: Actual API endpoint and format need to be determined from Mission Inbox documentation
        const missionInboxUrl = `https://api.missioninbox.com/v1/orders` // Placeholder URL
        
        const missionResponse = await fetch(missionInboxUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${providerData.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            workspace_id: providerData.workspace_id,
            project: client, // Client is a "Project" in Mission Inbox
            domain: domain,
            quantity: quantity,
          }),
        })

        if (missionResponse.ok) {
          const missionData = await missionResponse.json()
          providerOrderId = missionData.order_id || missionData.id
          totalCost = missionData.total_cost || missionData.cost
          inboxesCreated = missionData.inboxes_created || 0
          orderDetails = missionData
        } else {
          throw new Error(`Mission Inbox API error: ${missionResponse.status}`)
        }

      } else if (provider === 'inboxkit') {
        // InboxKit API call
        // Note: Actual API endpoint and format need to be determined from InboxKit documentation
        const inboxkitUrl = `https://api.inboxkit.com/v1/inboxes/bulk` // Placeholder URL
        
        const inboxkitResponse = await fetch(inboxkitUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${providerData.api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            domain: domain,
            quantity: quantity,
            workspace: client, // May need workspace ID instead
          }),
        })

        if (inboxkitResponse.ok) {
          const inboxkitData = await inboxkitResponse.json()
          providerOrderId = inboxkitData.order_id || inboxkitData.id
          totalCost = inboxkitData.total_cost || inboxkitData.cost
          inboxesCreated = inboxkitData.inboxes_created || inboxkitData.inboxes?.length || 0
          orderDetails = inboxkitData
        } else {
          throw new Error(`InboxKit API error: ${inboxkitResponse.status}`)
        }
      }

      // Update order with provider response
      await supabase
        .from('inbox_orders')
        .update({
          provider_order_id: providerOrderId,
          total_cost: totalCost,
          inboxes_created: inboxesCreated,
          order_data: orderDetails,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

    } catch (apiError) {
      // Update order status to failed
      await supabase
        .from('inbox_orders')
        .update({
          status: 'failed',
          order_data: { error: apiError instanceof Error ? apiError.message : String(apiError) },
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      throw apiError
    }

    return new Response(
      JSON.stringify({
        message: 'Order placed successfully',
        order_number: orderNumber,
        order_id: order.id,
        provider_order_id: providerOrderId,
        status: 'processing',
        quantity: quantity,
        inboxes_created: inboxesCreated,
        total_cost: totalCost,
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

