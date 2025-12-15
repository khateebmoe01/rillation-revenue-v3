// Deep View Dashboard - Comprehensive GTM Analytics

let deepViewData = {
    dateStart: null,
    dateEnd: null,
    selectedClient: '',
    selectedCampaign: ''
};

// Initialize Deep View
function initDeepView() {
    console.log('🚀 Initializing Deep View...');
    
    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Supabase client not available');
        setTimeout(initDeepView, 1000);
        return;
    }
    
    // Initialize filters
    const dateStartEl = document.getElementById('dv-date-start');
    const dateEndEl = document.getElementById('dv-date-end');
    const clientFilter = document.getElementById('dv-client-filter');
    const campaignFilter = document.getElementById('dv-campaign-filter');
    
    if (dateStartEl && dateEndEl) {
        dateStartEl.addEventListener('change', () => {
            deepViewData.dateStart = dateStartEl.value;
            loadDeepViewData();
        });
        
        dateEndEl.addEventListener('change', () => {
            deepViewData.dateEnd = dateEndEl.value;
            loadDeepViewData();
        });
    }
    
    if (clientFilter) {
        loadClientsForDeepViewFilter();
        clientFilter.addEventListener('change', () => {
            deepViewData.selectedClient = clientFilter.value || '';
            loadDeepViewData();
        });
    }
    
    if (campaignFilter) {
        loadCampaignsForDeepViewFilter();
        campaignFilter.addEventListener('change', () => {
            deepViewData.selectedCampaign = campaignFilter.value || '';
            loadDeepViewData();
        });
    }
    
    // Load data
    setTimeout(() => {
        loadDeepViewData();
    }, 500);
}

// Load clients for Deep View filter
async function loadClientsForDeepViewFilter() {
    const client = getSupabaseClient();
    if (!client) return;
    
    const clientFilter = document.getElementById('dv-client-filter');
    if (!clientFilter) return;
    
    try {
        let { data, error } = await client.from('Clients').select('Business');
        
        if (error) {
            const { data: fallbackData } = await client
                .from('campaign_reporting')
                .select('client')
                .not('client', 'is', null);
            
            if (fallbackData) {
                const clients = [...new Set(fallbackData.map(c => c.client).filter(Boolean))].sort();
                populateDeepViewClientFilter(clients);
                return;
            }
        }
        
        if (data && data.length > 0) {
            const clients = data
                .map(row => row.Business || row.business)
                .filter(Boolean)
                .filter((value, index, self) => self.indexOf(value) === index)
                .sort();
            populateDeepViewClientFilter(clients);
        }
    } catch (err) {
        console.error('❌ Error loading clients:', err);
    }
}

function populateDeepViewClientFilter(clients) {
    const clientFilter = document.getElementById('dv-client-filter');
    if (!clientFilter) return;
    
    clientFilter.innerHTML = '<option value="">All Clients</option>';
    clients.forEach(client => {
        const option = document.createElement('option');
        option.value = client;
        option.textContent = client;
        clientFilter.appendChild(option);
    });
}

// Load campaigns for Deep View filter
async function loadCampaignsForDeepViewFilter() {
    const client = getSupabaseClient();
    if (!client) return;
    
    const campaignFilter = document.getElementById('dv-campaign-filter');
    if (!campaignFilter) return;
    
    try {
        let { data, error } = await client.from('Campaigns').select('campaign_name').order('campaign_name', { ascending: true });
        
        if (error || !data || data.length === 0) {
            const { data: reportingData } = await client
                .from('campaign_reporting')
                .select('campaign_name')
                .not('campaign_name', 'is', null);
            
            if (reportingData) {
                const uniqueCampaigns = [...new Set(reportingData.map(r => r.campaign_name).filter(Boolean))].sort();
                data = uniqueCampaigns.map(name => ({ campaign_name: name }));
            }
        }
        
        campaignFilter.innerHTML = '<option value="">All Campaigns</option>';
        if (data) {
            data.forEach(campaign => {
                const campaignName = campaign.campaign_name || campaign;
                const option = document.createElement('option');
                option.value = campaignName;
                option.textContent = campaignName;
                campaignFilter.appendChild(option);
            });
        }
    } catch (err) {
        console.error('❌ Error loading campaigns:', err);
    }
}

// Load all Deep View data
async function loadDeepViewData() {
    console.log('📊 Loading Deep View data...');
    
    // Load all sections in parallel
    await Promise.all([
        loadCampaignAnalytics(),
        loadEngagedLeadsAnalysis(),
        loadMeetingsDeepDive(),
        loadRepliesDeepAnalysis(),
        loadFlowAnalysis()
    ]);
}

