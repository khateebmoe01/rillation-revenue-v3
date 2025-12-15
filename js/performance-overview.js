// Performance Overview Dashboard

let poChart = null;
let poTimeframe = 'daily'; // Always use daily scale
let poDateStart = null;
let poDateEnd = null;
let poClientFilter = null;
let poCampaignFilter = null;

// Load clients for Performance Overview filter
async function loadClientsForPOFilter() {
    console.log('🔄 loadClientsForPOFilter called');
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
            populatePOClientFilter(clients);
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
        
        populatePOClientFilter(clients);
    } catch (err) {
        console.error('❌ Error loading clients:', err);
        console.error('Error stack:', err.stack);
    }
}

// Populate Performance Overview client filter dropdown
function populatePOClientFilter(clients) {
    console.log('🔄 populatePOClientFilter called with:', clients);
    
    poClientFilter = document.getElementById('po-client-filter');
    if (!poClientFilter) {
        console.error('❌ po-client-filter element not found!');
        return;
    }
    
    console.log('✅ po-client-filter element found, populating...');
    
    // Clear existing options
    poClientFilter.innerHTML = '';
    
    // Add "All Clients" option first
    const allClientsOption = document.createElement('option');
    allClientsOption.value = '';
    allClientsOption.textContent = 'All Clients';
    poClientFilter.appendChild(allClientsOption);
    
    // Add client options
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        poClientFilter.appendChild(option);
        console.log('➕ Added client option:', client);
    });
    
    // Set "Rillation Revenue" as selected by default
    const rillationOption = Array.from(poClientFilter.options).find(opt => opt.value === 'Rillation Revenue');
    if (rillationOption) {
        poClientFilter.value = 'Rillation Revenue';
    }
    
    console.log('✅ Client filter populated with', clients.length, 'clients');
}

// Load campaigns for Performance Overview filter
async function loadCampaignsForPOFilter() {
    console.log('🔄 Loading campaigns for Performance Overview filter...');
    const client = getSupabaseClient();
    
    if (!client) {
        console.error('❌ Supabase client not available');
        return;
    }
    
    poCampaignFilter = document.getElementById('po-campaign-filter');
    if (!poCampaignFilter) {
        console.error('❌ po-campaign-filter element not found');
        return;
    }
    
    try {
        // Get selected client to filter campaigns
        const selectedClient = poClientFilter ? (poClientFilter.value || '') : '';
        
        // Get unique campaigns by campaign_id from campaign_reporting
        let query = client
            .from('campaign_reporting')
            .select('campaign_id, campaign_name, client')
            .not('campaign_id', 'is', null)
            .not('campaign_name', 'is', null);
        
        // Filter by client if selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
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
                    name: row.campaign_name,
                    client: row.client
                });
            }
        });
        
        // Convert to array and sort by name
        const uniqueCampaigns = Array.from(campaignMap.values())
            .sort((a, b) => a.name.localeCompare(b.name));

        // Populate filter
        poCampaignFilter.innerHTML = '<option value="">All Campaigns</option>';
        uniqueCampaigns.forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.name;
            option.textContent = campaign.name;
            option.setAttribute('data-campaign-id', campaign.id);
            poCampaignFilter.appendChild(option);
        });

        console.log('✅ Campaign filter populated with', uniqueCampaigns.length, 'unique campaigns');
    } catch (err) {
        console.error('❌ Error loading campaigns:', err);
    }
}

// Reload campaigns when client filter changes
function updateCampaignFilterOnClientChange() {
    if (poClientFilter) {
        poClientFilter.addEventListener('change', () => {
            console.log('🔄 Client filter changed, reloading campaigns...');
            loadCampaignsForPOFilter();
            // Clear campaign search when client changes
            if (poCampaignFilter) {
                poCampaignFilter.value = '';
            }
        });
    }
}

