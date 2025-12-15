// Infrastructure Inboxes Inventory Management
// List view and bulk management of inboxes

let selectedInboxes = new Set();
let inboxInventoryFilters = {
    client: '',
    provider: '',
    status: '',
    dateStart: '',
    dateEnd: '',
};

// Initialize Inboxes Inventory
function initInboxesInventory() {
    console.log('🚀 Initializing Inboxes Inventory...');
    
    setupInventoryFilters();
    setupBulkActions();
    loadInboxesInventory();
    loadClientFilter();
}

// Setup inventory filters
function setupInventoryFilters() {
    const clientFilter = document.getElementById('inbox-inventory-client-filter');
    const providerFilter = document.getElementById('inbox-inventory-provider-filter');
    const statusFilter = document.getElementById('inbox-inventory-status-filter');
    const dateStartFilter = document.getElementById('inbox-inventory-date-start');
    const dateEndFilter = document.getElementById('inbox-inventory-date-end');
    const applyFiltersBtn = document.getElementById('inbox-inventory-apply-filters');
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            updateInventoryFilters();
            loadInboxesInventory();
        });
    }
    
    // Auto-apply on filter change
    [clientFilter, providerFilter, statusFilter, dateStartFilter, dateEndFilter].forEach(filter => {
        if (filter) {
            filter.addEventListener('change', () => {
                updateInventoryFilters();
                loadInboxesInventory();
            });
        }
    });
}

// Update inventory filters
function updateInventoryFilters() {
    const clientFilter = document.getElementById('inbox-inventory-client-filter');
    const providerFilter = document.getElementById('inbox-inventory-provider-filter');
    const statusFilter = document.getElementById('inbox-inventory-status-filter');
    const dateStartFilter = document.getElementById('inbox-inventory-date-start');
    const dateEndFilter = document.getElementById('inbox-inventory-date-end');
    
    inboxInventoryFilters = {
        client: clientFilter ? clientFilter.value : '',
        provider: providerFilter ? providerFilter.value : '',
        status: statusFilter ? statusFilter.value : '',
        dateStart: dateStartFilter ? dateStartFilter.value : '',
        dateEnd: dateEndFilter ? dateEndFilter.value : '',
    };
}

// Setup bulk actions
function setupBulkActions() {
    const selectAllBtn = document.getElementById('inbox-inventory-select-all');
    const bulkStatusBtn = document.getElementById('inbox-inventory-bulk-status');
    const bulkClientBtn = document.getElementById('inbox-inventory-bulk-client');
    const exportBtn = document.getElementById('inbox-inventory-export');
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            toggleSelectAll();
        });
    }
    
    if (bulkStatusBtn) {
        bulkStatusBtn.addEventListener('click', () => {
            showBulkStatusModal();
        });
    }
    
    if (bulkClientBtn) {
        bulkClientBtn.addEventListener('click', () => {
            showBulkClientModal();
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportSelectedInboxes();
        });
    }
}

