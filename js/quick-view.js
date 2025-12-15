// Quick View Dashboard - Client bubbles with actual vs target metrics

let quickViewData = null;
let currentPage = 1;
const clientsPerPage = 10;

// Get supabase client from global scope
function getSupabaseClient() {
    // Use the global function from analytics-core.js if available
    // Guard against infinite recursion by ensuring we don't call ourselves
    if (window.getSupabaseClient && typeof window.getSupabaseClient === 'function' && window.getSupabaseClient !== getSupabaseClient) {
        const client = window.getSupabaseClient();
        if (client) return client;
    }
    
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        return supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }
    
    console.error('Cannot get Supabase client');
    return null;
}

// Load campaigns for Quick View filter
async function loadCampaignsForQuickViewFilter() {
    console.log('🔄 Loading campaigns for Quick View filter...');
    const client = getSupabaseClient();
    
    if (!client) {
        console.error('❌ Supabase client not available');
        return;
    }
    
    const campaignFilter = document.getElementById('qv-campaign-filter');
    if (!campaignFilter) {
        console.error('❌ Campaign filter element not found');
        return;
    }
    
    try {
        // Get unique campaigns by campaign_id from campaign_reporting
        let query = client
            .from('campaign_reporting')
            .select('campaign_id, campaign_name')
            .not('campaign_id', 'is', null)
            .not('campaign_name', 'is', null);
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading campaigns:', error);
            return;
        }
        
        // Group by campaign_id to get unique campaigns
        const campaignMap = new Map();
        (data || []).forEach(row => {
            const campaignId = row.campaign_id;
            if (campaignId && !campaignMap.has(campaignId)) {
                campaignMap.set(campaignId, {
                    id: campaignId,
                    name: row.campaign_name
                });
            }
        });
        
        // Convert to array and sort by name
        const uniqueCampaigns = Array.from(campaignMap.values())
            .sort((a, b) => a.name.localeCompare(b.name));
        
        // Populate filter
        campaignFilter.innerHTML = '<option value="">All Campaigns</option>';
        uniqueCampaigns.forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.name;
            option.textContent = campaign.name;
            option.setAttribute('data-campaign-id', campaign.id);
            campaignFilter.appendChild(option);
        });
        
        console.log('✅ Campaign filter populated with', uniqueCampaigns.length, 'unique campaigns');
    } catch (err) {
        console.error('❌ Error loading campaigns:', err);
    }
}

// Initialize Quick View
function initQuickView() {
    console.log('🚀 ========== INIT QUICK VIEW START ==========');
    console.log('🚀 Initializing Quick View...');
    
    try {
        // Immediately clear loading state and show initializing message
        const bubblesContainer = document.getElementById('qv-client-bubbles');
        console.log('📦 Bubbles container found:', !!bubblesContainer);
        
        if (!bubblesContainer) {
            console.error('❌ CRITICAL: qv-client-bubbles element not found in DOM!');
            // Try to find the Quick View container
            const quickViewContainer = document.getElementById('quick-view');
            console.log('📦 Quick View container found:', !!quickViewContainer);
            if (quickViewContainer) {
                console.log('📦 Quick View container HTML:', quickViewContainer.innerHTML.substring(0, 200));
            }
            return;
        }
        
        bubblesContainer.innerHTML = '<div class="loading">🚀 Initializing Quick View...</div>';
        console.log('✅ Loading message set');
        
        // Check for required DOM elements first
        const dateStartEl = document.getElementById('qv-date-start');
        const dateEndEl = document.getElementById('qv-date-end');
        
        console.log('📅 Date elements:', { 
            dateStartEl: !!dateStartEl, 
            dateEndEl: !!dateEndEl,
            dateStartId: dateStartEl?.id,
            dateEndId: dateEndEl?.id
        });
        
        if (!dateStartEl || !dateEndEl) {
            console.error('❌ Date input elements not found. Elements:', { dateStartEl: !!dateStartEl, dateEndEl: !!dateEndEl });
            bubblesContainer.innerHTML = '<div class="error"><strong>Error:</strong> Date range inputs not found.<br><small>Please refresh the page. Check console for details.</small></div>';
            return;
        }
    
        // Check for Supabase client
        console.log('🔌 Checking for Supabase client...');
        const client = getSupabaseClient();
        if (!client) {
            console.error('❌ Supabase client not available, retrying in 1 second...');
            bubblesContainer.innerHTML = '<div class="loading">⏳ Waiting for database connection...</div>';
            setTimeout(() => {
                console.log('🔄 Retrying initQuickView after timeout...');
                initQuickView();
            }, 1000);
            return;
        }
        
        console.log('✅ Supabase client found');
        console.log('✅ All required elements found, proceeding with initialization');
    
        // Initialize targets modal
        if (window.initTargetsModal) {
            try {
                window.initTargetsModal();
                console.log('✅ Targets modal initialized');
            } catch (err) {
                console.warn('⚠️ Error initializing targets modal:', err);
            }
        } else {
            console.log('ℹ️ Targets modal function not available (this is okay)');
        }
        
        // No default date range - user must select a date range or load all data
        console.log('📅 No default date range - user must select dates or load all data');
        
        // Add change listeners (remove existing first to avoid duplicates)
        dateStartEl.removeEventListener('change', handleDateChange);
        dateEndEl.removeEventListener('change', handleDateChange);
        
        function handleDateChange() {
            console.log('📅 Date changed, reloading data...');
            currentPage = 1;
            loadQuickViewData();
        }
        
        dateStartEl.addEventListener('change', handleDateChange);
        dateEndEl.addEventListener('change', handleDateChange);
        
        // Initialize campaign filter
        const campaignFilter = document.getElementById('qv-campaign-filter');
        if (campaignFilter) {
            loadCampaignsForQuickViewFilter();
            campaignFilter.addEventListener('change', () => {
                console.log('🔄 Campaign filter changed');
                currentPage = 1;
                loadQuickViewData();
            });
        }
        
        // Clear filters button
        const clearBtn = document.getElementById('qv-clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (dateStartEl) dateStartEl.value = '';
                if (dateEndEl) dateEndEl.value = '';
                if (campaignFilter) campaignFilter.value = '';
                currentPage = 1;
                loadQuickViewData();
            });
        }
        
        // Pagination buttons
        const prevBtn = document.getElementById('qv-prev-page');
        const nextBtn = document.getElementById('qv-next-page');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderQuickView();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil((quickViewData?.clients?.length || 0) / clientsPerPage);
                if (currentPage < totalPages) {
                    currentPage++;
                    renderQuickView();
                }
            });
        }
        
        // Load data immediately since dates are set
        console.log('📊 Starting data load...');
        loadQuickViewData();
        
    } catch (err) {
        console.error('❌ CRITICAL ERROR in initQuickView:', err);
        console.error('Error stack:', err.stack);
        const bubblesContainer = document.getElementById('qv-client-bubbles');
        if (bubblesContainer) {
            bubblesContainer.innerHTML = `<div class="error">
                <strong>Initialization Error:</strong> ${err.message || 'Unknown error'}
                <br><small>Check console (F12) for details.</small>
            </div>`;
        }
    } finally {
        console.log('🚀 ========== INIT QUICK VIEW END ==========');
    }
}