// Initialize Performance Overview
function initPerformanceOverview() {
    console.log('🚀 Initializing Performance Overview...');
    
    // No default date range - load all data by default
    const dateStartEl = document.getElementById('po-date-start');
    const dateEndEl = document.getElementById('po-date-end');
    
    if (dateStartEl && dateEndEl) {
        // Leave dates empty to load all cumulative data
        poDateStart = null;
        poDateEnd = null;
        
        // Add change listeners
        dateStartEl.addEventListener('change', () => {
            poDateStart = dateStartEl.value;
            loadPerformanceData();
        });
        
        dateEndEl.addEventListener('change', () => {
            poDateEnd = dateEndEl.value;
            loadPerformanceData();
        });
        
        // Add blur listeners for date range validation
        dateStartEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value) {
                // If start date is after end date, set end date to start date
                if (dateStartEl.value > dateEndEl.value) {
                    dateEndEl.value = dateStartEl.value;
                    poDateEnd = dateStartEl.value;
                    console.log('📅 Adjusted end date to match start date:', dateStartEl.value);
                    loadPerformanceData();
                }
            }
        });
        
        dateEndEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value) {
                // If end date is before start date, set start date to end date
                if (dateEndEl.value < dateStartEl.value) {
                    dateStartEl.value = dateEndEl.value;
                    poDateStart = dateEndEl.value;
                    console.log('📅 Adjusted start date to match end date:', dateEndEl.value);
                    loadPerformanceData();
                }
            }
        });
    }
    
    // Initialize client filter
    poClientFilter = document.getElementById('po-client-filter');
    if (poClientFilter) {
        // Load clients for filter (async, don't wait)
        loadClientsForPOFilter();
        
        // Add change event listener for client filter
        poClientFilter.addEventListener('change', () => {
            console.log('🔄 Client filter changed');
            // Reload campaigns when client changes
            loadCampaignsForPOFilter();
            loadPerformanceData();
        });
    }
    
    // Initialize campaign filter
    poCampaignFilter = document.getElementById('po-campaign-filter');
    if (poCampaignFilter) {
        // Load campaigns for filter (async, don't wait)
        loadCampaignsForPOFilter();
        
        // Add change event listener for campaign filter
        poCampaignFilter.addEventListener('change', () => {
            console.log('🔄 Campaign filter changed');
            loadPerformanceData();
        });
    }
    
    // Timeframe buttons removed - always using daily scale
    
    // Filter buttons
    const clearFiltersBtn = document.getElementById('po-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            // Clear date range
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            poDateStart = null;
            poDateEnd = null;
            
            // Clear client filter to "All Clients"
            if (poClientFilter) {
                poClientFilter.value = '';
            }
            
            // Clear campaign filter to "All Campaigns"
            if (poCampaignFilter) {
                poCampaignFilter.value = '';
            }
            
            loadPerformanceData();
        });
    }
    
    // Save Report button (CSV export)
    const saveReportBtn = document.getElementById('po-save-report');
    if (saveReportBtn) {
        saveReportBtn.addEventListener('click', () => {
            exportPerformanceOverviewCSV();
        });
    }
    
    // Add click handlers for all metric cards
    addMetricClickHandlers();
    
    // Add click handler for Meetings Booked card (special case - shows meeting details)
    const meetingsCard = document.getElementById('po-meetings-booked');
    if (meetingsCard) {
        // Find the parent card element
        const cardElement = meetingsCard.closest('.performance-metric-card');
        if (cardElement) {
            cardElement.addEventListener('click', async () => {
                console.log('📅 Meetings Booked card clicked');
                
                // Get current filter values
                const selectedClient = poClientFilter ? (poClientFilter.value || '') : '';
                const selectedCampaign = poCampaignFilter ? (poCampaignFilter.value || '') : '';
                
                // Load meeting details
                const meetings = await loadMeetingsDetailsForPopup(poDateStart, poDateEnd, selectedClient);
                
                // Format meeting details as HTML table - show specific columns
                let content = '';
                if (meetings.length === 0) {
                    content = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No meetings found for the selected filters.</p>';
                } else {
                    // Define columns to display (in order)
                    const columns = ['email', 'first_name', 'last_name', 'title', 'company', 'company_domain', 'client', 'campaign_name', 'created_time'];
                    
                    // Generate table headers
                    const headers = columns.map(col => 
                        `<th>${formatColumnName(col)}</th>`
                    ).join('');
                    
                    // Generate table rows
                    const rows = meetings.map((meeting, rowIndex) => {
                        // Debug first row
                        if (rowIndex === 0) {
                            console.log('🔍 Debugging first meeting row:', meeting);
                            console.log('🔍 First meeting object keys:', Object.keys(meeting));
                            columns.forEach(col => {
                                const rawValue = meeting[col];
                                console.log(`  ${col}: rawValue type=${typeof rawValue}, value=${JSON.stringify(rawValue)}`);
                                const formattedValue = formatCellValue(rawValue, col);
                                console.log(`  ${col}: formatted="${formattedValue}", type=${typeof formattedValue}`);
                            });
                        }
                        const cells = columns.map((col, colIndex) => {
                            // Access property directly
                            let value = meeting[col];
                            
                            // Debug: Log what we're actually getting for first row
                            if (rowIndex === 0) {
                                console.log(`[Cell ${colIndex}] ${col}: meeting["${col}"] =`, value, `(type: ${typeof value}, isNull: ${value === null}, isUndefined: ${value === undefined})`);
                            }
                            
                            // If value is undefined, try alternative property access
                            if (value === undefined) {
                                value = meeting[col.toLowerCase()] || meeting[col.toUpperCase()];
                            }
                            
                            // Handle display value: show actual value or 'N/A' for null/undefined/empty
                            let displayValue;
                            if (value !== null && value !== undefined && value !== '') {
                                // Format date fields nicely
                                if (col === 'created_time' && typeof value === 'string') {
                                    try {
                                        const date = parseLocalDate(value);
                                        if (date && !isNaN(date.getTime())) {
                                            displayValue = date.toLocaleDateString('en-US', { 
                                                year: 'numeric', 
                                                month: 'short', 
                                                day: 'numeric'
                                            });
                                        } else {
                                            displayValue = String(value).trim();
                                        }
                                    } catch (e) {
                                        displayValue = String(value).trim();
                                    }
                                } else {
                                    // Direct display if value exists
                                    displayValue = String(value).trim();
                                }
                            } else {
                                // Show 'N/A' for null/undefined/empty values
                                displayValue = 'N/A';
                            }
                            
                            // Debug: Log display value for first row
                            if (rowIndex === 0) {
                                console.log(`[Cell ${colIndex}] ${col}: displayValue =`, displayValue, `(type: ${typeof displayValue})`);
                            }
                            
                            // Escape HTML to prevent XSS
                            const escapedValue = String(displayValue)
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/'/g, '&#039;');
                            return `<td>${escapedValue}</td>`;
                        }).join('');
                        return `<tr>${cells}</tr>`;
                    }).join('');
                    
                    // Debug: Log first row HTML to verify content
                    if (meetings.length > 0) {
                        const firstRowMatch = rows.match(/<tr>.*?<\/tr>/);
                        if (firstRowMatch) {
                            console.log('🔍 First row HTML:', firstRowMatch[0]);
                        }
                    }
                    
                    content = `
                        <div style="max-height: 500px; overflow-y: auto; overflow-x: auto;">
                            <table class="meetings-detail-table">
                                <thead>
                                    <tr>
                                        ${headers}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-subtle);">
                            <p style="color: var(--color-text-muted); font-size: 0.85rem;">Total: ${meetings.length} meeting${meetings.length !== 1 ? 's' : ''}</p>
                        </div>
                    `;
                }
                
                // Show modal using the global function or create our own
                showMeetingsDetailModal('Meetings Booked Details', content);
            });
        }
    }
    
    // Load data (will wait for client filter to be populated)
    // Delay slightly to allow client filter to populate first
    setTimeout(() => {
        loadPerformanceData();
    }, 500);
}

