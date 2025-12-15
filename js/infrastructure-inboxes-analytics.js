// Infrastructure Inboxes Analytics
// Analytics dashboard for inboxes with filters and charts

let inboxAnalyticsFilters = {
    client: '',
    dateStart: '',
    dateEnd: '',
    provider: '',
    deliverabilityMin: 0,
};

let inboxAnalyticsCharts = {
    countOverTime: null,
    providerDistribution: null,
    clientDistribution: null,
    deliverabilityTrends: null,
};

// Initialize Inboxes Analytics
function initInboxesAnalytics() {
    console.log('🚀 Initializing Inboxes Analytics...');
    
    setupAnalyticsFilters();
    loadAnalyticsData();
}

// Setup analytics filters
function setupAnalyticsFilters() {
    const clientFilter = document.getElementById('inbox-analytics-client-filter');
    const dateStartFilter = document.getElementById('inbox-analytics-date-start');
    const dateEndFilter = document.getElementById('inbox-analytics-date-end');
    const providerFilter = document.getElementById('inbox-analytics-provider-filter');
    const deliverabilityFilter = document.getElementById('inbox-analytics-deliverability-filter');
    const applyFiltersBtn = document.getElementById('inbox-analytics-apply-filters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            updateFilters();
            loadAnalyticsData();
        });
    }
    
    // Auto-apply on filter change
    [clientFilter, dateStartFilter, dateEndFilter, providerFilter, deliverabilityFilter].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => {
                updateFilters();
                loadAnalyticsData();
            });
        }
    });
    
    loadClientFilterOptions();
}

// Update filters object
function updateFilters() {
    const clientFilter = document.getElementById('inbox-analytics-client-filter');
    const dateStartFilter = document.getElementById('inbox-analytics-date-start');
    const dateEndFilter = document.getElementById('inbox-analytics-date-end');
    const providerFilter = document.getElementById('inbox-analytics-provider-filter');
    const deliverabilityFilter = document.getElementById('inbox-analytics-deliverability-filter');
    
    inboxAnalyticsFilters = {
        client: clientFilter ? clientFilter.value : '',
        dateStart: dateStartFilter ? dateStartFilter.value : '',
        dateEnd: dateEndFilter ? dateEndFilter.value : '',
        provider: providerFilter ? providerFilter.value : '',
        deliverabilityMin: deliverabilityFilter ? parseFloat(deliverabilityFilter.value) || 0 : 0,
    };
}

// Load analytics data
async function loadAnalyticsData() {
    try {
        const client = window.getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }
        
        // Load metrics cards
        await loadAnalyticsMetrics();
        
        // Load charts
        await loadAnalyticsCharts();
        
    } catch (error) {
        console.error('Error loading analytics data:', error);
    }
}

