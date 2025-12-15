// GTM Scoreboard Dashboard - Data from campaign_reporting table

let gtmClientFilter = null;
let gtmData = null;

// Get supabase client from global scope
function getSupabaseClient() {
    // Use the global function from analytics-core.js if available
    if (window.getSupabaseClient && typeof window.getSupabaseClient === 'function' && window.getSupabaseClient !== getSupabaseClient) {
        const client = window.getSupabaseClient();
        if (client) {
            return client;
        }
    }
    
    // Fallback: create directly
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        return supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }
    
    console.error('Cannot get Supabase client - all methods failed');
    return null;
}

// Initialize GTM Scoreboard
function initGTMScoreboard() {
    console.log('🚀 Initializing GTM Scoreboard...');
    console.log('Window.SUPABASE_URL:', window.SUPABASE_URL);
    console.log('Window.SUPABASE_KEY:', window.SUPABASE_KEY ? 'Present' : 'Missing');
    console.log('Supabase library loaded:', typeof supabase !== 'undefined');
    
    // Try to get client multiple ways
    let client = getSupabaseClient();
    
    // If no client, try creating directly
    if (!client && typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        console.log('🔧 Creating client directly...');
        client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
        console.log('Client created:', !!client);
    }
    
    if (!client) {
        console.error('❌ Supabase client not available. Retrying in 1 second...');
        console.error('Available:', {
            hasSupabaseLib: typeof supabase !== 'undefined',
            hasUrl: !!window.SUPABASE_URL,
            hasKey: !!window.SUPABASE_KEY,
            getSupabaseClient: typeof window.getSupabaseClient
        });
        setTimeout(initGTMScoreboard, 1000);
        return;
    }
    
    console.log('✅ Supabase client available, proceeding with GTM initialization');
    
    gtmClientFilter = document.getElementById('gtm-client-filter');
    
    if (!gtmClientFilter) {
        console.error('⚠️ GTM client filter element not found');
        // Still try to load data even without filter
        loadGTMData();
        return;
    }
    
    // Load clients for filter (async, don't wait)
    loadClientsForFilter();
    
    // Add filter change listener for client
    gtmClientFilter.addEventListener('change', () => {
        console.log('🔄 Client filter changed:', gtmClientFilter.value);
        loadGTMData();
    });
    
    // Initialize date range to yesterday (matching Performance Overview)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const dateStartEl = document.getElementById('gtm-date-start');
    const dateEndEl = document.getElementById('gtm-date-end');
    
    if (dateStartEl && dateEndEl) {
        // Set default to yesterday
        dateStartEl.value = yesterdayStr;
        dateEndEl.value = yesterdayStr;
        
        // Add change listeners
        dateStartEl.addEventListener('change', () => {
            console.log('🔄 Date start changed:', dateStartEl.value);
            loadGTMData();
        });
        
        dateEndEl.addEventListener('change', () => {
            console.log('🔄 Date end changed:', dateEndEl.value);
            loadGTMData();
        });
        
        // Add blur listeners for date validation (auto-adjust)
        dateStartEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value) {
                // If start date is after end date, set end date to start date
                if (dateStartEl.value > dateEndEl.value) {
                    dateEndEl.value = dateStartEl.value;
                    console.log('📅 Adjusted end date to match start date:', dateStartEl.value);
                    loadGTMData();
                }
            }
        });
        
        dateEndEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value) {
                // If end date is before start date, set start date to end date
                if (dateEndEl.value < dateStartEl.value) {
                    dateStartEl.value = dateEndEl.value;
                    console.log('📅 Adjusted start date to match end date:', dateEndEl.value);
                    loadGTMData();
                }
            }
        });
    } else {
        console.warn('⚠️ Date range inputs not found');
    }
    
    // Clear Filters button
    const clearFiltersBtn = document.getElementById('gtm-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Clear client filter
            if (gtmClientFilter) {
                gtmClientFilter.value = '';
            }
            
            // Clear date range
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            
            console.log('🔄 Filters cleared');
            loadGTMData();
        });
    }
    
    // Save Report button (CSV export)
    const saveReportBtn = document.getElementById('gtm-save-report');
    if (saveReportBtn) {
        saveReportBtn.addEventListener('click', () => {
            exportGTMScoreboardCSV();
        });
    }
    
    // Load data after a brief delay to ensure DOM is ready
    console.log('📥 Calling loadGTMData...');
    setTimeout(() => {
        loadGTMData();
    }, 100);
}

