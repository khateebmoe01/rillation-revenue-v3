// Targets Configuration - Manage client targets for Quick View

// Get Supabase client
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

// Get targets from Supabase client_targets table
async function getTargets() {
    try {
        const client = getSupabaseClient();
        if (!client) {
            console.warn('⚠️ Supabase client not available, returning empty targets');
            return {};
        }
        
        console.log('📥 Querying client_targets table...');
        const { data, error } = await client
            .from('client_targets')
            .select('*');
        
        if (error) {
            console.error('❌ Error loading targets from Supabase:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details });
            return {};
        }
        
        console.log('📊 Raw targets data from Supabase:', data);
        console.log('📊 Number of rows:', data?.length || 0);
        
        // Convert array to object format: { clientName: { emails_per_day: ..., ... } }
        const targetsObj = {};
        (data || []).forEach(row => {
            if (!row.client) {
                console.warn('⚠️ Row missing client field:', row);
                return;
            }
            
            targetsObj[row.client] = {
                emails_per_day: row.emails_per_day != null ? parseFloat(row.emails_per_day) : null,
                prospects_per_day: row.prospects_per_day != null ? parseFloat(row.prospects_per_day) : null,
                replies_per_day: row.replies_per_day != null ? parseFloat(row.replies_per_day) : null,
                bounces_per_day: row.bounces_per_day != null ? parseFloat(row.bounces_per_day) : null,
                meetings_per_day: row.meetings_per_day != null ? parseFloat(row.meetings_per_day) : null
            };
            
            console.log(`✅ Loaded targets for ${row.client}:`, targetsObj[row.client]);
        });
        
        console.log('✅ Targets loaded from Supabase:', Object.keys(targetsObj).length, 'clients');
        console.log('📋 Final targets object:', targetsObj);
        return targetsObj;
    } catch (err) {
        console.error('❌ Exception loading targets from Supabase:', err);
        console.error('Error stack:', err.stack);
        return {};
    }
}

// Save targets to Supabase client_targets table
async function saveTargets(targets) {
    try {
        const client = getSupabaseClient();
        if (!client) {
            const errorMsg = 'Database connection not available. Please refresh the page.';
            console.error('❌ Supabase client not available');
            alert(errorMsg);
            return false;
        }
        
        // Convert object format to array for upsert
        const targetsArray = Object.keys(targets).map(clientName => ({
            client: clientName,
            emails_per_day: parseFloat(targets[clientName].emails_per_day) || 0,
            prospects_per_day: parseFloat(targets[clientName].prospects_per_day) || 0,
            replies_per_day: parseFloat(targets[clientName].replies_per_day) || 0,
            bounces_per_day: parseFloat(targets[clientName].bounces_per_day) || 0, // Keep for backward compatibility
            meetings_per_day: parseFloat(targets[clientName].meetings_per_day) || 0
        }));
        
        if (targetsArray.length === 0) {
            console.warn('⚠️ No targets to save');
            return false;
        }
        
        console.log('💾 Saving targets to Supabase:', targetsArray);
        
        const { data, error } = await client
            .from('client_targets')
            .upsert(targetsArray, { onConflict: 'client' });
        
        if (error) {
            const errorMsg = error.message || 'Unknown error occurred';
            const errorDetails = error.details || error.hint || '';
            const fullError = `Error saving targets: ${errorMsg}${errorDetails ? '\n' + errorDetails : ''}`;
            
            console.error('❌ Error saving targets to Supabase:', error);
            console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
            
            alert(fullError + '\n\nPlease check the browser console (F12) for more details.');
            return false;
        }
        
        console.log('✅ Targets saved to Supabase:', targetsArray.length, 'clients');
        return true;
    } catch (err) {
        const errorMsg = err.message || 'Unknown error occurred';
        console.error('❌ Exception saving targets to Supabase:', err);
        console.error('Error stack:', err.stack);
        alert(`Error saving targets: ${errorMsg}\n\nPlease check the browser console (F12) for more details.`);
        return false;
    }
}

// Get target for a specific client and metric
async function getTarget(clientName, metric, dateRangeDays = 1) {
    const targets = await getTargets();
    if (!targets[clientName]) {
        return null;
    }
    
    const clientTargets = targets[clientName];
    const dailyTarget = clientTargets[`${metric}_per_day`] || 0;
    
    // Calculate target for date range
    return dailyTarget * dateRangeDays;
}

// Initialize targets modal
function initTargetsModal() {
    const modal = document.getElementById('targets-modal');
    const openBtn = document.getElementById('qv-configure-targets');
    const closeBtn = document.getElementById('targets-modal-close');
    const cancelBtn = document.getElementById('targets-modal-cancel');
    const saveBtn = document.getElementById('targets-modal-save');
    
    if (!modal || !openBtn) {
        console.warn('⚠️ Targets modal elements not found');
        return;
    }
    
    // Open modal
    openBtn.addEventListener('click', () => {
        loadTargetsModal();
        modal.classList.add('active');
    });
    
    // Close modal
    const closeModal = () => {
        modal.classList.remove('active');
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Save targets
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveTargetsFromModal();
            closeModal();
        });
    }
}

