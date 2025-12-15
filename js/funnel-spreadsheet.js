// Funnel Spreadsheet - Editable table with calculations

// Define the funnel metrics structure (matching screenshot)
const funnelMetrics = [
    { name: 'total messages sent', key: 'total_messages_sent', type: 'number', rowClass: 'row-dark-green', formula: null },
    { name: 'total leads contacted', key: 'total_leads_contacted', type: 'number', rowClass: 'row-dark-green', formula: null },
    { name: '% response rate', key: 'response_rate', type: 'percentage', rowClass: 'row-light-yellow', formula: 'actual_total_responses / (actual_total_leads_contacted || 1) * 100' },
    { name: 'total responses', key: 'total_responses', type: 'number', rowClass: 'row-light-yellow', formula: null },
    { name: '% positive response', key: 'positive_response_rate', type: 'percentage', rowClass: 'row-light-yellow', formula: 'actual_total_pos_response / (actual_total_responses || 1) * 100' },
    { name: 'total pos response', key: 'total_pos_response', type: 'number', rowClass: 'row-light-yellow', formula: null },
    { name: '% booked', key: 'booked_rate', type: 'percentage', rowClass: 'row-light-pink', formula: 'actual_total_booked / (actual_total_pos_response || 1) * 100' },
    { name: 'total booked', key: 'total_booked', type: 'number', rowClass: 'row-light-pink', formula: null },
    { name: 'meetings passed', key: 'meetings_passed', type: 'number', rowClass: 'row-light-pink', formula: null },
    { name: '% show up to disco', key: 'showup_disco_rate', type: 'percentage', rowClass: 'row-light-pink', formula: 'actual_total_showup_disco / (actual_total_booked || 1) * 100' },
    { name: 'total show up to disco', key: 'total_showup_disco', type: 'number', rowClass: 'row-light-pink', formula: null },
    { name: '% qualified', key: 'qualified_rate', type: 'percentage', rowClass: 'row-light-green', formula: 'actual_total_qualified / (actual_total_showup_disco || 1) * 100' },
    { name: 'total qualified', key: 'total_qualified', type: 'number', rowClass: 'row-light-green', formula: null },
    { name: '% close rate', key: 'close_rate', type: 'percentage', rowClass: 'row-purple', formula: 'actual_total_deals_closed / (actual_total_qualified || 1) * 100' },
    { name: 'total PILOT accepted', key: 'total_pilot_accepted', type: 'number', rowClass: 'row-purple', formula: null },
    { name: 'LM converted to close', key: 'lm_converted_to_close', type: 'percentage', rowClass: 'row-purple', formula: 'actual_total_deals_closed / (actual_total_pilot_accepted || 1) * 100' },
    { name: 'total deals closed', key: 'total_deals_closed', type: 'number', rowClass: 'row-purple', formula: null },
    { name: 'Cost per close', key: 'cost_per_close', type: 'currency', rowClass: 'row-dark-red', formula: 'total_cost / (actual_total_deals_closed || 1)' },
    { name: 'AVG CC per client', key: 'avg_cc_per_client', type: 'currency', rowClass: 'row-dark-red', formula: null },
    { name: 'MRR Added', key: 'mrr_added', type: 'currency', rowClass: 'row-dark-red', formula: 'actual_total_deals_closed * actual_avg_cc_per_client' }
];

// Store values by month
let funnelData = {};
let currentMonth = new Date().toLocaleString('default', { month: 'long' });
let currentYear = new Date().getFullYear();