// Load clients for filter dropdown
async function loadClientsForFilter() {
    console.log('🔄 loadClientsForFilter called');
    // Get supabase client
    const client = getSupabaseClient();
    
    if (!client) {
        console.error('❌ Supabase client not initialized');
        return;
    }
    
    try {
        console.log('📥 Querying Clients table...');
        // Try Clients with capital C first
        let { data, error } = await client
            .from('Clients')
            .select('Business');
        
        // If that fails, try lowercase
        if (error) {
            console.log('⚠️ Clients (capital) failed, trying clients (lowercase)...', error);
            const result = await client
                .from('clients')
                .select('Business');
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            console.error('❌ Error loading clients from Clients/clients table:', error);
            // Fallback: try to get clients from campaign_reporting table
            const { data: fallbackData, error: fallbackError } = await client
                .from('campaign_reporting')
                .select('client')
                .not('client', 'is', null);
            
            if (fallbackError) {
                console.error('❌ Error loading clients from fallback:', fallbackError);
                return;
            }
            
            // Extract unique clients from campaign_reporting
            const clients = [...new Set(fallbackData.map(c => c.client).filter(Boolean))];
            console.log('✅ Loaded clients from fallback:', clients);
            populateClientFilter(clients);
            return;
        }
        
        console.log('✅ Data received from Clients table:', data);
        console.log('✅ Number of rows:', data ? data.length : 0);
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No data in Clients table');
            return;
        }
        
        // Extract client names from Clients table
        // The Clients table uses "Business" column for client names
        const clients = data
            .map(row => {
                // Try Business first (capital B), then business (lowercase)
                return row.Business || row.business || row.name || row.client_name || row.client || row.company_name;
            })
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
            .sort();
        
        console.log('✅ Extracted clients:', clients);
        console.log('✅ Number of unique clients:', clients.length);
        
        if (clients.length === 0) {
            console.warn('⚠️ No clients extracted from data');
            return;
        }
        
        populateClientFilter(clients);
    } catch (err) {
        console.error('❌ Error loading clients:', err);
        console.error('Error stack:', err.stack);
    }
}

// Populate client filter dropdown
function populateClientFilter(clients) {
    console.log('🔄 populateClientFilter called with:', clients);
    
    if (!gtmClientFilter) {
        console.error('❌ gtmClientFilter element not found!');
        return;
    }
    
    console.log('✅ gtmClientFilter element found, populating...');
    
    // Clear existing options except "All Clients"
    gtmClientFilter.innerHTML = '<option value="">All Clients</option>';
    
    // Add client options
    clients.sort().forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        gtmClientFilter.appendChild(option);
        console.log('➕ Added client option:', client);
    });
    
    console.log('✅ Client filter populated with', clients.length, 'clients');
}