// Load Performance Overview data
async function loadPerformanceData() {
    console.log('📊 Loading Performance Overview data...', { poDateStart, poDateEnd, poTimeframe });
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        return;
    }
    
    try {
        // Get current date input values from DOM
        const dateStartEl = document.getElementById('po-date-start');
        const dateEndEl = document.getElementById('po-date-end');
        const dateStartValue = dateStartEl ? dateStartEl.value : poDateStart;
        const dateEndValue = dateEndEl ? dateEndEl.value : poDateEnd;
        
        // Update variables from DOM values
        poDateStart = dateStartValue || null;
        poDateEnd = dateEndValue || null;
        
        // Get selected client from single-select filter
        let selectedClient = '';
        if (poClientFilter) {
            selectedClient = poClientFilter.value || '';
        }
        
        // Get selected campaign from filter
        let selectedCampaign = '';
        if (poCampaignFilter) {
            selectedCampaign = poCampaignFilter.value || '';
        }
        
        console.log('🔍 Selected client:', selectedClient || 'All Clients');
        console.log('🔍 Selected campaign:', selectedCampaign || 'All Campaigns');
        
        // Build query for campaign_reporting
        let query = client.from('campaign_reporting').select('*');
        
        // Apply client filter if a client is selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
            console.log('✅ Filtering by client:', selectedClient);
        }
        
        // Apply campaign filter if a campaign is selected
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
            console.log('✅ Filtering by campaign:', selectedCampaign);
        }
        
        // Apply date filters only when both dates are set
        if (poDateStart && poDateEnd) {
            query = query.gte('date', poDateStart);
            query = query.lte('date', poDateEnd);
            console.log('📅 Filtering by date range:', poDateStart, 'to', poDateEnd);
        } else {
            // No date filters - load all cumulative data
            console.log('📅 Loading cumulative data (no date filter)');
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading data:', error);
            return;
        }
        
        console.log('✅ Data loaded:', data?.length || 0, 'rows');
        
        // Calculate metrics from campaign_reporting (emails, prospects, bounces, positive replies)
        const metrics = calculatePerformanceMetrics(data || []);
        
        // Load replies from replies table (both total and real)
        const repliesData = await loadRepliesForPO(poDateStart, poDateEnd, selectedClient);
        metrics.totalReplies = repliesData.totalReplies;
        metrics.realReplies = repliesData.realReplies;
        
        // Recalculate percentages based on replies table data
        // Divide by unique prospects, not total emails sent
        metrics.repliesPercentage = metrics.uniqueProspects > 0 
            ? ((metrics.totalReplies / metrics.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        metrics.realRepliesPercentage = metrics.uniqueProspects > 0
            ? ((metrics.realReplies / metrics.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        
        // Calculate positive replies percentage based on real replies (excl. OOO)
        metrics.positivePercentage = metrics.realReplies > 0
            ? ((metrics.positiveReplies / metrics.realReplies) * 100).toFixed(1) + '%'
            : '0.0%';
        
        // Update UI
        updatePerformanceMetrics(metrics);
        
        // Load meetings from meetings_booked table
        const meetingsCount = await loadMeetingsBookedForPO(poDateStart, poDateEnd, selectedClient);
        metrics.meetingsBooked = meetingsCount;
        
        // Recalculate meetings percentage based on real replies
        metrics.meetingsPercentage = metrics.realReplies > 0
            ? ((metrics.meetingsBooked / metrics.realReplies) * 100).toFixed(0) + '%'
            : '0.0%';
        
        updatePerformanceMetrics(metrics);
        
        // Load meetings data for chart
        const meetingsData = await loadMeetingsDataForChart(poDateStart, poDateEnd, selectedClient);
        
        // Calculate changes from previous period
        let previousMetrics = null;
        if (poDateStart && poDateEnd) {
            // Calculate previous period (same duration, before current period)
            const startDate = new Date(poDateStart);
            const endDate = new Date(poDateEnd);
            const periodDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            
            const prevEndDate = new Date(startDate);
            prevEndDate.setDate(prevEndDate.getDate() - 1);
            const prevStartDate = new Date(prevEndDate);
            prevStartDate.setDate(prevStartDate.getDate() - periodDays + 1);
            
            previousMetrics = await loadPreviousPeriodMetrics(
                prevStartDate.toISOString().split('T')[0],
                prevEndDate.toISOString().split('T')[0],
                selectedClient
            );
        }
        
        // Update UI with metrics and changes
        updatePerformanceMetrics(metrics, previousMetrics);
        
        // Create/update chart
        createPerformanceChart(data || [], metrics, meetingsData || []);
        
    } catch (err) {
        console.error('❌ Error in loadPerformanceData:', err);
    }
}

// Load previous period metrics for comparison
async function loadPreviousPeriodMetrics(dateStart, dateEnd, selectedClient = '') {
    const client = getSupabaseClient();
    if (!client) return null;
    
    try {
        // Build query for previous period
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
            console.error('❌ Error loading previous period data:', error);
            return null;
        }
        
        const metrics = calculatePerformanceMetrics(data || []);
        
        // Load replies for previous period
        const repliesData = await loadRepliesForPO(dateStart, dateEnd, selectedClient);
        metrics.totalReplies = repliesData.totalReplies;
        metrics.realReplies = repliesData.realReplies;
        
        // Load meetings for previous period
        const meetingsCount = await loadMeetingsBookedForPO(dateStart, dateEnd, selectedClient);
        metrics.meetingsBooked = meetingsCount;
        
        return metrics;
    } catch (err) {
        console.error('❌ Error in loadPreviousPeriodMetrics:', err);
        return null;
    }
}

// Calculate performance metrics
function calculatePerformanceMetrics(data) {
    const metrics = {
        totalEmailsSent: 0,
        uniqueProspects: 0,
        totalReplies: 0,      // Will be set from replies table
        realReplies: 0,       // Will be set from replies table (excl. OOO)
        positiveReplies: 0,
        bounces: 0,
        meetingsBooked: 0
    };
    
    data.forEach(row => {
        metrics.totalEmailsSent += parseFloat(row.emails_sent) || 0;
        metrics.positiveReplies += parseFloat(row.interested) || 0;
        metrics.bounces += parseFloat(row.bounced) || 0;
    });
    
    // Use total_leads_contacted directly from campaign_reporting table
    metrics.uniqueProspects = data.reduce((sum, row) => sum + (parseFloat(row.total_leads_contacted) || 0), 0);
    
    // Note: totalReplies and realReplies are now loaded from the replies table
    // and will be set after calling loadRepliesForPO()
    
    // Calculate initial percentages (will be recalculated after loading replies)
    metrics.repliesPercentage = '0.0%';
    metrics.realRepliesPercentage = '0.0%';
    
    metrics.positivePercentage = '0.0%'; // Will be recalculated based on realReplies
    
    metrics.bouncesPercentage = metrics.totalEmailsSent > 0
        ? ((metrics.bounces / metrics.totalEmailsSent) * 100).toFixed(1) + '%'
        : '0.0%';
    
    metrics.meetingsPercentage = '0.0%'; // Will be recalculated based on realReplies
    
    return metrics;
}

// Update performance metrics UI
function updatePerformanceMetrics(metrics, previousMetrics = null) {
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    // Update values
    updateElement('po-total-emails', formatNum(metrics.totalEmailsSent));
    updateElement('po-unique-prospects', formatNum(metrics.uniqueProspects));
    updateElement('po-total-replies', formatNum(metrics.totalReplies));
    updateElement('po-real-replies', formatNum(metrics.realReplies));
    updateElement('po-positive-replies', formatNum(metrics.positiveReplies));
    updateElement('po-bounces', formatNum(metrics.bounces));
    updateElement('po-meetings-booked', formatNum(metrics.meetingsBooked));
    
    // Update percentages
    updateElement('po-replies-percentage', metrics.repliesPercentage);
    updateElement('po-real-replies-percentage', metrics.realRepliesPercentage);
    updateElement('po-positive-percentage', metrics.positivePercentage);
    updateElement('po-bounces-percentage', metrics.bouncesPercentage);
    updateElement('po-meetings-percentage', metrics.meetingsPercentage);
    
    // Calculate and update changes from previous period
    function calculateChange(current, previous) {
        if (!previous || previous === 0) return '-';
        const change = ((current - previous) / previous) * 100;
        const sign = change >= 0 ? '↑' : '↓';
        const absChange = Math.abs(change).toFixed(1);
        return `${sign}${absChange}%`;
    }
    
    if (previousMetrics) {
        updateElement('po-emails-change', calculateChange(metrics.totalEmailsSent, previousMetrics.totalEmailsSent));
        updateElement('po-prospects-change', calculateChange(metrics.uniqueProspects, previousMetrics.uniqueProspects));
        updateElement('po-replies-change', calculateChange(metrics.totalReplies, previousMetrics.totalReplies));
        updateElement('po-real-replies-change', calculateChange(metrics.realReplies, previousMetrics.realReplies));
        updateElement('po-positive-change', calculateChange(metrics.positiveReplies, previousMetrics.positiveReplies));
        updateElement('po-bounces-change', calculateChange(metrics.bounces, previousMetrics.bounces));
        updateElement('po-meetings-change', calculateChange(metrics.meetingsBooked, previousMetrics.meetingsBooked));
    } else {
        // No previous period data available
        updateElement('po-emails-change', '-');
        updateElement('po-prospects-change', '-');
        updateElement('po-replies-change', '-');
        updateElement('po-real-replies-change', '-');
        updateElement('po-positive-change', '-');
        updateElement('po-bounces-change', '-');
        updateElement('po-meetings-change', '-');
    }
}

function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
        // Preserve title attribute if it exists (for tooltips)
        // The title attributes are set in HTML to explain what percentages mean
    }
}

