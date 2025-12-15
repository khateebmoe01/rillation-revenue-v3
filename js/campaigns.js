// Campaigns Dashboard

let campaignsChart = null;
let campaignsDateStart = null;
let campaignsDateEnd = null;
let campaignsClientFilter = null;
let campaignsCampaignFilter = null;

// Load clients for Campaigns filter
async function loadClientsForCampaignsFilter() {
    console.log('🔄 loadClientsForCampaignsFilter called');
    const client = getSupabaseClient();
    
    if (!client) {
        console.error('❌ Supabase client not initialized');
        return;
    }
    
    try {
        console.log('📥 Querying Clients table...');
        let { data, error } = await client
            .from('Clients')
            .select('Business');
        
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
            const { data: fallbackData, error: fallbackError } = await client
                .from('campaign_reporting')
                .select('client')
                .not('client', 'is', null);
            
            if (fallbackError) {
                console.error('❌ Error loading clients from fallback:', fallbackError);
                return;
            }
            
            const clients = [...new Set(fallbackData.map(c => c.client).filter(Boolean))];
            console.log('✅ Loaded clients from fallback:', clients);
            populateCampaignsClientFilter(clients);
            return;
        }
        
        console.log('✅ Data received from Clients table:', data);
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No data in Clients table');
            return;
        }
        
        const clients = data
            .map(row => row.Business || row.business || row.name || row.client_name || row.client || row.company_name)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort();
        
        console.log('✅ Extracted clients:', clients);
        populateCampaignsClientFilter(clients);
    } catch (err) {
        console.error('❌ Error loading clients:', err);
    }
}

// Populate Campaigns client filter dropdown
function populateCampaignsClientFilter(clients) {
    console.log('🔄 populateCampaignsClientFilter called with:', clients);
    
    campaignsClientFilter = document.getElementById('campaigns-client-filter');
    if (!campaignsClientFilter) {
        console.error('❌ campaigns-client-filter element not found!');
        return;
    }
    
    campaignsClientFilter.innerHTML = '<option value="">All Clients</option>';
    clients.forEach(clientName => {
        const option = document.createElement('option');
        option.value = clientName;
        option.textContent = clientName;
        campaignsClientFilter.appendChild(option);
    });
    
    // Load campaigns when client is selected
    campaignsClientFilter.addEventListener('change', () => {
        loadCampaignsForFilter();
        loadCampaignsData();
    });
    
    console.log('✅ Client filter populated');
}

// Load campaigns for the selected client
async function loadCampaignsForFilter() {
    const client = getSupabaseClient();
    if (!client) return;
    
    const selectedClient = campaignsClientFilter ? campaignsClientFilter.value : '';
    if (!selectedClient) {
        campaignsCampaignFilter = document.getElementById('campaigns-campaign-filter');
        if (campaignsCampaignFilter) {
            campaignsCampaignFilter.innerHTML = '<option value="">All Campaigns</option>';
        }
        return;
    }
    
    try {
        const { data, error } = await client
            .from('campaign_reporting')
            .select('campaign_name')
            .eq('client', selectedClient)
            .not('campaign_name', 'is', null);
        
        if (error) {
            console.error('❌ Error loading campaigns:', error);
            return;
        }
        
        const campaigns = [...new Set(data.map(c => c.campaign_name).filter(Boolean))].sort();
        
        campaignsCampaignFilter = document.getElementById('campaigns-campaign-filter');
        if (campaignsCampaignFilter) {
            campaignsCampaignFilter.innerHTML = '<option value="">All Campaigns</option>';
            campaigns.forEach(campaignName => {
                const option = document.createElement('option');
                option.value = campaignName;
                option.textContent = campaignName;
                campaignsCampaignFilter.appendChild(option);
            });
            
            campaignsCampaignFilter.addEventListener('change', () => {
                loadCampaignsData();
            });
        }
        
        console.log('✅ Campaigns loaded:', campaigns);
    } catch (err) {
        console.error('❌ Error loading campaigns:', err);
    }
}

