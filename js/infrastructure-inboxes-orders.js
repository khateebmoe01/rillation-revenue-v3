/**
 * Infrastructure - Inboxes Order Management Tab
 * Handles bulk inbox ordering and order history
 */

(function() {
    'use strict';

    let supabaseClient = null;

    /**
     * Initialize the Inboxes Orders Tab
     */
    window.initInboxesOrders = async function() {
        console.log('📦 Initializing Inboxes Orders Tab...');

        try {
            // Initialize Supabase client
            if (!supabaseClient && window.SUPABASE_URL && window.SUPABASE_KEY) {
                supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            }

            // Load dropdown options
            await loadProviderOptions();
            await loadDomainOptions();
            await loadClientOptions();

            // Setup event listeners
            setupEventListeners();

            // Load order history
            await loadOrderHistory();

            console.log('✅ Inboxes Orders Tab initialized');
        } catch (error) {
            console.error('❌ Error initializing Inboxes Orders Tab:', error);
        }
    };

    /**
     * Load provider options
     */
    async function loadProviderOptions() {
        try {
            if (!supabaseClient) return;

            const { data: providers, error } = await supabaseClient
                .from('inbox_providers')
                .select('provider_id, provider_name')
                .order('provider_name');

            if (error) throw error;

            const providerSelect = document.getElementById('inbox-order-provider');
            if (providerSelect && providers) {
                providerSelect.innerHTML = '<option value="">Select Provider</option>' +
                    providers.map(p => `<option value="${p.provider_id}">${p.provider_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading providers:', error);
            // Fallback to hardcoded providers
            const providerSelect = document.getElementById('inbox-order-provider');
            if (providerSelect) {
                providerSelect.innerHTML = `
                    <option value="">Select Provider</option>
                    <option value="missioninbox">Mission Inbox</option>
                    <option value="inboxkit">InboxKit</option>
                    <option value="bison">Bison</option>
                `;
            }
        }
    }

    /**
     * Load domain options
     */
    async function loadDomainOptions() {
        try {
            if (!supabaseClient) return;

            const { data: domains, error } = await supabaseClient
                .from('domains')
                .select('domain_id, domain_name, status')
                .eq('status', 'active')
                .order('domain_name');

            if (error) throw error;

            const domainSelect = document.getElementById('inbox-order-domain');
            if (domainSelect && domains) {
                domainSelect.innerHTML = '<option value="">Select Domain</option>' +
                    domains.map(d => `<option value="${d.domain_id}">${d.domain_name}</option>`).join('');
            }
        } catch (error) {
            console.error('Error loading domains:', error);
        }
    }

    /**
     * Load client options
     */
    async function loadClientOptions() {
        try {
            if (!supabaseClient) return;

            const { data: clients, error } = await supabaseClient
                .from('Clients')
                .select('client_id, client_name')
                .order('client_name');

            if (error) throw error;

            const clientSelect = document.getElementById('inbox-order-client');
            if (clientSelect && clients) {
                clientSelect.innerHTML = '<option value="">Select Client</option>' +
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
        // Preview order button
        const previewBtn = document.getElementById('inbox-order-preview');
        if (previewBtn) {
            previewBtn.addEventListener('click', previewOrder);
        }

        // Place order button
        const submitBtn = document.getElementById('inbox-order-submit');
        if (submitBtn) {
            submitBtn.addEventListener('click', placeOrder);
        }

        // Update cost estimate when quantity changes
        const quantityInput = document.getElementById('inbox-order-quantity');
        if (quantityInput) {
            quantityInput.addEventListener('input', updateCostEstimate);
        }
    }

    /**
     * Preview order
     */
    function previewOrder() {
        const provider = document.getElementById('inbox-order-provider')?.value;
        const quantity = document.getElementById('inbox-order-quantity')?.value;
        const domain = document.getElementById('inbox-order-domain')?.value;
        const client = document.getElementById('inbox-order-client')?.value;

        const previewContainer = document.getElementById('inbox-order-preview-container');
        if (!previewContainer) return;

        // Validation
        if (!provider || !quantity || !domain || !client) {
            previewContainer.innerHTML = `
                <div style="padding: 20px; background: var(--color-surface-subtle); border-radius: 8px; color: var(--color-text-muted);">
                    <p>Please fill in all fields to preview the order</p>
                </div>
            `;
            return;
        }

        const quantityNum = parseInt(quantity);
        if (quantityNum < 100) {
            previewContainer.innerHTML = `
                <div style="padding: 20px; background: var(--color-surface-subtle); border-radius: 8px; color: var(--color-accent-red);">
                    <p>⚠️ Minimum quantity is 100 inboxes</p>
                </div>
            `;
            return;
        }

        // Get selected option texts
        const providerText = document.getElementById('inbox-order-provider')?.selectedOptions[0]?.text || provider;
        const domainText = document.getElementById('inbox-order-domain')?.selectedOptions[0]?.text || domain;
        const clientText = document.getElementById('inbox-order-client')?.selectedOptions[0]?.text || client;

        // Calculate cost (placeholder pricing)
        const costPerInbox = 0.50;
        const totalCost = (quantityNum * costPerInbox).toFixed(2);

        previewContainer.innerHTML = `
            <div style="padding: 20px; background: var(--color-surface-subtle); border-radius: 8px;">
                <h4 style="margin-bottom: 16px; color: var(--color-text-default);">Order Summary</h4>
                <div style="display: grid; gap: 12px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-muted);">Provider:</span>
                        <span style="color: var(--color-text-default); font-weight: 500;">${providerText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-muted);">Client:</span>
                        <span style="color: var(--color-text-default); font-weight: 500;">${clientText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-muted);">Domain:</span>
                        <span style="color: var(--color-text-default); font-weight: 500;">${domainText}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-muted);">Quantity:</span>
                        <span style="color: var(--color-text-default); font-weight: 500;">${quantityNum} inboxes</span>
                    </div>
                    <div style="height: 1px; background: var(--color-border-muted); margin: 8px 0;"></div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: var(--color-text-default); font-weight: 600;">Estimated Cost:</span>
                        <span style="color: var(--color-accent-green); font-weight: 600; font-size: 1.1rem;">$${totalCost}</span>
                    </div>
                    <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 8px;">
                        💡 ${costPerInbox} per inbox
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Update cost estimate
     */
    function updateCostEstimate() {
        // Trigger preview update
        previewOrder();
    }

    /**
     * Place order
     */
    async function placeOrder() {
        const provider = document.getElementById('inbox-order-provider')?.value;
        const quantity = document.getElementById('inbox-order-quantity')?.value;
        const domain = document.getElementById('inbox-order-domain')?.value;
        const client = document.getElementById('inbox-order-client')?.value;

        // Validation
        if (!provider || !quantity || !domain || !client) {
            alert('Please fill in all fields');
            return;
        }

        const quantityNum = parseInt(quantity);
        if (quantityNum < 100) {
            alert('Minimum quantity is 100 inboxes');
            return;
        }

        const submitBtn = document.getElementById('inbox-order-submit');
        if (submitBtn) {
            submitBtn.textContent = 'Placing Order...';
            submitBtn.disabled = true;
        }

        try {
            if (!supabaseClient) {
                throw new Error('Supabase client not available');
            }

            // Calculate cost
            const costPerInbox = 0.50;
            const totalCost = quantityNum * costPerInbox;

            // Create order record
            const { data, error } = await supabaseClient
                .from('inbox_orders')
                .insert({
                    provider_id: provider,
                    client_id: client,
                    domain_id: domain,
                    quantity: quantityNum,
                    status: 'pending',
                    total_cost: totalCost,
                    order_date: new Date().toISOString()
                })
                .select();

            if (error) throw error;

            console.log('✅ Order placed successfully:', data);
            alert('Order placed successfully! The provider will process your order shortly.');

            // Clear form
            document.getElementById('inbox-order-provider').value = '';
            document.getElementById('inbox-order-quantity').value = '100';
            document.getElementById('inbox-order-domain').value = '';
            document.getElementById('inbox-order-client').value = '';
            document.getElementById('inbox-order-preview-container').innerHTML = '';

            // Reload order history
            await loadOrderHistory();

        } catch (error) {
            console.error('❌ Error placing order:', error);
            alert('Error placing order: ' + error.message);
        } finally {
            if (submitBtn) {
                submitBtn.textContent = 'Place Order';
                submitBtn.disabled = false;
            }
        }
    }

    /**
     * Load order history
     */
    async function loadOrderHistory() {
        try {
            if (!supabaseClient) {
                console.warn('Supabase client not initialized');
                return;
            }

            const { data: orders, error } = await supabaseClient
                .from('inbox_orders')
                .select(`
                    *,
                    inbox_providers (provider_name),
                    Clients (client_name),
                    domains (domain_name)
                `)
                .order('order_date', { ascending: false });

            if (error) throw error;

            displayOrderHistory(orders || []);
        } catch (error) {
            console.error('Error loading order history:', error);
            displayOrderHistory([]);
        }
    }

    /**
     * Display order history in table
     */
    function displayOrderHistory(orders) {
        const tbody = document.getElementById('inbox-orders-history-tbody');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No orders found</td></tr>';
            return;
        }

        tbody.innerHTML = orders.map(order => {
            const providerName = order.inbox_providers?.provider_name || order.provider_id || 'Unknown';
            const clientName = order.Clients?.client_name || order.client_id || 'Unknown';
            const domainName = order.domains?.domain_name || order.domain_id || 'Unknown';
            const statusColor = getOrderStatusColor(order.status);
            const orderNumber = order.order_number || order.order_id || 'N/A';

            return `
                <tr>
                    <td><strong style="color: var(--color-text-default);">${orderNumber}</strong></td>
                    <td>${providerName}</td>
                    <td>${clientName}</td>
                    <td>${order.quantity || 0}</td>
                    <td style="font-family: monospace; font-size: 0.9rem;">${domainName}</td>
                    <td><span style="color: ${statusColor};">${order.status || 'unknown'}</span></td>
                    <td style="font-weight: 600;">$${(order.total_cost || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Get order status color
     */
    function getOrderStatusColor(status) {
        const colors = {
            'pending': 'var(--color-accent-orange)',
            'processing': 'var(--color-accent-orange)',
            'completed': 'var(--color-accent-green)',
            'failed': 'var(--color-accent-red)',
            'cancelled': 'var(--color-text-muted)'
        };
        return colors[status] || 'var(--color-text-muted)';
    }

    // Auto-initialize logging
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('📄 Infrastructure-inboxes-orders.js loaded');
        });
    } else {
        console.log('📄 Infrastructure-inboxes-orders.js loaded');
    }
})();