// Load Quick View data
async function loadQuickViewData() {
    console.log('📊 Loading Quick View data...');
    
    const bubblesContainer = document.getElementById('qv-client-bubbles');
    
    // Update loading state immediately at start
    if (bubblesContainer) {
        bubblesContainer.innerHTML = '<div class="loading">Loading client data...</div>';
    }
    
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.error('❌ Supabase client not available');
            if (bubblesContainer) {
                bubblesContainer.innerHTML = '<div class="error">Error: Database connection not available. Please refresh the page.</div>';
            }
            return;
        }
        
        console.log('✅ Supabase client obtained');
        
        const dateStartEl = document.getElementById('qv-date-start');
        const dateEndEl = document.getElementById('qv-date-end');
        const campaignFilter = document.getElementById('qv-campaign-filter');
        const dateStart = dateStartEl ? dateStartEl.value : '';
        const dateEnd = dateEndEl ? dateEndEl.value : '';
        const selectedCampaign = campaignFilter ? campaignFilter.value : '';
        
        console.log('📅 Date range from inputs:', { dateStart, dateEnd, selectedCampaign });
        
        // If no date range, load all cumulative data
        if (!dateStart || !dateEnd) {
            console.log('📅 No date range selected - loading all cumulative data');
        }
        
        // Build query
        console.log('🔍 Building query for campaign_reporting...');
        let query = client.from('campaign_reporting').select('*');
        
        // Apply campaign filter if selected
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
            console.log('🔍 Filtering by campaign:', selectedCampaign);
        }
        
        // Apply date filters only when both dates are set
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart);
            query = query.lte('date', dateEnd);
            console.log('🔍 Querying campaign_reporting with date range:', dateStart, 'to', dateEnd);
        } else {
            console.log('🔍 Querying campaign_reporting for all data (no date filter)');
        }
        
        // Execute query with timeout to prevent infinite loading
        const queryPromise = query;
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout after 30 seconds')), 30000)
        );
        
        let result;
        try {
            console.log('⏳ Executing query (max 30 seconds)...');
            result = await Promise.race([queryPromise, timeoutPromise]);
            console.log('✅ Query completed successfully');
        } catch (err) {
            console.error('❌ Query error:', err);
            if (err.message === 'Query timeout after 30 seconds') {
                throw new Error('Database query took too long. Please try a smaller date range or refresh the page.');
            }
            throw err;
        }
        
        const { data, error } = result || {};
        
        if (error) {
            console.error('❌ Database error:', error);
            throw error;
        }
        
        if (!data || data.length === 0) {
            console.log('ℹ️ No data found for selected date range');
            if (bubblesContainer) {
                bubblesContainer.innerHTML = '<div class="empty-state">No data found for selected date range</div>';
            }
            return;
        }
        
        console.log(`✅ Found ${data.length} rows of data`);
        
        // Calculate date range in days
        let dateRangeDays = 1;
        if (dateStart && dateEnd) {
            const start = new Date(dateStart);
            const end = new Date(dateEnd);
            dateRangeDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        }
        
        // Aggregate data by client
        const clientMap = {};
        
        data.forEach(row => {
            const clientName = row.client || 'Unknown';
            
            if (!clientMap[clientName]) {
                clientMap[clientName] = {
                    name: clientName,
                    emailsSent: 0,
                    prospects: 0,
                    replies: 0,      // Will be set from replies table
                    totalReplies: 0, // Total including OOO
                    bounces: 0,
                    meetings: 0      // Will be set from meetings_booked table
                };
            }
            
            clientMap[clientName].emailsSent += parseFloat(row.emails_sent) || 0;
            clientMap[clientName].prospects += parseFloat(row.total_leads_contacted || row.total_leads) || 0;
            // Replies will be loaded separately from replies table
            // Bounces: use 'bounced' field (same as Performance Overview)
            clientMap[clientName].bounces += parseFloat(row.bounced) || 0;
            // Meetings loaded separately from meetings_booked table
        });
        
        // Load replies from replies table in bulk (optimized - 2 queries total instead of N×2)
        console.log('📧 Loading replies data in bulk for all clients...');
        try {
            const repliesMap = await loadAllRepliesBulk(dateStart, dateEnd);
            
            // Apply replies data to clientMap
            Object.keys(clientMap).forEach(clientName => {
                const repliesData = repliesMap[clientName] || { totalReplies: 0, realReplies: 0 };
                // Use realReplies (excl. OOO) as the main replies metric (same as Performance Overview)
                clientMap[clientName].replies = repliesData.realReplies;
                // Store totalReplies if needed later
                clientMap[clientName].totalReplies = repliesData.totalReplies;
            });
            
            console.log('✅ Replies data loaded');
        } catch (err) {
            console.error('⚠️ Error loading replies data (continuing anyway):', err);
            // Set defaults if bulk load fails
            Object.keys(clientMap).forEach(clientName => {
                clientMap[clientName].replies = 0;
                clientMap[clientName].totalReplies = 0;
            });
        }
        
        // Load meetings from meetings_booked table in bulk (optimized - 1 query total instead of N queries)
        console.log('📅 Loading meetings data in bulk for all clients...');
        try {
            const meetingsMap = await loadAllMeetingsBulk(dateStart, dateEnd);
            
            // Apply meetings data to clientMap
            Object.keys(clientMap).forEach(clientName => {
                clientMap[clientName].meetings = meetingsMap[clientName] || 0;
            });
            
            console.log('✅ Meetings data loaded');
        } catch (err) {
            console.error('⚠️ Error loading meetings data (continuing anyway):', err);
            // Set defaults if bulk load fails
            Object.keys(clientMap).forEach(clientName => {
                clientMap[clientName].meetings = 0;
            });
        }
        
        // Convert to array and sort by client name
        const clients = Object.values(clientMap).sort((a, b) => a.name.localeCompare(b.name));
        console.log(`✅ Aggregated data for ${clients.length} clients`);
        
        quickViewData = {
            clients: clients,
            dateRangeDays: dateRangeDays
        };
        
        currentPage = 1;
        console.log('🎨 Rendering Quick View...');
        renderQuickView();
        console.log('✅ Quick View rendered successfully');
        
    } catch (err) {
        console.error('❌ Error loading Quick View data:', err);
        console.error('Error details:', {
            message: err.message,
            details: err.details,
            hint: err.hint,
            code: err.code,
            stack: err.stack
        });
        
        if (bubblesContainer) {
            const errorMessage = err.message || 'Unknown error occurred';
            const errorDetails = err.details || err.hint || '';
            const errorCode = err.code ? ` (Code: ${err.code})` : '';
            
            bubblesContainer.innerHTML = `
                <div class="error">
                    <strong>Error loading data:</strong> ${errorMessage}${errorCode}
                    ${errorDetails ? '<br><small>' + errorDetails + '</small>' : ''}
                    <br><br>
                    <small>Please check the browser console (F12) for more details.</small>
                </div>
            `;
        }
    }
}