// Load inboxes inventory
async function loadInboxesInventory() {
    const tbody = document.getElementById('inbox-inventory-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="10" class="loading">Loading inboxes...</td></tr>';
    
    try {
        const client = window.getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }
        
        let query = client.from('inboxes').select('*').order('created_at', { ascending: false });
        
        if (inboxInventoryFilters.client) {
            query = query.eq('client', inboxInventoryFilters.client);
        }
        if (inboxInventoryFilters.provider) {
            query = query.eq('provider', inboxInventoryFilters.provider);
        }
        if (inboxInventoryFilters.status) {
            query = query.eq('status', inboxInventoryFilters.status);
        }
        
        const { data: inboxes, error } = await query;
        
        if (error) throw error;
        
        if (!inboxes || inboxes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No inboxes found</td></tr>';
            return;
        }
        
        // Get analytics for bounce rates
        const inboxIds = inboxes.map(i => i.bison_inbox_id).filter(Boolean);
        let healthMetrics = {};
        if (inboxIds.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const { data: metrics } = await client
                .from('inbox_analytics')
                .select('*')
                .in('inbox_id', inboxIds)
                .eq('date', today);
            
            if (metrics) {
                metrics.forEach(m => {
                    healthMetrics[m.inbox_id] = m;
                });
            }
        }
        
        tbody.innerHTML = inboxes.map(inbox => {
            const health = healthMetrics[inbox.bison_inbox_id] || {};
            const bounceRate = health.bounce_rate ? (health.bounce_rate * 100).toFixed(1) + '%' : '-';
            const bounceColor = health.bounce_rate > 0.05 ? 'var(--color-accent-red)' :
                               health.bounce_rate > 0.02 ? 'var(--color-accent-orange)' : 'var(--color-accent-green)';
            
            const providerName = inbox.provider === 'missioninbox' ? 'Mission Inbox' :
                                inbox.provider === 'inboxkit' ? 'InboxKit' :
                                inbox.provider || 'Bison';
            
            return `
                <tr>
                    <td>
                        <input type="checkbox" class="inbox-select-checkbox" value="${inbox.bison_inbox_id || inbox.id}" 
                               onchange="toggleInboxSelection('${inbox.bison_inbox_id || inbox.id}')">
                    </td>
                    <td><strong>${inbox.email || '-'}</strong></td>
                    <td>${inbox.client || '-'}</td>
                    <td>${providerName}</td>
                    <td><span style="color: ${inbox.status === 'active' ? 'var(--color-accent-green)' : 'var(--color-text-muted)'};">${inbox.status || 'unknown'}</span></td>
                    <td>${inbox.emails_sent_count || 0}</td>
                    <td>${inbox.total_replied_count || 0}</td>
                    <td><span style="color: ${bounceColor};">${bounceRate}</span></td>
                    <td>${inbox.daily_limit || 0}</td>
                    <td>
                        <button class="filter-btn" onclick="showInboxDetails('${inbox.bison_inbox_id || inbox.id}')" 
                                style="padding: 4px 8px; font-size: 0.8rem;">View</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading inboxes inventory:', error);
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: var(--color-accent-red);">Error: ${error.message}</td></tr>`;
    }
}

// Toggle inbox selection
function toggleInboxSelection(inboxId) {
    if (selectedInboxes.has(inboxId)) {
        selectedInboxes.delete(inboxId);
    } else {
        selectedInboxes.add(inboxId);
    }
    updateBulkActionsUI();
}

// Toggle select all
function toggleSelectAll() {
    const checkboxes = document.querySelectorAll('.inbox-select-checkbox');
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    
    checkboxes.forEach(cb => {
        cb.checked = !allSelected;
        const inboxId = cb.value;
        if (!allSelected) {
            selectedInboxes.add(inboxId);
        } else {
            selectedInboxes.delete(inboxId);
        }
    });
    
    updateBulkActionsUI();
}

// Update bulk actions UI
function updateBulkActionsUI() {
    const count = selectedInboxes.size;
    const bulkActionsContainer = document.getElementById('inbox-inventory-bulk-actions');
    
    if (bulkActionsContainer) {
        if (count > 0) {
            bulkActionsContainer.style.display = 'flex';
            bulkActionsContainer.innerHTML = `
                <span style="margin-right: 12px;">${count} selected</span>
                <button class="filter-btn" id="inbox-inventory-bulk-status">Update Status</button>
                <button class="filter-btn" id="inbox-inventory-bulk-client">Assign Client</button>
                <button class="filter-btn" id="inbox-inventory-export">Export</button>
            `;
            
            // Re-attach event listeners
            document.getElementById('inbox-inventory-bulk-status')?.addEventListener('click', showBulkStatusModal);
            document.getElementById('inbox-inventory-bulk-client')?.addEventListener('click', showBulkClientModal);
            document.getElementById('inbox-inventory-export')?.addEventListener('click', exportSelectedInboxes);
        } else {
            bulkActionsContainer.style.display = 'none';
        }
    }
}

// Show bulk status modal
function showBulkStatusModal() {
    // Implementation for bulk status update modal
    const status = prompt('Enter new status (active, inactive, suspended):');
    if (status && ['active', 'inactive', 'suspended'].includes(status.toLowerCase())) {
        updateBulkStatus(Array.from(selectedInboxes), status);
    }
}

// Show bulk client modal
function showBulkClientModal() {
    // Implementation for bulk client assignment modal
    const client = prompt('Enter client name:');
    if (client) {
        updateBulkClient(Array.from(selectedInboxes), client);
    }
}

// Update bulk status
async function updateBulkStatus(inboxIds, status) {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        // Update inboxes
        const { error } = await client
            .from('inboxes')
            .update({ status: status })
            .in('bison_inbox_id', inboxIds);
        
        if (error) throw error;
        
        alert(`Updated ${inboxIds.length} inboxes to status: ${status}`);
        selectedInboxes.clear();
        loadInboxesInventory();
        
    } catch (error) {
        console.error('Error updating bulk status:', error);
        alert(`Error: ${error.message}`);
    }
}

// Update bulk client
async function updateBulkClient(inboxIds, clientName) {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        // Update inboxes
        const { error } = await client
            .from('inboxes')
            .update({ client: clientName })
            .in('bison_inbox_id', inboxIds);
        
        if (error) throw error;
        
        alert(`Assigned ${inboxIds.length} inboxes to client: ${clientName}`);
        selectedInboxes.clear();
        loadInboxesInventory();
        
    } catch (error) {
        console.error('Error updating bulk client:', error);
        alert(`Error: ${error.message}`);
    }
}

