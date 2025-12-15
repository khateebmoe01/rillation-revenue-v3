// Debug script to test campaign_reporting table connection
// Add this to console to test

async function debugCampaignReporting() {
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_KEY = window.SUPABASE_KEY;
    
    console.log('Testing campaign_reporting connection...');
    console.log('URL:', SUPABASE_URL);
    console.log('Key present:', !!SUPABASE_KEY);
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing credentials');
        return;
    }
    
    const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // Test 1: Simple select
    console.log('\n=== Test 1: Select all ===');
    const { data: allData, error: allError } = await client
        .from('campaign_reporting')
        .select('*')
        .limit(5);
    
    if (allError) {
        console.error('Error:', allError);
    } else {
        console.log('Success! Rows:', allData.length);
        if (allData.length > 0) {
            console.log('Columns:', Object.keys(allData[0]));
            console.log('First row:', allData[0]);
        }
    }
    
    // Test 2: Count
    console.log('\n=== Test 2: Count ===');
    const { count, error: countError } = await client
        .from('campaign_reporting')
        .select('*', { count: 'exact', head: true });
    
    if (countError) {
        console.error('Count error:', countError);
    } else {
        console.log('Total rows:', count);
    }
    
    // Test 3: Aggregate
    console.log('\n=== Test 3: Aggregate test ===');
    const { data: aggData, error: aggError } = await client
        .from('campaign_reporting')
        .select('client, emails_sent, replies, meetings_booked');
    
    if (aggError) {
        console.error('Aggregate error:', aggError);
    } else {
        console.log('Aggregate data rows:', aggData.length);
        if (aggData.length > 0) {
            console.log('Sample:', aggData[0]);
        }
    }
    
    return { allData, count, aggData };
}

// Run on load
if (typeof window !== 'undefined') {
    window.debugCampaignReporting = debugCampaignReporting;
    console.log('Debug function available. Run: debugCampaignReporting()');
}
