// Load all replies in bulk for all clients (optimized - 2 queries total instead of N×2)
async function loadAllRepliesBulk(dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return {};
    
    try {
        // Query for ALL replies (including OOO) - fetch client column only for efficiency
        let totalQuery = client.from('replies').select('client');
        
        // Query for REAL replies (excluding OOO) - fetch client column only
        let realQuery = client.from('replies')
            .select('client')
            .neq('category', 'Out Of Office');
        
        // Apply date filters using date_received column
        if (dateStart && dateEnd) {
            totalQuery = totalQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
            realQuery = realQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
        }
        
        // Execute both queries in parallel
        const [totalResult, realResult] = await Promise.all([totalQuery, realQuery]);
        
        if (totalResult.error) {
            console.error('Error loading total replies:', totalResult.error);
            return {};
        }
        if (realResult.error) {
            console.error('Error loading real replies:', realResult.error);
            return {};
        }
        
        // Aggregate by client in JavaScript
        const repliesMap = {};
        
        // Count total replies by client
        (totalResult.data || []).forEach(reply => {
            const clientName = reply.client || 'Unknown';
            if (!repliesMap[clientName]) {
                repliesMap[clientName] = { totalReplies: 0, realReplies: 0 };
            }
            repliesMap[clientName].totalReplies++;
        });
        
        // Count real replies by client
        (realResult.data || []).forEach(reply => {
            const clientName = reply.client || 'Unknown';
            if (!repliesMap[clientName]) {
                repliesMap[clientName] = { totalReplies: 0, realReplies: 0 };
            }
            repliesMap[clientName].realReplies++;
        });
        
        return repliesMap;
    } catch (err) {
        console.error('Error loading replies in bulk:', err);
        return {};
    }
}

// Load replies for a specific client from replies table (kept for popup usage)
async function loadRepliesForClient(clientName, dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return { totalReplies: 0, realReplies: 0 };
    
    try {
        // Query for ALL replies (including OOO)
        let totalQuery = client.from('replies').select('*', { count: 'exact', head: true }).eq('client', clientName);
        
        // Query for REAL replies (excluding OOO)
        let realQuery = client.from('replies')
            .select('*', { count: 'exact', head: true })
            .eq('client', clientName)
            .neq('category', 'Out Of Office');
        
        // Apply date filters using date_received column
        if (dateStart && dateEnd) {
            totalQuery = totalQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
            realQuery = realQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
        }
        
        // Execute both queries in parallel
        const [totalResult, realResult] = await Promise.all([totalQuery, realQuery]);
        
        if (totalResult.error) {
            console.error(`Error loading total replies for ${clientName}:`, totalResult.error);
        }
        if (realResult.error) {
            console.error(`Error loading real replies for ${clientName}:`, realResult.error);
        }
        
        return {
            totalReplies: totalResult.count || 0,
            realReplies: realResult.count || 0
        };
    } catch (err) {
        console.error(`Error loading replies for ${clientName}:`, err);
        return { totalReplies: 0, realReplies: 0 };
    }
}