// Initialize Campaigns dashboard
function initCampaigns() {
    console.log('🚀 Initializing Campaigns dashboard...');
    
    // Load clients first
    loadClientsForCampaignsFilter();
    
    // Date preset buttons
    const datePresetButtons = document.querySelectorAll('#campaigns .date-preset-btn');
    datePresetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setDatePresetForCampaigns(preset);
        });
    });
    
    // Clear filters button
    const clearFiltersBtn = document.getElementById('campaigns-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const dateStartEl = document.getElementById('campaigns-date-start');
            const dateEndEl = document.getElementById('campaigns-date-end');
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            campaignsDateStart = null;
            campaignsDateEnd = null;
            
            if (campaignsClientFilter) campaignsClientFilter.value = '';
            if (campaignsCampaignFilter) campaignsCampaignFilter.value = '';
            
            loadCampaignsData();
        });
    }
    
    // Save Report button
    const saveReportBtn = document.getElementById('campaigns-save-report');
    if (saveReportBtn) {
        saveReportBtn.addEventListener('click', () => {
            exportCampaignsCSV();
        });
    }
    
    // Load data after a short delay
    setTimeout(() => {
        loadCampaignsData();
    }, 500);
}

// Set date preset for campaigns
function setDatePresetForCampaigns(preset) {
    const dateStartEl = document.getElementById('campaigns-date-start');
    const dateEndEl = document.getElementById('campaigns-date-end');
    if (!dateStartEl || !dateEndEl) return;
    
    const today = new Date();
    const endDate = new Date(today);
    let startDate = new Date(today);
    
    switch(preset) {
        case 'today':
            startDate = new Date(today);
            break;
        case 'this_week':
            startDate.setDate(today.getDate() - today.getDay());
            break;
        case 'last_week':
            startDate.setDate(today.getDate() - today.getDay() - 7);
            endDate.setDate(today.getDate() - today.getDay() - 1);
            break;
        case 'this_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'custom':
            return; // Let user pick custom dates
    }
    
    dateStartEl.value = startDate.toISOString().split('T')[0];
    dateEndEl.value = endDate.toISOString().split('T')[0];
    campaignsDateStart = dateStartEl.value;
    campaignsDateEnd = dateEndEl.value;
    
    loadCampaignsData();
}

// Load Campaigns data
async function loadCampaignsData() {
    console.log('📊 Loading Campaigns data...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        return;
    }
    
    try {
        const dateStartEl = document.getElementById('campaigns-date-start');
        const dateEndEl = document.getElementById('campaigns-date-end');
        const dateStartValue = dateStartEl ? dateStartEl.value : campaignsDateStart;
        const dateEndValue = dateEndEl ? dateEndEl.value : campaignsDateEnd;
        
        campaignsDateStart = dateStartValue || null;
        campaignsDateEnd = dateEndValue || null;
        
        let selectedClient = '';
        if (campaignsClientFilter) {
            selectedClient = campaignsClientFilter.value || '';
        }
        
        let selectedCampaign = '';
        if (campaignsCampaignFilter) {
            selectedCampaign = campaignsCampaignFilter.value || '';
        }
        
        console.log('🔍 Filters:', { client: selectedClient || 'All', campaign: selectedCampaign || 'All', dateStart: campaignsDateStart, dateEnd: campaignsDateEnd });
        
        // Build query
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        if (campaignsDateStart) {
            query = query.gte('date', campaignsDateStart);
        }
        
        if (campaignsDateEnd) {
            query = query.lte('date', campaignsDateEnd);
        }
        
        const { data, error } = await query.order('date', { ascending: true });
        
        if (error) {
            console.error('❌ Error loading campaigns data:', error);
            return;
        }
        
        console.log('✅ Campaigns data loaded:', data?.length || 0, 'rows');
        
        // Calculate metrics
        const metrics = calculateCampaignsMetrics(data || []);
        
        // Load previous period for trends
        const previousMetrics = await loadPreviousPeriodCampaignsMetrics(campaignsDateStart, campaignsDateEnd, selectedClient, selectedCampaign);
        
        // Update UI
        updateCampaignsMetrics(metrics, previousMetrics);
        
        // Load meetings
        const meetings = await loadMeetingsBookedForCampaigns(campaignsDateStart, campaignsDateEnd, selectedClient, selectedCampaign);
        metrics.meetingsBooked = meetings;
        
        // Update meetings metric
        updateElement('campaigns-meetings-booked', formatNumber(meetings));
        
        // Create charts
        createCampaignsChart(data || [], metrics, meetings);
        
    } catch (err) {
        console.error('❌ Error in loadCampaignsData:', err);
    }
}

// Calculate campaigns metrics
function calculateCampaignsMetrics(data) {
    const metrics = {
        totalEmails: 0,
        uniqueProspects: 0,
        totalReplies: 0,
        realReplies: 0,
        positiveReplies: 0,
        bounces: 0,
        meetingsBooked: 0
    };
    
    data.forEach(row => {
        metrics.totalEmails += row.emails_sent || 0;
        metrics.uniqueProspects += row.unique_prospects || row.total_leads || 0;
        metrics.totalReplies += row.total_replies || row.unique_replies || 0;
        metrics.realReplies += row.real_replies || row.unique_replies || 0;
        metrics.positiveReplies += row.positive_replies || row.interested || 0;
        metrics.bounces += row.bounces || row.bounced || 0;
    });
    
    return metrics;
}

