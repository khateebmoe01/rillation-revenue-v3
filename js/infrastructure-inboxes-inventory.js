/**
 * Infrastructure - Inboxes Inventory Tab
 * Handles inbox inventory management with bulk operations
 */

(function() {
    'use strict';

    let supabaseClient = null;
    let selectedInboxes = new Set();

    /**
     * Initialize the Inboxes Inventory Tab
     */
    window.initInboxesInventory = async function() {
        console.log('📋 Initializing Inboxes Inventory Tab...');

        try {
            // Initialize Supabase client
            if (!supabaseClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
                supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            }

            // Load filter options
            await loadClientOptions();

            // Setup event listeners
            setupEventListeners();

            // Load inbox inventory
            await loadInventory();

            console.log('✅ Inboxes Inventory Tab initialized');
        } catch (error) {
            console.error('❌ Error initializing Inboxes Inventory Tab:', error);
        }
    };

    /**
     * Load client options for filter
     */
    async function loadClientOptions() {
        try {
            if (!supabaseClient) return;

            const { data: clients, error } = await supabaseClient
                .from('Clients')
                .select('client_id, client_name')
                .order('client_name');

            if (error) throw error;

            const clientFilter = document.getElementById('inbox-inventory-client-filter');
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
        // Apply filters button
        const applyFiltersBtn = document.getElementById('inbox-inventory-apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', loadInventory);
        }

        // Select all checkbox
        const selectAllCheckbox = document.getElementById('inbox-inventory-select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', toggleSelectAll);
        }

        // Select all button
        const selectAllBtn = document.getElementById('inbox-inventory-select-all');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const checkbox = document.getElementById('inbox-inventory-select-all-checkbox');
                if (checkbox) {
                    checkbox.checked = true;
                    toggleSelectAll({ target: checkbox });
                }
            });
        }
    }

    /**
     * Get current filter values
     */
    function getFilters() {
        const clientFilter = document.getElementById('inbox-inventory-client-filter');
        const providerFilter = document.getElementById('inbox-inventory-provider-filter');
        const statusFilter = document.getElementById('inbox-inventory-status-filter');
        const dateStartFilter = document.getElementById('inbox-inventory-date-start');
        const dateEndFilter = document.getElementById('inbox-inventory-date-end');

        return {
            client: clientFilter ? clientFilter.value : '',
            provider: providerFilter ? providerFilter.value : '',
            status: statusFilter ? statusFilter.value : '',
            dateStart: dateStartFilter ? dateStartFilter.value : '',
            dateEnd: dateEndFilter ? dateEndFilter.value : ''
        };
    }

    /**
     * Load inbox inventory
     */
    async function loadInventory() {
        try {
            if (!supabaseClient) {
                console.warn('Supabase client not initialized');
                return;
            }

            // Get filter values
            const filters = getFilters();

            // Build query
            let query = supabaseClient
                .from('inboxes')
                .select('*')
                .order('created_at', { ascending: false });

            if (filters.client) {
                query = query.eq('client_id', filters.client);
            }

            if (filters.provider) {
                query = query.eq('provider', filters.provider);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            if (filters.dateStart) {
                query = query.gte('created_at', filters.dateStart);
            }

            if (filters.dateEnd) {
                query = query.lte('created_at', filters.dateEnd + 'T23:59:59');
            }

            const { data: inboxes, error } = await query;

            if (error) throw error;

            displayInventory(inboxes || []);
        } catch (error) {
            console.error('Error loading inventory:', error);
            displayInventory([]);
        }
    }

    /**
     * Display inventory in table
     */
    function displayInventory(inboxes) {
        const tbody = document.getElementById('inbox-inventory-tbody');
        if (!tbody) return;

        if (inboxes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No inboxes found</td></tr>';
            return;
        }

        tbody.innerHTML = inboxes.map(inbox => {
            const statusColor = getStatusColor(inbox.status);
            const bounceRate = inbox.bounce_rate ? (inbox.bounce_rate * 100).toFixed(1) : '0.0';
            const isChecked = selectedInboxes.has(inbox.inbox_id) ? 'checked' : '';

            return `
                <tr>
                    <td>
                        <input type="checkbox"
                               class="inbox-checkbox"
                               data-inbox-id="${inbox.inbox_id}"
                               ${isChecked}
                               onchange="handleInboxCheckboxChange(this)">
                    </td>
                    <td style="font-family: monospace; font-size: 0.9rem;">
                        <strong style="color: var(--color-text-default);">${inbox.email || 'N/A'}</strong>
                    </td>
                    <td>${inbox.client_id || 'Unassigned'}</td>
                    <td>${inbox.provider || 'Unknown'}</td>
                    <td><span style="color: ${statusColor};">${inbox.status || 'unknown'}</span></td>
                    <td>${inbox.total_sends || 0}</td>
                    <td>${inbox.total_replies || 0}</td>
                    <td><span style="color: ${getBounceRateColor(bounceRate)};">${bounceRate}%</span></td>
                    <td>${inbox.daily_limit || 0}</td>
                    <td>
                        <button class="filter-btn"
                                onclick="viewInboxDetails('${inbox.inbox_id}')"
                                style="padding: 6px 12px; font-size: 0.85rem;">
                            View
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update select all checkbox state
        updateSelectAllCheckboxState();
    }

    /**
     * Get status color
     */
    function getStatusColor(status) {
        const colors = {
            'active': 'var(--color-accent-green)',
            'inactive': 'var(--color-accent-red)',
            'suspended': 'var(--color-accent-orange)',
            'warming': 'var(--color-accent-orange)'
        };
        return colors[status] || 'var(--color-text-muted)';
    }

    /**
     * Get bounce rate color
     */
    function getBounceRateColor(bounceRate) {
        const rate = parseFloat(bounceRate);
        if (rate < 2) return 'var(--color-accent-green)';
        if (rate < 5) return 'var(--color-accent-orange)';
        return 'var(--color-accent-red)';
    }

    /**
     * Toggle select all checkboxes
     */
    function toggleSelectAll(event) {
        const isChecked = event.target.checked;
        const checkboxes = document.querySelectorAll('.inbox-checkbox');

        checkboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            const inboxId = checkbox.getAttribute('data-inbox-id');
            if (isChecked) {
                selectedInboxes.add(inboxId);
            } else {
                selectedInboxes.delete(inboxId);
            }
        });

        updateBulkActionsVisibility();
    }

    /**
     * Handle individual checkbox change
     */
    window.handleInboxCheckboxChange = function(checkbox) {
        const inboxId = checkbox.getAttribute('data-inbox-id');
        if (checkbox.checked) {
            selectedInboxes.add(inboxId);
        } else {
            selectedInboxes.delete(inboxId);
        }

        updateSelectAllCheckboxState();
        updateBulkActionsVisibility();
    };

    /**
     * Update select all checkbox state based on individual selections
     */
    function updateSelectAllCheckboxState() {
        const selectAllCheckbox = document.getElementById('inbox-inventory-select-all-checkbox');
        if (!selectAllCheckbox) return;

        const checkboxes = document.querySelectorAll('.inbox-checkbox');
        const totalCheckboxes = checkboxes.length;
        const checkedCheckboxes = Array.from(checkboxes).filter(cb => cb.checked).length;

        if (checkedCheckboxes === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes === totalCheckboxes) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    /**
     * Update bulk actions visibility
     */
    function updateBulkActionsVisibility() {
        const bulkActionsContainer = document.getElementById('inbox-inventory-bulk-actions');
        if (!bulkActionsContainer) return;

        if (selectedInboxes.size > 0) {
            bulkActionsContainer.style.display = 'flex';
            bulkActionsContainer.innerHTML = `
                <span style="color: var(--color-text-muted); margin-right: 12px;">
                    ${selectedInboxes.size} inbox${selectedInboxes.size > 1 ? 'es' : ''} selected
                </span>
                <button class="filter-btn" onclick="bulkUpdateStatus()">
                    Update Status
                </button>
                <button class="filter-btn" onclick="bulkExport()">
                    Export Selected
                </button>
            `;
        } else {
            bulkActionsContainer.style.display = 'none';
        }
    }

    /**
     * Bulk update status (placeholder)
     */
    window.bulkUpdateStatus = function() {
        if (selectedInboxes.size === 0) {
            alert('No inboxes selected');
            return;
        }

        const newStatus = prompt('Enter new status (active/inactive/suspended):');
        if (!newStatus) return;

        console.log(`Updating ${selectedInboxes.size} inboxes to status: ${newStatus}`);
        alert(`This will update ${selectedInboxes.size} inbox(es) to status: ${newStatus}\n\nFeature coming soon!`);
    };

    /**
     * Bulk export selected inboxes (placeholder)
     */
    window.bulkExport = function() {
        if (selectedInboxes.size === 0) {
            alert('No inboxes selected');
            return;
        }

        console.log(`Exporting ${selectedInboxes.size} inboxes`);
        alert(`Exporting ${selectedInboxes.size} inbox(es)\n\nFeature coming soon!`);
    };

    /**
     * View inbox details (placeholder)
     */
    window.viewInboxDetails = function(inboxId) {
        console.log('Viewing inbox:', inboxId);
        alert(`Inbox details for ${inboxId}\n\nThis feature will be implemented soon.`);
    };

    // Auto-initialize logging
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 Infrastructure-inboxes-inventory.js loaded');
        });
    } else {
        console.log('📄 Infrastructure-inboxes-inventory.js loaded');
    }
})();