// Load all meetings in bulk for all clients (optimized - 1 query total instead of N queries)
async function loadAllMeetingsBulk(dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return {};
    
    try {
        // Query all meetings - fetch client column only for efficiency
        let query = client.from('meetings_booked').select('client');
        
        // Apply date filters
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart).lte('created_time', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error loading meetings in bulk:', error);
            return {};
        }
        
        // Count meetings by client in JavaScript
        const meetingsMap = {};
        (data || []).forEach(meeting => {
            const clientName = meeting.client || 'Unknown';
            meetingsMap[clientName] = (meetingsMap[clientName] || 0) + 1;
        });
        
        return meetingsMap;
    } catch (err) {
        console.error('Error loading meetings in bulk:', err);
        return {};
    }
}

// Load meetings for a specific client (kept for popup usage)
async function loadMeetingsForClient(clientName, dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return 0;
    
    try {
        let query = client
            .from('meetings_booked')
            .select('*', { count: 'exact' })
            .eq('client', clientName);
        
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart);
            query = query.lte('created_time', dateEnd);
        }
        
        const { count, error } = await query;
        
        if (error) {
            console.error(`Error loading meetings for ${clientName}:`, error);
            return 0;
        }
        
        return count || 0;
    } catch (err) {
        console.error(`Error loading meetings for ${clientName}:`, err);
        return 0;
    }
}

// Render Quick View client bubbles
async function renderQuickView() {
    if (!quickViewData || !quickViewData.clients) {
        return;
    }
    
    const bubblesContainer = document.getElementById('qv-client-bubbles');
    const pagination = document.getElementById('qv-pagination');
    const pageInfo = document.getElementById('qv-page-info');
    const prevBtn = document.getElementById('qv-prev-page');
    const nextBtn = document.getElementById('qv-next-page');
    
    if (!bubblesContainer) {
        return;
    }
    
    const clients = quickViewData.clients;
    const totalPages = Math.ceil(clients.length / clientsPerPage);
    const startIndex = (currentPage - 1) * clientsPerPage;
    const endIndex = startIndex + clientsPerPage;
    const pageClients = clients.slice(startIndex, endIndex);
    
    // Render client bubbles
    // Note: getTargets is now async, but we'll call it once and use result for all clients
    const targets = window.getTargets && typeof window.getTargets === 'function' 
        ? await window.getTargets() 
        : {};
    
    // Get selected campaign for context
    const campaignFilter = document.getElementById('qv-campaign-filter');
    const selectedCampaign = campaignFilter ? campaignFilter.value : '';
    
    bubblesContainer.innerHTML = pageClients.map(client => {
        const clientTargets = targets[client.name] || {};
        const dateRangeDays = quickViewData.dateRangeDays || 1;
        
        // Calculate targets for date range
        const emailsTarget = (clientTargets.emails_per_day || 0) * dateRangeDays;
        const prospectsTarget = (clientTargets.prospects_per_day || 0) * dateRangeDays;
        const repliesTarget = (clientTargets.replies_per_day || 0) * dateRangeDays;
        const meetingsTarget = (clientTargets.meetings_per_day || 0) * dateRangeDays;
        
        // Show campaign name if filtered
        const campaignContext = selectedCampaign ? `<div style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 8px;">Campaign: ${selectedCampaign}</div>` : '';
        
        return `
            <div class="qv-client-bubble" data-client-name="${client.name}" data-client-data='${JSON.stringify(client)}'>
                <div class="qv-client-name">${client.name}</div>
                ${campaignContext}
                ${renderMetricRow('Emails Sent', client.emailsSent, emailsTarget)}
                ${renderMetricRow('Unique Prospects', client.prospects, prospectsTarget)}
                ${renderMetricRow('Real Replies', client.replies, repliesTarget)}
                ${renderMetricRow('Meetings', client.meetings, meetingsTarget)}
            </div>
        `;
    }).join('');
    
    // Update pagination
    if (pagination) {
        if (totalPages > 1) {
            pagination.style.display = 'flex';
            if (pageInfo) {
                pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            }
            if (prevBtn) {
                prevBtn.disabled = currentPage === 1;
            }
            if (nextBtn) {
                nextBtn.disabled = currentPage === totalPages;
            }
        } else {
            pagination.style.display = 'none';
        }
    }
}

// Render a metric row with color coding
function renderMetricRow(label, actual, target) {
    if (target === 0 || target === null) {
        // No target set - show only actual
        return `
            <div class="qv-metric-row">
                <span class="qv-metric-label">${label}</span>
                <div class="qv-metric-values">
                    <span class="qv-metric-actual">${formatNumber(actual)}</span>
                </div>
            </div>
        `;
    }
    
    // Calculate percentage
    const percentage = (actual / target) * 100;
    
    // Determine color - updated thresholds: >=95% green, 75-94% yellow, <75% red
    let colorClass = 'green';
    if (percentage < 75) {
        colorClass = 'red';
    } else if (percentage < 95) {
        colorClass = 'yellow';
    }
    
    return `
        <div class="qv-metric-row">
            <span class="qv-metric-label">${label}</span>
            <div class="qv-metric-values">
                <span class="qv-metric-target">${formatNumber(target)}</span>
                <span class="qv-metric-actual ${colorClass}">${formatNumber(actual)}</span>
            </div>
        </div>
    `;
}

// Format number helper
function formatNumber(num) {
    return (num || 0).toLocaleString();
}