// Initialize data structure for a month
function initMonthData(month, year) {
    const monthKey = `${month}_${year}`;
    if (!funnelData[monthKey]) {
        funnelData[monthKey] = {
            estimate_low: {},
            estimate_avg: {},
            estimate_high: {},
            estimate_1: {},
            estimate_2: {},
            actual: {},
            projected: {}
        };
        
        // Initialize with default values
        funnelMetrics.forEach(metric => {
            const defaultValue = getDefaultEstimate(metric.name);
            funnelData[monthKey].estimate_low[metric.key] = defaultValue;
            funnelData[monthKey].estimate_avg[metric.key] = defaultValue;
            funnelData[monthKey].estimate_high[metric.key] = defaultValue;
            funnelData[monthKey].estimate_1[metric.key] = defaultValue;
            funnelData[monthKey].estimate_2[metric.key] = defaultValue;
            funnelData[monthKey].actual[metric.key] = 0;
            funnelData[monthKey].projected[metric.key] = 0;
        });
    }
    return monthKey;
}

// Load data from Supabase for a specific month
async function loadFunnelDataForMonth(month, year) {
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!client) {
        console.error('Supabase client not available');
        return;
    }

    try {
        const { data, error } = await client
            .from('funnel_forecasts')
            .select('*')
            .eq('month', month)
            .eq('year', year);

        if (error) {
            console.error('Error loading funnel data:', error);
            return;
        }

        const monthKey = `${month}_${year}`;
        initMonthData(month, year);

        // Populate data from Supabase
        if (data && data.length > 0) {
            data.forEach(row => {
                if (funnelData[monthKey]) {
                    funnelData[monthKey].estimate_low[row.metric_key] = parseFloat(row.estimate_low) || 0;
                    funnelData[monthKey].estimate_avg[row.metric_key] = parseFloat(row.estimate_avg) || 0;
                    funnelData[monthKey].estimate_high[row.metric_key] = parseFloat(row.estimate_high) || 0;
                    funnelData[monthKey].estimate_1[row.metric_key] = parseFloat(row.estimate_1) || 0;
                    funnelData[monthKey].estimate_2[row.metric_key] = parseFloat(row.estimate_2) || 0;
                    funnelData[monthKey].actual[row.metric_key] = parseFloat(row.actual) || 0;
                    funnelData[monthKey].projected[row.metric_key] = parseFloat(row.projected) || 0;
                }
            });
        }
    } catch (err) {
        console.error('Error loading funnel data:', err);
    }
}

// Save data to Supabase for a specific month
async function saveFunnelDataForMonth(month, year, metricKey, column, value) {
    const client = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!client) {
        console.error('Supabase client not available');
        return;
    }

    try {
        const updateData = {
            month: month,
            year: year,
            metric_key: metricKey,
            [column]: parseFloat(value) || 0,
            updated_at: new Date().toISOString()
        };

        // Try to update first
        const { data: existing, error: selectError } = await client
            .from('funnel_forecasts')
            .select('id')
            .eq('month', month)
            .eq('year', year)
            .eq('metric_key', metricKey)
            .single();

        if (existing) {
            // Update existing row
            const { error } = await client
                .from('funnel_forecasts')
                .update(updateData)
                .eq('month', month)
                .eq('year', year)
                .eq('metric_key', metricKey);

            if (error) {
                console.error('Error updating funnel data:', error);
            }
        } else {
            // Insert new row
            const { error } = await client
                .from('funnel_forecasts')
                .insert(updateData);

            if (error) {
                console.error('Error inserting funnel data:', error);
            }
        }
    } catch (err) {
        console.error('Error saving funnel data:', err);
    }
}

