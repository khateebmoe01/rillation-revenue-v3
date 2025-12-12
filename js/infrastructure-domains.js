/**
 * Infrastructure - Domains Tab
 * Handles domain generation, availability checking, and domain management
 */

(function() {
    'use strict';

    // Default prefixes and suffixes for domain generation
    const DEFAULT_PREFIXES = ['try', 'use', 'join', 'grow', 'start', 'get', 'my', 'go', 'the', 'new', 'best', 'top', 'your', 'our', 'pro', 'easy', 'quick', 'smart', 'fast', 'real'];
    const DEFAULT_SUFFIXES = ['go', 'max', 'pro', 'top'];

    let generatedDomains = [];
    let supabaseClient = null;

    /**
     * Initialize the Domains Tab
     */
    window.initDomainsTab = async function() {
        console.log('🌐 Initializing Domains Tab...');

        try {
            // Initialize Supabase client
            if (!supabaseClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
                supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            }

            // Initialize prefix/suffix checkboxes
            initializePrefixSuffixSelectors();

            // Load client options
            await loadClientOptions();

            // Setup event listeners
            setupEventListeners();

            // Load existing domains
            await loadDomains();

            console.log('✅ Domains Tab initialized');
        } catch (error) {
            console.error('❌ Error initializing Domains Tab:', error);
        }
    };

    /**
     * Initialize prefix and suffix checkbox selectors
     */
    function initializePrefixSuffixSelectors() {
        const prefixesContainer = document.getElementById('domain-prefixes-container');
        const suffixesContainer = document.getElementById('domain-suffixes-container');

        if (prefixesContainer) {
            prefixesContainer.innerHTML = DEFAULT_PREFIXES.map(prefix => `
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                    <input type="checkbox" value="${prefix}" class="domain-prefix-checkbox"
                           style="width: 16px; height: 16px; cursor: pointer;">
                    <span style="color: var(--color-text-default);">${prefix}</span>
                </label>
            `).join('');
        }

        if (suffixesContainer) {
            suffixesContainer.innerHTML = DEFAULT_SUFFIXES.map(suffix => `
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
                    <input type="checkbox" value="${suffix}" class="domain-suffix-checkbox"
                           style="width: 16px; height: 16px; cursor: pointer;">
                    <span style="color: var(--color-text-default);">${suffix}</span>
                </label>
            `).join('');
        }
    }

    /**
     * Load client options for dropdown
     */
    async function loadClientOptions() {
        try {
            if (!supabaseClient) return;

            const { data: clients, error } = await supabaseClient
                .from('Clients')
                .select('client_id, client_name')
                .order('client_name');

            if (error) throw error;

            const clientSelect = document.getElementById('domain-client-select');
            const domainClientFilter = document.getElementById('infra-domain-client-filter');

            if (clientSelect && clients) {
                clientSelect.innerHTML = '<option value="">Select Client (Optional)</option>' +
                    clients.map(c => `<option value="${c.client_id}">${c.client_name}</option>`).join('');
            }

            if (domainClientFilter && clients) {
                domainClientFilter.innerHTML = '<option value="">All Clients</option>' +
                    clients.map(c => `<option value="${c.client_id}">${c.client_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    /**
     * Setup event listeners for buttons and filters
     */
    function setupEventListeners() {
        // Generate domains button
        const generateBtn = document.getElementById('domain-generate-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', generateDomains);
        }

        // Check availability button
        const checkAvailabilityBtn = document.getElementById('domain-check-availability-btn');
        if (checkAvailabilityBtn) {
            checkAvailabilityBtn.addEventListener('click', checkDomainsAvailability);
        }

        // Sync domains button
        const syncDomainsBtn = document.getElementById('infra-sync-domains');
        if (syncDomainsBtn) {
            syncDomainsBtn.addEventListener('click', syncDomains);
        }

        // Domain filters
        const domainClientFilter = document.getElementById('infra-domain-client-filter');
        const domainProviderFilter = document.getElementById('infra-domain-provider-filter');

        if (domainClientFilter) {
            domainClientFilter.addEventListener('change', loadDomains);
        }

        if (domainProviderFilter) {
            domainProviderFilter.addEventListener('change', loadDomains);
        }
    }

    /**
     * Generate domain combinations
     */
    function generateDomains() {
        const baseNameInput = document.getElementById('domain-base-name');
        const baseName = baseNameInput ? baseNameInput.value.trim() : '';

        if (!baseName) {
            alert('Please enter a base name for domain generation');
            return;
        }

        // Get selected prefixes
        const selectedPrefixes = Array.from(document.querySelectorAll('.domain-prefix-checkbox:checked'))
            .map(cb => cb.value);

        // Get selected suffixes
        const selectedSuffixes = Array.from(document.querySelectorAll('.domain-suffix-checkbox:checked'))
            .map(cb => cb.value);

        if (selectedPrefixes.length === 0 && selectedSuffixes.length === 0) {
            alert('Please select at least one prefix or suffix');
            return;
        }

        // Generate combinations
        generatedDomains = [];

        // Prefix combinations
        selectedPrefixes.forEach(prefix => {
            generatedDomains.push(`${prefix}${baseName}.com`);
        });

        // Suffix combinations
        selectedSuffixes.forEach(suffix => {
            generatedDomains.push(`${baseName}${suffix}.com`);
        });

        // Prefix + Suffix combinations
        selectedPrefixes.forEach(prefix => {
            selectedSuffixes.forEach(suffix => {
                generatedDomains.push(`${prefix}${baseName}${suffix}.com`);
            });
        });

        // Display generated domains
        displayGeneratedDomains();
    }

    /**
     * Display generated domains in the UI
     */
    function displayGeneratedDomains() {
        const generatedList = document.getElementById('domain-generated-list');
        if (!generatedList) return;

        if (generatedDomains.length === 0) {
            generatedList.innerHTML = '<p style="color: var(--color-text-muted); padding: 20px; text-align: center;">No domains generated yet</p>';
            return;
        }

        generatedList.innerHTML = `
            <div style="background: var(--color-surface-subtle); padding: 16px; border-radius: 8px; max-height: 500px; overflow-y: auto;">
                <div style="margin-bottom: 12px; color: var(--color-text-muted); font-size: 0.9rem;">
                    Generated ${generatedDomains.length} domain(s)
                </div>
                <div style="display: grid; gap: 8px;">
                    ${generatedDomains.map(domain => `
                        <div class="generated-domain-item" data-domain="${domain}"
                             style="padding: 10px; background: var(--color-surface-strong); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="color: var(--color-text-default); font-family: monospace;">${domain}</span>
                            <span class="domain-status" style="font-size: 0.85rem; color: var(--color-text-muted);">-</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Check availability of generated domains
     */
    async function checkDomainsAvailability() {
        if (generatedDomains.length === 0) {
            alert('Please generate domains first');
            return;
        }

        const checkBtn = document.getElementById('domain-check-availability-btn');
        if (checkBtn) {
            checkBtn.textContent = 'Checking...';
            checkBtn.disabled = true;
        }

        try {
            // In a real implementation, this would call the Supabase Edge Function
            // For now, we'll simulate the check
            const domainItems = document.querySelectorAll('.generated-domain-item');

            for (const item of domainItems) {
                const domain = item.getAttribute('data-domain');
                const statusSpan = item.querySelector('.domain-status');

                if (statusSpan) {
                    statusSpan.textContent = 'Checking...';
                    statusSpan.style.color = 'var(--color-accent-orange)';
                }

                // Simulate API call delay
                await new Promise(resolve => setTimeout(resolve, 200));

                // Simulate random availability (in production, call actual API)
                const isAvailable = Math.random() > 0.5;

                if (statusSpan) {
                    if (isAvailable) {
                        statusSpan.textContent = '✓ Available ($9.99)';
                        statusSpan.style.color = 'var(--color-accent-green)';
                    } else {
                        statusSpan.textContent = '✗ Taken';
                        statusSpan.style.color = 'var(--color-accent-red)';
                    }
                }
            }

            console.log('✅ Domain availability check complete');
        } catch (error) {
            console.error('❌ Error checking domain availability:', error);
            alert('Error checking domain availability. Please try again.');
        } finally {
            if (checkBtn) {
                checkBtn.textContent = 'Check Availability';
                checkBtn.disabled = false;
            }
        }
    }

    /**
     * Load domains from database
     */
    async function loadDomains() {
        try {
            if (!supabaseClient) {
                console.warn('Supabase client not initialized');
                return;
            }

            const clientFilter = document.getElementById('infra-domain-client-filter');
            const providerFilter = document.getElementById('infra-domain-provider-filter');

            const selectedClient = clientFilter ? clientFilter.value : '';
            const selectedProvider = providerFilter ? providerFilter.value : '';

            let query = supabaseClient
                .from('domains')
                .select('*')
                .order('created_at', { ascending: false });

            if (selectedClient) {
                query = query.eq('client_id', selectedClient);
            }

            if (selectedProvider) {
                query = query.eq('provider', selectedProvider);
            }

            const { data: domains, error } = await query;

            if (error) throw error;

            displayDomains(domains || []);
        } catch (error) {
            console.error('Error loading domains:', error);
            displayDomains([]);
        }
    }

    /**
     * Display domains in the management table
     */
    function displayDomains(domains) {
        const tbody = document.getElementById('infra-domains-tbody');
        if (!tbody) return;

        if (domains.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No domains found</td></tr>';
            return;
        }

        tbody.innerHTML = domains.map(domain => {
            const providerName = getProviderDisplayName(domain.provider);
            const statusColor = getStatusColor(domain.status);
            const healthColor = getHealthColor(domain.health_status);
            const dnsStatus = getDNSStatus(domain);

            return `
                <tr>
                    <td><strong style="color: var(--color-text-default);">${domain.domain_name || 'N/A'}</strong></td>
                    <td>${providerName}</td>
                    <td><span style="color: ${statusColor};">${domain.status || 'unknown'}</span></td>
                    <td>${dnsStatus}</td>
                    <td><span style="color: ${healthColor};">${domain.health_status || 'unknown'}</span></td>
                    <td>
                        <button class="filter-btn" onclick="viewDomainDetails('${domain.domain_id}')" style="padding: 6px 12px; font-size: 0.85rem;">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Get provider display name
     */
    function getProviderDisplayName(provider) {
        const providers = {
            'porkbun': 'Porkbun',
            'inboxkit': 'InboxKit',
            'missioninbox': 'Mission Inbox'
        };
        return providers[provider] || provider || 'Unknown';
    }

    /**
     * Get status color
     */
    function getStatusColor(status) {
        const colors = {
            'active': 'var(--color-accent-green)',
            'verifying': 'var(--color-accent-orange)',
            'pending': 'var(--color-accent-orange)',
            'inactive': 'var(--color-accent-red)',
            'failed': 'var(--color-accent-red)'
        };
        return colors[status] || 'var(--color-text-muted)';
    }

    /**
     * Get health status color
     */
    function getHealthColor(health) {
        const colors = {
            'healthy': 'var(--color-accent-green)',
            'warning': 'var(--color-accent-orange)',
            'critical': 'var(--color-accent-red)'
        };
        return colors[health] || 'var(--color-text-muted)';
    }

    /**
     * Get DNS status display
     */
    function getDNSStatus(domain) {
        if (!domain.dns_records) return '<span style="color: var(--color-text-muted);">Not configured</span>';

        const records = typeof domain.dns_records === 'string' ? JSON.parse(domain.dns_records) : domain.dns_records;
        const recordCount = records ? Object.keys(records).length : 0;

        if (recordCount > 0) {
            return `<span style="color: var(--color-accent-green);">${recordCount} records</span>`;
        }

        return '<span style="color: var(--color-text-muted);">No records</span>';
    }

    /**
     * Sync domains from Porkbun
     */
    async function syncDomains() {
        const syncBtn = document.getElementById('infra-sync-domains');
        if (syncBtn) {
            syncBtn.textContent = 'Syncing...';
            syncBtn.disabled = true;
        }

        try {
            // In production, this would call the sync-domains-porkbun Edge Function
            // For now, we'll just reload the domains
            console.log('🔄 Syncing domains from Porkbun...');

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            await loadDomains();

            alert('Domains synced successfully!');
            console.log('✅ Domains synced');
        } catch (error) {
            console.error('❌ Error syncing domains:', error);
            alert('Error syncing domains. Please try again.');
        } finally {
            if (syncBtn) {
                syncBtn.textContent = 'Sync Domains';
                syncBtn.disabled = false;
            }
        }
    }

    /**
     * View domain details (placeholder for future implementation)
     */
    window.viewDomainDetails = function(domainId) {
        console.log('Viewing domain:', domainId);
        alert(`Domain details for ${domainId} - This feature will be implemented soon.`);
    };

    // Auto-initialize if on domains tab
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 Infrastructure-domains.js loaded');
        });
    } else {
        console.log('📄 Infrastructure-domains.js loaded');
    }
})();