// Load analytics metrics cards
async function loadAnalyticsMetrics() {
    const client = window.getSupabaseClient();
    if (!client) return;
    
    try {
        // Build query for inboxes
        let inboxesQuery = client.from('inboxes').select('*', { count: 'exact' });
        
        if (inboxAnalyticsFilters.client) {
            inboxesQuery = inboxesQuery.eq('client', inboxAnalyticsFilters.client);
        }
        
        const { data: inboxes, count: totalInboxes } = await inboxesQuery;
        
        // Count by provider
        const byProvider = {};
        const byClient = {};
        let totalDeliverability = 0;
        let deliverabilityCount = 0;
        
        if (inboxes) {
            inboxes.forEach(inbox => {
                // By provider
                const provider = inbox.provider || 'bison';
                byProvider[provider] = (byProvider[provider] || 0) + 1;
                
                // By client
                const clientName = inbox.client || 'Unknown';
                byClient[clientName] = (byClient[clientName] || 0) + 1;
                
                // Deliverability (if available in analytics)
                // This would come from inbox_analytics table
            });
        }
        
        // Get analytics data for deliverability
        let analyticsQuery = client.from('inbox_analytics').select('*');
        if (inboxAnalyticsFilters.client) {
            analyticsQuery = analyticsQuery.eq('client', inboxAnalyticsFilters.client);
        }
        if (inboxAnalyticsFilters.dateStart && inboxAnalyticsFilters.dateEnd) {
            analyticsQuery = analyticsQuery.gte('date', inboxAnalyticsFilters.dateStart)
                .lte('date', inboxAnalyticsFilters.dateEnd);
        }
        if (inboxAnalyticsFilters.provider) {
            analyticsQuery = analyticsQuery.eq('provider', inboxAnalyticsFilters.provider);
        }
        
        const { data: analytics } = await analyticsQuery;
        
        if (analytics) {
            analytics.forEach(metric => {
                if (metric.deliverability_score && metric.deliverability_score > inboxAnalyticsFilters.deliverabilityMin) {
                    totalDeliverability += metric.deliverability_score;
                    deliverabilityCount++;
                }
            });
        }
        
        const avgDeliverability = deliverabilityCount > 0 ? (totalDeliverability / deliverabilityCount).toFixed(1) : 0;
        
        // Render metrics cards
        const metricsContainer = document.getElementById('inbox-analytics-metrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = `
                <div class="metric-card total">
                    <div class="metric-label">Total Inboxes</div>
                    <div class="metric-value">${totalInboxes || 0}</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">By Provider</div>
                    <div class="metric-value">${Object.keys(byProvider).length}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 8px;">
                        ${Object.entries(byProvider).map(([p, c]) => `${p}: ${c}`).join(', ')}
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">By Client</div>
                    <div class="metric-value">${Object.keys(byClient).length}</div>
                    <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 8px;">
                        ${Object.entries(byClient).slice(0, 3).map(([c, n]) => `${c}: ${n}`).join(', ')}${Object.keys(byClient).length > 3 ? '...' : ''}
                    </div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">Avg Deliverability</div>
                    <div class="metric-value">${avgDeliverability}%</div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading analytics metrics:', error);
    }
}

// Load analytics charts
async function loadAnalyticsCharts() {
    const client = window.getSupabaseClient();
    if (!client) return;
    
    try {
        // Load data for charts
        let analyticsQuery = client.from('inbox_analytics').select('*').order('date', { ascending: true });
        
        if (inboxAnalyticsFilters.client) {
            analyticsQuery = analyticsQuery.eq('client', inboxAnalyticsFilters.client);
        }
        if (inboxAnalyticsFilters.dateStart && inboxAnalyticsFilters.dateEnd) {
            analyticsQuery = analyticsQuery.gte('date', inboxAnalyticsFilters.dateStart)
                .lte('date', inboxAnalyticsFilters.dateEnd);
        }
        if (inboxAnalyticsFilters.provider) {
            analyticsQuery = analyticsQuery.eq('provider', inboxAnalyticsFilters.provider);
        }
        
        const { data: analytics } = await analyticsQuery;
        
        // Also get inboxes for provider/client distribution
        let inboxesQuery = client.from('inboxes').select('provider, client, created_at');
        if (inboxAnalyticsFilters.client) {
            inboxesQuery = inboxesQuery.eq('client', inboxAnalyticsFilters.client);
        }
        const { data: inboxes } = await inboxesQuery;
        
        // Render charts
        renderCountOverTimeChart(analytics || []);
        renderProviderDistributionChart(inboxes || []);
        renderClientDistributionChart(inboxes || []);
        renderDeliverabilityTrendsChart(analytics || []);
        
    } catch (error) {
        console.error('Error loading analytics charts:', error);
    }
}

// Render count over time chart
function renderCountOverTimeChart(analytics) {
    const ctx = document.getElementById('inbox-analytics-count-chart');
    if (!ctx) return;
    
    // Group by date
    const dateMap = {};
    analytics.forEach(metric => {
        const date = metric.date;
        if (!dateMap[date]) {
            dateMap[date] = 0;
        }
        dateMap[date]++;
    });
    
    const labels = Object.keys(dateMap).sort();
    const data = labels.map(date => dateMap[date]);
    
    if (inboxAnalyticsCharts.countOverTime) {
        inboxAnalyticsCharts.countOverTime.destroy();
    }
    
    inboxAnalyticsCharts.countOverTime = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inbox Count',
                data: data,
                borderColor: 'rgb(139, 92, 246)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'var(--color-text-default)' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                },
                x: {
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                }
            }
        }
    });
}