// Format column name for display (snake_case to Title Case)
function formatColumnName(columnName) {
    return columnName
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
}

// Format cell value for display
function formatCellValue(value, columnName) {
    // Debug logging for troubleshooting
    if (columnName === 'email' || columnName === 'client') {
        console.log(`[formatCellValue] ${columnName}: input value="${value}", type=${typeof value}, isNull=${value === null}, isUndefined=${value === undefined}`);
    }
    
    // Handle null, undefined, or empty string
    if (value === null || value === undefined || value === '') {
        return 'N/A';
    }
    
    // Handle boolean values
    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }
    
    // Handle date/timestamp fields
    const dateColumns = ['created_time', 'created_at', 'updated_at', 'updated_time', 
                         'meeting_date', 'booked_date', 'date', 'disco_date', 
                         'demo_booked_date', 'closed_date'];
    if (dateColumns.some(col => columnName.toLowerCase().includes(col))) {
        try {
            // Handle both date strings and Date objects
            const date = parseLocalDate(value);
            if (date && !isNaN(date.getTime())) {
                return date.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (e) {
            // If date parsing fails, return as string
        }
    }
    
    // Handle arrays and objects (JSON)
    if (typeof value === 'object' && !(value instanceof Date)) {
        return JSON.stringify(value);
    }
    
    // Return as string for everything else, trim whitespace
    const strValue = String(value).trim();
    const result = strValue.length > 0 ? strValue : 'N/A';
    
    // Debug logging for troubleshooting
    if (columnName === 'email' || columnName === 'client') {
        console.log(`[formatCellValue] ${columnName}: returning="${result}", strValue="${strValue}", length=${strValue.length}`);
    }
    
    return result;
}

// Show meetings detail modal
function showMeetingsDetailModal(title, content) {
    const modal = document.getElementById('detail-modal');
    const titleEl = document.getElementById('detail-modal-title');
    const bodyEl = document.getElementById('detail-modal-body');
    
    if (modal && titleEl && bodyEl) {
        titleEl.textContent = title;
        bodyEl.innerHTML = content;
        modal.classList.add('active');
    } else {
        console.error('❌ Detail modal elements not found');
    }
}

// Load meetings for Performance Overview
async function loadMeetingsBookedForPO(dateStart, dateEnd, selectedClient = '') {
    const client = getSupabaseClient();
    if (!client) return 0;
    
    try {
        let query = client.from('meetings_booked').select('*', { count: 'exact' });
        
        // Apply client filter if a client is selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
            console.log('🔍 Filtering meetings by client:', selectedClient);
        }
        
        // Apply date filters only when both dates are set
        // Use created_time field instead of date field
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart);
            query = query.lte('created_time', dateEnd);
            console.log('📅 Filtering meetings by created_time range:', dateStart, 'to', dateEnd);
        } else {
            // No date filters - load all cumulative meetings
            console.log('📅 Loading cumulative meetings (no date filter)');
        }
        
        const { count, error } = await query;
        
        if (error) {
            console.error('❌ Error loading meetings:', error);
            return 0;
        }
        
        console.log('✅ Meetings loaded:', count || 0);
        return count || 0;
    } catch (err) {
        console.error('❌ Error in loadMeetingsBookedForPO:', err);
        return 0;
    }
}

// Load meetings data for chart (with dates)
async function loadMeetingsDataForChart(dateStart, dateEnd, selectedClient = '') {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        let query = client.from('meetings_booked').select('created_time');
        
        // Apply client filter if a client is selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        // Apply date filters only when both dates are set
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart);
            query = query.lte('created_time', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading meetings data for chart:', error);
            return [];
        }
        
        // Transform to match campaign_reporting format (with date field)
        return (data || []).map(meeting => ({
            date: meeting.created_time ? meeting.created_time.split('T')[0] : null,
            meetings: 1
        }));
    } catch (err) {
        console.error('❌ Error in loadMeetingsDataForChart:', err);
        return [];
    }
}

