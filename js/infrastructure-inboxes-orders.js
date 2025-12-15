// Infrastructure Inboxes Order Management
// Handles bulk inbox ordering with Mission Inbox and InboxKit

let orderFormData = {
    provider: '',
    quantity: 100,
    domain: '',
    client: '',
};

// Initialize Inboxes Orders
function initInboxesOrders() {
    console.log('🚀 Initializing Inboxes Orders...');
    
    setupOrderForm();
    loadOrderHistory();
    loadDomainOptions();
    loadClientOptions();
}

// Setup order form
function setupOrderForm() {
    const providerSelect = document.getElementById('inbox-order-provider');
    const quantityInput = document.getElementById('inbox-order-quantity');
    const domainSelect = document.getElementById('inbox-order-domain');
    const clientSelect = document.getElementById('inbox-order-client');
    const submitBtn = document.getElementById('inbox-order-submit');
    const previewBtn = document.getElementById('inbox-order-preview');
    
    // Quantity validation
    if (quantityInput) {
        quantityInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value < 100) {
                e.target.setCustomValidity('Minimum order quantity is 100');
            } else {
                e.target.setCustomValidity('');
            }
        });
    }
    
    // Preview button
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            showOrderPreview();
        });
    }
    
    // Submit button
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            await submitOrder();
        });
    }
    
    // Load provider options
    loadProviderOptions();
}

// Load provider options
async function loadProviderOptions() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: providers } = await client
            .from('inbox_providers')
            .select('provider_name, is_active')
            .eq('is_active', true);
        
        const providerSelect = document.getElementById('inbox-order-provider');
        if (providerSelect && providers) {
            providerSelect.innerHTML = '<option value="">Select Provider</option>' +
                providers.map(p => `<option value="${p.provider_name}">${p.provider_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading providers:', error);
    }
}

// Load domain options
async function loadDomainOptions() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: domains } = await client
            .from('domains')
            .select('domain_name, status')
            .eq('status', 'active')
            .order('domain_name', { ascending: true });
        
        const domainSelect = document.getElementById('inbox-order-domain');
        if (domainSelect && domains) {
            domainSelect.innerHTML = '<option value="">Select Domain</option>' +
                domains.map(d => `<option value="${d.domain_name}">${d.domain_name}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading domains:', error);
    }
}