// Load previous period metrics for trends
async function loadPreviousPeriodCampaignsMetrics(dateStart, dateEnd, selectedClient, selectedCampaign) {
    if (!dateStart || !dateEnd) return null;
    
    const client = getSupabaseClient();
    if (!client) return null;
    
    try {
        const start = new Date(dateStart);
        const end = new Date(dateEnd);
        const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        
        const prevEnd = new Date(start);
        prevEnd.setDate(prevEnd.getDate() - 1);
        const prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - periodDays);
        
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        query = query.gte('date', prevStart.toISOString().split('T')[0])
                     .lte('date', prevEnd.toISOString().split('T')[0]);
        
        const { data, error } = await query;
        
        if (error || !data) return null;
        
        return calculateCampaignsMetrics(data);
    } catch (err) {
        console.error('❌ Error loading previous period:', err);
        return null;
    }
}

// Update campaigns metrics in UI
function updateCampaignsMetrics(metrics, previousMetrics = null) {
    updateElement('campaigns-total-emails', formatNumber(metrics.totalEmails));
    updateElement('campaigns-unique-prospects', formatNumber(metrics.uniqueProspects));
    updateElement('campaigns-total-replies', formatNumber(metrics.totalReplies));
    updateElement('campaigns-real-replies', formatNumber(metrics.realReplies));
    updateElement('campaigns-positive-replies', formatNumber(metrics.positiveReplies));
    updateElement('campaigns-bounces', formatNumber(metrics.bounces));
    
    // Calculate and display trends
    if (previousMetrics) {
        updateTrend('campaigns-emails-change', metrics.totalEmails, previousMetrics.totalEmails, 'positive');
        updateTrend('campaigns-prospects-change', metrics.uniqueProspects, previousMetrics.uniqueProspects, 'positive');
        updateTrend('campaigns-replies-change', metrics.totalReplies, previousMetrics.totalReplies, 'positive');
        updateTrend('campaigns-real-replies-change', metrics.realReplies, previousMetrics.realReplies, 'positive');
        updateTrend('campaigns-positive-change', metrics.positiveReplies, previousMetrics.positiveReplies, 'positive');
        updateTrend('campaigns-bounces-change', metrics.bounces, previousMetrics.bounces, 'negative');
        updateTrend('campaigns-meetings-change', metrics.meetingsBooked, previousMetrics.meetingsBooked, 'positive');
    } else {
        // No previous data, show dashes
        ['campaigns-emails-change', 'campaigns-prospects-change', 'campaigns-replies-change', 
         'campaigns-real-replies-change', 'campaigns-positive-change', 'campaigns-bounces-change', 
         'campaigns-meetings-change'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '↑-';
        });
    }
}

// Update trend indicator
function updateTrend(elementId, current, previous, type) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    if (previous === 0 || previous === null) {
        el.textContent = '↑-';
        el.className = 'metric-change positive';
        return;
    }
    
    const change = ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const sign = isPositive ? '+' : '';
    
    el.textContent = `${arrow}${sign}${change.toFixed(1)}%`;
    el.className = `metric-change ${type === 'negative' ? (isPositive ? 'negative' : 'positive') : (isPositive ? 'positive' : 'negative')}`;
}