// Load Campaign Analytics
async function loadCampaignAnalytics() {
    console.log('📊 Loading Campaign Analytics...');
    const container = document.getElementById('dv-campaign-analytics');
    if (!container) return;
    
    const client = getSupabaseClient();
    if (!client) {
        container.innerHTML = '<div class="error">Database connection not available</div>';
        return;
    }
    
    try {
        // Build query
        let query = client.from('campaign_reporting').select('*');
        
        if (deepViewData.selectedClient) {
            query = query.eq('client', deepViewData.selectedClient);
        }
        
        if (deepViewData.selectedCampaign) {
            query = query.eq('campaign_name', deepViewData.selectedCampaign);
        }
        
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            query = query.gte('date', deepViewData.dateStart).lte('date', deepViewData.dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        // Aggregate by campaign
        const campaignMap = {};
        (data || []).forEach(row => {
            const campaignName = row.campaign_name || 'Unknown';
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
        
        // Load replies and meetings
        const campaigns = await enrichCampaignData(Object.values(campaignMap));
        
        // Sort by emails sent descending
        campaigns.sort((a, b) => b.emailsSent - a.emailsSent);
        
        // Render
        renderCampaignAnalytics(campaigns, container);
        
    } catch (err) {
        console.error('❌ Error loading campaign analytics:', err);
        container.innerHTML = `<div class="error">Error loading campaign analytics: ${err.message}</div>`;
    }
}

// Enrich campaign data with replies and meetings
async function enrichCampaignData(campaigns) {
    const client = getSupabaseClient();
    if (!client) return campaigns;
    
    // Load replies
    let repliesQuery = client.from('replies').select('campaign_id, category, client');
    if (deepViewData.selectedClient) {
        repliesQuery = repliesQuery.eq('client', deepViewData.selectedClient);
    }
    if (deepViewData.dateStart && deepViewData.dateEnd) {
        repliesQuery = repliesQuery.gte('date_received', deepViewData.dateStart)
                                   .lte('date_received', deepViewData.dateEnd);
    }
    
    const { data: repliesData } = await repliesQuery;
    
    // Load meetings
    let meetingsQuery = client.from('meetings_booked').select('client, campaign_name');
    if (deepViewData.selectedClient) {
        meetingsQuery = meetingsQuery.eq('client', deepViewData.selectedClient);
    }
    if (deepViewData.dateStart && deepViewData.dateEnd) {
        meetingsQuery = meetingsQuery.gte('created_time', deepViewData.dateStart)
                                     .lte('created_time', deepViewData.dateEnd);
    }
    
    const { data: meetingsData } = await meetingsQuery;
    
    // Group replies and meetings by client (approximate distribution)
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
    
    const meetingsByClient = {};
    (meetingsData || []).forEach(meeting => {
        const meetingClient = meeting.client || 'Unknown';
        meetingsByClient[meetingClient] = (meetingsByClient[meetingClient] || 0) + 1;
    });
    
    // Distribute across campaigns
    campaigns.forEach(campaign => {
        const clientReplies = repliesByClient[campaign.client] || { total: 0, real: 0 };
        const clientMeetings = meetingsByClient[campaign.client] || 0;
        const campaignsForClient = campaigns.filter(c => c.client === campaign.client).length;
        
        campaign.totalReplies = campaignsForClient > 0 ? Math.round(clientReplies.total / campaignsForClient) : 0;
        campaign.realReplies = campaignsForClient > 0 ? Math.round(clientReplies.real / campaignsForClient) : 0;
        campaign.meetings = campaignsForClient > 0 ? Math.round(clientMeetings / campaignsForClient) : 0;
    });
    
    return campaigns;
}

// Render Campaign Analytics
function renderCampaignAnalytics(campaigns, container) {
    if (!campaigns || campaigns.length === 0) {
        container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No campaign data available</p>';
        return;
    }
    
    const formatNum = formatNumber;
    
    // Calculate percentages
    campaigns.forEach(campaign => {
        campaign.repliesPercentage = campaign.uniqueProspects > 0
            ? ((campaign.totalReplies / campaign.uniqueProspects) * 100).toFixed(1) + '%'
            : '0.0%';
        campaign.positivePercentage = campaign.realReplies > 0
            ? ((campaign.positiveReplies / campaign.realReplies) * 100).toFixed(1) + '%'
            : '0.0%';
        campaign.bouncesPercentage = campaign.emailsSent > 0
            ? ((campaign.bounces / campaign.emailsSent) * 100).toFixed(1) + '%'
            : '0.0%';
    });
    
    const tableHTML = `
        <table class="data-table" style="width: 100%; margin-bottom: 24px;">
            <thead>
                <tr>
                    <th>Campaign Name</th>
                    <th>Client</th>
                    <th style="text-align: right;">Emails Sent</th>
                    <th style="text-align: right;">Unique Prospects</th>
                    <th style="text-align: right;">Total Replies</th>
                    <th style="text-align: right;">Real Replies</th>
                    <th style="text-align: right;">Reply Rate</th>
                    <th style="text-align: right;">Positive Replies</th>
                    <th style="text-align: right;">Positive %</th>
                    <th style="text-align: right;">Bounces</th>
                    <th style="text-align: right;">Bounce %</th>
                    <th style="text-align: right;">Meetings</th>
                </tr>
            </thead>
            <tbody>
                ${campaigns.map(campaign => `
                    <tr>
                        <td><strong>${escapeHtml(campaign.name)}</strong></td>
                        <td>${escapeHtml(campaign.client)}</td>
                        <td style="text-align: right;">${formatNum(campaign.emailsSent)}</td>
                        <td style="text-align: right;">${formatNum(campaign.uniqueProspects)}</td>
                        <td style="text-align: right;">${formatNum(campaign.totalReplies || 0)}</td>
                        <td style="text-align: right;">${formatNum(campaign.realReplies || 0)}</td>
                        <td style="text-align: right;">${campaign.repliesPercentage}</td>
                        <td style="text-align: right;">${formatNum(campaign.positiveReplies)}</td>
                        <td style="text-align: right;">${campaign.positivePercentage}</td>
                        <td style="text-align: right;">${formatNum(campaign.bounces)}</td>
                        <td style="text-align: right;">${campaign.bouncesPercentage}</td>
                        <td style="text-align: right;">${formatNum(campaign.meetings || 0)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Top/Bottom performers
    const topCampaign = campaigns[0];
    const bottomCampaign = campaigns[campaigns.length - 1];
    
    const performersHTML = `
        <div class="grid-2" style="margin-top: 24px;">
            <div class="outlier-card">
                <div class="outlier-title">Top Performing Campaign</div>
                <div class="outlier-value">${escapeHtml(topCampaign.name)}</div>
                <div style="margin-top: 8px; font-size: 0.9rem; color: var(--color-text-muted);">
                    ${formatNum(topCampaign.emailsSent)} emails, ${formatNum(topCampaign.realReplies || 0)} replies
                </div>
            </div>
            <div class="outlier-card warning">
                <div class="outlier-title">Lowest Performing Campaign</div>
                <div class="outlier-value">${escapeHtml(bottomCampaign.name)}</div>
                <div style="margin-top: 8px; font-size: 0.9rem; color: var(--color-text-muted);">
                    ${formatNum(bottomCampaign.emailsSent)} emails, ${formatNum(bottomCampaign.realReplies || 0)} replies
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = tableHTML + performersHTML;
}

// Load Engaged Leads Analysis
async function loadEngagedLeadsAnalysis() {
    console.log('📊 Loading Engaged Leads Analysis...');
    const container = document.getElementById('dv-leads-analysis');
    if (!container) return;
    
    const client = getSupabaseClient();
    if (!client) {
        container.innerHTML = '<div class="error">Database connection not available</div>';
        return;
    }
    
    try {
        // Load campaign reporting data for engagement metrics
        let query = client.from('campaign_reporting').select('*');
        
        if (deepViewData.selectedClient) {
            query = query.eq('client', deepViewData.selectedClient);
        }
        
        if (deepViewData.selectedCampaign) {
            query = query.eq('campaign_name', deepViewData.selectedCampaign);
        }
        
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            query = query.gte('date', deepViewData.dateStart).lte('date', deepViewData.dateEnd);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Calculate engagement metrics
        let totalLeads = 0;
        let totalOpens = 0;
        let totalReplies = 0;
        
        (data || []).forEach(row => {
            totalLeads += parseFloat(row.total_leads_contacted) || 0;
            totalOpens += parseFloat(row.opened) || 0;
            totalReplies += parseFloat(row.unique_replies_per_contact) || 0;
        });
        
        const openRate = totalLeads > 0 ? ((totalOpens / totalLeads) * 100).toFixed(1) : '0.0';
        const replyRate = totalLeads > 0 ? ((totalReplies / totalLeads) * 100).toFixed(1) : '0.0';
        const engagementRate = totalLeads > 0 ? (((totalOpens + totalReplies) / totalLeads) * 100).toFixed(1) : '0.0';
        
        const metricsHTML = `
            <div class="grid-3" style="margin-bottom: 24px;">
                <div class="metric-card">
                    <div class="metric-label">Total Leads Contacted</div>
                    <div class="metric-value">${formatNumber(totalLeads)}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Opens</div>
                    <div class="metric-value">${formatNumber(totalOpens)}</div>
                    <div class="metric-percentage">${openRate}% Open Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Total Replies</div>
                    <div class="metric-value">${formatNumber(totalReplies)}</div>
                    <div class="metric-percentage">${replyRate}% Reply Rate</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Overall Engagement Rate</div>
                    <div class="metric-value">${engagementRate}%</div>
                    <div class="metric-percentage">Opens + Replies</div>
                </div>
            </div>
            <p style="color: var(--color-text-muted); font-size: 0.9rem;">
                Engagement metrics show how leads interact with your campaigns. Higher engagement rates indicate better campaign performance.
            </p>
        `;
        
        container.innerHTML = metricsHTML;
        
    } catch (err) {
        console.error('❌ Error loading leads analysis:', err);
        container.innerHTML = `<div class="error">Error loading leads analysis: ${err.message}</div>`;
    }
}

// Load Meetings Deep Dive
async function loadMeetingsDeepDive() {
    console.log('📊 Loading Meetings Deep Dive...');
    const container = document.getElementById('dv-meetings-deepdive');
    if (!container) return;
    
    const client = getSupabaseClient();
    if (!client) {
        container.innerHTML = '<div class="error">Database connection not available</div>';
        return;
    }
    
    try {
        // Load meetings
        let query = client.from('meetings_booked').select('*');
        
        if (deepViewData.selectedClient) {
            query = query.eq('client', deepViewData.selectedClient);
        }
        
        if (deepViewData.selectedCampaign) {
            query = query.eq('campaign_name', deepViewData.selectedCampaign);
        }
        
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            query = query.gte('created_time', deepViewData.dateStart)
                         .lte('created_time', deepViewData.dateEnd);
        }
        
        const { data, error } = await query.order('created_time', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No meetings found for the selected filters.</p>';
            return;
        }
        
        // Group by campaign
        const meetingsByCampaign = {};
        data.forEach(meeting => {
            const campaignName = meeting.campaign_name || 'Unknown';
            if (!meetingsByCampaign[campaignName]) {
                meetingsByCampaign[campaignName] = [];
            }
            meetingsByCampaign[campaignName].push(meeting);
        });
        
        // Render meetings table
        const tableHTML = `
            <div style="margin-bottom: 24px;">
                <h3>Meetings by Campaign</h3>
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th>Campaign</th>
                            <th style="text-align: right;">Count</th>
                            <th style="text-align: right;">% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(meetingsByCampaign)
                            .sort((a, b) => b[1].length - a[1].length)
                            .map(([campaign, meetings]) => {
                                const percentage = ((meetings.length / data.length) * 100).toFixed(1);
                                return `
                                    <tr>
                                        <td><strong>${escapeHtml(campaign)}</strong></td>
                                        <td style="text-align: right;">${formatNumber(meetings.length)}</td>
                                        <td style="text-align: right;">${percentage}%</td>
                                    </tr>
                                `;
                            }).join('')}
                    </tbody>
                </table>
            </div>
            <div>
                <h3>All Meetings Details</h3>
                <div style="max-height: 400px; overflow-y: auto;">
                    <table class="data-table" style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Company</th>
                                <th>Email</th>
                                <th>Campaign</th>
                                <th>Client</th>
                                <th>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.slice(0, 100).map(meeting => `
                                <tr>
                                    <td>${escapeHtml((meeting.full_name || meeting.first_name + ' ' + meeting.last_name || 'N/A').trim())}</td>
                                    <td>${escapeHtml(meeting.company || 'N/A')}</td>
                                    <td>${escapeHtml(meeting.email || 'N/A')}</td>
                                    <td>${escapeHtml(meeting.campaign_name || 'N/A')}</td>
                                    <td>${escapeHtml(meeting.client || 'N/A')}</td>
                                    <td>${meeting.created_time ? (parseLocalDate(meeting.created_time)?.toLocaleDateString() || 'N/A') : 'N/A'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${data.length > 100 ? `<p style="color: var(--color-text-muted); margin-top: 12px;">Showing first 100 of ${formatNumber(data.length)} meetings</p>` : ''}
            </div>
        `;
        
        container.innerHTML = tableHTML;
        
    } catch (err) {
        console.error('❌ Error loading meetings deep dive:', err);
        container.innerHTML = `<div class="error">Error loading meetings: ${err.message}</div>`;
    }
}

// Load Replies Deep Analysis
async function loadRepliesDeepAnalysis() {
    console.log('📊 Loading Replies Deep Analysis...');
    const container = document.getElementById('dv-replies-analysis');
    if (!container) return;
    
    const client = getSupabaseClient();
    if (!client) {
        container.innerHTML = '<div class="error">Database connection not available</div>';
        return;
    }
    
    try {
        // Load replies
        let query = client.from('replies').select('*');
        
        if (deepViewData.selectedClient) {
            query = query.eq('client', deepViewData.selectedClient);
        }
        
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            query = query.gte('date_received', deepViewData.dateStart)
                         .lte('date_received', deepViewData.dateEnd);
        }
        
        const { data, error } = await query.order('date_received', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 20px;">No replies found for the selected filters.</p>';
            return;
        }
        
        // Group by category
        const repliesByCategory = {};
        data.forEach(reply => {
            const category = reply.category || 'Unknown';
            if (!repliesByCategory[category]) {
                repliesByCategory[category] = [];
            }
            repliesByCategory[category].push(reply);
        });
        
        // Calculate percentages
        const totalReplies = data.length;
        const realReplies = data.filter(r => r.category !== 'Out Of Office').length;
        
        const categoryBreakdown = Object.entries(repliesByCategory)
            .map(([category, replies]) => ({
                category,
                count: replies.length,
                percentage: ((replies.length / totalReplies) * 100).toFixed(1)
            }))
            .sort((a, b) => b.count - a.count);
        
        const breakdownHTML = `
            <div style="margin-bottom: 24px;">
                <h3>Reply Category Breakdown</h3>
                <div class="grid-2">
                    ${categoryBreakdown.map(({ category, count, percentage }) => `
                        <div class="metric-card">
                            <div class="metric-label">${escapeHtml(category)}</div>
                            <div class="metric-value">${formatNumber(count)}</div>
                            <div class="metric-percentage">${percentage}% of total</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div>
                <h3>Summary</h3>
                <div class="grid-3">
                    <div class="metric-card">
                        <div class="metric-label">Total Replies</div>
                        <div class="metric-value">${formatNumber(totalReplies)}</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Real Replies (excl. OOO)</div>
                        <div class="metric-value">${formatNumber(realReplies)}</div>
                        <div class="metric-percentage">${((realReplies / totalReplies) * 100).toFixed(1)}%</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-label">Interested Replies</div>
                        <div class="metric-value">${formatNumber(repliesByCategory['Interested']?.length || 0)}</div>
                        <div class="metric-percentage">${repliesByCategory['Interested'] ? ((repliesByCategory['Interested'].length / totalReplies) * 100).toFixed(1) + '%' : '0.0%'}</div>
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML = breakdownHTML;
        
    } catch (err) {
        console.error('❌ Error loading replies analysis:', err);
        container.innerHTML = `<div class="error">Error loading replies: ${err.message}</div>`;
    }
}

// Load Flow Analysis
async function loadFlowAnalysis() {
    console.log('📊 Loading Flow Analysis...');
    const container = document.getElementById('dv-flow-analysis');
    if (!container) return;
    
    const client = getSupabaseClient();
    if (!client) {
        container.innerHTML = '<div class="error">Database connection not available</div>';
        return;
    }
    
    try {
        // Load all data for flow analysis
        let campaignQuery = client.from('campaign_reporting').select('*');
        if (deepViewData.selectedClient) {
            campaignQuery = campaignQuery.eq('client', deepViewData.selectedClient);
        }
        if (deepViewData.selectedCampaign) {
            campaignQuery = campaignQuery.eq('campaign_name', deepViewData.selectedCampaign);
        }
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            campaignQuery = campaignQuery.gte('date', deepViewData.dateStart)
                                         .lte('date', deepViewData.dateEnd);
        }
        
        const { data: campaignData } = await campaignQuery;
        
        // Load replies
        let repliesQuery = client.from('replies').select('*');
        if (deepViewData.selectedClient) {
            repliesQuery = repliesQuery.eq('client', deepViewData.selectedClient);
        }
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            repliesQuery = repliesQuery.gte('date_received', deepViewData.dateStart)
                                       .lte('date_received', deepViewData.dateEnd);
        }
        
        const { data: repliesData } = await repliesQuery;
        
        // Load meetings
        let meetingsQuery = client.from('meetings_booked').select('*');
        if (deepViewData.selectedClient) {
            meetingsQuery = meetingsQuery.eq('client', deepViewData.selectedClient);
        }
        if (deepViewData.dateStart && deepViewData.dateEnd) {
            meetingsQuery = meetingsQuery.gte('created_time', deepViewData.dateStart)
                                        .lte('created_time', deepViewData.dateEnd);
        }
        
        const { data: meetingsData } = await meetingsQuery;
        
        // Calculate funnel metrics
        const totalEmails = (campaignData || []).reduce((sum, row) => sum + (parseFloat(row.emails_sent) || 0), 0);
        const totalProspects = (campaignData || []).reduce((sum, row) => sum + (parseFloat(row.total_leads_contacted) || 0), 0);
        const totalReplies = (repliesData || []).length;
        const realReplies = (repliesData || []).filter(r => r.category !== 'Out Of Office').length;
        const interestedReplies = (repliesData || []).filter(r => r.category === 'Interested').length;
        const totalMeetings = (meetingsData || []).length;
        
        // Calculate conversion rates
        const emailToProspectRate = totalEmails > 0 ? ((totalProspects / totalEmails) * 100).toFixed(1) : '0.0';
        const prospectToReplyRate = totalProspects > 0 ? ((realReplies / totalProspects) * 100).toFixed(1) : '0.0';
        const replyToInterestedRate = realReplies > 0 ? ((interestedReplies / realReplies) * 100).toFixed(1) : '0.0';
        const interestedToMeetingRate = interestedReplies > 0 ? ((totalMeetings / interestedReplies) * 100).toFixed(1) : '0.0';
        const overallConversionRate = totalProspects > 0 ? ((totalMeetings / totalProspects) * 100).toFixed(2) : '0.00';
        
        const funnelHTML = `
            <div class="funnel-container" style="margin-bottom: 32px;">
                <div class="funnel-stage">
                    <div class="funnel-stage-label">Emails Sent</div>
                    <div class="funnel-stage-value">${formatNumber(totalEmails)}</div>
                </div>
                <div class="funnel-stage">
                    <div class="funnel-stage-label">Unique Prospects</div>
                    <div class="funnel-stage-value">${formatNumber(totalProspects)}</div>
                    <div class="funnel-stage-rate">${emailToProspectRate}% conversion</div>
                </div>
                <div class="funnel-stage">
                    <div class="funnel-stage-label">Real Replies</div>
                    <div class="funnel-stage-value">${formatNumber(realReplies)}</div>
                    <div class="funnel-stage-rate">${prospectToReplyRate}% conversion</div>
                </div>
                <div class="funnel-stage">
                    <div class="funnel-stage-label">Interested Replies</div>
                    <div class="funnel-stage-value">${formatNumber(interestedReplies)}</div>
                    <div class="funnel-stage-rate">${replyToInterestedRate}% conversion</div>
                </div>
                <div class="funnel-stage">
                    <div class="funnel-stage-label">Meetings Booked</div>
                    <div class="funnel-stage-value">${formatNumber(totalMeetings)}</div>
                    <div class="funnel-stage-rate">${interestedToMeetingRate}% conversion</div>
                </div>
            </div>
            <div class="grid-2">
                <div class="metric-card">
                    <div class="metric-label">Overall Conversion Rate</div>
                    <div class="metric-value">${overallConversionRate}%</div>
                    <div class="metric-percentage">Prospects → Meetings</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Email to Meeting Rate</div>
                    <div class="metric-value">${totalEmails > 0 ? ((totalMeetings / totalEmails) * 100).toFixed(2) : '0.00'}%</div>
                    <div class="metric-percentage">Emails → Meetings</div>
                </div>
            </div>
        `;
        
        container.innerHTML = funnelHTML;
        
    } catch (err) {
        console.error('❌ Error loading flow analysis:', err);
        container.innerHTML = `<div class="error">Error loading flow analysis: ${err.message}</div>`;
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
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

// Format number helper
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toLocaleString();
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initDeepView = initDeepView;
    window.loadDeepViewData = loadDeepViewData;
}