// Load client options
async function loadClientOptions() {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: clients } = await client.from('Clients').select('Business');
        const clientSelect = document.getElementById('inbox-order-client');
        
        if (clientSelect && clients) {
            const uniqueClients = [...new Set(clients.map(c => c.Business).filter(Boolean))];
            clientSelect.innerHTML = '<option value="">Select Client</option>' +
                uniqueClients.map(c => `<option value="${c}">${c}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

// Show order preview
function showOrderPreview() {
    const providerSelect = document.getElementById('inbox-order-provider');
    const quantityInput = document.getElementById('inbox-order-quantity');
    const domainSelect = document.getElementById('inbox-order-domain');
    const clientSelect = document.getElementById('inbox-order-client');
    const previewContainer = document.getElementById('inbox-order-preview-container');
    
    if (!previewContainer) return;
    
    const provider = providerSelect ? providerSelect.value : '';
    const quantity = quantityInput ? parseInt(quantityInput.value) || 0 : 0;
    const domain = domainSelect ? domainSelect.value : '';
    const client = clientSelect ? clientSelect.value : '';
    
    if (!provider || !quantity || !domain || !client) {
        previewContainer.innerHTML = '<div class="error">Please fill in all fields</div>';
        return;
    }
    
    if (quantity < 100) {
        previewContainer.innerHTML = '<div class="error">Minimum order quantity is 100</div>';
        return;
    }
    
    // Estimate cost (placeholder - would need actual pricing from providers)
    const estimatedCost = quantity * 0.50; // $0.50 per inbox estimate
    
    previewContainer.innerHTML = `
        <div style="background: var(--color-surface); padding: 20px; border-radius: 8px; border: 1px solid var(--color-border-subtle);">
            <h3 style="margin-bottom: 16px;">Order Preview</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                    <strong>Provider:</strong> ${provider}
                </div>
                <div>
                    <strong>Quantity:</strong> ${quantity.toLocaleString()} inboxes
                </div>
                <div>
                    <strong>Domain:</strong> ${domain}
                </div>
                <div>
                    <strong>Client:</strong> ${client}
                </div>
                <div style="grid-column: 1 / -1; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border-subtle);">
                    <strong>Estimated Cost:</strong> $${estimatedCost.toFixed(2)}
                </div>
            </div>
        </div>
    `;
}

// Submit order
async function submitOrder() {
    const providerSelect = document.getElementById('inbox-order-provider');
    const quantityInput = document.getElementById('inbox-order-quantity');
    const domainSelect = document.getElementById('inbox-order-domain');
    const clientSelect = document.getElementById('inbox-order-client');
    const submitBtn = document.getElementById('inbox-order-submit');
    
    const provider = providerSelect ? providerSelect.value : '';
    const quantity = quantityInput ? parseInt(quantityInput.value) || 0 : 0;
    const domain = domainSelect ? domainSelect.value : '';
    const client = clientSelect ? clientSelect.value : '';
    
    if (!provider || !quantity || !domain || !client) {
        alert('Please fill in all fields');
        return;
    }
    
    if (quantity < 100) {
        alert('Minimum order quantity is 100 inboxes');
        return;
    }
    
    if (!confirm(`Place order for ${quantity.toLocaleString()} inboxes with ${provider}?`)) {
        return;
    }
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Placing Order...';
    }
    
    try {
        const supabaseUrl = window.SUPABASE_URL;
        const supabaseKey = window.SUPABASE_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/order-inboxes-bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider,
                quantity,
                domain,
                client,
            }),
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to place order');
        }
        
        const data = await response.json();
        
        alert(`Order placed successfully! Order Number: ${data.order_number}`);
        
        // Reset form
        if (quantityInput) quantityInput.value = '100';
        if (domainSelect) domainSelect.value = '';
        if (clientSelect) clientSelect.value = '';
        if (providerSelect) providerSelect.value = '';
        
        // Reload order history
        loadOrderHistory();
        
    } catch (error) {
        console.error('Error placing order:', error);
        alert(`Error: ${error.message}`);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Place Order';
        }
    }
}

// Load order history
async function loadOrderHistory() {
    const tbody = document.getElementById('inbox-orders-history-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading orders...</td></tr>';
    
    try {
        const client = window.getSupabaseClient();
        if (!client) {
            throw new Error('Supabase client not available');
        }
        
        const { data: orders, error } = await client
            .from('inbox_orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No orders found</td></tr>';
            return;
        }
        
        tbody.innerHTML = orders.map(order => {
            const statusColor = order.status === 'completed' ? 'var(--color-accent-green)' :
                               order.status === 'processing' ? 'var(--color-accent-orange)' :
                               order.status === 'failed' ? 'var(--color-accent-red)' :
                               'var(--color-text-muted)';
            
            return `
                <tr>
                    <td><strong>${order.order_number}</strong></td>
                    <td>${order.provider}</td>
                    <td>${order.client || '-'}</td>
                    <td>${order.quantity.toLocaleString()}</td>
                    <td>${order.domain || '-'}</td>
                    <td><span style="color: ${statusColor};">${order.status}</span></td>
                    <td>
                        ${order.total_cost ? `$${order.total_cost.toFixed(2)}` : '-'}
                        <button class="filter-btn" onclick="showOrderDetails('${order.id}')" style="padding: 4px 8px; font-size: 0.8rem; margin-left: 8px;">Details</button>
                    </td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading order history:', error);
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--color-accent-red);">Error: ${error.message}</td></tr>`;
    }
}

// Show order details
async function showOrderDetails(orderId) {
    try {
        const client = window.getSupabaseClient();
        if (!client) return;
        
        const { data: order, error } = await client
            .from('inbox_orders')
            .select('*')
            .eq('id', orderId)
            .single();
        
        if (error) throw error;
        
        // Show modal with order details
        const modal = document.getElementById('order-details-modal');
        if (modal) {
            const body = document.getElementById('order-details-body');
            if (body) {
                body.innerHTML = `
                    <div style="margin-bottom: 16px;">
                        <strong>Order Number:</strong> ${order.order_number}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Provider:</strong> ${order.provider}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Client:</strong> ${order.client || '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Quantity:</strong> ${order.quantity.toLocaleString()}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Domain:</strong> ${order.domain || '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Status:</strong> ${order.status}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Inboxes Created:</strong> ${order.inboxes_created || 0}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Total Cost:</strong> ${order.total_cost ? `$${order.total_cost.toFixed(2)}` : '-'}
                    </div>
                    <div style="margin-bottom: 16px;">
                        <strong>Created:</strong> ${new Date(order.created_at).toLocaleString()}
                    </div>
                    ${order.order_data ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--color-border-subtle);">
                            <strong>Order Data:</strong>
                            <pre style="background: var(--color-surface-subtle); padding: 12px; border-radius: 4px; overflow-x: auto; margin-top: 8px;">${JSON.stringify(order.order_data, null, 2)}</pre>
                        </div>
                    ` : ''}
                `;
            }
            modal.classList.add('active');
        }
        
    } catch (error) {
        console.error('Error loading order details:', error);
        alert(`Error: ${error.message}`);
    }
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initInboxesOrders = initInboxesOrders;
    window.loadOrderHistory = loadOrderHistory;
    window.showOrderDetails = showOrderDetails;
}