// Update element helper
function updateElement(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

// Format number helper
function formatNumber(num) {
    if (num === null || num === undefined) return '-';
    return new Intl.NumberFormat('en-US').format(num);
}

// Load meetings booked
async function loadMeetingsBookedForCampaigns(dateStart, dateEnd, selectedClient, selectedCampaign) {
    const client = getSupabaseClient();
    if (!client) return 0;
    
    try {
        let query = client.from('meetings_booked').select('*', { count: 'exact' });
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        // Apply date filters using created_time field
        if (dateStart && dateEnd) {
            query = query.gte('created_time', dateStart).lte('created_time', dateEnd);
        } else if (dateStart) {
            query = query.gte('created_time', dateStart);
        } else if (dateEnd) {
            query = query.lte('created_time', dateEnd);
        }
        
        const { count, error } = await query;
        
        if (error) {
            console.error('❌ Error loading meetings:', error);
            return 0;
        }
        
        console.log('✅ Meetings loaded for campaigns:', count || 0);
        return count || 0;
    } catch (err) {
        console.error('❌ Error in loadMeetingsBookedForCampaigns:', err);
        return 0;
    }
}

// Create campaigns chart
function createCampaignsChart(data, metrics, meetingsData = []) {
    const ctx = document.getElementById('campaigns-trend-chart');
    if (!ctx) return;
    
    if (campaignsChart) {
        campaignsChart.destroy();
    }
    
    // Group data by date
    const groupedData = groupDataByDate(data);
    
    const labels = Object.keys(groupedData).sort();
    const emailsData = labels.map(date => groupedData[date].emails || 0);
    const repliesData = labels.map(date => groupedData[date].replies || 0);
    const opensData = labels.map(date => groupedData[date].opens || 0);
    const bouncesData = labels.map(date => groupedData[date].bounces || 0);
    
    campaignsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Emails Sent',
                    data: emailsData,
                    borderColor: 'rgb(139, 92, 246)',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Replies',
                    data: repliesData,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Opens',
                    data: opensData,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Bounces',
                    data: bouncesData,
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e4e4e7'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    ticks: {
                        color: '#a1a1aa'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            }
        }
    });
}

// Group data by date
function groupDataByDate(data) {
    const grouped = {};
    
    data.forEach(row => {
        const date = row.date || row.created_at?.split('T')[0];
        if (!date) return;
        
        if (!grouped[date]) {
            grouped[date] = {
                emails: 0,
                replies: 0,
                opens: 0,
                bounces: 0
            };
        }
        
        grouped[date].emails += row.emails_sent || 0;
        grouped[date].replies += row.total_replies || row.unique_replies || 0;
        grouped[date].opens += row.unique_opens || row.opens || 0;
        grouped[date].bounces += row.bounces || row.bounced || 0;
    });
    
    return grouped;
}

// Export campaigns CSV
async function exportCampaignsCSV() {
    try {
        const client = getSupabaseClient();
        if (!client) return;
        
        let selectedClient = '';
        if (campaignsClientFilter) {
            selectedClient = campaignsClientFilter.value || '';
        }
        
        let selectedCampaign = '';
        if (campaignsCampaignFilter) {
            selectedCampaign = campaignsCampaignFilter.value || '';
        }
        
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (selectedCampaign) {
            query = query.eq('campaign_name', selectedCampaign);
        }
        
        if (campaignsDateStart) {
            query = query.gte('date', campaignsDateStart);
        }
        
        if (campaignsDateEnd) {
            query = query.lte('date', campaignsDateEnd);
        }
        
        const { data, error } = await query.order('date', { ascending: true });
        
        if (error) {
            console.error('❌ Error exporting CSV:', error);
            alert('Error exporting CSV: ' + error.message);
            return;
        }
        
        const metrics = calculateCampaignsMetrics(data || []);
        const meetings = await loadMeetingsBookedForCampaigns(campaignsDateStart, campaignsDateEnd, selectedClient, selectedCampaign);
        
        const csvRows = [];
        csvRows.push('Campaigns Report');
        csvRows.push(`Generated: ${new Date().toISOString()}`);
        csvRows.push('');
        csvRows.push('Metrics');
        csvRows.push(`Total Email Sent,${metrics.totalEmails}`);
        csvRows.push(`Unique Prospects,${metrics.uniqueProspects}`);
        csvRows.push(`Total Replies (incl. OOO),${metrics.totalReplies}`);
        csvRows.push(`Real Replies (excl. OOO),${metrics.realReplies}`);
        csvRows.push(`Positive Replies,${metrics.positiveReplies}`);
        csvRows.push(`Bounces,${metrics.bounces}`);
        csvRows.push(`Meetings Booked,${meetings}`);
        csvRows.push('');
        
        if (data && data.length > 0) {
            csvRows.push('Detailed Data');
            const columns = new Set();
            data.forEach(row => {
                Object.keys(row).forEach(key => columns.add(key));
            });
            const columnArray = Array.from(columns);
            
            csvRows.push(columnArray.join(','));
            
            data.forEach(row => {
                const values = columnArray.map(col => {
                    let value = row[col] || '';
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csvRows.push(values.join(','));
            });
        }
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `campaigns-report-${dateStr}.csv`;
        
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
    window.initCampaigns = initCampaigns;
    window.loadCampaignsData = loadCampaignsData;
    if (window.loadDashboard) {
        const originalLoadDashboard = window.loadDashboard;
        window.loadDashboard = function(dashboardName) {
            if (dashboardName === 'campaigns') {
                initCampaigns();
            } else {
                originalLoadDashboard(dashboardName);
            }
        };
    }
}
