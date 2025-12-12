/**
 * Infrastructure - Inboxes Analytics Tab
 * Handles inbox analytics charts and metrics
 */

(function() {
    'use strict';

    let supabaseClient = null;
    let charts = {
        countChart: null,
        providerChart: null,
        clientChart: null,
        deliverabilityChart: null
    };

    /**
     * Initialize the Inboxes Analytics Tab
     */
    window.initInboxesAnalytics = async function() {
        console.log('📊 Initializing Inboxes Analytics Tab...');

        try {
            // Initialize Supabase client
            if (!supabaseClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
                supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            }

            // Load client options for filter
            await loadClientOptions();

            // Setup event listeners
            setupEventListeners();

            // Load initial analytics
            await loadAnalytics();

            console.log('✅ Inboxes Analytics Tab initialized');
        } catch (error) {
            console.error('❌ Error initializing Inboxes Analytics Tab:', error);
        }
    };

    /**
     * Load client options for filter dropdown
     */
    async function loadClientOptions() {
        try {
            if (!supabaseClient) return;

            const { data: clients, error } = await supabaseClient
                .from('Clients')
                .select('client_id, client_name')
                .order('client_name');

            if (error) throw error;

            const clientFilter = document.getElementById('inbox-analytics-client-filter');
            if (clientFilter && clients) {
                clientFilter.innerHTML = '<option value="">All Clients</option>' +
                    clients.map(c => `<option value="${c.client_id}">${c.client_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const applyFiltersBtn = document.getElementById('inbox-analytics-apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', loadAnalytics);
        }
    }

    /**
     * Load and display analytics
     */
    async function loadAnalytics() {
        try {
            if (!supabaseClient) {
                console.warn('Supabase client not initialized');
                displayError('Supabase client not available');
                return;
            }

            // Get filter values
            const filters = getFilters();

            // Load data
            const inboxes = await loadInboxesData(filters);

            // Display metrics
            displayMetrics(inboxes);

            // Render charts
            renderCharts(inboxes);

            console.log('✅ Analytics loaded successfully');
        } catch (error) {
            console.error('Error loading analytics:', error);
            displayError(error.message);
        }
    }

    /**
     * Get current filter values
     */
    function getFilters() {
        const clientFilter = document.getElementById('inbox-analytics-client-filter');
        const dateStartFilter = document.getElementById('inbox-analytics-date-start');
        const dateEndFilter = document.getElementById('inbox-analytics-date-end');
        const providerFilter = document.getElementById('inbox-analytics-provider-filter');
        const deliverabilityFilter = document.getElementById('inbox-analytics-deliverability-filter');

        return {
            client: clientFilter ? clientFilter.value : '',
            dateStart: dateStartFilter ? dateStartFilter.value : '',
            dateEnd: dateEndFilter ? dateEndFilter.value : '',
            provider: providerFilter ? providerFilter.value : '',
            minDeliverability: deliverabilityFilter ? parseFloat(deliverabilityFilter.value) : 0
        };
    }

    /**
     * Load inboxes data with filters
     */
    async function loadInboxesData(filters) {
        let query = supabaseClient
            .from('inboxes')
            .select('*')
            .order('created_at', { ascending: true });

        if (filters.client) {
            query = query.eq('client_id', filters.client);
        }

        if (filters.provider) {
            query = query.eq('provider', filters.provider);
        }

        if (filters.dateStart) {
            query = query.gte('created_at', filters.dateStart);
        }

        if (filters.dateEnd) {
            query = query.lte('created_at', filters.dateEnd + 'T23:59:59');
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter by deliverability (client-side since it may be calculated)
        let filteredData = data || [];
        if (filters.minDeliverability > 0) {
            filteredData = filteredData.filter(inbox => {
                const deliverability = inbox.deliverability_score || 0;
                return deliverability >= filters.minDeliverability;
            });
        }

        return filteredData;
    }

    /**
     * Display metrics cards
     */
    function displayMetrics(inboxes) {
        const metricsContainer = document.getElementById('inbox-analytics-metrics');
        if (!metricsContainer) return;

        // Calculate metrics
        const totalInboxes = inboxes.length;

        const providerCounts = {};
        const clientCounts = {};
        let totalDeliverability = 0;

        inboxes.forEach(inbox => {
            // Provider distribution
            const provider = inbox.provider || 'Unknown';
            providerCounts[provider] = (providerCounts[provider] || 0) + 1;

            // Client distribution
            const client = inbox.client_id || 'Unassigned';
            clientCounts[client] = (clientCounts[client] || 0) + 1;

            // Deliverability
            totalDeliverability += inbox.deliverability_score || 0;
        });

        const avgDeliverability = totalInboxes > 0 ? (totalDeliverability / totalInboxes).toFixed(1) : 0;

        // Render metrics
        metricsContainer.innerHTML = `
            <div class="metric-card total">
                <div class="metric-label">Total Inboxes</div>
                <div class="metric-value">${totalInboxes}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Providers</div>
                <div class="metric-value">${Object.keys(providerCounts).length}</div>
                <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 8px;">
                    ${Object.entries(providerCounts).slice(0, 3).map(([p, c]) => `${p}: ${c}`).join(', ')}
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Clients</div>
                <div class="metric-value">${Object.keys(clientCounts).length}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Deliverability</div>
                <div class="metric-value">${avgDeliverability}%</div>
            </div>
        `;
    }

    /**
     * Render all charts
     */
    function renderCharts(inboxes) {
        renderInboxCountChart(inboxes);
        renderProviderDistributionChart(inboxes);
        renderClientDistributionChart(inboxes);
        renderDeliverabilityTrendsChart(inboxes);
    }

    /**
     * Render inbox count over time chart
     */
    function renderInboxCountChart(inboxes) {
        const canvas = document.getElementById('inbox-analytics-count-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (charts.countChart) {
            charts.countChart.destroy();
        }

        // Group inboxes by date
        const dateGroups = {};
        inboxes.forEach(inbox => {
            const date = inbox.created_at ? inbox.created_at.split('T')[0] : 'Unknown';
            dateGroups[date] = (dateGroups[date] || 0) + 1;
        });

        // Sort dates and create cumulative count
        const sortedDates = Object.keys(dateGroups).sort();
        const cumulativeCounts = [];
        let total = 0;

        sortedDates.forEach(date => {
            total += dateGroups[date];
            cumulativeCounts.push(total);
        });

        const ctx = canvas.getContext('2d');
        charts.countChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates.length > 0 ? sortedDates : ['No Data'],
                datasets: [{
                    label: 'Total Inboxes',
                    data: cumulativeCounts.length > 0 ? cumulativeCounts : [0],
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#e4e4e7' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Render provider distribution pie chart
     */
    function renderProviderDistributionChart(inboxes) {
        const canvas = document.getElementById('inbox-analytics-provider-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (charts.providerChart) {
            charts.providerChart.destroy();
        }

        // Count by provider
        const providerCounts = {};
        inboxes.forEach(inbox => {
            const provider = inbox.provider || 'Unknown';
            providerCounts[provider] = (providerCounts[provider] || 0) + 1;
        });

        const labels = Object.keys(providerCounts);
        const data = Object.values(providerCounts);
        const colors = ['#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#ef4444'];

        const ctx = canvas.getContext('2d');
        charts.providerChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [{
                    data: data.length > 0 ? data : [1],
                    backgroundColor: colors.slice(0, labels.length > 0 ? labels.length : 1),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e4e4e7', padding: 15 }
                    }
                }
            }
        });
    }

    /**
     * Render client distribution bar chart
     */
    function renderClientDistributionChart(inboxes) {
        const canvas = document.getElementById('inbox-analytics-client-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (charts.clientChart) {
            charts.clientChart.destroy();
        }

        // Count by client
        const clientCounts = {};
        inboxes.forEach(inbox => {
            const client = inbox.client_id || 'Unassigned';
            clientCounts[client] = (clientCounts[client] || 0) + 1;
        });

        const labels = Object.keys(clientCounts);
        const data = Object.values(clientCounts);

        const ctx = canvas.getContext('2d');
        charts.clientChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['No Data'],
                datasets: [{
                    label: 'Inbox Count',
                    data: data.length > 0 ? data : [0],
                    backgroundColor: '#8b5cf6',
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#e4e4e7' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    /**
     * Render deliverability trends chart
     */
    function renderDeliverabilityTrendsChart(inboxes) {
        const canvas = document.getElementById('inbox-analytics-deliverability-chart');
        if (!canvas) return;

        // Destroy existing chart
        if (charts.deliverabilityChart) {
            charts.deliverabilityChart.destroy();
        }

        // Group by date and calculate average deliverability
        const dateGroups = {};
        inboxes.forEach(inbox => {
            const date = inbox.created_at ? inbox.created_at.split('T')[0] : 'Unknown';
            if (!dateGroups[date]) {
                dateGroups[date] = { total: 0, count: 0 };
            }
            dateGroups[date].total += inbox.deliverability_score || 0;
            dateGroups[date].count += 1;
        });

        const sortedDates = Object.keys(dateGroups).sort();
        const avgDeliverability = sortedDates.map(date => {
            const group = dateGroups[date];
            return group.count > 0 ? (group.total / group.count).toFixed(1) : 0;
        });

        const ctx = canvas.getContext('2d');
        charts.deliverabilityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates.length > 0 ? sortedDates : ['No Data'],
                datasets: [{
                    label: 'Avg Deliverability (%)',
                    data: avgDeliverability.length > 0 ? avgDeliverability : [0],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: { color: '#e4e4e7' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#a1a1aa' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    /**
     * Display error message
     */
    function displayError(message) {
        const metricsContainer = document.getElementById('inbox-analytics-metrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = `
                <div class="metric-card" style="grid-column: 1 / -1;">
                    <div class="metric-label">Error</div>
                    <div style="color: var(--color-accent-red); margin-top: 8px;">${message}</div>
                </div>
            `;
        }
    }

    // Auto-initialize logging
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 Infrastructure-inboxes-analytics.js loaded');
        });
    } else {
        console.log('📄 Infrastructure-inboxes-analytics.js loaded');
    }
})();