// Export selected inboxes
function exportSelectedInboxes() {
    if (selectedInboxes.size === 0) {
        alert('Please select inboxes to export');
        return;
    }
    
    // Implementation for CSV export
    alert(`Exporting ${selectedInboxes.size} inboxes...`);
    // Would implement actual CSV export here
}

// Show inbox details
async function showInboxDetails(inboxId) {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: inbox, error } = await client
            .from('inboxes')
            .select('*')
            .eq('bison_inbox_id', inboxId)
            .single();
        
        if (error) throw error;
        
        // Get analytics
        const { data: analytics } = await client
            .from('inbox_analytics')
            .select('*')
            .eq('inbox_id', inboxId)
            .order('date', { ascending: false })
            .limit(30);
        
        // Show modal
        const modal = document.getElementById('inbox-details-modal');
        if (modal) {
            const body = document.getElementById('inbox-details-body');
            if (body) {
                body.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <strong>Email:</strong> ${inbox.email || '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Client:</strong> ${inbox.client || '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Status:</strong> ${inbox.status || '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Daily Limit:</strong> ${inbox.daily_limit || 0}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Emails Sent:</strong> ${inbox.emails_sent_count || 0}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Replies:</strong> ${inbox.total_replied_count || 0}
                    </div>
                    ${analytics && analytics.length > 0 ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-subtle);">
                            <strong>Recent Analytics:</strong>
                            <table class="data-table" style="margin-top: 12px;">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Emails Sent</th>
                                        <th>Replies</th>
                                        <th>Bounce Rate</th>
                                        <th>Deliverability</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${analytics.map(a => `
                                        <tr>
                                            <td>${a.date}</td>
                                            <td>${a.emails_sent || 0}</td>
                                            <td>${a.replies_received || 0}</td>
                                            <td>${(a.bounce_rate * 100).toFixed(1)}%</td>
                                            <td>${a.deliverability_score?.toFixed(1) || 0}%</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}
                `;
            }
            modal.classList.add('active');
        }
        
    } catch (error) {
        console.error('Error loading inbox details:', error);
        alert(`Error: ${error.message}`);
    }
}

// Load client filter
async function loadClientFilter() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: clients } = await client.from('Clients').select('Business');
        const clientFilter = document.getElementById('inbox-inventory-client-filter');
        
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
    window.initInboxesInventory = initInboxesInventory;
    window.loadInboxesInventory = loadInboxesInventory;
    window.toggleInboxSelection = toggleInboxSelection;
    window.showInboxDetails = showInboxDetails;
}