// Initialize the spreadsheet
async function initFunnelSpreadsheet() {
    const tbody = document.getElementById('funnel-spreadsheet-body');
    if (!tbody) return;

    // Get current month/year from selector
    const monthSelect = document.getElementById('funnel-month-select');
    const yearSelect = document.getElementById('funnel-year-select');
    
    // Set default to current month if not set
    if (monthSelect && !monthSelect.value) {
        const now = new Date();
        currentMonth = now.toLocaleString('default', { month: 'long' });
        currentYear = now.getFullYear();
        monthSelect.value = currentMonth;
        if (yearSelect) {
            yearSelect.value = currentYear.toString();
        }
    }
    
    const month = monthSelect ? monthSelect.value : currentMonth;
    const year = yearSelect ? parseInt(yearSelect.value) : currentYear;
    
    // Update month display
    const monthDisplay = document.getElementById('funnel-month-display');
    if (monthDisplay) {
        monthDisplay.textContent = month;
    }
    
    // Load data from Supabase
    await loadFunnelDataForMonth(month, year);
    
    const monthKey = initMonthData(month, year);
    const monthData = funnelData[monthKey];

    // Generate rows with 7 columns
    tbody.innerHTML = funnelMetrics.map((metric, index) => {
        const key = metric.key;
        
        const estimateLow = monthData.estimate_low[key] || 0;
        const estimateAvg = monthData.estimate_avg[key] || 0;
        const estimateHigh = monthData.estimate_high[key] || 0;
        const estimate1 = monthData.estimate_1[key] || 0;
        const estimate2 = monthData.estimate_2[key] || 0;
        const actual = monthData.actual[key] || 0;
        const projected = monthData.projected[key] || 0;
        
        return `
            <tr class="${metric.rowClass}">
                <td class="metric-name">${metric.name}</td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(estimateLow, metric.type)}" 
                           data-metric="${key}" data-column="estimate_low" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(estimateAvg, metric.type)}" 
                           data-metric="${key}" data-column="estimate_avg" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(estimateHigh, metric.type)}" 
                           data-metric="${key}" data-column="estimate_high" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(estimate1, metric.type)}" 
                           data-metric="${key}" data-column="estimate_1" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(estimate2, metric.type)}" 
                           data-metric="${key}" data-column="estimate_2" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(actual, metric.type)}" 
                           data-metric="${key}" data-column="actual" data-metric-type="${metric.type}">
                </td>
                <td class="editable">
                    <input type="text" value="${formatCellValue(projected, metric.type)}" 
                           data-metric="${key}" data-column="projected" data-metric-type="${metric.type}">
                </td>
            </tr>
        `;
    }).join('');

    // Add event listeners
    tbody.querySelectorAll('input').forEach(input => {
        input.addEventListener('blur', handleCellUpdate);
        input.addEventListener('input', (e) => {
            // Visual feedback while typing
            e.target.style.backgroundColor = '#fff3cd';
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.target.blur();
            }
        });
    });

    // Setup month/year listeners
    setupMonthListeners();

    // Initial calculation for all columns
    const columns = ['estimate_low', 'estimate_avg', 'estimate_high', 'estimate_1', 'estimate_2', 'actual', 'projected'];
    columns.forEach(col => {
        setTimeout(() => {
            recalculateFunnel(month, year, col);
        }, 50);
    });
}

// Get default estimate values
function getDefaultEstimate(metricName) {
    const defaults = {
        'total messages sent': 120000,
        'total leads contacted': 60000,
        '% response rate': 1.75,
        'total responses': 1050,
        '% positive response': 40,
        'total pos response': 420,
        '% booked': 50,
        'total booked': 210,
        'meetings passed': 0,
        '% show up to disco': 70,
        'total show up to disco': 147,
        '% qualified': 65,
        'total qualified': 95.55,
        '% close rate': 20,
        'total PILOT accepted': 19.11,
        'LM converted to close': 30,
        'total deals closed': 5.733,
        'Cost per close': 552,
        'AVG CC per client': 4000,
        'MRR Added': 22932
    };
    return defaults[metricName] || 0;
}

// Format cell value based on type
function formatCellValue(value, type) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    switch(type) {
        case 'percentage':
            return num.toFixed(2) + '%';
        case 'currency':
            return '$' + num.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
        case 'number':
        default:
            return num.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2});
    }
}

// Parse cell value
function parseCellValue(value, type) {
    if (!value || value === '-') return 0;
    
    // Remove currency and percentage symbols
    const cleaned = value.toString().replace(/[$,%]/g, '').trim();
    const num = parseFloat(cleaned);
    
    return isNaN(num) ? 0 : num;
}