// Load GTM Scoreboard data from campaign_reporting table
async function loadGTMData() {
    console.log('📊 loadGTMData called');
    
    // Get supabase client - try multiple ways
    let client = getSupabaseClient();
    
    // If still no client, try creating one directly
    if (!client && typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        console.log('🔧 Creating Supabase client directly...');
        client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }
    
    if (!client) {
        console.error('❌ Supabase client not initialized');
        showError('Supabase client not initialized. Make sure config.js is loaded and Supabase library is included.');
        return;
    }
    
    console.log('✅ Supabase client available, querying campaigns...');
    clearError();
    
    // Show loading state
    setGTMLoading(true);
    
    try {
        const selectedClient = gtmClientFilter ? gtmClientFilter.value : '';
        const dateStartEl = document.getElementById('gtm-date-start');
        const dateEndEl = document.getElementById('gtm-date-end');
        const dateStart = dateStartEl ? dateStartEl.value : '';
        const dateEnd = dateEndEl ? dateEndEl.value : '';
        
        console.log('📥 Loading GTM data from campaigns...', { 
            selectedClient: selectedClient || 'All Clients',
            dateStart: dateStart || 'All Dates',
            dateEnd: dateEnd || 'All Dates',
            url: window.SUPABASE_URL ? window.SUPABASE_URL.substring(0, 40) + '...' : 'missing',
            hasKey: !!window.SUPABASE_KEY
        });
        
        // Build query for campaign_reporting table
        let query = client
            .from('campaign_reporting')
            .select('*');
        
        // Apply client filter if selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
            console.log('🔍 Filtering by client:', selectedClient);
        }
        
        // Apply date range filter if both dates are set
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart);
            query = query.lte('date', dateEnd);
            console.log('🔍 Filtering by date range:', dateStart, 'to', dateEnd);
        } else {
            // No date filter - show cumulative data (all dates)
            console.log('🔍 No date filter - showing cumulative data (all dates)');
        }
        
        console.log('⚡ Executing query...');
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Supabase query error:', error);
            console.error('Error details:', JSON.stringify(error, null, 2));
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error hint:', error.hint);
            
            // Check if it's an RLS issue (though user said RLS is off)
            if (error.message && (error.message.includes('permission') || error.message.includes('policy')) || error.code === 'PGRST301' || error.code === '42501') {
                showError('Permission denied. Even though RLS is off, there may be a policy issue. Check Supabase dashboard.');
            } else if (error.code === '42P01') {
                showError('Table "campaign_reporting" does not exist. Please check the table name in Supabase.');
            } else {
                showError(`Failed to load data: ${error.message} (Code: ${error.code}). Check browser console for details.`);
            }
            setGTMLoading(false);
            return;
        }
        
        console.log('✅ Query successful!');
        console.log('Data received from campaign_reporting:', data);
        console.log('Number of rows:', data ? data.length : 0);
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No data found in campaign_reporting table. The table exists but has no rows.');
            showError('No data found in campaign_reporting table. Make sure the table has data.');
            setGTMLoading(false);
            // Still update UI with zeros
            updateGTMUI({
                totalEmailsSent: 0,
                totalLeadsContacted: 0,
                totalReplied: 0,
                totalInterested: 0,
                totalMeetingsBooked: 0
            });
            return;
        }
        
        // Log first row to see structure
        if (data.length > 0) {
            console.log('📊 Sample row structure:', Object.keys(data[0]));
            console.log('📊 Sample row data:', JSON.stringify(data[0], null, 2));
        }
        
        // Process and aggregate data
        gtmData = data;
        const metrics = calculateGTMMetrics(data);
        
        console.log('📈 Calculated metrics:', metrics);
        console.log('📈 About to update UI...');
        
        // Set loading to false first (but don't reset values)
        setGTMLoading(false);
        
        // Load meetings from meetings_booked table
        const meetingsCount = await loadMeetingsBooked(selectedClient, dateStart, dateEnd);
        metrics.totalMeetingsBooked = meetingsCount;
        
        // Update UI - use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            updateGTMUI(metrics);
            console.log('📈 UI update completed');
            
            // Load other data after UI is updated
            loadEmailsByClientChart(data);
        });
        console.log('✅ GTM data loaded and UI updated successfully!');
        
    } catch (err) {
        console.error('Error loading GTM data:', err);
        console.error('Error stack:', err.stack);
        showError(`Error loading data: ${err.message}. Check browser console for details.`);
        setGTMLoading(false);
    }
}

