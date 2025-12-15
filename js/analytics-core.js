// Analytics Core - Supabase client and shared utilities

let supabaseClient = null;

// Initialize Supabase client
function initSupabase() {
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_KEY = window.SUPABASE_KEY;
    const SUPABASE_ACCESS_TOKEN = window.SUPABASE_ACCESS_TOKEN;
    
    console.log('Initializing Supabase...', { 
        hasUrl: !!SUPABASE_URL, 
        hasKey: !!SUPABASE_KEY,
        hasToken: !!SUPABASE_ACCESS_TOKEN,
        url: SUPABASE_URL ? SUPABASE_URL.substring(0, 30) + '...' : 'missing'
    });
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Supabase credentials not found. Make sure config.js is loaded.');
        console.error('SUPABASE_URL:', SUPABASE_URL);
        console.error('SUPABASE_KEY:', SUPABASE_KEY ? 'Present' : 'Missing');
        return null;
    }
    
    if (typeof supabase !== 'undefined') {
        // Create client with options
        const options = {
            auth: {
                persistSession: false
            }
        };
        
        // If access token is available, we might need to use it for certain operations
        if (SUPABASE_ACCESS_TOKEN) {
            options.global = {
                headers: {
                    'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`
                }
            };
        }
        
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, options);
        console.log('Supabase client initialized successfully');
        return supabaseClient;
    } else {
        console.error('Supabase library not loaded. Make sure @supabase/supabase-js is included.');
    }
    
    return null;
}

// Format number with commas
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '-';
    return num.toLocaleString();
}

// Format percentage
function formatPercentage(num, total) {
    if (!total || total === 0) return '0.0%';
    const pct = (num / total) * 100;
    return pct.toFixed(1) + '%';
}

// Parse date string as local date (not UTC)
// Fixes timezone offset issue where YYYY-MM-DD dates appear one day ahead
function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    
    // Handle timestamp strings (with time component)
    if (typeof dateStr === 'string' && (dateStr.includes('T') || dateStr.includes(' '))) {
        return new Date(dateStr);
    }
    
    // For YYYY-MM-DD format, parse as local date
    if (typeof dateStr === 'string') {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // month is 0-indexed
            const day = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
    }
    
    // Fallback to regular Date parsing
    return new Date(dateStr);
}

// Show error message
function showError(message, containerId = 'error-container') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="error">${message}</div>`;
    } else {
        console.error(message);
    }
}

// Clear error message
function clearError(containerId = 'error-container') {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

// Initialize on load
if (typeof window !== 'undefined') {
    window.initAnalytics = function() {
        return initSupabase();
    };
    
    // Expose supabaseClient globally
    window.getSupabaseClient = function() {
        if (!supabaseClient) {
            initSupabase();
        }
        return supabaseClient;
    };
    
    // Expose utility functions globally
    window.formatNumber = formatNumber;
    window.formatPercentage = formatPercentage;
    window.showError = showError;
    window.clearError = clearError;
    window.parseLocalDate = parseLocalDate;
    
    // Auto-initialize if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSupabase);
    } else {
        initSupabase();
    }
}