// Handle cell update
async function handleCellUpdate(e) {
    const input = e.target;
    const metric = input.getAttribute('data-metric');
    const column = input.getAttribute('data-column');
    const metricType = input.getAttribute('data-metric-type');
    
    if (!metric || !column) {
        console.error('Missing data attributes:', { metric, column });
        return;
    }
    
    const value = parseCellValue(input.value, metricType);
    console.log(`📝 Cell updated: ${metric} [${column}] = ${value}`);
    
    // Visual feedback
    input.style.backgroundColor = '#d4edda';
    setTimeout(() => {
        input.style.backgroundColor = '';
    }, 300);
    
    // Get current month/year
    const monthSelect = document.getElementById('funnel-month-select');
    const yearSelect = document.getElementById('funnel-year-select');
    const month = monthSelect ? monthSelect.value : currentMonth;
    const year = yearSelect ? parseInt(yearSelect.value) : currentYear;
    const monthKey = `${month}_${year}`;
    
    // Initialize month data if it doesn't exist
    if (!funnelData[monthKey]) {
        console.log('Initializing month data for', monthKey);
        initMonthData(month, year);
    }
    
    // Update local data
    if (funnelData[monthKey] && funnelData[monthKey][column]) {
        funnelData[monthKey][column][metric] = value;
        console.log(`💾 Updated local data: ${monthKey}.${column}.${metric} = ${value}`);
    } else {
        console.error('Failed to update local data:', { monthKey, column, metric, value, hasMonthData: !!funnelData[monthKey], hasColumn: !!(funnelData[monthKey] && funnelData[monthKey][column]) });
    }
    
    // Save to Supabase (async, don't wait)
    saveFunnelDataForMonth(month, year, metric, column, value).catch(err => {
        console.error('Error saving to Supabase:', err);
    });
    
    // Recalculate immediately for the specific column that was edited
    setTimeout(() => {
        recalculateFunnel(month, year, column);
    }, 10);
}

// Recalculate formulas for a specific column
function recalculateFunnel(month, year, column = 'actual') {
    const tbody = document.getElementById('funnel-spreadsheet-body');
    if (!tbody) return;

    const monthKey = `${month}_${year}`;
    const monthData = funnelData[monthKey];
    if (!monthData) {
        console.warn('No month data found for', monthKey);
        return;
    }

    // Get the column data
    const columnData = monthData[column];
    if (!columnData) {
        console.warn('No column data found for', column);
        return;
    }

    console.log(`🔄 Recalculating funnel for ${month} ${year}, column: ${column}`);

    // Create a context for formula evaluation using the specified column's data
    const context = {};
    
    // Add values from the specified column to context
    Object.keys(columnData).forEach(key => {
        context['actual_' + key] = columnData[key] || 0;
    });
    
    // Add total cost (calculate from messages sent in this column)
    context['total_cost'] = (context['actual_total_messages_sent'] || 0) * 0.01;
    
    // Find the column index for UI updates
    const columnMap = {
        'estimate_low': 1,
        'estimate_avg': 2,
        'estimate_high': 3,
        'estimate_1': 4,
        'estimate_2': 5,
        'actual': 6,
        'projected': 7
    };
    const columnIndex = columnMap[column];
    
    // Recalculate each row in order (some formulas depend on previous rows)
    funnelMetrics.forEach((metric, index) => {
        const key = metric.key;
        const row = tbody.children[index];
        
        if (!row) {
            console.warn('Row not found for index', index, metric.name);
            return;
        }
        
        // Calculate value if there's a formula (using this column's values)
        if (metric.formula) {
            try {
                // Replace formula variables with context values
                let formula = metric.formula;
                Object.keys(context).forEach(varName => {
                    const regex = new RegExp('\\b' + varName + '\\b', 'g');
                    formula = formula.replace(regex, context[varName]);
                });
                
                // Evaluate formula (safely)
                const result = Function('"use strict"; return (' + formula + ')')();
                
                // Handle division by zero
                if (!isFinite(result) || isNaN(result)) {
                    columnData[key] = 0;
                    const cellInput = row.children[columnIndex]?.querySelector('input');
                    if (cellInput) {
                        cellInput.value = '#DIV/0!';
                    }
                } else {
                    // Update the column data
                    columnData[key] = result;
                    
                    // Update the UI cell for this column
                    const cellInput = row.children[columnIndex]?.querySelector('input');
                    if (cellInput) {
                        const formatted = formatCellValue(result, metric.type);
                        const oldValue = cellInput.value;
                        cellInput.value = formatted;
                        // Visual feedback if value changed
                        if (oldValue !== formatted) {
                            cellInput.style.backgroundColor = '#d4edda';
                            setTimeout(() => {
                                cellInput.style.backgroundColor = '';
                            }, 500);
                        }
                        console.log(`✅ Updated ${metric.name} [${column}]: ${formatted}`);
                    }
                }
            } catch (e) {
                console.error('❌ Error calculating', metric.name, ':', e, 'Formula:', metric.formula);
                columnData[key] = 0;
                const cellInput = row.children[columnIndex]?.querySelector('input');
                if (cellInput) {
                    cellInput.value = '#ERROR';
                }
            }
        }
    });
    
    console.log(`✅ Recalculation complete for ${column}`);
}