// Calculate GTM metrics from campaigns table data
function calculateGTMMetrics(data) {
    const metrics = {
        totalEmailsSent: 0,
        totalLeadsContacted: 0,
        totalReplied: 0,
        totalInterested: 0,
        totalMeetingsBooked: 0
    };
    
    if (!data || data.length === 0) {
        console.warn('No data to calculate metrics from');
        return metrics;
    }
    
    // Log first row to see structure
    console.log('Sample row from campaigns:', data[0]);
    console.log('Available columns:', Object.keys(data[0]));
    
    // Aggregate data from campaigns table
    data.forEach(row => {
        // Use fields from campaigns table
        const emailsSent = row.emails_sent || 0;
        const leadsContacted = row.total_leads_contacted || row.total_leads || 0;
        // Use unique_replies for Total Replied
        const replied = row.unique_replies || row.replied || 0;
        // Use interested column for Total Interested Replies
        const interested = row.interested || 0;
        
        // Convert to numbers and sum
        metrics.totalEmailsSent += parseFloat(emailsSent) || 0;
        metrics.totalLeadsContacted += parseFloat(leadsContacted) || 0;
        metrics.totalReplied += parseFloat(replied) || 0;
        metrics.totalInterested += parseFloat(interested) || 0;
    });
    
    console.log('📊 Final calculated metrics:', metrics);
    console.log('📊 Breakdown:', {
        emailsSent: metrics.totalEmailsSent,
        leadsContacted: metrics.totalLeadsContacted,
        replied: metrics.totalReplied,
        interested: metrics.totalInterested,
        meetings: metrics.totalMeetingsBooked
    });
    
    return metrics;
}

// Update GTM UI with metrics
function updateGTMUI(metrics) {
    console.log('🔄 Updating UI with metrics:', metrics);
    
    // Calculate percentages
    const repliedPercentage = metrics.totalLeadsContacted > 0 
        ? ((metrics.totalReplied / metrics.totalLeadsContacted) * 100).toFixed(1) + '%'
        : '0.0%';
    const interestedPercentage = metrics.totalReplied > 0 
        ? ((metrics.totalInterested / metrics.totalReplied) * 100).toFixed(1) + '%'
        : '0.0%';
    
    // High-Level Performance Overview
    const elements = {
        'gtm-total-emails': metrics.totalEmailsSent,
        'gtm-total-leads-contacted': metrics.totalLeadsContacted,
        'gtm-total-replied': metrics.totalReplied,
        'gtm-total-interested': metrics.totalInterested,
        'gtm-total-meetings': metrics.totalMeetingsBooked
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        // Try multiple ways to find the element
        let el = document.getElementById(id);
        if (!el) {
            el = document.querySelector(`#${id}`);
        }
        if (!el) {
            el = document.querySelector(`[id="${id}"]`);
        }
        
        if (el) {
            // Check if formatNumber exists, otherwise use toLocaleString
            const formattedValue = (typeof formatNumber === 'function') 
                ? formatNumber(value || 0) 
                : (value || 0).toLocaleString();
            
            // Set both innerText and textContent to ensure update
            el.innerText = formattedValue;
            el.textContent = formattedValue;
            
            // Force a reflow to ensure the browser updates
            void el.offsetHeight;
            
            // Verify the update immediately
            const actualValue = el.textContent || el.innerText || el.innerHTML;
            console.log(`✅ Updated ${id}: ${formattedValue} (raw: ${value}, actual DOM: ${actualValue})`);
            
            // Double-check after a microtask
            setTimeout(() => {
                const verifyValue = el.textContent || el.innerText;
                if (verifyValue !== formattedValue && verifyValue !== String(value)) {
                    console.warn(`⚠️ Value may have been reset for ${id}. Expected: ${formattedValue}, Got: ${verifyValue}`);
                    // Try updating again
                    el.textContent = formattedValue;
                    el.innerText = formattedValue;
                }
            }, 0);
        } else {
            console.error(`❌ Element not found: ${id}`);
        }
    });
    
    // Update percentages
    const repliedPctEl = document.getElementById('gtm-replied-percentage');
    if (repliedPctEl) {
        repliedPctEl.textContent = repliedPercentage;
        console.log(`✅ Updated gtm-replied-percentage: ${repliedPercentage}`);
    }
    
    const interestedPctEl = document.getElementById('gtm-interested-percentage');
    if (interestedPctEl) {
        interestedPctEl.textContent = interestedPercentage;
        console.log(`✅ Updated gtm-interested-percentage: ${interestedPercentage}`);
    }
    
    // Calculate and update ratios
    const ratios = {
        emailsPerMeeting: metrics.totalMeetingsBooked > 0 
            ? (metrics.totalEmailsSent / metrics.totalMeetingsBooked).toFixed(1)
            : '0',
        leadToReply: metrics.totalReplied > 0
            ? (metrics.totalLeadsContacted / metrics.totalReplied).toFixed(1)
            : '0',
        replyToPosReply: metrics.totalInterested > 0
            ? (metrics.totalReplied / metrics.totalInterested).toFixed(1)
            : '0',
        posReplyToMeeting: metrics.totalMeetingsBooked > 0
            ? (metrics.totalInterested / metrics.totalMeetingsBooked).toFixed(1)
            : '0'
    };
    
    // Update ratio elements
    const ratioElements = {
        'qv-ratio-emails-meeting': ratios.emailsPerMeeting,
        'qv-ratio-lead-reply': ratios.leadToReply,
        'qv-ratio-reply-pos': ratios.replyToPosReply,
        'qv-ratio-pos-meeting': ratios.posReplyToMeeting
    };
    
    Object.entries(ratioElements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
            el.innerText = value;
            console.log(`✅ Updated ${id}: ${value}`);
        } else {
            console.warn(`⚠️ Ratio element not found: ${id}`);
        }
    });
    
    console.log('✅ UI update function completed');
}