// Fallback: Ensure UI shows something even if init fails
function ensureQuickViewUI() {
    const bubblesContainer = document.getElementById('qv-client-bubbles');
    if (bubblesContainer && (!bubblesContainer.innerHTML || bubblesContainer.innerHTML.trim() === '' || bubblesContainer.innerHTML.includes('Loading clients'))) {
        console.log('🔧 Fallback: Setting initial loading state');
        bubblesContainer.innerHTML = '<div class="loading">⏳ Loading Quick View...</div>';
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initQuickView = initQuickView;
    window.loadQuickViewData = loadQuickViewData;
    window.renderQuickView = renderQuickView;
    
    // Ensure UI is initialized when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureQuickViewUI);
    } else {
        // DOM already loaded
        setTimeout(ensureQuickViewUI, 100);
    }
    
    // Handle loadDashboard calls for quick-view tab
    // Merge with existing loadDashboard if it exists, otherwise create new one
    const existingLoadDashboard = window.loadDashboard;
    console.log('🔧 Setting up loadDashboard handler. Existing handler:', typeof existingLoadDashboard);
    
    window.loadDashboard = function(dashboardName) {
        console.log('🔄 ========== loadDashboard CALLED ==========');
        console.log('🔄 Dashboard name:', dashboardName);
        console.log('🔄 initQuickView function exists:', typeof initQuickView);
        
        if (dashboardName === 'quick-view') {
            console.log('✅ Routing to Quick View initialization');
            
            // Ensure container exists and shows something immediately
            const bubblesContainer = document.getElementById('qv-client-bubbles');
            if (!bubblesContainer) {
                console.error('❌ CRITICAL: qv-client-bubbles container not found!');
                return;
            }
            
            // Show loading immediately
            bubblesContainer.innerHTML = '<div class="loading">🚀 Starting Quick View...</div>';
            
            try {
                if (typeof initQuickView === 'function') {
                    console.log('✅ Calling initQuickView function');
                    initQuickView();
                } else {
                    console.error('❌ initQuickView is not a function! Type:', typeof initQuickView);
                    bubblesContainer.innerHTML = '<div class="error"><strong>Error:</strong> Quick View initialization function not found.<br><small>Please refresh the page.</small></div>';
                }
            } catch (err) {
                console.error('❌ Error calling initQuickView:', err);
                console.error('Error stack:', err.stack);
                bubblesContainer.innerHTML = `<div class="error">
                    <strong>Initialization Error:</strong> ${err.message || 'Unknown error'}
                    <br><small>Check console (F12) for details.</small>
                </div>`;
            }
        } else if (existingLoadDashboard && typeof existingLoadDashboard === 'function') {
            // Call existing handler for other dashboards
            console.log('✅ Routing to existing dashboard handler');
            existingLoadDashboard(dashboardName);
        } else {
            console.warn('⚠️ No handler found for dashboard:', dashboardName);
        }
        
        console.log('🔄 ========== loadDashboard END ==========');
    };
    
    console.log('✅ Quick View functions exposed globally');
    console.log('✅ loadDashboard handler registered for quick-view');
    
    // Initialize client bubble click handlers
    initClientBubbleClicks();
}

// Initialize click handlers for client bubbles
function initClientBubbleClicks() {
    // Use event delegation since bubbles are dynamically created
    document.addEventListener('click', async (e) => {
        const bubble = e.target.closest('.qv-client-bubble');
        if (bubble) {
            const clientName = bubble.getAttribute('data-client-name');
            const clientDataStr = bubble.getAttribute('data-client-data');
            if (clientName && clientDataStr) {
                try {
                    const clientData = JSON.parse(clientDataStr);
                    await showClientDetailModal(clientName, clientData);
                } catch (err) {
                    console.error('Error parsing client data:', err);
                }
            }
        }
    });
}

// Load client data for a specific date range (for popup)
async function loadClientDataForPopup(clientName, dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return null;
    
    try {
        // Load campaign_reporting data
        let query = client.from('campaign_reporting').select('*');
        query = query.gte('date', dateStart);
        query = query.lte('date', dateEnd);
        query = query.eq('client', clientName);
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error loading client data:', error);
            return null;
        }
        
        // Aggregate data
        let emailsSent = 0;
        let prospects = 0;
        let bounces = 0;
        
        (data || []).forEach(row => {
            emailsSent += parseFloat(row.emails_sent) || 0;
            prospects += parseFloat(row.total_leads_contacted || row.total_leads) || 0;
            bounces += parseFloat(row.bounced) || 0;
        });
        
        // Load replies
        const repliesData = await loadRepliesForClient(clientName, dateStart, dateEnd);
        
        // Load meetings
        const meetings = await loadMeetingsForClient(clientName, dateStart, dateEnd);
        
        // Calculate date range in days
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        const dateRangeDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        return {
            emailsSent,
            prospects,
            replies: repliesData.realReplies,
            meetings,
            dateRangeDays
        };
    } catch (err) {
        console.error('Error loading client data for popup:', err);
        return null;
    }
}

