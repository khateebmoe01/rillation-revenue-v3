// Campaigns Analytics Dashboard

let campaignsClientFilter = null;
let campaignsDateStart = null;
let campaignsDateEnd = null;
let campaignsData = null;

// Initialize Campaigns Analytics
function initCampaignsAnalytics() {
    console.log('🚀 Initializing Campaigns Analytics...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        setTimeout(initCampaignsAnalytics, 1000);
        return;
    }
    
    // Initialize date range (no default - load all data)
    const dateStartEl = document.getElementById('campaigns-date-start');
    const dateEndEl = document.getElementById('campaigns-date-end');
    
    if (dateStartEl && dateEndEl) {
        campaignsDateStart = null;
        campaignsDateEnd = null;
        
        dateStartEl.addEventListener('change', () => {
            campaignsDateStart = dateStartEl.value;
            loadCampaignsData();
        });
        
        dateEndEl.addEventListener('change', () => {
            campaignsDateEnd = dateEndEl.value;
            loadCampaignsData();
        });
        
        // Date validation
        dateStartEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value && dateStartEl.value > dateEndEl.value) {
                dateEndEl.value = dateStartEl.value;
                campaignsDateEnd = dateStartEl.value;
                loadCampaignsData();
            }
        });
        
        dateEndEl.addEventListener('blur', () => {
            if (dateStartEl.value && dateEndEl.value && dateEndEl.value < dateStartEl.value) {
                dateStartEl.value = dateEndEl.value;
                campaignsDateStart = dateEndEl.value;
                loadCampaignsData();
            }
        });
    }
    
    // Initialize client filter
    campaignsClientFilter = document.getElementById('campaigns-client-filter');
    if (campaignsClientFilter) {
        loadClientsForCampaignsFilter();
        campaignsClientFilter.addEventListener('change', () => {
            loadCampaignsData();
        });
    }
    
    // Clear Filters button
    const clearFiltersBtn = document.getElementById('campaigns-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            campaignsDateStart = null;
            campaignsDateEnd = null;
            if (campaignsClientFilter) campaignsClientFilter.value = '';
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
    
    // Load data
    setTimeout(() => {
        loadCampaignsData();
    }, 500);
}

// Load clients for filter dropdown
async function loadClientsForCampaignsFilter() {
    console.log('🔄 loadClientsForCampaignsFilter called');
    const client = getSupabaseClient();
    
    if (!client) {
        console.error('❌ Supabase client not initialized');
        return;
    }
    
    try {
        let { data, error } = await client
            .from('Clients')
            .select('Business');
        
        if (error) {
            const result = await client
                .from('clients')
                .select('Business');
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            // Fallback: get from campaign_reporting
            const { data: fallbackData, error: fallbackError } = await client
                .from('campaign_reporting')
                .select('client')
                .not('client', 'is', null);
            
            if (fallbackError) {
                console.error('❌ Error loading clients:', fallbackError);
                return;
            }
            
            const clients = [...new Set(fallbackData.map(c => c.client).filter(Boolean))];
            populateCampaignsClientFilter(clients);
            return;
        }
        
        if (!data || data.length === 0) {
            console.warn('⚠️ No data in Clients table');
            return;
        }
        
        const clients = data
            .map(row => row.Business || row.business || row.name || row.client_name || row.client || row.company_name)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort();
        
        populateCampaignsClientFilter(clients);
    } catch (err) {
        console.error('❌ Error loading clients:', err);
    }
}

// Populate client filter dropdown
function populateCampaignsClientFilter(clients) {
    if (!campaignsClientFilter) {
        console.error('❌ campaigns-client-filter element not found!');
        return;
    }
    
    campaignsClientFilter.innerHTML = '';
    
    const allClientsOption = document.createElement('option');
    allClientsOption.value = '';
    allClientsOption.textContent = 'All Clients';
    campaignsClientFilter.appendChild(allClientsOption);
    
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        campaignsClientFilter.appendChild(option);
    });
    
    console.log('✅ Client filter populated with', clients.length, 'clients');
}

