// Infrastructure Domains Management
// Handles domain generation, availability checking, and domain management

let domainGenerationData = {
    baseName: '',
    selectedPrefixes: [],
    selectedSuffixes: [],
    client: '',
    generatedDomains: [],
    checkingAvailability: false,
};

// Default prefixes and suffixes
const DEFAULT_PREFIXES = ['try', 'use', 'join', 'grow', 'choose', 'find', 'go', 'do', 'get', 'max', 'pick', 'start', 'run', 'new', 'my', 'pro', 'top', 'true', 'next', 'best', 'one'];
const DEFAULT_SUFFIXES = ['go', 'max', 'pro', 'top'];

// Initialize Domains tab
function initDomainsTab() {
    console.log('🚀 Initializing Domains tab...');
    
    // Setup event listeners
    setupDomainGenerationUI();
    setupDomainListUI();
    
    // Load initial data
    loadDomainsList();
    loadClientFilter();
}

// Setup domain generation UI
function setupDomainGenerationUI() {
    const baseNameInput = document.getElementById('domain-base-name');
    const generateBtn = document.getElementById('domain-generate-btn');
    const checkAvailabilityBtn = document.getElementById('domain-check-availability-btn');
    const clientSelect = document.getElementById('domain-client-select');
    
    // Prefix checkboxes
    const prefixContainer = document.getElementById('domain-prefixes-container');
    if (prefixContainer) {
        DEFAULT_PREFIXES.forEach(prefix => {
            const label = document.createElement('label');
            label.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 4px 0;';
            label.innerHTML = `
                <input type="checkbox" class="domain-prefix-checkbox" value="${prefix}" style="width: 18px; height: 18px;">
                <span>${prefix}</span>
            `;
            prefixContainer.appendChild(label);
        });
    }
    
    // Suffix checkboxes
    const suffixContainer = document.getElementById('domain-suffixes-container');
    if (suffixContainer) {
        DEFAULT_SUFFIXES.forEach(suffix => {
            const label = document.createElement('label');
            label.style.cssText = 'display: flex; align-items: center; gap: 8px; margin: 4px 0;';
            label.innerHTML = `
                <input type="checkbox" class="domain-suffix-checkbox" value="${suffix}" style="width: 18px; height: 18px;">
                <span>${suffix}</span>
            `;
            suffixContainer.appendChild(label);
        });
    }
    
    // Generate button
    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            await generateDomains();
        });
    }
    
    // Check availability button
    if (checkAvailabilityBtn) {
        checkAvailabilityBtn.addEventListener('click', async () => {
            await checkDomainsAvailability();
        });
    }
}