// Load meetings details for popup
async function loadMeetingsDetailsForPopup(dateStart, dateEnd, selectedClient = '') {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        console.log('📥 Loading meeting details for popup...');
        
        // Explicitly select only the columns we need for the table
        // Using select with array format to ensure all columns are requested correctly
        let query = client.from('meetings_booked')
            .select('email,first_name,last_name,title,company,company_domain,client,campaign_name,created_time')
            .order('created_time', { ascending: false });
        
        // Apply client filter if a client is selected
        if (selectedClient) {
            query = query.eq('client', selectedClient);
            console.log('🔍 Filtering meetings by client:', selectedClient);
        }
        
        // Apply date filters only when both dates are set
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart);
            query = query.lte('created_time', dateEnd);
            console.log('📅 Filtering meetings by created_time range:', dateStart, 'to', dateEnd);
        } else {
            console.log('📅 Loading all meetings (no date filter)');
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading meeting details:', error);
            return [];
        }
        
        console.log('✅ Meeting details loaded:', data?.length || 0, 'meetings');
        if (data && data.length > 0) {
            console.log('📋 Sample meeting data:', JSON.stringify(data[0], null, 2));
            console.log('📋 First meeting email:', data[0].email);
            console.log('📋 First meeting keys:', Object.keys(data[0]));
        }
        
        // Ensure full_name is populated if first_name and last_name exist
        const enrichedData = (data || []).map(meeting => {
            if (!meeting.full_name && (meeting.first_name || meeting.last_name)) {
                meeting.full_name = `${meeting.first_name || ''} ${meeting.last_name || ''}`.trim();
            }
            return meeting;
        });
        
        return enrichedData;
    } catch (err) {
        console.error('❌ Error in loadMeetingsDetailsForPopup:', err);
        return [];
    }
}

// Load replies from replies table for Performance Overview
async function loadRepliesForPO(dateStart, dateEnd, selectedClient = '') {
    const client = getSupabaseClient();
    if (!client) return { totalReplies: 0, realReplies: 0 };
    
    try {
        console.log('📥 Loading replies from replies table...');
        
        // Query for ALL replies (including OOO)
        let totalQuery = client.from('replies').select('*', { count: 'exact', head: true });
        
        // Query for REAL replies (excluding OOO)
        let realQuery = client.from('replies')
            .select('*', { count: 'exact', head: true })
            .neq('category', 'Out Of Office');
        
        // Apply client filter to both queries
        if (selectedClient) {
            totalQuery = totalQuery.eq('client', selectedClient);
            realQuery = realQuery.eq('client', selectedClient);
            console.log('🔍 Filtering replies by client:', selectedClient);
        }
        
        // Apply date filters using date_received column
        if (dateStart && dateEnd) {
            totalQuery = totalQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
            realQuery = realQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
            console.log('📅 Filtering replies by date_received range:', dateStart, 'to', dateEnd);
        } else {
            console.log('📅 Loading cumulative replies (no date filter)');
        }
        
        // Execute both queries in parallel
        const [totalResult, realResult] = await Promise.all([totalQuery, realQuery]);
        
        if (totalResult.error) {
            console.error('❌ Error loading total replies:', totalResult.error);
        }
        if (realResult.error) {
            console.error('❌ Error loading real replies:', realResult.error);
        }
        
        const totalReplies = totalResult.count || 0;
        const realReplies = realResult.count || 0;
        
        console.log('✅ Replies loaded - Total (incl. OOO):', totalReplies, '| Real (excl. OOO):', realReplies);
        
        return {
            totalReplies: totalReplies,
            realReplies: realReplies
        };
    } catch (err) {
        console.error('❌ Error in loadRepliesForPO:', err);
        return { totalReplies: 0, realReplies: 0 };
    }
}

// Create performance trend chart
function createPerformanceChart(data, metrics, meetingsData = []) {
    const canvas = document.getElementById('po-trend-chart');
    if (!canvas || typeof Chart === 'undefined') {
        console.error('❌ Chart canvas or Chart.js not available');
        return;
    }
    
    // Group data by timeframe
    const chartData = groupDataByTimeframe(data, poTimeframe, meetingsData);
    
    // Destroy existing chart
    if (poChart) {
        poChart.destroy();
    }
    
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    const ctx = canvas.getContext('2d');
    poChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'Sent',
                    data: chartData.sent,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Unique Prospects',
                    data: chartData.prospects,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Replied',
                    data: chartData.replies,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Positive Replies',
                    data: chartData.positiveReplies,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                },
                {
                    label: 'Meetings Booked',
                    data: chartData.meetings,
                    borderColor: '#ec4899',
                    backgroundColor: '#ec4899',
                    fill: false,
                    tension: 0.4,
                    yAxisID: 'y1',
                    borderWidth: 0, // No line drawn
                    pointRadius: 0, // No points
                    pointHoverRadius: 0,
                    order: 100 // Put it last
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
                        filter: function(legendItem, chartData) {
                            // Hide Meetings Booked from legend (it has no visible line)
                            return legendItem.text !== 'Meetings Booked';
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNum(context.parsed.y);
                        }
                    },
                    displayColors: true
                }
            },
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const element = elements[0];
                    const datasetIndex = element.datasetIndex;
                    const dataset = poChart.data.datasets[datasetIndex];
                    const label = dataset.label;
                    
                    // Show all metrics breakdown for clicked line
                    console.log(`📊 Chart clicked: ${label}`);
                    showAllCampaignMetrics(label);
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
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
}

// Group data by timeframe (always daily now)
function groupDataByTimeframe(data, timeframe, meetingsData = []) {
    const grouped = {};
    
    // Always use daily grouping regardless of timeframe parameter
    // Group campaign_reporting data
    data.forEach(row => {
        const date = parseLocalDate(row.date);
        if (!date) return;
        const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        if (!grouped[key]) {
            grouped[key] = {
                sent: 0,
                prospects: 0,
                replies: 0,
                positiveReplies: 0,
                meetings: 0
            };
        }
        
        grouped[key].sent += parseFloat(row.emails_sent) || 0;
        grouped[key].prospects += parseFloat(row.total_leads_contacted) || 0;
        grouped[key].replies += parseFloat(row.unique_replies_per_contact) || 0;
        grouped[key].positiveReplies += parseFloat(row.interested) || 0;
    });
    
    // Group meetings data (always daily)
    meetingsData.forEach(row => {
        if (!row.date) return;
        const date = parseLocalDate(row.date);
        if (!date) return;
        const key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        if (!grouped[key]) {
            grouped[key] = {
                sent: 0,
                prospects: 0,
                replies: 0,
                positiveReplies: 0,
                meetings: 0
            };
        }
        
        grouped[key].meetings += 1;
    });
    
    // Convert to arrays and sort
    const keys = Object.keys(grouped).sort((a, b) => {
        return new Date(a) - new Date(b);
    });
    
    return {
        labels: keys,
        sent: keys.map(k => grouped[k].sent),
        prospects: keys.map(k => grouped[k].prospects),
        replies: keys.map(k => grouped[k].replies),
        positiveReplies: keys.map(k => grouped[k].positiveReplies),
        meetings: keys.map(k => grouped[k].meetings)
    };
}