// Load clients and populate targets modal
async function loadTargetsModal() {
    const modalBody = document.getElementById('targets-modal-body');
    if (!modalBody) {
        console.error('❌ Targets modal body not found');
        return;
    }
    
    modalBody.innerHTML = '<div class="loading">Loading clients...</div>';
    
    try {
        // Get Supabase client
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }
        
        // Load clients from Clients table
        let { data, error } = await client
            .from('Clients')
            .select('Business');
        
        if (error) {
            // Try lowercase
            const result = await client
                .from('clients')
                .select('Business');
            data = result.data;
            error = result.error;
        }
        
        if (error) {
            // Fallback: get from campaign_reporting table
            const fallback = await client
                .from('campaign_reporting')
                .select('client')
                .not('client', 'is', null);
            
            if (fallback.error) {
                throw fallback.error;
            }
            
            const clients = [...new Set(fallback.data.map(c => c.client).filter(Boolean))];
            populateTargetsModal(clients);
            return;
        }
        
        // Extract client names
        const clients = data
            .map(row => row.Business || row.business || row.name || row.client_name || row.client)
            .filter(Boolean)
            .filter((value, index, self) => self.indexOf(value) === index)
            .sort();
        
        populateTargetsModal(clients);
    } catch (err) {
        console.error('Error loading clients for targets:', err);
        modalBody.innerHTML = `<div class="error">Error loading clients: ${err.message}</div>`;
    }
}

// Populate targets modal with client forms
async function populateTargetsModal(clients) {
    const modalBody = document.getElementById('targets-modal-body');
    if (!modalBody) {
        console.error('❌ Targets modal body not found');
        return;
    }
    
    console.log('📥 Loading targets from Supabase...');
    const targets = await getTargets();
    console.log('✅ Targets loaded:', targets);
    console.log('📊 Number of clients with targets:', Object.keys(targets).length);
    
    if (clients.length === 0) {
        modalBody.innerHTML = '<div class="empty-state">No clients found</div>';
        return;
    }
    
    modalBody.innerHTML = clients.map(clientName => {
        const clientTargets = targets[clientName] || {};
        
        // Log for debugging
        console.log(`📋 Client: ${clientName}, Targets:`, clientTargets);
        
        // Format values - use empty string if 0 or null/undefined
        const formatValue = (val) => {
            if (val === null || val === undefined || val === 0) return '';
            return val;
        };
        
        return `
            <div class="targets-client-section" data-client="${clientName}">
                <div class="targets-client-header">${clientName}</div>
                <div class="targets-metrics-grid">
                    <div class="targets-metric-input">
                        <label>Emails per Day</label>
                        <input type="number" 
                               data-client="${clientName}" 
                               data-metric="emails" 
                               value="${formatValue(clientTargets.emails_per_day)}" 
                               placeholder="0"
                               min="0">
                    </div>
                    <div class="targets-metric-input">
                        <label>Prospects per Day</label>
                        <input type="number" 
                               data-client="${clientName}" 
                               data-metric="prospects" 
                               value="${formatValue(clientTargets.prospects_per_day)}" 
                               placeholder="0"
                               min="0">
                    </div>
                    <div class="targets-metric-input">
                        <label>Replies per Day</label>
                        <input type="number" 
                               data-client="${clientName}" 
                               data-metric="replies" 
                               value="${formatValue(clientTargets.replies_per_day)}" 
                               placeholder="0"
                               min="0">
                    </div>
                    <div class="targets-metric-input">
                        <label>Bounces per Day</label>
                        <input type="number" 
                               data-client="${clientName}" 
                               data-metric="bounces" 
                               value="${formatValue(clientTargets.bounces_per_day)}" 
                               placeholder="0"
                               min="0">
                    </div>
                    <div class="targets-metric-input">
                        <label>Meetings per Day</label>
                        <input type="number" 
                               data-client="${clientName}" 
                               data-metric="meetings" 
                               value="${formatValue(clientTargets.meetings_per_day)}" 
                               placeholder="0"
                               min="0">
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('✅ Targets modal populated with', clients.length, 'clients');
}

// Save targets from modal form
async function saveTargetsFromModal() {
    const targets = {};
    const inputs = document.querySelectorAll('#targets-modal-body input[type="number"]');
    
    inputs.forEach(input => {
        const clientName = input.getAttribute('data-client');
        const metric = input.getAttribute('data-metric');
        const value = parseFloat(input.value) || 0;
        
        if (!targets[clientName]) {
            targets[clientName] = {};
        }
        
        targets[clientName][`${metric}_per_day`] = value;
    });
    
    const success = await saveTargets(targets);
    if (success) {
        console.log('✅ Targets saved successfully');
        // Trigger Quick View refresh if it's active
        if (window.loadQuickViewData) {
            window.loadQuickViewData();
        }
    } else {
        alert('Error saving targets. Please try again.');
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.getTargets = getTargets;
    window.saveTargets = saveTargets;
    window.getTarget = getTarget;
    window.initTargetsModal = initTargetsModal;
    window.loadTargetsModal = loadTargetsModal;
    
    console.log('✅ Targets configuration functions exposed');
}