// Load historical client data grouped by date for charting
async function loadHistoricalClientData(clientName, dateStart, dateEnd) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        console.log('📊 Loading historical data for', clientName, 'from', dateStart, 'to', dateEnd);
        
        // Load campaign_reporting data grouped by date
        let query = client.from('campaign_reporting')
            .select('date, emails_sent, total_leads_contacted, total_leads, bounced')
            .eq('client', clientName)
            .gte('date', dateStart)
            .lte('date', dateEnd)
            .order('date', { ascending: true });
        
        const { data: campaignData, error: campaignError } = await query;
        
        if (campaignError) {
            console.error('Error loading campaign data:', campaignError);
            return [];
        }
        
        // Load replies grouped by date_received
        let repliesQuery = client.from('replies')
            .select('date_received')
            .eq('client', clientName)
            .neq('category', 'Out Of Office')
            .gte('date_received', dateStart)
            .lte('date_received', dateEnd)
            .order('date_received', { ascending: true });
        
        const { data: repliesData, error: repliesError } = await repliesQuery;
        
        if (repliesError) {
            console.error('Error loading replies data:', repliesError);
        }
        
        // Load meetings grouped by created_time
        let meetingsQuery = client.from('meetings_booked')
            .select('created_time')
            .eq('client', clientName)
            .gte('created_time', dateStart)
            .lte('created_time', dateEnd)
            .order('created_time', { ascending: true });
        
        const { data: meetingsData, error: meetingsError } = await meetingsQuery;
        
        if (meetingsError) {
            console.error('Error loading meetings data:', meetingsError);
        }
        
        // Get daily targets
        const targets = window.getTargets && typeof window.getTargets === 'function' 
            ? await window.getTargets() 
            : {};
        const clientTargets = targets[clientName] || {};
        
        // Group campaign data by date
        const dateMap = {};
        (campaignData || []).forEach(row => {
            const date = row.date;
            if (!dateMap[date]) {
                dateMap[date] = {
                    date: date,
                    emailsSent: 0,
                    prospects: 0,
                    bounces: 0,
                    replies: 0,
                    meetings: 0
                };
            }
            dateMap[date].emailsSent += parseFloat(row.emails_sent) || 0;
            dateMap[date].prospects += parseFloat(row.total_leads_contacted || row.total_leads) || 0;
            dateMap[date].bounces += parseFloat(row.bounced) || 0;
        });
        
        // Group replies by date
        (repliesData || []).forEach(reply => {
            const date = reply.date_received;
            if (date) {
                if (!dateMap[date]) {
                    dateMap[date] = {
                        date: date,
                        emailsSent: 0,
                        prospects: 0,
                        bounces: 0,
                        replies: 0,
                        meetings: 0
                    };
                }
                dateMap[date].replies++;
            }
        });
        
        // Group meetings by date
        (meetingsData || []).forEach(meeting => {
            const date = meeting.created_time ? meeting.created_time.split('T')[0] : null;
            if (date) {
                if (!dateMap[date]) {
                    dateMap[date] = {
                        date: date,
                        emailsSent: 0,
                        prospects: 0,
                        bounces: 0,
                        replies: 0,
                        meetings: 0
                    };
                }
                dateMap[date].meetings++;
            }
        });
        
        // Convert to array and add targets
        const historicalData = Object.values(dateMap)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(day => ({
                date: day.date,
                emailsSent: day.emailsSent,
                emailsTarget: clientTargets.emails_per_day || 0,
                prospects: day.prospects,
                prospectsTarget: clientTargets.prospects_per_day || 0,
                replies: day.replies,
                repliesTarget: clientTargets.replies_per_day || 0,
                meetings: day.meetings,
                meetingsTarget: clientTargets.meetings_per_day || 0
            }));
        
        console.log('✅ Historical data loaded:', historicalData.length, 'days');
        return historicalData;
    } catch (err) {
        console.error('Error loading historical client data:', err);
        return [];
    }
}

// Format date for display
function formatDateForDisplay(dateStr) {
    if (!dateStr) return '';
    const date = parseLocalDate(dateStr);
    if (!date) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Create historical chart for client
let clientHistoryChart = null;

function createClientHistoryChart(historicalData, clientName) {
    const canvas = document.getElementById('client-history-chart');
    if (!canvas || typeof Chart === 'undefined') {
        console.error('Chart canvas or Chart.js not available');
        return;
    }
    
    // Destroy existing chart if it exists
    if (clientHistoryChart) {
        clientHistoryChart.destroy();
        clientHistoryChart = null;
    }
    
    if (!historicalData || historicalData.length === 0) {
        console.warn('No historical data to display');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'var(--color-text-muted)';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for selected date range', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Prepare labels (dates)
    const labels = historicalData.map(d => {
        const date = parseLocalDate(d.date);
        return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    });
    
    // Prepare datasets
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    const ctx = canvas.getContext('2d');
    clientHistoryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Emails Sent (Actual)',
                    data: historicalData.map(d => d.emailsSent),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Emails Target',
                    data: historicalData.map(d => d.emailsTarget),
                    borderColor: '#93c5fd',
                    backgroundColor: 'rgba(147, 197, 253, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Prospects (Actual)',
                    data: historicalData.map(d => d.prospects),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Prospects Target',
                    data: historicalData.map(d => d.prospectsTarget),
                    borderColor: '#fcd34d',
                    backgroundColor: 'rgba(252, 211, 77, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Replies (Actual)',
                    data: historicalData.map(d => d.replies),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Replies Target',
                    data: historicalData.map(d => d.repliesTarget),
                    borderColor: '#6ee7b7',
                    backgroundColor: 'rgba(110, 231, 183, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Meetings (Actual)',
                    data: historicalData.map(d => d.meetings),
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Meetings Target',
                    data: historicalData.map(d => d.meetingsTarget),
                    borderColor: '#c4b5fd',
                    backgroundColor: 'rgba(196, 181, 253, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNum(context.parsed.y);
                        }
                    }
                },
                title: {
                    display: true,
                    text: `${clientName} - Historical Performance`,
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        top: 10,
                        bottom: 20
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Emails & Prospects'
                    },
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNum(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Replies & Meetings'
                    },
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNum(value);
                        }
                    }
                }
            }
        }
    });
    
    console.log('✅ Client history chart created');
}