// Generate domains
async function generateDomains() {
    const baseNameInput = document.getElementById('domain-base-name');
    const clientSelect = document.getElementById('domain-client-select');
    const generatedContainer = document.getElementById('domain-generated-list');
    
    if (!baseNameInput || !generatedContainer) return;
    
    const baseName = baseNameInput.value.trim();
    if (!baseName) {
        alert('Please enter a base name');
        return;
    }
    
    // Get selected prefixes and suffixes
    const selectedPrefixes = Array.from(document.querySelectorAll('.domain-prefix-checkbox:checked'))
        .map(cb => cb.value);
    const selectedSuffixes = Array.from(document.querySelectorAll('.domain-suffix-checkbox:checked'))
        .map(cb => cb.value);
    
    if (selectedPrefixes.length === 0 && selectedSuffixes.length === 0) {
        alert('Please select at least one prefix or suffix');
        return;
    }
    
    const client = clientSelect ? clientSelect.value : '';
    
    // Show loading
    generatedContainer.innerHTML = '<div class="loading">Generating domains...</div>';
    
    try {
        // Call generate-domains edge function
        const supabaseUrl = window.SUPABASE_URL;
        const supabaseKey = window.SUPABASE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not available');
        }
        
        const response = await fetch(`${supabaseUrl}/functions/v1/generate-domains`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                base_name: baseName,
                prefixes: selectedPrefixes,
                suffixes: selectedSuffixes,
                client: client || null,
                check_availability: false, // Don't check on initial generation
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate domains');
        }
        
        const data = await response.json();
        
        // Store generated domains
        domainGenerationData = {
            baseName: baseName,
            selectedPrefixes: selectedPrefixes,
            selectedSuffixes: selectedSuffixes,
            client: client,
            generatedDomains: data.domains || [],
        };
        
        // Render generated domains
        renderGeneratedDomains(data.domains || []);
        
    } catch (error) {
        console.error('Error generating domains:', error);
        generatedContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// Check domains availability
async function checkDomainsAvailability() {
    const generatedContainer = document.getElementById('domain-generated-list');
    const checkBtn = document.getElementById('domain-check-availability-btn');
    
    if (!generatedContainer || domainGenerationData.generatedDomains.length === 0) {
        alert('Please generate domains first');
        return;
    }
    
    // Show loading
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
    }
    
    domainGenerationData.checkingAvailability = true;
    updateDomainAvailabilityUI('checking');
    
    try {
        const supabaseUrl = window.SUPABASE_URL;
        const supabaseKey = window.SUPABASE_KEY;
        
        const domains = domainGenerationData.generatedDomains.map(d => d.domain);
        
        const response = await fetch(`${supabaseUrl}/functions/v1/check-domain-availability`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ domains }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to check availability');
        }
        
        const data = await response.json();
        
        // Update domains with availability
        const availabilityMap = {};
        data.results.forEach(result => {
            availabilityMap[result.domain] = result;
        });
        
        domainGenerationData.generatedDomains = domainGenerationData.generatedDomains.map(domainObj => {
            const availability = availabilityMap[domainObj.domain];
            return {
                ...domainObj,
                is_available: availability?.is_available ?? null,
                price: availability?.price ?? null,
                cached: availability?.cached ?? false,
            };
        });
        
        // Re-render with availability
        renderGeneratedDomains(domainGenerationData.generatedDomains);
        
    } catch (error) {
        console.error('Error checking availability:', error);
        alert(`Error: ${error.message}`);
    } finally {
        domainGenerationData.checkingAvailability = false;
        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.textContent = 'Check Availability';
        }
    }
}

// Render generated domains
function renderGeneratedDomains(domains) {
    const container = document.getElementById('domain-generated-list');
    if (!container) return;
    
    if (domains.length === 0) {
        container.innerHTML = '<div class="empty-state">No domains generated</div>';
        return;
    }
    
    const grid = document.createElement('div');
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; margin-top: 20px;';
    
    domains.forEach(domainObj => {
        const card = document.createElement('div');
        card.className = 'domain-card';
        card.style.cssText = `
            background: var(--color-surface);
            padding: 12px;
            border-radius: 8px;
            border: 1px solid var(--color-border-subtle);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        
        const domainName = domainObj.domain || domainObj;
        const isAvailable = domainObj.is_available;
        const price = domainObj.price;
        
        let statusColor = 'var(--color-text-muted)';
        let statusText = 'Not Checked';
        if (isAvailable === true) {
            statusColor = 'var(--color-accent-green)';
            statusText = 'Available';
        } else if (isAvailable === false) {
            statusColor = 'var(--color-accent-red)';
            statusText = 'Taken';
        } else if (domainGenerationData.checkingAvailability) {
            statusText = 'Checking...';
        }
        
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--color-text-strong); margin-bottom: 4px;">${domainName}</div>
                <div style="font-size: 0.85rem; color: ${statusColor};">${statusText}${price ? ` - $${price}` : ''}</div>
            </div>
            <div style="width: 12px; height: 12px; border-radius: 50%; background: ${statusColor};"></div>
        `;
        
        grid.appendChild(card);
    });
    
    container.innerHTML = '';
    container.appendChild(grid);
}

// Update domain availability UI state
function updateDomainAvailabilityUI(state) {
    const domains = domainGenerationData.generatedDomains;
    if (state === 'checking') {
        // Show checking state on all domains
        renderGeneratedDomains(domains.map(d => ({
            ...d,
            is_available: null,
        })));
    }
}

// Setup domain list UI
function setupDomainListUI() {
    const syncBtn = document.getElementById('infra-sync-domains');
    const clientFilter = document.getElementById('infra-domain-client-filter');
    const providerFilter = document.getElementById('infra-domain-provider-filter');
    
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            await syncDomainsFromPorkbun();
        });
    }
    
    if (clientFilter) {
        clientFilter.addEventListener('change', () => {
            loadDomainsList();
        });
    }
    
    if (providerFilter) {
        providerFilter.addEventListener('change', () => {
            loadDomainsList();
        });
    }
}