// Render provider distribution chart
function renderProviderDistributionChart(inboxes) {
    const ctx = document.getElementById('inbox-analytics-provider-chart');
    if (!ctx) return;
    
    const providerCounts = {};
    inboxes.forEach(inbox => {
        const provider = inbox.provider || 'bison';
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
    });
    
    const labels = Object.keys(providerCounts);
    const data = Object.values(providerCounts);
    
    if (inboxAnalyticsCharts.providerDistribution) {
        inboxAnalyticsCharts.providerDistribution.destroy();
    }
    
    inboxAnalyticsCharts.providerDistribution = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'var(--color-text-default)' }
                }
            }
        }
    });
}

// Render client distribution chart
function renderClientDistributionChart(inboxes) {
    const ctx = document.getElementById('inbox-analytics-client-chart');
    if (!ctx) return;
    
    const clientCounts = {};
    inboxes.forEach(inbox => {
        const clientName = inbox.client || 'Unknown';
        clientCounts[clientName] = (clientCounts[clientName] || 0) + 1;
    });
    
    const entries = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = entries.map(e => e[0]);
    const data = entries.map(e => e[1]);
    
    if (inboxAnalyticsCharts.clientDistribution) {
        inboxAnalyticsCharts.clientDistribution.destroy();
    }
    
    inboxAnalyticsCharts.clientDistribution = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Inboxes',
                data: data,
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'var(--color-text-default)' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                },
                x: {
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                }
            }
        }
    });
}

// Render deliverability trends chart
function renderDeliverabilityTrendsChart(analytics) {
    const ctx = document.getElementById('inbox-analytics-deliverability-chart');
    if (!ctx) return;
    
    // Group by date
    const dateMap = {};
    analytics.forEach(metric => {
        const date = metric.date;
        if (!dateMap[date]) {
            dateMap[date] = { sum: 0, count: 0 };
        }
        if (metric.deliverability_score) {
            dateMap[date].sum += metric.deliverability_score;
            dateMap[date].count++;
        }
    });
    
    const labels = Object.keys(dateMap).sort();
    const data = labels.map(date => {
        const d = dateMap[date];
        return d.count > 0 ? (d.sum / d.count).toFixed(1) : 0;
    });
    
    if (inboxAnalyticsCharts.deliverabilityTrends) {
        inboxAnalyticsCharts.deliverabilityTrends.destroy();
    }
    
    inboxAnalyticsCharts.deliverabilityTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Deliverability Score',
                data: data,
                borderColor: 'rgb(16, 185, 129)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: 'var(--color-text-default)' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                },
                x: {
                    ticks: { color: 'var(--color-text-muted)' },
                    grid: { color: 'var(--color-border-subtle)' }
                }
            }
        }
    });
}

// Load client filter options
async function loadClientFilterOptions() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: clients } = await client.from('Clients').select('Business');
        const clientFilter = document.getElementById('inbox-analytics-client-filter');
        
        if (clientFilter && clients) {
            const uniqueClients = [...new Set(clients.map(c => c.Business).filter(Boolean))];
            clientFilter.innerHTML = '<option value="">All Clients</option>' + 
                uniqueClients.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading client filter:', error);
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initInboxesAnalytics = initInboxesAnalytics;
    window.loadAnalyticsData = loadAnalyticsData;
}