// Export Performance Overview data to CSV
async function exportPerformanceOverviewCSV() {
    console.log('📥 Exporting Performance Overview to CSV...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        alert('Unable to export: Database connection not available');
        return;
    }
    
    try {
        // Get current filter values
        const dateStart = poDateStart || '';
        const dateEnd = poDateEnd || '';
        const selectedClient = poClientFilter ? (poClientFilter.value || '') : '';
        
        // Build query same as loadPerformanceData
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (dateStart) {
            query = query.gte('date', dateStart);
        }
        if (dateEnd) {
            query = query.lte('date', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading data for export:', error);
            alert('Error loading data for export: ' + error.message);
            return;
        }
        
        // Get meetings count
        const meetingsCount = await loadMeetingsBookedForPO(dateStart, dateEnd, selectedClient);
        
        // Get replies from replies table
        const repliesData = await loadRepliesForPO(dateStart, dateEnd, selectedClient);
        
        // Calculate metrics
        const metrics = calculatePerformanceMetrics(data || []);
        metrics.meetingsBooked = meetingsCount;
        metrics.totalReplies = repliesData.totalReplies;
        metrics.realReplies = repliesData.realReplies;
        
        // Calculate percentages
        // Divide by unique prospects, not total emails sent
        metrics.repliesPercentage = metrics.uniqueProspects > 0 
            ? ((metrics.totalReplies / metrics.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        metrics.realRepliesPercentage = metrics.uniqueProspects > 0
            ? ((metrics.realReplies / metrics.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        metrics.positivePercentage = metrics.realReplies > 0
            ? ((metrics.positiveReplies / metrics.realReplies) * 100).toFixed(1) + '%'
            : '0.0%';
        metrics.meetingsPercentage = metrics.realReplies > 0
            ? ((metrics.meetingsBooked / metrics.realReplies) * 100).toFixed(0) + '%'
            : '0.0%';
        
        // Build CSV content
        const csvRows = [];
        
        // Header section
        csvRows.push('Performance Overview Report');
        csvRows.push(`Date Range: ${dateStart || 'All'} to ${dateEnd || 'All'}`);
        csvRows.push(`Client: ${selectedClient || 'All Clients'}`);
        csvRows.push(''); // Empty row
        
        // Metrics section
        csvRows.push('Metrics');
        csvRows.push('Metric,Value,Percentage');
        csvRows.push(`Total Emails Sent,${metrics.totalEmailsSent},`);
        csvRows.push(`Unique Prospects,${metrics.uniqueProspects},`);
        csvRows.push(`Total Replies (incl. OOO),${metrics.totalReplies},${metrics.repliesPercentage}`);
        csvRows.push(`Real Replies (excl. OOO),${metrics.realReplies},${metrics.realRepliesPercentage}`);
        csvRows.push(`Positive Replies,${metrics.positiveReplies},${metrics.positivePercentage}`);
        csvRows.push(`Bounces,${metrics.bounces},${metrics.bouncesPercentage}`);
        csvRows.push(`Meetings Booked,${metrics.meetingsBooked},${metrics.meetingsPercentage}`);
        csvRows.push(''); // Empty row
        
        // Data section
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
        const filename = `performance-overview-${dateStr}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log('✅ CSV exported successfully:', filename);
    } catch (err) {
        console.error('❌ Error exporting CSV:', err);
        alert('Error exporting CSV: ' + err.message);
    }
}

// Add click handlers to metric cards for drill-down
function addMetricClickHandlers() {
    const metricCards = [
        { id: 'po-total-emails', metric: 'emails', label: 'Total Emails Sent' },
        { id: 'po-unique-prospects', metric: 'prospects', label: 'Unique Prospects' },
        { id: 'po-total-replies', metric: 'replies', label: 'Total Replies' },
        { id: 'po-real-replies', metric: 'realReplies', label: 'Real Replies' },
        { id: 'po-positive-replies', metric: 'positiveReplies', label: 'Positive Replies' },
        { id: 'po-bounces', metric: 'bounces', label: 'Bounces' }
    ];
    
    metricCards.forEach(({ id, metric, label }) => {
        const element = document.getElementById(id);
        if (element) {
            const cardElement = element.closest('.performance-metric-card');
            if (cardElement) {
                cardElement.style.cursor = 'pointer';
                cardElement.addEventListener('click', async () => {
                    console.log(`📊 ${label} card clicked`);
                    await showCampaignBreakdownForMetric(metric, label);
                });
            }
        }
    });
}

// Load campaign breakdown for a specific metric
async function loadCampaignBreakdownForMetric(metricType, dateStart, dateEnd, selectedClient, selectedCampaign) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        // Build query for campaign_reporting
        let query = client.from('campaign_reporting').select('campaign_name, client, emails_sent, total_leads_contacted, interested, bounced');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart).lte('date', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading campaign breakdown:', error);
            return [];
        }
        
        // Aggregate by campaign
        const campaignMap = {};
        (data || []).forEach(row => {
            const campaignName = row.campaign_name || 'Unknown';
            if (!campaignMap[campaignName]) {
                campaignMap[campaignName] = {
                    campaign_name: campaignName,
                    client: row.client || 'Unknown',
                    emailsSent: 0,
                    uniqueProspects: 0,
                    positiveReplies: 0,
                    bounces: 0
                };
            }
            
            campaignMap[campaignName].emailsSent += parseFloat(row.emails_sent) || 0;
            campaignMap[campaignName].uniqueProspects += parseFloat(row.total_leads_contacted) || 0;
            campaignMap[campaignName].positiveReplies += parseFloat(row.interested) || 0;
            campaignMap[campaignName].bounces += parseFloat(row.bounced) || 0;
        });
        
        // Load replies for each campaign if needed
        if (metricType === 'replies' || metricType === 'realReplies') {
            let repliesQuery = client.from('replies').select('campaign_id, category, client');
            
            if (selectedClient) {
                repliesQuery = repliesQuery.eq('client', selectedClient);
            }
            
            if (dateStart && dateEnd) {
                repliesQuery = repliesQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
            }
            
            const { data: repliesData } = await repliesQuery;
            
            // Group replies by client (approximate by client since we don't have direct campaign mapping)
            const repliesByClient = {};
            (repliesData || []).forEach(reply => {
                const replyClient = reply.client || 'Unknown';
                if (!repliesByClient[replyClient]) {
                    repliesByClient[replyClient] = { total: 0, real: 0 };
                }
                repliesByClient[replyClient].total += 1;
                if (reply.category !== 'Out Of Office') {
                    repliesByClient[replyClient].real += 1;
                }
            });
            
            // Distribute replies across campaigns for the same client
            Object.values(campaignMap).forEach(campaign => {
                const clientReplies = repliesByClient[campaign.client] || { total: 0, real: 0 };
                const campaignsForClient = Object.values(campaignMap).filter(c => c.client === campaign.client).length;
                campaign.totalReplies = campaignsForClient > 0 ? Math.round(clientReplies.total / campaignsForClient) : 0;
                campaign.realReplies = campaignsForClient > 0 ? Math.round(clientReplies.real / campaignsForClient) : 0;
            });
        }
        
        // Calculate metric values and totals
        const campaigns = Object.values(campaignMap);
        let totalValue = 0;
        
        campaigns.forEach(campaign => {
            let value = 0;
            switch (metricType) {
                case 'emails':
                    value = campaign.emailsSent;
                    break;
                case 'prospects':
                    value = campaign.uniqueProspects;
                    break;
                case 'replies':
                    value = campaign.totalReplies || 0;
                    break;
                case 'realReplies':
                    value = campaign.realReplies || 0;
                    break;
                case 'positiveReplies':
                    value = campaign.positiveReplies;
                    break;
                case 'bounces':
                    value = campaign.bounces;
                    break;
            }
            campaign.metricValue = value;
            totalValue += value;
        });
        
        // Calculate percentages
        campaigns.forEach(campaign => {
            campaign.percentage = totalValue > 0 ? ((campaign.metricValue / totalValue) * 100).toFixed(1) : '0.0';
        });
        
        // Sort by metric value descending
        campaigns.sort((a, b) => b.metricValue - a.metricValue);
        
        return campaigns;
    } catch (err) {
        console.error('❌ Error in loadCampaignBreakdownForMetric:', err);
        return [];
    }
}

// Show all campaign metrics breakdown
async function showAllCampaignMetrics(clickedMetricLabel) {
    const modal = document.getElementById('detail-modal');
    const titleEl = document.getElementById('detail-modal-title');
    const bodyEl = document.getElementById('detail-modal-body');
    
    if (!modal || !titleEl || !bodyEl) {
        console.error('❌ Detail modal elements not found');
        return;
    }
    
    // Show loading state
    titleEl.textContent = `Campaign Breakdown: ${clickedMetricLabel}`;
    bodyEl.innerHTML = '<div class="loading">Loading campaign breakdown...</div>';
    modal.classList.add('active');
    
    // Get current filter values
    const dateStartEl = document.getElementById('po-date-start');
    const dateEndEl = document.getElementById('po-date-end');
    const dateStart = dateStartEl ? dateStartEl.value : poDateStart;
    const dateEnd = dateEndEl ? dateEndEl.value : poDateEnd;
    const selectedClient = poClientFilter ? (poClientFilter.value || '') : '';
    const selectedCampaign = poCampaignFilter ? (poCampaignFilter.value || '') : '';
    
    // Load all campaign metrics
    const campaigns = await loadAllCampaignMetrics(dateStart, dateEnd, selectedClient, selectedCampaign);
    
    if (campaigns.length === 0) {
        bodyEl.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No campaign data found for the selected filters.</p>';
        return;
    }
    
    // Format number helper
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    // Build comprehensive table with all metrics
    const tableRows = campaigns.map(campaign => {
        return `
            <tr>
                <td><strong>${escapeHtml(campaign.campaign_name)}</strong></td>
                <td>${escapeHtml(campaign.client)}</td>
                <td style="text-align: right;">${formatNum(campaign.emailsSent)}</td>
                <td style="text-align: right;">${formatNum(campaign.uniqueProspects)}</td>
                <td style="text-align: right;">${formatNum(campaign.totalReplies || 0)}</td>
                <td style="text-align: right;">${formatNum(campaign.realReplies || 0)}</td>
                <td style="text-align: right;">${formatNum(campaign.positiveReplies)}</td>
                <td style="text-align: right;">${formatNum(campaign.bounces)}</td>
                <td style="text-align: right;">${formatNum(campaign.meetings || 0)}</td>
            </tr>
        `;
    }).join('');
    
    const content = `
        <div style="margin-bottom: 16px;">
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">
                Showing all metrics for campaigns (clicked: <strong>${clickedMetricLabel}</strong>)
            </p>
        </div>
        <div style="max-height: 500px; overflow-y: auto; overflow-x: auto;">
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="text-align: left;">Campaign Name</th>
                        <th style="text-align: left;">Client</th>
                        <th style="text-align: right;">Emails Sent</th>
                        <th style="text-align: right;">Prospects</th>
                        <th style="text-align: right;">Total Replies</th>
                        <th style="text-align: right;">Real Replies</th>
                        <th style="text-align: right;">Positive Replies</th>
                        <th style="text-align: right;">Bounces</th>
                        <th style="text-align: right;">Meetings</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-subtle);">
            <p style="color: var(--color-text-muted); font-size: 0.85rem;">
                Total: ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}
            </p>
        </div>
    `;
    
    bodyEl.innerHTML = content;
}

// Load all campaign metrics (not just one metric)
async function loadAllCampaignMetrics(dateStart, dateEnd, selectedClient, selectedCampaign) {
    const client = getSupabaseClient();
    if (!client) return [];
    
    try {
        // Build query for campaign_reporting - include campaign_id for uniqueness
        let query = client.from('campaign_reporting').select('campaign_id, campaign_name, client, emails_sent, total_leads_contacted, interested, bounced');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart).lte('date', dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading campaign breakdown:', error);
            return [];
        }
        
        // Aggregate by campaign_id (unique) instead of campaign_name
        const campaignMap = {};
        (data || []).forEach(row => {
            const campaignId = row.campaign_id || 'unknown';
            const campaignName = row.campaign_name || 'Unknown';
            
            if (!campaignMap[campaignId]) {
                campaignMap[campaignId] = {
                    campaign_id: campaignId,
                    campaign_name: campaignName,
                    client: row.client || 'Unknown',
                    emailsSent: 0,
                    uniqueProspects: 0,
                    positiveReplies: 0,
                    bounces: 0
                };
            }
            
            campaignMap[campaignId].emailsSent += parseFloat(row.emails_sent) || 0;
            campaignMap[campaignId].uniqueProspects += parseFloat(row.total_leads_contacted) || 0;
            campaignMap[campaignId].positiveReplies += parseFloat(row.interested) || 0;
            campaignMap[campaignId].bounces += parseFloat(row.bounced) || 0;
        });
        
        // Load replies
        let repliesQuery = client.from('replies').select('campaign_id, category, client');
        if (selectedClient) {
            repliesQuery = repliesQuery.eq('client', selectedClient);
        }
        if (dateStart && dateEnd) {
            repliesQuery = repliesQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
        }
        const { data: repliesData } = await repliesQuery;
        
        // Load meetings
        let meetingsQuery = client.from('meetings_booked').select('campaign_id, client');
        if (selectedClient) {
            meetingsQuery = meetingsQuery.eq('client', selectedClient);
        }
        if (dateStart && dateEnd) {
            meetingsQuery = meetingsQuery.gte('created_time', dateStart).lte('created_time', dateEnd);
        }
        const { data: meetingsData } = await meetingsQuery;
        
        // Group replies and meetings by campaign_id
        const repliesByCampaign = {};
        (repliesData || []).forEach(reply => {
            const campaignId = reply.campaign_id || 'unknown';
            if (!repliesByCampaign[campaignId]) {
                repliesByCampaign[campaignId] = { total: 0, real: 0 };
            }
            repliesByCampaign[campaignId].total += 1;
            if (reply.category !== 'Out Of Office') {
                repliesByCampaign[campaignId].real += 1;
            }
        });
        
        const meetingsByCampaign = {};
        (meetingsData || []).forEach(meeting => {
            const campaignId = meeting.campaign_id || 'unknown';
            meetingsByCampaign[campaignId] = (meetingsByCampaign[campaignId] || 0) + 1;
        });
        
        // Add replies and meetings to campaigns
        Object.values(campaignMap).forEach(campaign => {
            campaign.totalReplies = repliesByCampaign[campaign.campaign_id]?.total || 0;
            campaign.realReplies = repliesByCampaign[campaign.campaign_id]?.real || 0;
            campaign.meetings = meetingsByCampaign[campaign.campaign_id] || 0;
        });
        
        // Sort by emails sent descending
        const campaigns = Object.values(campaignMap);
        campaigns.sort((a, b) => b.emailsSent - a.emailsSent);
        
        return campaigns;
    } catch (err) {
        console.error('❌ Error in loadAllCampaignMetrics:', err);
        return [];
    }
}

// Show campaign breakdown modal for a metric (kept for metric card clicks)
async function showCampaignBreakdownForMetric(metricType, metricLabel) {
    const modal = document.getElementById('detail-modal');
    const titleEl = document.getElementById('detail-modal-title');
    const bodyEl = document.getElementById('detail-modal-body');
    
    if (!modal || !titleEl || !bodyEl) {
        console.error('❌ Detail modal elements not found');
        return;
    }
    
    // Show loading state
    titleEl.textContent = `Campaign Breakdown: ${metricLabel}`;
    bodyEl.innerHTML = '<div class="loading">Loading campaign breakdown...</div>';
    modal.classList.add('active');
    
    // Get current filter values
    const dateStartEl = document.getElementById('po-date-start');
    const dateEndEl = document.getElementById('po-date-end');
    const dateStart = dateStartEl ? dateStartEl.value : poDateStart;
    const dateEnd = dateEndEl ? dateEndEl.value : poDateEnd;
    const selectedClient = poClientFilter ? (poClientFilter.value || '') : '';
    const selectedCampaign = poCampaignFilter ? (poCampaignFilter.value || '') : '';
    
    // Load all campaign metrics and show the specific one
    const campaigns = await loadAllCampaignMetrics(dateStart, dateEnd, selectedClient, selectedCampaign);
    
    if (campaigns.length === 0) {
        bodyEl.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No campaign data found for the selected filters.</p>';
        return;
    }
    
    // Calculate metric values and totals for the specific metric
    let totalValue = 0;
    campaigns.forEach(campaign => {
        let value = 0;
        switch (metricType) {
            case 'emails':
                value = campaign.emailsSent;
                break;
            case 'prospects':
                value = campaign.uniqueProspects;
                break;
            case 'replies':
                value = campaign.totalReplies || 0;
                break;
            case 'realReplies':
                value = campaign.realReplies || 0;
                break;
            case 'positiveReplies':
                value = campaign.positiveReplies;
                break;
            case 'bounces':
                value = campaign.bounces;
                break;
        }
        campaign.metricValue = value;
        totalValue += value;
    });
    
    // Calculate percentages
    campaigns.forEach(campaign => {
        campaign.percentage = totalValue > 0 ? ((campaign.metricValue / totalValue) * 100).toFixed(1) : '0.0';
    });
    
    // Format number helper
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    // Build table
    const tableRows = campaigns.map(campaign => {
        return `
            <tr>
                <td><strong>${escapeHtml(campaign.campaign_name)}</strong></td>
                <td>${escapeHtml(campaign.client)}</td>
                <td style="text-align: right;">${formatNum(campaign.metricValue)}</td>
                <td style="text-align: right;">${campaign.percentage}%</td>
            </tr>
        `;
    }).join('');
    
    const content = `
        <div style="margin-bottom: 16px;">
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">
                Showing campaign breakdown for <strong>${metricLabel}</strong>
            </p>
        </div>
        <div style="max-height: 500px; overflow-y: auto; overflow-x: auto;">
            <table class="data-table" style="width: 100%;">
                <thead>
                    <tr>
                        <th style="text-align: left;">Campaign Name</th>
                        <th style="text-align: left;">Client</th>
                        <th style="text-align: right;">Value</th>
                        <th style="text-align: right;">% of Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-subtle);">
            <p style="color: var(--color-text-muted); font-size: 0.85rem;">
                Total: ${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}
            </p>
        </div>
    `;
    
    bodyEl.innerHTML = content;
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Get Supabase client
function getSupabaseClient() {
    // Use the global function from analytics-core.js if available
    // Guard against infinite recursion by ensuring we don't call ourselves
    if (window.getSupabaseClient && typeof window.getSupabaseClient === 'function' && window.getSupabaseClient !== getSupabaseClient) {
        return window.getSupabaseClient();
    }
    
    // Fallback: create directly if Supabase is available
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        return supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    }
    
    console.error('Cannot get Supabase client - all methods failed');
    return null;
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initPerformanceOverview = initPerformanceOverview;
    window.loadPerformanceData = loadPerformanceData;
    window.loadDashboard = function(dashboardName) {
        if (dashboardName === 'performance-overview') {
            initPerformanceOverview();
        } else if (dashboardName === 'quick-view') {
            if (window.initQuickView) {
                window.initQuickView();
            } else {
                console.warn('initQuickView function not found');
            }
        } else if (dashboardName === 'gtm-scoreboard') {
            if (window.initGTMScoreboard) window.initGTMScoreboard();
        } else if (dashboardName === 'pipeline') {
            if (window.loadPipelineDashboard) {
                window.loadPipelineDashboard();
            } else {
                console.warn('loadPipelineDashboard function not found');
            }
        }
    };
}