// Load meetings from meetings_booked table
async function loadMeetingsBooked(clientFilter = '', dateStart = '', dateEnd = '') {
    console.log('📅 Loading meetings from meetings_booked table...', { clientFilter, dateStart, dateEnd });
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        return 0;
    }
    
    try {
        let query = client
            .from('meetings_booked')
            .select('*', { count: 'exact' });
        
        // Apply client filter if selected
        if (clientFilter) {
            query = query.eq('client', clientFilter);
        }
        
        // Apply date range filter if both dates are set
        // Use created_time field instead of date field
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart);
            query = query.lte('created_time', dateEnd);
            console.log('🔍 Filtering meetings by created_time range:', dateStart, 'to', dateEnd);
        } else {
            // No date filter - show cumulative meetings
            console.log('🔍 No date filter - loading cumulative meetings');
        }
        
        const { data, error, count } = await query;
        
        if (error) {
            console.error('❌ Error loading meetings_booked:', error);
            return 0;
        }
        
        // If count is available, use it; otherwise use data length
        const meetingsCount = count !== null ? count : (data ? data.length : 0);
        console.log('✅ Loaded meetings from meetings_booked:', meetingsCount);
        return meetingsCount;
    } catch (err) {
        console.error('❌ Error in loadMeetingsBooked:', err);
        return 0;
    }
}