// Load campaigns data
async function loadCampaignsData() {
    console.log('📊 Loading campaigns data...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        return;
    }
    
    try {
        // Get filter values
        const dateStartEl = document.getElementById('campaigns-date-start');
        const dateEndEl = document.getElementById('campaigns-date-end');
        const dateStart = dateStartEl ? dateStartEl.value : campaignsDateStart;
        const dateEnd = dateEndEl ? dateEndEl.value : campaignsDateEnd;
        const selectedClient = campaignsClientFilter ? campaignsClientFilter.value : '';
        
        // Update variables
        campaignsDateStart = dateStart || null;
        campaignsDateEnd = dateEnd || null;
        
        // Build query for campaign_reporting
        let query = client.from('campaign_reporting').select('*');
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        
        if (campaignsDateStart && campaignsDateEnd) {
            query = query.gte('date', campaignsDateStart);
            query = query.lte('date', campaignsDateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('❌ Error loading campaign_reporting:', error);
            return;
        }
        
        console.log('✅ Campaign reporting data loaded:', data?.length || 0, 'rows');
        
        // Aggregate by campaign_name
        const campaignMap = {};
        
        (data || []).forEach(row => {
            const campaignName = row.campaign_name || row.campaign || 'Unknown';
            
            if (!campaignMap[campaignName]) {
                campaignMap[campaignName] = {
                    name: campaignName,
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
        
        // Get campaign names for replies query
        const campaignNames = Object.keys(campaignMap);
        
        // Load replies for each campaign
        // Note: replies table uses campaign_id, but we need to map campaign_name to campaign_id
        // For now, we'll query all replies and filter by client if needed
        let repliesQuery = client.from('replies').select('campaign_id, category, client');
        
        if (selectedClient) {
            repliesQuery = repliesQuery.eq('client', selectedClient);
        }
        
        if (campaignsDateStart && campaignsDateEnd) {
            repliesQuery = repliesQuery.gte('date_received', campaignsDateStart)
                                   .lte('date_received', campaignsDateEnd);
        }
        
        const { data: repliesData, error: repliesError } = await repliesQuery;
        
        if (repliesError) {
            console.error('❌ Error loading replies:', repliesError);
        } else {
            console.log('✅ Replies data loaded:', repliesData?.length || 0, 'rows');
            
            // Group replies by campaign_id
            // Since we don't have direct mapping, we'll need to get campaign_id from campaigns table
            // For now, we'll aggregate by client and approximate
            // TODO: Improve this with proper campaign_id mapping
            
            // Count total and real replies (excluding OOO)
            const repliesByClient = {};
            (repliesData || []).forEach(reply => {
                const replyClient = reply.client || 'Unknown';
                if (!repliesByClient[replyClient]) {
                    repliesByClient[replyClient] = {
                        total: 0,
                        real: 0
                    };
                }
                repliesByClient[replyClient].total += 1;
                if (reply.category !== 'Out Of Office') {
                    repliesByClient[replyClient].real += 1;
                }
            });
            
            // For now, distribute replies evenly across campaigns for the same client
            // This is a simplification - ideally we'd have campaign_id in replies
            Object.values(campaignMap).forEach(campaign => {
                const clientReplies = repliesByClient[campaign.client] || { total: 0, real: 0 };
                // Rough approximation: divide by number of campaigns for that client
                const campaignsForClient = Object.values(campaignMap).filter(c => c.client === campaign.client).length;
                campaign.totalReplies = campaignsForClient > 0 ? Math.round(clientReplies.total / campaignsForClient) : 0;
                campaign.realReplies = campaignsForClient > 0 ? Math.round(clientReplies.real / campaignsForClient) : 0;
            });
        }
        
        // Load meetings
        let meetingsQuery = client.from('meetings_booked').select('client');
        
        if (selectedClient) {
            meetingsQuery = meetingsQuery.eq('client', selectedClient);
        }
        
        if (campaignsDateStart && campaignsDateEnd) {
            meetingsQuery = meetingsQuery.gte('created_time', campaignsDateStart)
                                        .lte('created_time', campaignsDateEnd);
        }
        
        const { data: meetingsData, error: meetingsError } = await meetingsQuery;
        
        if (meetingsError) {
            console.error('❌ Error loading meetings:', meetingsError);
        } else {
            console.log('✅ Meetings data loaded:', meetingsData?.length || 0, 'rows');
            
            // Group meetings by client (similar approximation as replies)
            const meetingsByClient = {};
            (meetingsData || []).forEach(meeting => {
                const meetingClient = meeting.client || 'Unknown';
                meetingsByClient[meetingClient] = (meetingsByClient[meetingClient] || 0) + 1;
            });
            
            Object.values(campaignMap).forEach(campaign => {
                const clientMeetings = meetingsByClient[campaign.client] || 0;
                const campaignsForClient = Object.values(campaignMap).filter(c => c.client === campaign.client).length;
                campaign.meetings = campaignsForClient > 0 ? Math.round(clientMeetings / campaignsForClient) : 0;
            });
        }
        
        // Store data
        campaignsData = Object.values(campaignMap);
        
        // Render table
        renderCampaignsTable(campaignsData);
        
    } catch (err) {
        console.error('❌ Error in loadCampaignsData:', err);
    }
}

// Render campaigns table
function renderCampaignsTable(campaigns) {
    const tbody = document.getElementById('campaigns-table-body');
    if (!tbody) {
        console.error('❌ campaigns-table-body not found');
        return;
    }
    
    if (!campaigns || campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="empty-state">No campaign data available</td></tr>';
        return;
    }
    
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    
    tbody.innerHTML = campaigns.map(campaign => {
        // Calculate percentages
        const repliesPercentage = campaign.uniqueProspects > 0
            ? ((campaign.totalReplies / campaign.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        const positivePercentage = campaign.realReplies > 0
            ? ((campaign.positiveReplies / campaign.realReplies) * 100).toFixed(1) + '%'
            : '0.0%';
        const bouncesPercentage = campaign.emailsSent > 0
            ? ((campaign.bounces / campaign.emailsSent) * 100).toFixed(1) + '%'
            : '0.0%';
        
        return `
            <tr>
                <td>
                    <a href="#" class="campaign-link" data-campaign="${encodeURIComponent(campaign.name)}" data-client="${encodeURIComponent(campaign.client)}">
                        ${escapeHtml(campaign.name)}
                    </a>
                </td>
                <td>${formatNum(campaign.emailsSent)}</td>
                <td>${formatNum(campaign.uniqueProspects)}</td>
                <td>${formatNum(campaign.totalReplies || 0)}</td>
                <td>${formatNum(campaign.realReplies || 0)}</td>
                <td>${repliesPercentage}</td>
                <td>${formatNum(campaign.positiveReplies)}</td>
                <td>${positivePercentage}</td>
                <td>${formatNum(campaign.bounces)}</td>
                <td>${bouncesPercentage}</td>
                <td>${formatNum(campaign.meetings || 0)}</td>
            </tr>
        `;
    }).join('');
    
    // Add click handlers for campaign links
    tbody.querySelectorAll('.campaign-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const campaignName = decodeURIComponent(link.getAttribute('data-campaign'));
            const campaignClient = decodeURIComponent(link.getAttribute('data-client'));
            openCampaignDetailModal(campaignName, campaignClient);
        });
    });
}

// Open campaign detail modal
async function openCampaignDetailModal(campaignName, campaignClient) {
    console.log('📊 Opening campaign detail modal for:', campaignName);
    
    const modal = document.getElementById('campaign-detail-modal');
    const titleEl = document.getElementById('campaign-detail-title');
    const bodyEl = document.getElementById('campaign-detail-body');
    
    if (!modal || !titleEl || !bodyEl) {
        console.error('❌ Campaign detail modal elements not found');
        return;
    }
    
    titleEl.textContent = campaignName;
    
    // Show loading state
    bodyEl.innerHTML = '<div class="loading">Loading campaign details...</div>';
    modal.classList.add('active');
    
    const client = getSupabaseClient();
    if (!client) {
        bodyEl.innerHTML = '<div class="error">Unable to load campaign details: Database connection not available</div>';
        return;
    }
    
    try {
        // Get date filters
        const dateStartEl = document.getElementById('campaigns-date-start');
        const dateEndEl = document.getElementById('campaigns-date-end');
        const dateStart = dateStartEl ? dateStartEl.value : null;
        const dateEnd = dateEndEl ? dateEndEl.value : null;
        
        // Load campaign data
        let query = client.from('campaign_reporting')
            .select('*')
            .eq('campaign_name', campaignName);
        
        if (campaignClient) {
            query = query.eq('client', campaignClient);
        }
        
        if (dateStart && dateEnd) {
            query = query.gte('date', dateStart).lte('date', dateEnd);
        }
        
        const { data: campaignData, error: campaignError } = await query;
        
        if (campaignError) {
            throw campaignError;
        }
        
        // Aggregate metrics
        const metrics = {
            emailsSent: 0,
            uniqueProspects: 0,
            positiveReplies: 0,
            bounces: 0
        };
        
        (campaignData || []).forEach(row => {
            metrics.emailsSent += parseFloat(row.emails_sent) || 0;
            metrics.uniqueProspects += parseFloat(row.total_leads_contacted) || 0;
            metrics.positiveReplies += parseFloat(row.interested) || 0;
            metrics.bounces += parseFloat(row.bounced) || 0;
        });
        
        // Load replies
        let repliesQuery = client.from('replies').select('category, date_received');
        
        if (campaignClient) {
            repliesQuery = repliesQuery.eq('client', campaignClient);
        }
        
        if (dateStart && dateEnd) {
            repliesQuery = repliesQuery.gte('date_received', dateStart)
                                   .lte('date_received', dateEnd);
        }
        
        const { data: repliesData } = await repliesQuery;
        
        const totalReplies = repliesData ? repliesData.length : 0;
        const realReplies = repliesData ? repliesData.filter(r => r.category !== 'Out Of Office').length : 0;
        
        // Load meetings
        let meetingsQuery = client.from('meetings_booked').select('*');
        
        if (campaignClient) {
            meetingsQuery = meetingsQuery.eq('client', campaignClient);
        }
        
        if (dateStart && dateEnd) {
            meetingsQuery = meetingsQuery.gte('created_time', dateStart)
                                        .lte('created_time', dateEnd);
        }
        
        const { data: meetingsData } = await meetingsQuery;
        const meetingsCount = meetingsData ? meetingsData.length : 0;
        
        // Calculate percentages
        const repliesPercentage = metrics.uniqueProspects > 0
            ? ((totalReplies / metrics.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        const positivePercentage = realReplies > 0
            ? ((metrics.positiveReplies / realReplies) * 100).toFixed(1) + '%'
            : '0.0%';
        const bouncesPercentage = metrics.emailsSent > 0
            ? ((metrics.bounces / metrics.emailsSent) * 100).toFixed(1) + '%'
            : '0.0%';
        const meetingsPercentage = realReplies > 0
            ? ((meetingsCount / realReplies) * 100).toFixed(0) + '%'
            : '0.0%';
        
        const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
        
        // Build modal content
        bodyEl.innerHTML = `
            <div class="performance-metrics-grid" style="margin-bottom: 24px;">
                <div class="performance-metric-card">
                    <div class="metric-icon">📧</div>
                    <div class="metric-content">
                        <div class="metric-label">Total Email Sent</div>
                        <div class="metric-value">${formatNum(metrics.emailsSent)}</div>
                    </div>
                </div>
                <div class="performance-metric-card">
                    <div class="metric-icon">👥</div>
                    <div class="metric-content">
                        <div class="metric-label">Unique Prospects</div>
                        <div class="metric-value">${formatNum(metrics.uniqueProspects)}</div>
                    </div>
                </div>
                <div class="performance-metric-card">
                    <div class="metric-icon">💬</div>
                    <div class="metric-content">
                        <div class="metric-label">Total Replies</div>
                        <div class="metric-value">${formatNum(totalReplies)}</div>
                        <div class="metric-percentage">${repliesPercentage}</div>
                    </div>
                </div>
                <div class="performance-metric-card">
                    <div class="metric-icon">✅</div>
                    <div class="metric-content">
                        <div class="metric-label">Positive Replies</div>
                        <div class="metric-value">${formatNum(metrics.positiveReplies)}</div>
                        <div class="metric-percentage">${positivePercentage}</div>
                    </div>
                </div>
                <div class="performance-metric-card">
                    <div class="metric-icon">↩️</div>
                    <div class="metric-content">
                        <div class="metric-label">Bounces</div>
                        <div class="metric-value">${formatNum(metrics.bounces)}</div>
                        <div class="metric-percentage">${bouncesPercentage}</div>
                    </div>
                </div>
                <div class="performance-metric-card">
                    <div class="metric-icon">📅</div>
                    <div class="metric-content">
                        <div class="metric-label">Meetings Booked</div>
                        <div class="metric-value">${formatNum(meetingsCount)}</div>
                        <div class="metric-percentage">${meetingsPercentage}</div>
                    </div>
                </div>
            </div>
            
            <div class="section">
                <h3>Reply Breakdown by Category</h3>
                <div id="campaign-replies-breakdown">
                    ${generateRepliesBreakdown(repliesData || [])}
                </div>
            </div>
        `;
        
    } catch (err) {
        console.error('❌ Error loading campaign details:', err);
        bodyEl.innerHTML = `<div class="error">Error loading campaign details: ${err.message}</div>`;
    }
}

// Generate replies breakdown HTML
function generateRepliesBreakdown(replies) {
    const categoryCounts = {};
    
    replies.forEach(reply => {
        const category = reply.category || 'Unknown';
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    if (Object.keys(categoryCounts).length === 0) {
        return '<p style="color: var(--color-text-muted);">No replies data available</p>';
    }
    
    const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
    const total = replies.length;
    
    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Count</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => {
                        const percentage = total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0.0%';
                        return `
                            <tr>
                                <td>${escapeHtml(category)}</td>
                                <td>${formatNum(count)}</td>
                                <td>${percentage}</td>
                            </tr>
                        `;
                    }).join('')}
            </tbody>
        </table>
    `;
}

// Export campaigns to CSV
async function exportCampaignsCSV() {
    console.log('📥 Exporting campaigns to CSV...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        alert('Unable to export: Database connection not available');
        return;
    }
    
    if (!campaignsData || campaignsData.length === 0) {
        alert('No campaign data to export');
        return;
    }
    
    try {
        const formatNum = (typeof formatNumber === 'function') ? formatNumber : (n) => n.toLocaleString();
        
        const csvRows = [];
        csvRows.push('Campaign Analytics Report');
        csvRows.push(`Date Range: ${campaignsDateStart || 'All'} to ${campaignsDateEnd || 'All'}`);
        csvRows.push(`Client: ${campaignsClientFilter ? (campaignsClientFilter.value || 'All Clients') : 'All Clients'}`);
        csvRows.push('');
        csvRows.push('Campaign,Client,Emails Sent,Unique Prospects,Total Replies,Real Replies,Replies %,Positive Replies,Positive %,Bounces,Bounces %,Meetings');
        
        campaignsData.forEach(campaign => {
            const repliesPercentage = campaign.uniqueProspects > 0
                ? ((campaign.totalReplies / campaign.uniqueProspects) * 100).toFixed(1) + '%'
                : '0.0%';
            const positivePercentage = campaign.realReplies > 0
                ? ((campaign.positiveReplies / campaign.realReplies) * 100).toFixed(1) + '%'
                : '0.0%';
            const bouncesPercentage = campaign.emailsSent > 0
                ? ((campaign.bounces / campaign.emailsSent) * 100).toFixed(1) + '%'
                : '0.0%';
            
            const row = [
                `"${campaign.name}"`,
                `"${campaign.client}"`,
                campaign.emailsSent,
                campaign.uniqueProspects,
                campaign.totalReplies || 0,
                campaign.realReplies || 0,
                repliesPercentage,
                campaign.positiveReplies,
                positivePercentage,
                campaign.bounces,
                bouncesPercentage,
                campaign.meetings || 0
            ];
            csvRows.push(row.join(','));
        });
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `campaigns-analytics-${dateStr}.csv`;
        
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
    window.initCampaignsAnalytics = initCampaignsAnalytics;
    window.loadCampaignsData = loadCampaignsData;
    window.loadDashboard = function(dashboardName) {
        if (dashboardName === 'campaigns') {
            initCampaignsAnalytics();
        } else if (dashboardName === 'performance-overview') {
            if (window.initPerformanceOverview) window.initPerformanceOverview();
        } else if (dashboardName === 'gtm-scoreboard') {
            if (window.initGTMScoreboard) window.initGTMScoreboard();
        } else if (dashboardName === 'pipeline') {
            if (window.loadPipelineDashboard) window.loadPipelineDashboard();
        }
    };
}