// Show client detail modal with actual vs target and editable targets
async function showClientDetailModal(clientName, clientData) {
    const modal = document.getElementById('client-detail-modal');
    const titleEl = document.getElementById('client-detail-title');
    const bodyEl = document.getElementById('client-detail-body');
    
    if (!modal || !titleEl || !bodyEl) {
        console.error('Client detail modal elements not found');
        return;
    }
    
    titleEl.textContent = clientName;
    
    // Get current date range from Quick View filters (sync with broader view)
    const dateStartEl = document.getElementById('qv-date-start');
    const dateEndEl = document.getElementById('qv-date-end');
    let dateStart = dateStartEl ? dateStartEl.value : '';
    let dateEnd = dateEndEl ? dateEndEl.value : '';
    
    // If no dates from Quick View, use default last 30 days for better historical view
    if (!dateStart || !dateEnd) {
        const dateEndObj = new Date();
        const dateStartObj = new Date();
        dateStartObj.setDate(dateStartObj.getDate() - 30);
        dateStart = dateStartObj.toISOString().split('T')[0];
        dateEnd = dateEndObj.toISOString().split('T')[0];
    }
    
    // Get targets
    const targets = window.getTargets && typeof window.getTargets === 'function' 
        ? await window.getTargets() 
        : {};
    const clientTargets = targets[clientName] || {};
    
    // Load client data for the date range
    const clientDataForRange = await loadClientDataForPopup(clientName, dateStart, dateEnd);
    const actualData = clientDataForRange || clientData;
    const dateRangeDays = actualData.dateRangeDays || quickViewData?.dateRangeDays || 1;
    
    // Calculate targets for date range
    const emailsTarget = (clientTargets.emails_per_day || 0) * dateRangeDays;
    const prospectsTarget = (clientTargets.prospects_per_day || 0) * dateRangeDays;
    const repliesTarget = (clientTargets.replies_per_day || 0) * dateRangeDays;
    const meetingsTarget = (clientTargets.meetings_per_day || 0) * dateRangeDays;
    
    // Format date range for display
    const dateRangeDisplay = `${formatDateForDisplay(dateStart)} - ${formatDateForDisplay(dateEnd)}`;
    
    // Build HTML with tabs, date range picker, chart, table and editable inputs
    bodyEl.innerHTML = `
        <div style="margin-bottom: 24px;">
            <div style="margin-bottom: 16px;">
                <label style="display: block; margin-bottom: 8px; color: var(--color-text-default); font-weight: 600;">Date Range</label>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="date" id="popup-date-start" value="${dateStart}" style="padding: 8px; border: 1px solid var(--color-border-subtle); border-radius: 6px; background: var(--color-surface-subtle); color: var(--color-text);">
                    <span style="color: var(--color-text-muted);">to</span>
                    <input type="date" id="popup-date-end" value="${dateEnd}" style="padding: 8px; border: 1px solid var(--color-border-subtle); border-radius: 6px; background: var(--color-surface-subtle); color: var(--color-text);">
                </div>
            </div>
        </div>
        
        <!-- Details Tab (Table) -->
        <div id="client-tab-details" class="client-modal-tab-content active">
            <h3 style="margin-bottom: 16px; color: var(--color-text-strong);">Actual vs Target</h3>
            <p style="margin-bottom: 16px; color: var(--color-text-muted); font-size: 0.9rem;">Period: ${dateRangeDisplay}</p>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--color-border-muted);">
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted);">Metric</th>
                        <th style="text-align: right; padding: 12px; color: var(--color-text-muted);">Actual</th>
                        <th style="text-align: right; padding: 12px; color: var(--color-text-muted);">Target</th>
                        <th style="text-align: right; padding: 12px; color: var(--color-text-muted);">%</th>
                    </tr>
                </thead>
                <tbody id="client-detail-table-body">
                    ${renderMetricTableRow('Emails Sent', actualData.emailsSent, emailsTarget)}
                    ${renderMetricTableRow('Unique Prospects', actualData.prospects, prospectsTarget)}
                    ${renderMetricTableRow('Real Replies', actualData.replies, repliesTarget)}
                    ${renderMetricTableRow('Meetings', actualData.meetings, meetingsTarget)}
                </tbody>
            </table>
        </div>
        
        <!-- Targets Tab (Editing) -->
        <div id="client-tab-targets" class="client-modal-tab-content">
            <h3 style="margin-bottom: 16px; color: var(--color-text-strong);">Edit Daily Targets</h3>
            <div class="targets-metrics-grid">
                <div class="targets-metric-input">
                    <label>Emails per Day</label>
                    <input type="number" id="client-detail-emails" data-metric="emails" value="${clientTargets.emails_per_day || ''}" placeholder="0" min="0">
                </div>
                <div class="targets-metric-input">
                    <label>Prospects per Day</label>
                    <input type="number" id="client-detail-prospects" data-metric="prospects" value="${clientTargets.prospects_per_day || ''}" placeholder="0" min="0">
                </div>
                <div class="targets-metric-input">
                    <label>Replies per Day</label>
                    <input type="number" id="client-detail-replies" data-metric="replies" value="${clientTargets.replies_per_day || ''}" placeholder="0" min="0">
                </div>
                <div class="targets-metric-input">
                    <label>Meetings per Day</label>
                    <input type="number" id="client-detail-meetings" data-metric="meetings" value="${clientTargets.meetings_per_day || ''}" placeholder="0" min="0">
                </div>
            </div>
        </div>
    `;
    
    // Store current client name and data for save/refresh
    modal.setAttribute('data-current-client', clientName);
    modal.setAttribute('data-current-client-data', JSON.stringify(actualData));
    
    // Add date change handlers
    const popupDateStart = document.getElementById('popup-date-start');
    const popupDateEnd = document.getElementById('popup-date-end');
    
    if (popupDateStart && popupDateEnd) {
        const handleDateChange = async () => {
            const newDateStart = popupDateStart.value;
            const newDateEnd = popupDateEnd.value;
            
            if (newDateStart && newDateEnd) {
                // Show loading state
                const tableBody = document.getElementById('client-detail-table-body');
                
                if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: var(--color-text-muted);">Loading data...</td></tr>';
                }
                
                // Reload data
                const newData = await loadClientDataForPopup(clientName, newDateStart, newDateEnd);
                
                if (newData) {
                    // Update the table with new data
                    await updatePopupDataTable(clientName, newData, newDateStart, newDateEnd);
                } else {
                    alert('Error loading data for selected date range');
                }
            }
        };
        
        popupDateStart.addEventListener('change', handleDateChange);
        popupDateEnd.addEventListener('change', handleDateChange);
    }
    
    // Show modal
    modal.classList.add('active');
}

