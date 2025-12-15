// Quick script to add Porkbun API credentials to domain_providers table
// Run this in browser console after opening the dashboard

async function setupPorkbunAPI() {
    const client = window.getSupabaseClient();
    if (!client) {
        console.error('Supabase client not available');
        return;
    }
    
    const apiKey = 'pk1_43969474039c7e28cc009730f0f93f8c3bf346848c9d037fdbb154872af6f47a';
    // Note: Porkbun requires both API key and secret key
    // You'll need to provide the secret key as well
    
    console.log('Adding Porkbun API credentials...');
    
    const { data, error } = await client
        .from('domain_providers')
        .upsert({
            provider_name: 'porkbun',
            api_key: apiKey,
            api_secret: 'YOUR_SECRET_KEY_HERE', // Replace with actual secret key
            is_active: true,
        }, {
            onConflict: 'provider_name',
        })
        .select();
    
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('✅ Porkbun API credentials added:', data);
    }
}

// Run it
setupPorkbunAPI();