// Sync domains from Porkbun
async function syncDomainsFromPorkbun() {
    const syncBtn = document.getElementById('infra-sync-domains');
    
    if (syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'Syncing...';
    }
    
    try {
        const supabaseUrl = window.SUPABASE_URL;
        const supabaseKey = window.SUPABASE_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/sync-domains-porkbun`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sync domains');
        }
        
        const data = await response.json();
        alert(`Synced ${data.domains_synced || 0} domains successfully`);
        
        // Reload domains list
        loadDomainsList();
        
    } catch (error) {
        console.error('Error syncing domains:', error);
        alert(`Error: ${error.message}`);
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Sync Domains';
        }
    }
}

// Load domains list
async function loadDomainsList() {
    const tbody = document.getElementById('infra-domains-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Loading domains...</td></tr>';
    
    try {
        const client = window.getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }
        
        const clientFilter = document.getElementById('infra-domain-client-filter');
        const providerFilter = document.getElementById('infra-domain-provider-filter');
        const selectedClient = clientFilter ? clientFilter.value : '';
        const selectedProvider = providerFilter ? providerFilter.value : '';
        
        let query = client.from('domains').select('*').order('domain_name', { ascending: true });
        
        if (selectedClient) {
            query = query.eq('client', selectedClient);
        }
        if (selectedProvider) {
            query = query.eq('provider', selectedProvider);
        }
        
        const { data: domains, error } = await query;
        
        if (error) throw error;
        
        if (!domains || domains.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No domains found</td></tr>';
            return;
        }
        
        tbody.innerHTML = domains.map(domain => {
            const dnsStatus = getDNSStatus(domain);
            const providerName = domain.provider === 'porkbun' ? 'Porkbun' : 
                               domain.provider === 'inboxkit' ? 'InboxKit' : 
                               domain.provider === 'missioninbox' ? 'MissionInbox' : domain.provider;
            const statusColor = domain.status === 'active' ? 'var(--color-accent-green)' :
                               domain.status === 'expired' ? 'var(--color-accent-red)' :
                               'var(--color-text-muted)';
            const healthColor = domain.health_status === 'healthy' ? 'var(--color-accent-green)' :
                               domain.health_status === 'warning' ? 'var(--color-accent-orange)' :
                               domain.health_status === 'critical' ? 'var(--color-accent-red)' : 'var(--color-text-muted)';
            
            return `
                <tr>
                    <td><strong>${domain.domain_name}</strong></td>
                    <td>${providerName}</td>
                    <td><span style="color: ${statusColor};">${domain.status || 'unknown'}</span></td>
                    <td>${dnsStatus}</td>
                    <td><span style="color: ${healthColor};">${domain.health_status || 'unknown'}</span></td>
                    <td>
                        <button class="filter-btn" onclick="checkDomainDNS('${domain.id}')" style="padding: 4px 8px; font-size: 0.8rem;">Check DNS</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading domains:', error);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--color-accent-red);">Error: ${error.message}</td></tr>`;
    }
}

// Helper function to get DNS status
function getDNSStatus(domain) {
    const allConfigured = domain.spf_configured && domain.dkim_configured && domain.dmarc_configured;
    if (allConfigured) return '<span style="color: var(--color-accent-green);">✓ Complete</span>';
    if (domain.spf_configured || domain.dkim_configured || domain.dmarc_configured) {
        return '<span style="color: var(--color-accent-orange);">⚠ Partial</span>';
    }
    return '<span style="color: var(--color-text-muted);">✗ Not Configured</span>';
}

// Load client filter options
async function loadClientFilter() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: clients } = await client.from('Clients').select('Business');
        const clientSelect = document.getElementById('domain-client-select');
        const clientFilter = document.getElementById('infra-domain-client-filter');
        
        if (clientSelect && clients) {
            const uniqueClients = [...new Set(clients.map(c => c.Business).filter(Boolean))];
            clientSelect.innerHTML = '<option value="">All Clients</option>' + 
                uniqueClients.map(c => `<option value="${c}">${c}</option>`).join('');
        }
        
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
    window.initDomainsTab = initDomainsTab;
    window.loadDomainsList = loadDomainsList;
    window.syncDomainsFromPorkbun = syncDomainsFromPorkbun;
}