// Load and render daily emails chart with target line
function loadEmailsByClientChart(data) {
    console.log('📊 Loading daily emails chart...');
    
    if (!data || data.length === 0) {
        console.warn('⚠️ No data for chart');
        return;
    }
    
    // Get selected client and date range
    const selectedClient = gtmClientFilter ? gtmClientFilter.value : '';
    const dateStartEl = document.getElementById('gtm-date-start');
    const dateEndEl = document.getElementById('gtm-date-end');
    const dateStart = dateStartEl ? dateStartEl.value : '';
    const dateEnd = dateEndEl ? dateEndEl.value : '';
    
    // Filter data by client if selected
    let filteredData = data;
    if (selectedClient) {
        filteredData = data.filter(row => (row.client || 'Unknown') === selectedClient);
    }
    
    // Group emails by date (only weekdays - Monday to Friday)
    const dateMap = {};
    filteredData.forEach(row => {
        const dateStr = row.date ? row.date.split('T')[0] : null;
        if (!dateStr) return;
        
        const date = parseLocalDate(dateStr);
        if (!date) return;
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
        
        // Only include weekdays (Monday = 1 to Friday = 5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            const emailsSent = parseFloat(row.emails_sent) || 0;
            
            if (!dateMap[dateStr]) {
                dateMap[dateStr] = 0;
            }
            dateMap[dateStr] += emailsSent;
        }
    });
    
    // Get last 5-7 weekdays
    const sortedDates = Object.keys(dateMap).sort().reverse();
    const lastWeekdays = sortedDates.slice(0, 7); // Get up to 7 days
    const labels = lastWeekdays.map(dateStr => {
        const date = parseLocalDate(dateStr);
        if (!date) return '';
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${dayNames[date.getDay()]} ${month}/${day}`;
    }).filter(label => label !== '').reverse();
    
    const emailsData = lastWeekdays.map(dateStr => dateMap[dateStr] || 0).reverse();
    
    console.log('📊 Chart data:', { labels, emailsData });
    
    // Get canvas element
    const canvas = document.getElementById('gtm-chart-emails-by-client');
    if (!canvas) {
        console.error('❌ Chart canvas not found');
        return;
    }
    
    // Wait for Chart.js to be available
    if (typeof Chart === 'undefined') {
        console.error('❌ Chart.js library not loaded');
        return;
    }
    
    // Destroy existing chart if it exists
    if (window.gtmEmailsByClientChart) {
        window.gtmEmailsByClientChart.destroy();
    }
    
    // Get target for selected client (or default)
    const targets = window.getTargets ? window.getTargets() : {};
    let dailyTarget = 0;
    if (selectedClient && targets[selectedClient]) {
        dailyTarget = targets[selectedClient].emails_per_day || 0;
    } else if (!selectedClient) {
        // For "All Clients", calculate average or use a default
        // For now, use the highest target or 0
        const allTargets = Object.values(targets).map(t => t.emails_per_day || 0);
        dailyTarget = allTargets.length > 0 ? Math.max(...allTargets) : 0;
    }
    
    // Use formatNumber from global scope or fallback
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    // Create target line data (same value for all days)
    const targetLineData = labels.map(() => dailyTarget);
    
    // Create new chart
    const ctx = canvas.getContext('2d');
    window.gtmEmailsByClientChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Emails Sent',
                    data: emailsData,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#a78bfa',
                    borderWidth: 1
                },
                {
                    label: 'Target',
                    data: targetLineData,
                    type: 'line',
                    borderColor: '#ec4899',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return 'Emails Sent: ' + formatNum(context.parsed.y);
                            } else {
                                return 'Target: ' + formatNum(context.parsed.y) + ' per day';
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNum(value);
                        },
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(139, 92, 246, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(139, 92, 246, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e4e4e7'
                    }
                }
            }
        }
    });
    
    console.log('✅ Daily emails chart created successfully');
}

// Load top performers (moved to DeepView)
async function loadTopPerformers(data, useDeepViewIds = false) {
    // Best Sequence - group by sequence_number
    const sequenceMap = {};
    data.forEach(row => {
        const seqNum = row.sequence_number || row.sequence || 0;
        if (!sequenceMap[seqNum]) {
            sequenceMap[seqNum] = { meetings: 0, replies: 0, sent: 0 };
        }
        sequenceMap[seqNum].meetings += row.meetings_booked || row.meetings || 0;
        sequenceMap[seqNum].replies += row.replies || row.replied || 0;
        sequenceMap[seqNum].sent += row.emails_sent || 0;
    });
    
    const bestSequence = Object.entries(sequenceMap)
        .sort((a, b) => b[1].meetings - a[1].meetings)[0];
    
    const sequenceId = useDeepViewIds ? 'dv-best-sequence' : 'gtm-best-sequence';
    if (bestSequence) {
        const el = document.getElementById(sequenceId);
        if (el) {
            el.textContent = `Sequence #${bestSequence[0]} (${formatNumber(bestSequence[1].meetings)} meetings)`;
        }
    }
    
    // Best Variant - group by variant
    const variantMap = {};
    data.forEach(row => {
        const variant = row.variant_name || row.variant || 'Default';
        if (!variantMap[variant]) {
            variantMap[variant] = { replies: 0, sent: 0 };
        }
        variantMap[variant].replies += row.replies || row.replied || 0;
        variantMap[variant].sent += row.emails_sent || 0;
    });
    
    const bestVariant = Object.entries(variantMap)
        .map(([name, stats]) => ({
            name,
            replyRate: stats.sent > 0 ? (stats.replies / stats.sent) * 100 : 0
        }))
        .sort((a, b) => b.replyRate - a.replyRate)[0];
    
    const variantId = useDeepViewIds ? 'dv-best-variant' : 'gtm-best-variant';
    if (bestVariant) {
        const el = document.getElementById(variantId);
        if (el) {
            el.textContent = `${bestVariant.name} (${bestVariant.replyRate.toFixed(1)}% reply rate)`;
        }
    }
    
    // Best/Worst Industry - group by industry
    const industryMap = {};
    data.forEach(row => {
        const industry = row.industry || row.industry_name || 'Unknown';
        if (!industryMap[industry]) {
            industryMap[industry] = { meetings: 0, replies: 0, sent: 0 };
        }
        industryMap[industry].meetings += row.meetings_booked || row.meetings || 0;
        industryMap[industry].replies += row.replies || row.replied || 0;
        industryMap[industry].sent += row.emails_sent || 0;
    });
    
    const industries = Object.entries(industryMap)
        .map(([name, stats]) => ({
            name,
            meetingRate: stats.sent > 0 ? (stats.meetings / stats.sent) * 100 : 0
        }))
        .sort((a, b) => b.meetingRate - a.meetingRate);
    
    const bestIndustryId = useDeepViewIds ? 'dv-best-industry' : 'gtm-best-industry';
    const worstIndustryId = useDeepViewIds ? 'dv-worst-industry' : 'gtm-worst-industry';
    
    if (industries.length > 0) {
        const bestEl = document.getElementById(bestIndustryId);
        if (bestEl) {
            bestEl.textContent = `${industries[0].name} (${industries[0].meetingRate.toFixed(1)}% meeting rate)`;
        }
        
        if (industries.length > 1) {
            const worstEl = document.getElementById(worstIndustryId);
            if (worstEl) {
                worstEl.textContent = `${industries[industries.length - 1].name} (${industries[industries.length - 1].meetingRate.toFixed(1)}% meeting rate)`;
            }
        }
    }
}