// Handle month change
function handleMonthChange() {
    const monthSelect = document.getElementById('funnel-month-select');
    const yearSelect = document.getElementById('funnel-year-select');
    const monthDisplay = document.getElementById('funnel-month-display');
    
    if (monthSelect && yearSelect) {
        currentMonth = monthSelect.value;
        currentYear = parseInt(yearSelect.value);
        
        // Update month display
        if (monthDisplay) {
            monthDisplay.textContent = currentMonth;
        }
    }
    
    initFunnelSpreadsheet();
}

// Setup month/year change listeners
function setupMonthListeners() {
    const monthSelect = document.getElementById('funnel-month-select');
    const yearSelect = document.getElementById('funnel-year-select');
    const monthDisplay = document.getElementById('funnel-month-display');
    
    // Make month display clickable - clicking it triggers the select
    if (monthDisplay && monthSelect) {
        monthDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            monthSelect.focus();
            monthSelect.click();
        });
        
        // Update display when select changes
        monthSelect.addEventListener('change', () => {
            monthDisplay.textContent = monthSelect.value;
            handleMonthChange();
        });
    }
    
    if (yearSelect) {
        yearSelect.addEventListener('change', handleMonthChange);
    }
}

// Load Pipeline Dashboard - wrapper function for tab switching
function loadPipelineDashboard() {
    console.log('📊 Loading Pipeline Dashboard...');
    initFunnelSpreadsheet();
    
    // Initialize pipeline funnel
    if (window.initPipelineFunnel) {
        window.initPipelineFunnel();
    } else {
        console.warn('⚠️ initPipelineFunnel function not available');
    }
}

// Initialize when page loads
if (typeof window !== 'undefined') {
    window.initFunnelSpreadsheet = initFunnelSpreadsheet;
    window.loadPipelineDashboard = loadPipelineDashboard;
    window.handleMonthChange = handleMonthChange;
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initFunnelSpreadsheet, 500);
        });
    } else {
        setTimeout(initFunnelSpreadsheet, 500);
    }
    
    // Also initialize when pipeline tab is shown
    document.addEventListener('DOMContentLoaded', () => {
        const pipelineTab = document.querySelector('[data-tab="pipeline"]');
        if (pipelineTab) {
            pipelineTab.addEventListener('click', () => {
                setTimeout(() => {
                    loadPipelineDashboard();
                }, 100);
            });
        }
    });
}