// Update popup data table with new date range data
async function updatePopupDataTable(clientName, clientData, dateStart, dateEnd) {
    const modal = document.getElementById('client-detail-modal');
    const bodyEl = document.getElementById('client-detail-body');
    
    if (!modal || !bodyEl) return;
    
    // Get targets
    const targets = window.getTargets && typeof window.getTargets === 'function' 
        ? await window.getTargets() 
        : {};
    const clientTargets = targets[clientName] || {};
    const dateRangeDays = clientData.dateRangeDays || 1;
    
    // Calculate targets for date range
    const emailsTarget = (clientTargets.emails_per_day || 0) * dateRangeDays;
    const prospectsTarget = (clientTargets.prospects_per_day || 0) * dateRangeDays;
    const repliesTarget = (clientTargets.replies_per_day || 0) * dateRangeDays;
    const meetingsTarget = (clientTargets.meetings_per_day || 0) * dateRangeDays;
    
    // Format date range for display
    const dateRangeDisplay = `${formatDateForDisplay(dateStart)} - ${formatDateForDisplay(dateEnd)}`;
    
    // Get date inputs (preserve them)
    const popupDateStart = document.getElementById('popup-date-start');
    const popupDateEnd = document.getElementById('popup-date-end');
    const dateStartValue = popupDateStart ? popupDateStart.value : dateStart;
    const dateEndValue = popupDateEnd ? popupDateEnd.value : dateEnd;
    
    // Update the table section only
    const tableSection = bodyEl.querySelector('table');
    const dateRangeSection = bodyEl.querySelector('p');
    
    if (tableSection) {
        tableSection.querySelector('tbody').innerHTML = `
            ${renderMetricTableRow('Emails Sent', clientData.emailsSent, emailsTarget)}
            ${renderMetricTableRow('Unique Prospects', clientData.prospects, prospectsTarget)}
            ${renderMetricTableRow('Real Replies', clientData.replies, repliesTarget)}
            ${renderMetricTableRow('Meetings', clientData.meetings, meetingsTarget)}
        `;
    }
    
    if (dateRangeSection) {
        dateRangeSection.textContent = `Period: ${dateRangeDisplay}`;
    }
    
    // Update stored data
    modal.setAttribute('data-current-client-data', JSON.stringify(clientData));
}

// Render metric table row with color coding
function renderMetricTableRow(label, actual, target) {
    const percentage = target > 0 ? ((actual / target) * 100).toFixed(1) : 'N/A';
    let colorClass = 'green';
    if (target > 0) {
        const pct = (actual / target) * 100;
        // Updated thresholds: >=95% green, 75-94% yellow, <75% red
        if (pct < 75) {
            colorClass = 'red';
        } else if (pct < 95) {
            colorClass = 'yellow';
        }
    }
    
    return `
        <tr style="border-bottom: 1px solid var(--color-border-subtle);">
            <td style="padding: 12px; color: var(--color-text-default);">${label}</td>
            <td style="padding: 12px; text-align: right; color: var(--color-text-strong); font-weight: 600;">${formatNumber(actual)}</td>
            <td style="padding: 12px; text-align: right; color: var(--color-text-default);">${formatNumber(target)}</td>
            <td style="padding: 12px; text-align: right; color: var(--color-accent-${colorClass}); font-weight: 600;">${percentage}%</td>
        </tr>
    `;
}

// Initialize client detail modal handlers
function initClientDetailModal() {
    const modal = document.getElementById('client-detail-modal');
    const closeBtn = document.getElementById('client-detail-close');
    const cancelBtn = document.getElementById('client-detail-cancel');
    const saveBtn = document.getElementById('client-detail-save');
    
    if (!modal) return;
    
    const closeModal = () => {
        modal.classList.remove('active');
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const clientName = modal.getAttribute('data-current-client');
            if (!clientName) {
                console.error('No client name found in modal');
                alert('Error: Client name not found. Please close and reopen the popup.');
                return;
            }
            
            // Get input values
            const emailsInput = document.getElementById('client-detail-emails');
            const prospectsInput = document.getElementById('client-detail-prospects');
            const repliesInput = document.getElementById('client-detail-replies');
            const meetingsInput = document.getElementById('client-detail-meetings');
            
            if (!emailsInput || !prospectsInput || !repliesInput || !meetingsInput) {
                console.error('Target input fields not found');
                alert('Error: Could not find target input fields. Please refresh the page.');
                return;
            }
            
            const emails = parseFloat(emailsInput.value) || 0;
            const prospects = parseFloat(prospectsInput.value) || 0;
            const replies = parseFloat(repliesInput.value) || 0;
            const meetings = parseFloat(meetingsInput.value) || 0;
            
            const targets = {
                [clientName]: {
                    emails_per_day: emails,
                    prospects_per_day: prospects,
                    replies_per_day: replies,
                    meetings_per_day: meetings
                }
            };
            
            console.log('💾 Saving targets for', clientName, ':', targets[clientName]);
            
            if (window.saveTargets && typeof window.saveTargets === 'function') {
                // Disable save button while saving
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
                
                try {
                    const success = await window.saveTargets(targets);
                    if (success) {
                        console.log('✅ Targets saved successfully');
                        closeModal();
                        // Refresh Quick View
                        if (window.loadQuickViewData) {
                            await window.loadQuickViewData();
                        }
                    } else {
                        // Error message already shown in saveTargets function
                        console.error('Failed to save targets');
                    }
                } catch (err) {
                    console.error('Exception saving targets:', err);
                    alert('An unexpected error occurred while saving. Please check the console.');
                } finally {
                    // Re-enable save button
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Targets';
                }
            } else {
                console.error('saveTargets function not available');
                alert('Error: Save function not available. Please refresh the page.');
            }
        });
    }
}

// Initialize client detail modal on load
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initClientDetailModal);
    } else {
        initClientDetailModal();
    }
}