// Set loading state
function setGTMLoading(loading) {
    const elements = [
        'gtm-total-emails',
        'gtm-total-leads-contacted',
        'gtm-total-replied',
        'gtm-total-interested',
        'gtm-total-meetings'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Only set loading state, don't reset to '-' when loading is false
            // The updateGTMUI function will set the actual values
            if (loading) {
                el.textContent = 'Loading...';
            }
            // When loading is false, don't reset - let updateGTMUI handle the values
        }
    });
}

// Test function to manually update UI
window.testUpdateUI = function() {
    console.log('🧪 Testing UI update...');
    const testMetrics = {
        totalEmailsSent: 103579,
        totalLeadsContacted: 100000,
        totalReplied: 5000,
        totalInterested: 2000,
        totalMeetingsBooked: 0
    };
    updateGTMUI(testMetrics);
    console.log('✅ Test UI update completed');
};

// CSV Export function
async function exportGTMScoreboardCSV() {
    console.log('📥 Exporting GTM Scoreboard to CSV...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        alert('Unable to export: Database connection not available');
        return;
    }
    
    try {
        // Get current filter values
        const dateStartEl = document.getElementById('gtm-date-start');
        const dateEndEl = document.getElementById('gtm-date-end');
        const dateStart = dateStartEl ? dateStartEl.value : '';
        const dateEnd = dateEndEl ? dateEndEl.value : '';
        const selectedClient = gtmClientFilter ? (gtmClientFilter.value || '') : '';
        
        // Build query same as loadGTMData
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart);
            query = query.lte('date', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading data for export:', error);
            alert('Error loading data for export: ' + error.message);
            return;
        }
        
        // Get meetings count
        const meetingsCount = await loadMeetingsBooked(selectedClient, dateStart, dateEnd);
        
        // Calculate metrics
        const metrics = calculateGTMMetrics(data || []);
        metrics.totalMeetingsBooked = meetingsCount;
        
        // Calculate ratios
        const ratios = {
            emailsPerMeeting: metrics.totalMeetingsBooked > 0 
                ? (metrics.totalEmailsSent / metrics.totalMeetingsBooked).toFixed(1)
                : '0',
            leadToReply: metrics.totalReplied > 0
                ? (metrics.totalLeadsContacted / metrics.totalReplied).toFixed(1)
                : '0',
            replyToPosReply: metrics.totalInterested > 0
                ? (metrics.totalReplied / metrics.totalInterested).toFixed(1)
                : '0',
            posReplyToMeeting: metrics.totalMeetingsBooked > 0
                ? (metrics.totalInterested / metrics.totalMeetingsBooked).toFixed(1)
                : '0'
        };
        
        // Calculate percentages
        const repliedPercentage = metrics.totalLeadsContacted > 0 
            ? ((metrics.totalReplied / metrics.totalLeadsContacted) * 100).toFixed(1) + '%'
            : '0.0%';
        const interestedPercentage = metrics.totalReplied > 0 
            ? ((metrics.totalInterested / metrics.totalReplied) * 100).toFixed(1) + '%'
            : '0.0%';
        
        // Build CSV content
        const csvRows = [];
        
        // Header section
        csvRows.push('GTM Scoreboard Report');
        csvRows.push(`Date Range: ${dateStart || 'All'} to ${dateEnd || 'All'}`);
        csvRows.push(`Client: ${selectedClient || 'All Clients'}`);
        csvRows.push(''); // Empty row
        
        // High-Level Performance Overview
        csvRows.push('High-Level Performance Overview');
        csvRows.push('Metric,Value,Percentage');
        csvRows.push(`Total Emails Sent,${metrics.totalEmailsSent},`);
        csvRows.push(`Total Leads Contacted,${metrics.totalLeadsContacted},`);
        csvRows.push(`Total Replied,${metrics.totalReplied},${repliedPercentage}`);
        csvRows.push(`Total Interested Replies,${metrics.totalInterested},${interestedPercentage}`);
        csvRows.push(`Total Meetings Booked,${metrics.totalMeetingsBooked},`);
        csvRows.push(''); // Empty row
        
        // Ratios section
        csvRows.push('Ratios');
        csvRows.push('Ratio,Value');
        csvRows.push(`Emails per Meeting,${ratios.emailsPerMeeting}`);
        csvRows.push(`Lead to Reply,${ratios.leadToReply}`);
        csvRows.push(`Reply to Pos Reply,${ratios.replyToPosReply}`);
        csvRows.push(`Pos Reply to Meeting,${ratios.posReplyToMeeting}`);
        csvRows.push(''); // Empty row
        
        // Detailed Data section
        if (data && data.length > 0) {
            csvRows.push('Detailed Data');
            // Get all unique column names
            const columns = new Set();
            data.forEach(row => {
                Object.keys(row).forEach(key => columns.add(key));
            });
            const columnArray = Array.from(columns);
            
            // Header row
            csvRows.push(columnArray.join(','));
            
            // Data rows
            data.forEach(row => {
                const values = columnArray.map(col => {
                    let value = row[col] || '';
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csvRows.push(values.join(','));
            });
        }
        
        // Create CSV blob and download
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `gtm-scoreboard-${dateStr}.csv`;
        
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('✅ CSV export completed:', filename);
    } catch (err) {
        console.error('❌ Error exporting CSV:', err);
        alert('Error exporting CSV: ' + err.message);
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initGTMScoreboard = initGTMScoreboard;
    window.loadGTMData = loadGTMData; // Expose for direct calling
    window.exportGTMScoreboardCSV = exportGTMScoreboardCSV; // Expose CSV export
    window.loadTopPerformers = loadTopPerformers; // Expose for DeepView
    window.loadDashboard = function(dashboardName) {
        if (dashboardName === 'gtm-scoreboard') {
            console.log('loadDashboard called for gtm-scoreboard');
            initGTMScoreboard();
        }
    };
    
    console.log('✅ GTM Scoreboard functions exposed:', {
        initGTMScoreboard: typeof window.initGTMScoreboard,
        loadGTMData: typeof window.loadGTMData,
        loadDashboard: typeof window.loadDashboard,
        exportGTMScoreboardCSV: typeof window.exportGTMScoreboardCSV,
        loadTopPerformers: typeof window.loadTopPerformers,
        testUpdateUI: typeof window.testUpdateUI
    });
}

