// Pipeline Funnel Component - Visual funnel with clickable stages and drill-down

const CLICKABLE_STAGES = ['meetings_booked', 'showed_up_to_disco', 'qualified', 'demo_booked', 'showed_up_to_demo', 'proposal_sent', 'closed'];
const STAGE_LABELS = {
    total_sent: 'Total Sent',
    unique_contacts: 'Unique Contacts',
    real_replies: 'Real Replies',
    positive_replies: 'Positive Replies',
    meetings_booked: 'Meetings Booked',
    showed_up_to_disco: 'Showed Up to Disco',
    qualified: 'Qualified',
    demo_booked: 'Demo Booked',
    showed_up_to_demo: 'Showed Up to Demo',
    proposal_sent: 'Proposal Sent',
    closed: 'Closed'
};

let currentDrillDownStage = null;
let currentDrillDownPage = 1;
const DRILLDOWN_PAGE_SIZE = 20;
let pipelineFunnelInitialized = false;
let dateChangeHandler = null;
let cachedSupabaseClient = null; // Cache client to avoid creating multiple instances
let loadFunnelFunction = null;
let currentFunnelStages = null; // Cache stages for resize recalculation
let resizeTimeout = null; // Debounce resize handler
let cachedFunnelTargets = null; // Cache funnel targets

// Get Supabase client (with caching to prevent multiple instances)
function getSupabaseClient() {
    // Return cached client if available
    if (cachedSupabaseClient) {
        return cachedSupabaseClient;
    }
    
    // First try to use the global function from analytics-core.js
    if (window.getSupabaseClient && typeof window.getSupabaseClient === 'function') {
        // Check if it's not our own function (avoid recursion)
        const globalFunc = window.getSupabaseClient;
        if (globalFunc !== getSupabaseClient) {
            try {
                const client = globalFunc();
                if (client) {
                    cachedSupabaseClient = client;
                    return client;
                }
            } catch (err) {
                console.error('Error calling window.getSupabaseClient:', err);
            }
        }
    }
    
    // Fallback: create client directly if Supabase library is available
    if (typeof supabase !== 'undefined' && window.SUPABASE_URL && window.SUPABASE_KEY) {
        try {
            const client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
            cachedSupabaseClient = client;
            return client;
        } catch (err) {
            console.error('Error creating Supabase client:', err);
            return null;
        }
    }
    
    console.error('Cannot get Supabase client - library or credentials not available');
    return null;
}

// Get date filter from Pipeline Funnel inputs
function getDateFilter() {
    const dateStartEl = document.getElementById('pf-date-start');
    const dateEndEl = document.getElementById('pf-date-end');
    const dateStart = dateStartEl ? dateStartEl.value : '';
    const dateEnd = dateEndEl ? dateEndEl.value : '';
    return { dateStart, dateEnd };
}

// Set date preset for Pipeline Funnel
function setDatePresetForFunnel(preset) {
    const dateStartEl = document.getElementById('pf-date-start');
    const dateEndEl = document.getElementById('pf-date-end');
    if (!dateStartEl || !dateEndEl) return;
    
    const today = new Date();
    let endDate = new Date(today);
    let startDate = new Date(today);
    
    switch(preset) {
        case 'today':
            startDate = new Date(today);
            break;
        case 'this_week':
            startDate.setDate(today.getDate() - today.getDay());
            break;
        case 'last_week':
            startDate.setDate(today.getDate() - today.getDay() - 7);
            endDate.setDate(today.getDate() - today.getDay() - 1);
            break;
        case 'this_month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            break;
        case 'last_month':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
    }
    
    // Format dates as YYYY-MM-DD
    dateStartEl.value = startDate.toISOString().split('T')[0];
    dateEndEl.value = endDate.toISOString().split('T')[0];
    
    // Reload funnel data with new dates
    loadFunnelData();
}

// Load pipeline funnel data
async function loadPipelineFunnelData(dateStart, dateEnd) {
    // Get client with retry logic
    let client = getSupabaseClient();
    if (!client) {
        // Wait a bit and retry
        await new Promise(resolve => setTimeout(resolve, 300));
        client = getSupabaseClient();
    }
    
    if (!client) {
        throw new Error('Supabase client not available. Please ensure config.js is loaded and Supabase library is available.');
    }
    
    // Query campaign_reporting for total_sent, unique_contacts, positive_replies
    // Match Quick View approach - select all columns to ensure we get all data
    let campaignQuery = client
        .from('campaign_reporting')
        .select('emails_sent, total_leads_contacted, interested, date, client')
        .eq('client', 'Rillation Revenue');
    
    // Apply date filter if provided
    if (dateStart && dateEnd) {
        campaignQuery = campaignQuery.gte('date', dateStart).lte('date', dateEnd);
        console.log('📅 Filtering campaign_reporting by date:', dateStart, 'to', dateEnd);
    } else {
        console.log('📅 Loading all campaign_reporting data (no date filter)');
    }
    
    // Query replies for real_replies (match Performance Overview approach - use Supabase count)
    let repliesQuery = client
        .from('replies')
        .select('*', { count: 'exact', head: true })
        .eq('client', 'Rillation Revenue')
        .neq('category', 'Out Of Office');
    
    if (dateStart && dateEnd) {
        repliesQuery = repliesQuery.gte('date_received', dateStart).lte('date_received', dateEnd);
    }
    
    // Query meetings_booked table for meetings count (separate table, not engaged_leads)
    let meetingsQuery = client
        .from('meetings_booked')
        .select('*', { count: 'exact', head: true })
        .eq('client', 'Rillation Revenue');
    
    if (dateStart && dateEnd) {
        meetingsQuery = meetingsQuery.gte('created_time', dateStart).lte('created_time', dateEnd);
    }
    
    // Query engaged_leads for stages 6-11 (post-meeting stages)
    let engagedLeadsQuery = client
        .from('engaged_leads')
        .select('showed_up_to_disco, qualified, demo_booked, showed_up_to_demo, proposal_sent, closed, created_at')
        .eq('client', 'Rillation Revenue');
    
    // Apply date filter to engaged_leads (using created_at)
    if (dateStart && dateEnd) {
        engagedLeadsQuery = engagedLeadsQuery.gte('created_at', dateStart).lte('created_at', dateEnd);
    }
    
    // Execute all queries in parallel
    const [campaignResult, repliesResult, meetingsResult, engagedLeadsResult] = await Promise.all([
        campaignQuery,
        repliesQuery,
        meetingsQuery,
        engagedLeadsQuery
    ]);
    
    if (campaignResult.error) {
        console.error('Error loading campaign data:', campaignResult.error);
    }
    if (repliesResult.error) {
        console.error('Error loading replies data:', repliesResult.error);
    }
    if (meetingsResult.error) {
        console.error('Error loading meetings_booked data:', meetingsResult.error);
    }
    if (engagedLeadsResult.error) {
        console.error('Error loading engaged_leads data:', engagedLeadsResult.error);
    }
    
    // Get counts directly from Supabase
    const realRepliesCount = repliesResult.count || 0;
    const meetingsBookedCount = meetingsResult.count || 0;
    
    console.log('📊 Data Loaded:', {
        campaignRows: (campaignResult.data || []).length,
        realRepliesCount: realRepliesCount,
        meetingsBookedCount: meetingsBookedCount,
        engagedLeadsRows: (engagedLeadsResult.data || []).length
    });
    
    return {
        campaignData: campaignResult.data || [],
        realRepliesCount: realRepliesCount,
        meetingsBookedCount: meetingsBookedCount,
        engagedLeads: engagedLeadsResult.data || []
    };
}

// Calculate funnel stages
function calculateFunnelStages(campaignData, realRepliesCount, meetingsBookedCount, engagedLeads) {
    // Calculate stages 1-4 from campaign_reporting (same as Performance Overview)
    const totalSent = campaignData.reduce((sum, row) => sum + (parseFloat(row.emails_sent) || 0), 0);
    const uniqueContacts = campaignData.reduce((sum, row) => sum + (parseFloat(row.total_leads_contacted) || 0), 0);
    const positiveReplies = campaignData.reduce((sum, row) => sum + (parseFloat(row.interested) || 0), 0);
    
    console.log('📊 Funnel Stage Calculations:', {
        campaignDataRows: campaignData.length,
        totalSent,
        uniqueContacts,
        realRepliesCount,
        positiveReplies,
        meetingsBookedCount,
        engagedLeadsCount: engagedLeads.length
    });
    
    const stages = {
        total_sent: totalSent,
        unique_contacts: uniqueContacts,
        real_replies: realRepliesCount || 0,
        positive_replies: positiveReplies,
        // Stage 5 from meetings_booked table
        meetings_booked: meetingsBookedCount || 0,
        // Stages 6-11 from engaged_leads
        showed_up_to_disco: engagedLeads.filter(l => l.showed_up_to_disco === true).length,
        qualified: engagedLeads.filter(l => l.qualified === true).length,
        demo_booked: engagedLeads.filter(l => l.demo_booked === true).length,
        showed_up_to_demo: engagedLeads.filter(l => l.showed_up_to_demo === true).length,
        proposal_sent: engagedLeads.filter(l => l.proposal_sent === true).length,
        closed: engagedLeads.filter(l => l.closed === true).length || 0
    };
    
    console.log('📊 Calculated Stages:', stages);
    
    // Calculate conversion percentages
    stages.conversions = {
        unique_contacts: calculateConversion(stages.unique_contacts, stages.total_sent),
        real_replies: calculateConversion(stages.real_replies, stages.unique_contacts),
        positive_replies: calculateConversion(stages.positive_replies, stages.real_replies),
        meetings_booked: calculateConversion(stages.meetings_booked, stages.positive_replies),
        showed_up_to_disco: calculateConversion(stages.showed_up_to_disco, stages.meetings_booked),
        qualified: calculateConversion(stages.qualified, stages.showed_up_to_disco),
        demo_booked: calculateConversion(stages.demo_booked, stages.qualified),
        showed_up_to_demo: calculateConversion(stages.showed_up_to_demo, stages.demo_booked),
        proposal_sent: calculateConversion(stages.proposal_sent, stages.showed_up_to_demo),
        closed: calculateConversion(stages.closed, stages.proposal_sent)
    };
    
    // Calculate drop-off rates
    stages.dropoffs = {
        unique_contacts: calculateDropOff(stages.unique_contacts, stages.total_sent),
        real_replies: calculateDropOff(stages.real_replies, stages.unique_contacts),
        positive_replies: calculateDropOff(stages.positive_replies, stages.real_replies),
        meetings_booked: calculateDropOff(stages.meetings_booked, stages.positive_replies),
        showed_up_to_disco: calculateDropOff(stages.showed_up_to_disco, stages.meetings_booked),
        qualified: calculateDropOff(stages.qualified, stages.showed_up_to_disco),
        demo_booked: calculateDropOff(stages.demo_booked, stages.qualified),
        showed_up_to_demo: calculateDropOff(stages.showed_up_to_demo, stages.demo_booked),
        proposal_sent: calculateDropOff(stages.proposal_sent, stages.showed_up_to_demo),
        closed: calculateDropOff(stages.closed, stages.proposal_sent)
    };
    
    return stages;
}

// Calculate conversion percentage
function calculateConversion(current, previous) {
    if (!previous || previous === 0) return 0;
    return parseFloat(((current / previous) * 100).toFixed(1));
}

// Calculate drop-off percentage
function calculateDropOff(current, previous) {
    const conversion = calculateConversion(current, previous);
    return 100 - conversion;
}

// ============================================================================
// PIPELINE FUNNEL RENDERING - COMPLETE REBUILD
// ============================================================================
// Constraints (non-negotiable):
// 1. Funnel MUST be wider than viewport (horizontal scroll required)
// 2. Each stage MUST be visibly narrower than previous (FORCED decay)
// 3. Text NEVER overlaps (fixed Y lanes)
// 4. Single purple family, fading left to right
// 5. Hero chart - visually dominant
// ============================================================================

// Stage order (11 stages)
const STAGE_ORDER = [
    'total_sent', 'unique_contacts', 'real_replies', 'positive_replies',
    'meetings_booked', 'showed_up_to_disco', 'qualified', 'demo_booked',
    'showed_up_to_demo', 'proposal_sent', 'closed'
];

// ============================================================================
// THICKNESS CALCULATION - FORCED DECAY (each stage MUST shrink)
// ============================================================================
function calculateForcedThickness(stages) {
    const MAX_THICKNESS = 280; // Hero size - visually dominant
    const MIN_THICKNESS = 28;  // Minimum visible thickness
    
    // Forced decay rules:
    // - Early stages (0-3): decay by 8% minimum per stage
    // - Post-meeting (4-10): decay by 15% minimum per stage
    // - Closed MUST be the smallest
    
    const thicknesses = [];
    let currentThickness = MAX_THICKNESS;
    
    STAGE_ORDER.forEach((stageKey, index) => {
        if (index === 0) {
            // First stage is always full thickness
            thicknesses.push(MAX_THICKNESS);
            currentThickness = MAX_THICKNESS;
        } else {
            // FORCED decay - each stage MUST be smaller than previous
            let decayRate;
            
            if (index <= 3) {
                // Early stages: 8-12% decay
                decayRate = 0.88;
            } else if (index <= 6) {
                // Post-meeting stages: 15-20% decay (aggressive)
                decayRate = 0.80;
            } else {
                // Late stages: 20-25% decay (brutal)
                decayRate = 0.75;
            }
            
            currentThickness = currentThickness * decayRate;
            
            // Ensure minimum visibility
            currentThickness = Math.max(MIN_THICKNESS, currentThickness);
            
            thicknesses.push(currentThickness);
        }
    });
    
    // Ensure closed is the narrowest (override if needed)
    const closedIndex = STAGE_ORDER.length - 1;
    thicknesses[closedIndex] = MIN_THICKNESS;
    
    return thicknesses;
}

// ============================================================================
// COLOR SYSTEM - Single purple family, fading left to right
// ============================================================================
function getFunnelFillColor(stageKey, stageIndex) {
    // Accent colors (only these two)
    if (stageKey === 'positive_replies') {
        return 'rgba(168, 85, 247, 0.85)'; // Brighter purple
    }
    if (stageKey === 'closed') {
        return 'rgba(34, 197, 94, 0.75)'; // Muted green
    }
    
    // Base purple family - fades left to right
    // Start at 0.80, end at 0.35
    const startAlpha = 0.80;
    const endAlpha = 0.35;
    const totalStages = STAGE_ORDER.length;
    const alpha = startAlpha - ((startAlpha - endAlpha) * (stageIndex / (totalStages - 1)));
    
    return `rgba(124, 58, 237, ${alpha.toFixed(2)})`;
}

// ============================================================================
// RENDER PIPELINE FUNNEL - Complete rebuild
// ============================================================================
async function renderPipelineFunnel(stages) {
    const container = document.getElementById('pipeline-funnel-container');
    if (!container) return;
    
    // Cache stages for resize
    currentFunnelStages = stages;
    
    const formatNum = window.formatNumber || ((n) => n.toLocaleString());
    
    // Handle empty funnel
    if (!stages.total_sent || stages.total_sent === 0) {
        container.innerHTML = '<div class="funnel-empty-state" style="text-align: center; padding: 60px; color: rgba(255,255,255,0.6); font-size: 16px;">No data available for selected date range</div>';
        return;
    }
    
    // Load targets for performance-based coloring
    const targets = await loadFunnelTargets();
    
    // ========================================================================
    // HARD LAYOUT CONSTRAINTS
    // ========================================================================
    const STAGE_COUNT = STAGE_ORDER.length; // 11 stages
    const SEGMENT_WIDTH = 200;              // Fixed 200px per stage
    const PADDING_LEFT = 80;
    const PADDING_RIGHT = 80;
    const TOTAL_WIDTH = (STAGE_COUNT * SEGMENT_WIDTH) + PADDING_LEFT + PADDING_RIGHT; // 2360px
    const SVG_HEIGHT = 420;                 // Hero height
    
    // ========================================================================
    // FIXED Y LANES (text NEVER overlaps)
    // ========================================================================
    const TITLE_Y = 50;                     // Stage names ABOVE funnel
    const FUNNEL_CENTER_Y = 200;            // Center of funnel body
    const PERCENT_Y = 380;                  // Percentages BELOW funnel
    
    // ========================================================================
    // THICKNESS - FORCED DECAY
    // ========================================================================
    const thicknesses = calculateForcedThickness(stages);
    
    // ========================================================================
    // CREATE SCROLL CONTAINER
    // ========================================================================
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'pipeline-funnel-scroll';
    scrollContainer.style.cssText = 'overflow-x: auto; overflow-y: visible; width: 100%;';
    
    // ========================================================================
    // CREATE SVG - Fixed dimensions, NO auto-scaling
    // ========================================================================
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', TOTAL_WIDTH);
    svg.setAttribute('height', SVG_HEIGHT);
    svg.setAttribute('viewBox', `0 0 ${TOTAL_WIDTH} ${SVG_HEIGHT}`);
    svg.setAttribute('class', 'funnel-svg');
    svg.style.cssText = 'display: block; min-width: ' + TOTAL_WIDTH + 'px;';
    
    // ========================================================================
    // RENDER CONTIGUOUS FUNNEL SEGMENTS
    // ========================================================================
    let cursorX = PADDING_LEFT;
    
    STAGE_ORDER.forEach((stageKey, index) => {
        const count = stages[stageKey] || 0;
        const conversion = stages.conversions?.[stageKey] || 0;
        const dropoff = stages.dropoffs?.[stageKey] || 0;
        const isClickable = CLICKABLE_STAGES.includes(stageKey);
        
        // Get thicknesses for this segment
        const leftThickness = index === 0 ? thicknesses[0] : thicknesses[index - 1];
        const rightThickness = thicknesses[index];
        
        // Calculate Y positions for trapezoid
        const leftTop = FUNNEL_CENTER_Y - (leftThickness / 2);
        const leftBottom = FUNNEL_CENTER_Y + (leftThickness / 2);
        const rightTop = FUNNEL_CENTER_Y - (rightThickness / 2);
        const rightBottom = FUNNEL_CENTER_Y + (rightThickness / 2);
        
        // ====================================================================
        // TRAPEZOID POLYGON (contiguous - edges touch)
        // ====================================================================
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const points = `${cursorX},${leftTop} ${cursorX + SEGMENT_WIDTH},${rightTop} ${cursorX + SEGMENT_WIDTH},${rightBottom} ${cursorX},${leftBottom}`;
        polygon.setAttribute('points', points);
        
        // Fill color - use performance color if target is set, otherwise default purple
        const targetValue = targets ? targets[stageKey] : null;
        const performanceColor = getPerformanceColor(count, targetValue);
        const fillColor = performanceColor || getFunnelFillColor(stageKey, index);
        polygon.setAttribute('fill', fillColor);
        
        // Stroke color matches fill theme
        const strokeColor = performanceColor 
            ? (performanceColor.includes('34, 197, 94') ? 'rgba(34, 197, 94, 0.5)' 
               : performanceColor.includes('234, 179, 8') ? 'rgba(234, 179, 8, 0.5)' 
               : performanceColor.includes('239, 68, 68') ? 'rgba(239, 68, 68, 0.5)'
               : 'rgba(139, 92, 246, 0.4)')
            : 'rgba(139, 92, 246, 0.4)';
        polygon.setAttribute('stroke', strokeColor);
        polygon.setAttribute('stroke-width', '1.5');
        
        // Zero-value: muted but still visible
        if (count === 0) {
            polygon.setAttribute('fill-opacity', '0.25');
        }
        
        // Data attributes
        polygon.setAttribute('class', `funnel-segment ${isClickable ? 'clickable' : ''}`);
        polygon.setAttribute('data-stage-key', stageKey);
        polygon.setAttribute('data-stage-name', STAGE_LABELS[stageKey]);
        polygon.setAttribute('data-count', count);
        polygon.setAttribute('data-conversion', conversion.toFixed(1));
        polygon.setAttribute('data-dropoff', dropoff.toFixed(1));
        
        // Tooltip
        const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        tooltip.textContent = `${STAGE_LABELS[stageKey]} | Count: ${formatNum(count)}${index > 0 ? ` | Conversion: ${conversion.toFixed(1)}% | Drop-off: ${dropoff.toFixed(1)}%` : ''}`;
        polygon.appendChild(tooltip);
        
        svg.appendChild(polygon);
        
        // ====================================================================
        // STAGE TITLE - ABOVE FUNNEL (fixed Y lane)
        // ====================================================================
        const segmentCenterX = cursorX + (SEGMENT_WIDTH / 2);
        
        const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        titleText.setAttribute('x', segmentCenterX);
        titleText.setAttribute('y', TITLE_Y);
        titleText.setAttribute('text-anchor', 'middle');
        titleText.setAttribute('font-size', '12');
        titleText.setAttribute('font-weight', '500');
        titleText.setAttribute('fill', 'rgba(255, 255, 255, 0.9)'); // High contrast
        titleText.setAttribute('pointer-events', 'none');
        titleText.textContent = STAGE_LABELS[stageKey];
        svg.appendChild(titleText);
        
        // ====================================================================
        // COUNT - INSIDE FUNNEL (or above with leader if too thin)
        // ====================================================================
        const minThickness = Math.min(leftThickness, rightThickness);
        
        if (minThickness >= 60) {
            // Count inside funnel
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.setAttribute('x', segmentCenterX);
            countText.setAttribute('y', FUNNEL_CENTER_Y + 6); // Slight offset for vertical centering
            countText.setAttribute('text-anchor', 'middle');
            countText.setAttribute('font-size', '20');
            countText.setAttribute('font-weight', '700');
            countText.setAttribute('fill', '#FFFFFF'); // Bright white, bold
            countText.setAttribute('pointer-events', 'none');
            countText.textContent = formatNum(count);
            svg.appendChild(countText);
        } else {
            // Too thin: move count above with leader line
            const leaderY = TITLE_Y + 20;
            const countY = TITLE_Y + 35;
            
            // Leader line from funnel top to label
            const leaderLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            leaderLine.setAttribute('x1', segmentCenterX);
            leaderLine.setAttribute('y1', rightTop);
            leaderLine.setAttribute('x2', segmentCenterX);
            leaderLine.setAttribute('y2', leaderY);
            leaderLine.setAttribute('stroke', 'rgba(255, 255, 255, 0.3)');
            leaderLine.setAttribute('stroke-width', '1');
            leaderLine.setAttribute('stroke-dasharray', '3,3');
            leaderLine.setAttribute('pointer-events', 'none');
            svg.appendChild(leaderLine);
            
            // Count above funnel
            const countText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            countText.setAttribute('x', segmentCenterX);
            countText.setAttribute('y', countY);
            countText.setAttribute('text-anchor', 'middle');
            countText.setAttribute('font-size', '16'); // Slightly smaller but still readable
            countText.setAttribute('font-weight', '700');
            countText.setAttribute('fill', '#FFFFFF');
            countText.setAttribute('pointer-events', 'none');
            countText.textContent = formatNum(count);
            svg.appendChild(countText);
        }
        
        // ====================================================================
        // CONVERSION % - BELOW FUNNEL (fixed Y lane, skip first stage)
        // ====================================================================
        if (index > 0) {
            const percentText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            percentText.setAttribute('x', segmentCenterX);
            percentText.setAttribute('y', PERCENT_Y);
            percentText.setAttribute('text-anchor', 'middle');
            percentText.setAttribute('font-size', '12');
            percentText.setAttribute('font-weight', '500');
            percentText.setAttribute('fill', 'rgba(255, 255, 255, 0.75)'); // Lighter white
            percentText.setAttribute('pointer-events', 'none');
            percentText.textContent = `${conversion.toFixed(1)}%`;
            svg.appendChild(percentText);
        }
        
        // Advance cursor for next segment
        cursorX += SEGMENT_WIDTH;
    });
    
    // ========================================================================
    // SALES HAND-OFF GUIDE LINE
    // ========================================================================
    const meetingsIndex = STAGE_ORDER.indexOf('meetings_booked');
    if (meetingsIndex >= 0) {
        const guideX = PADDING_LEFT + (meetingsIndex * SEGMENT_WIDTH) + SEGMENT_WIDTH;
        const guideTopY = FUNNEL_CENTER_Y - (thicknesses[meetingsIndex] / 2) - 10;
        const guideBottomY = FUNNEL_CENTER_Y + (thicknesses[meetingsIndex] / 2) + 10;
        
        const guideLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        guideLine.setAttribute('x1', guideX);
        guideLine.setAttribute('y1', guideTopY);
        guideLine.setAttribute('x2', guideX);
        guideLine.setAttribute('y2', guideBottomY);
        guideLine.setAttribute('stroke', 'rgba(192, 132, 252, 0.6)');
        guideLine.setAttribute('stroke-width', '2');
        guideLine.setAttribute('stroke-dasharray', '6,4');
        guideLine.setAttribute('pointer-events', 'none');
        svg.appendChild(guideLine);
        
        const guideLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        guideLabel.setAttribute('x', guideX);
        guideLabel.setAttribute('y', guideBottomY + 20);
        guideLabel.setAttribute('text-anchor', 'middle');
        guideLabel.setAttribute('font-size', '11');
        guideLabel.setAttribute('font-weight', '500');
        guideLabel.setAttribute('fill', 'rgba(192, 132, 252, 0.9)');
        guideLabel.setAttribute('pointer-events', 'none');
        guideLabel.textContent = 'Sales Hand-Off';
        svg.appendChild(guideLabel);
    }
    
    // ========================================================================
    // ASSEMBLE AND INSERT
    // ========================================================================
    scrollContainer.appendChild(svg);
    container.innerHTML = '';
    container.appendChild(scrollContainer);
    
    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================
    // Click handlers for clickable stages
    CLICKABLE_STAGES.forEach(stageKey => {
        const segment = svg.querySelector(`[data-stage-key="${stageKey}"]`);
        if (segment) {
            segment.addEventListener('click', () => {
                handleStageClick(stageKey, STAGE_LABELS[stageKey]);
            });
        }
    });
    
    // Hover effects (subtle - dim others to 60%)
    svg.querySelectorAll('.funnel-segment').forEach(segment => {
        segment.addEventListener('mouseenter', () => {
            svg.querySelectorAll('.funnel-segment').forEach(s => {
                if (s !== segment) {
                    s.style.opacity = '0.6';
                } else {
                    s.style.filter = 'drop-shadow(0 4px 12px rgba(139, 92, 246, 0.25))';
                }
            });
        });
        
        segment.addEventListener('mouseleave', () => {
            svg.querySelectorAll('.funnel-segment').forEach(s => {
                s.style.opacity = '1';
                s.style.filter = 'none';
            });
        });
    });
}

// Handle stage click
async function handleStageClick(stageKey, stageName) {
    const { dateStart, dateEnd } = getDateFilter();
    currentDrillDownPage = 1;
    await showStageDrillDown(stageName, stageKey, dateStart, dateEnd);
}

// Show drill-down panel
async function showStageDrillDown(stageName, stageKey, dateStart, dateEnd) {
    const panel = document.getElementById('pipeline-funnel-drilldown');
    const titleEl = document.getElementById('drilldown-stage-title');
    const bodyEl = document.getElementById('funnel-drilldown-body');
    
    if (!panel || !titleEl || !bodyEl) {
        console.error('Drill-down panel elements not found');
        return;
    }
    
    currentDrillDownStage = stageKey;
    titleEl.textContent = `Leads at ${stageName}`;
    
    // Show loading state
    bodyEl.innerHTML = '<div class="loading">Loading leads...</div>';
    panel.style.display = 'block';
    
    try {
        const { leads, total } = await loadLeadsForStage(stageKey, dateStart, dateEnd, currentDrillDownPage, DRILLDOWN_PAGE_SIZE);
        const totalPages = Math.ceil(total / DRILLDOWN_PAGE_SIZE);
        renderLeadList(leads, stageName, currentDrillDownPage, totalPages, total);
    } catch (err) {
        console.error('Error loading leads:', err);
        bodyEl.innerHTML = `<div class="error">Error loading leads: ${err.message}</div>`;
    }
}

// Load leads for a stage
async function loadLeadsForStage(stageKey, dateStart, dateEnd, page = 1, pageSize = 20) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client not available');
    }
    
    // Special handling for meetings_booked - query meetings_booked table
    if (stageKey === 'meetings_booked') {
        // Get count from meetings_booked table
        let countQuery = client
            .from('meetings_booked')
            .select('*', { count: 'exact', head: true })
            .eq('client', 'Rillation Revenue');
        
        if (dateStart && dateEnd) {
            countQuery = countQuery.gte('created_time', dateStart).lte('created_time', dateEnd);
        }
        
        const { count } = await countQuery;
        
        // Get paginated data from meetings_booked table
        let dataQuery = client
            .from('meetings_booked')
            .select('first_name, last_name, email, company, campaign_name, title, created_time')
            .eq('client', 'Rillation Revenue')
            .order('created_time', { ascending: false });
        
        if (dateStart && dateEnd) {
            dataQuery = dataQuery.gte('created_time', dateStart).lte('created_time', dateEnd);
        }
        
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        dataQuery = dataQuery.range(from, to);
        
        const { data, error } = await dataQuery;
        
        if (error) {
            throw error;
        }
        
        // Map to standard format (created_time -> created_at for consistency)
        const mappedData = (data || []).map(row => ({
            ...row,
            created_at: row.created_time,
            updated_at: row.created_time
        }));
        
        return {
            leads: mappedData,
            total: count || 0
        };
    }
    
    // Default: query engaged_leads table for other stages
    let countQuery = client
        .from('engaged_leads')
        .select('*', { count: 'exact', head: true })
        .eq('client', 'Rillation Revenue')
        .eq(stageKey, true);
    
    if (dateStart && dateEnd) {
        countQuery = countQuery.gte('created_at', dateStart).lte('created_at', dateEnd);
    }
    
    const { count } = await countQuery;
    
    // Then get paginated data
    let dataQuery = client
        .from('engaged_leads')
        .select('id, first_name, last_name, email, company, campaign_name, updated_at, created_at')
        .eq('client', 'Rillation Revenue')
        .eq(stageKey, true)
        .order('updated_at', { ascending: false });
    
    if (dateStart && dateEnd) {
        dataQuery = dataQuery.gte('created_at', dateStart).lte('created_at', dateEnd);
    }
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    dataQuery = dataQuery.range(from, to);
    
    const { data, error } = await dataQuery;
    
    if (error) {
        throw error;
    }
    
    return {
        leads: data || [],
        total: count || 0
    };
}

// Render lead list
function renderLeadList(leads, stageName, page, totalPages, total) {
    const bodyEl = document.getElementById('funnel-drilldown-body');
    const paginationEl = document.getElementById('drilldown-pagination');
    
    if (!bodyEl) return;
    
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = window.parseLocalDate ? window.parseLocalDate(dateStr) : new Date(dateStr);
        if (!date || isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };
    
    if (leads.length === 0) {
        bodyEl.innerHTML = '<div class="empty-state" style="text-align: center; padding: 40px; color: var(--color-text-muted);">No leads found for this stage</div>';
        if (paginationEl) paginationEl.innerHTML = '';
        return;
    }
    
    let html = `
        <div style="margin-bottom: 16px; color: var(--color-text-muted); font-size: 0.9rem;">
            Showing ${((page - 1) * DRILLDOWN_PAGE_SIZE) + 1} - ${Math.min(page * DRILLDOWN_PAGE_SIZE, total)} of ${total} leads
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--color-border-muted);">
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Name</th>
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Company</th>
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Email</th>
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Current Stage</th>
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Last Activity</th>
                        <th style="text-align: left; padding: 12px; color: var(--color-text-muted); font-weight: 600;">Campaign</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    leads.forEach(lead => {
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'N/A';
        const company = lead.company || 'N/A';
        const email = lead.email || 'N/A';
        const lastActivity = formatDate(lead.updated_at || lead.created_at);
        const campaign = lead.campaign_name || 'N/A';
        
        html += `
            <tr class="lead-row" data-lead-id="${lead.id}" style="border-bottom: 1px solid var(--color-border-subtle); cursor: pointer; transition: background var(--transition-fast);">
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(fullName)}</td>
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(company)}</td>
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(email)}</td>
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(stageName)}</td>
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(lastActivity)}</td>
                <td style="padding: 12px; color: var(--color-text-default);">${escapeHtml(campaign)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    bodyEl.innerHTML = html;
    
    // Add hover effects to rows
    bodyEl.querySelectorAll('.lead-row').forEach(row => {
        row.addEventListener('mouseenter', () => {
            row.style.background = 'var(--color-surface-subtle)';
        });
        row.addEventListener('mouseleave', () => {
            row.style.background = '';
        });
        row.addEventListener('click', () => {
            const leadId = row.getAttribute('data-lead-id');
            // TODO: Deep-link to lead detail view if available
            console.log('Lead clicked:', leadId);
        });
    });
    
    // Render pagination
    if (paginationEl) {
        renderPagination(paginationEl, page, totalPages);
    }
}

// Render pagination controls (with guard to prevent duplicate handlers)
let paginationHandlersAttached = false;
function renderPagination(container, currentPage, totalPages) {
    if (totalPages <= 1) {
        container.innerHTML = '';
        paginationHandlersAttached = false;
        return;
    }
    
    const prevDisabled = currentPage === 1;
    const nextDisabled = currentPage === totalPages;
    
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; padding: 16px;">
            <button class="filter-btn" id="drilldown-prev" ${prevDisabled ? 'disabled' : ''} style="padding: 8px 16px;">
                Previous
            </button>
            <span style="color: var(--color-text-default); font-weight: 600;">
                Page ${currentPage} of ${totalPages}
            </span>
            <button class="filter-btn" id="drilldown-next" ${nextDisabled ? 'disabled' : ''} style="padding: 8px 16px;">
                Next
            </button>
        </div>
    `;
    
    // Remove old handlers if they exist
    const prevBtn = document.getElementById('drilldown-prev');
    const nextBtn = document.getElementById('drilldown-next');
    
    // Clone nodes to remove all event listeners
    if (prevBtn && prevBtn.parentNode) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    }
    if (nextBtn && nextBtn.parentNode) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    }
    
    // Get fresh references after cloning
    const freshPrevBtn = document.getElementById('drilldown-prev');
    const freshNextBtn = document.getElementById('drilldown-next');
    
    if (freshPrevBtn) {
        freshPrevBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!prevDisabled && currentDrillDownStage) {
                try {
                    currentDrillDownPage--;
                    const { dateStart, dateEnd } = getDateFilter();
                    const { leads, total } = await loadLeadsForStage(currentDrillDownStage, dateStart, dateEnd, currentDrillDownPage, DRILLDOWN_PAGE_SIZE);
                    const totalPages = Math.ceil(total / DRILLDOWN_PAGE_SIZE);
                    renderLeadList(leads, STAGE_LABELS[currentDrillDownStage], currentDrillDownPage, totalPages, total);
                } catch (err) {
                    console.error('Error loading page:', err);
                }
            }
        });
    }
    
    if (freshNextBtn) {
        freshNextBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!nextDisabled && currentDrillDownStage) {
                try {
                    currentDrillDownPage++;
                    const { dateStart, dateEnd } = getDateFilter();
                    const { leads, total } = await loadLeadsForStage(currentDrillDownStage, dateStart, dateEnd, currentDrillDownPage, DRILLDOWN_PAGE_SIZE);
                    const totalPages = Math.ceil(total / DRILLDOWN_PAGE_SIZE);
                    renderLeadList(leads, STAGE_LABELS[currentDrillDownStage], currentDrillDownPage, totalPages, total);
                } catch (err) {
                    console.error('Error loading page:', err);
                }
            }
        });
    }
    
    paginationHandlersAttached = true;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load funnel data (separate function to avoid recursion)
async function loadFunnelData() {
    const { dateStart, dateEnd } = getDateFilter();
    const funnelContainer = document.getElementById('pipeline-funnel-container');
    if (!funnelContainer) return;
    
    funnelContainer.innerHTML = '<div class="loading">Loading funnel data...</div>';
    
    // Wait a bit for Supabase client to be available
    let client = getSupabaseClient();
    if (!client) {
        // Retry after a short delay
        await new Promise(resolve => setTimeout(resolve, 500));
        client = getSupabaseClient();
    }
    
    if (!client) {
        const errorMsg = 'Supabase client not available. Please refresh the page or check your connection.';
        console.error(errorMsg);
        funnelContainer.innerHTML = `<div class="error">${errorMsg}</div>`;
        return;
    }
    
    try {
        const data = await loadPipelineFunnelData(dateStart, dateEnd);
        const stages = calculateFunnelStages(data.campaignData, data.realRepliesCount, data.meetingsBookedCount, data.engagedLeads);
        await renderPipelineFunnel(stages);
    } catch (err) {
        console.error('Error loading funnel data:', err);
        if (funnelContainer) {
            funnelContainer.innerHTML = `<div class="error">Error loading funnel data: ${err.message}</div>`;
        }
    }
}

// Initialize pipeline funnel
async function initPipelineFunnel() {
    console.log('🚀 Initializing Pipeline Funnel...');
    
    const container = document.getElementById('pipeline-funnel-container');
    if (!container) {
        console.error('Pipeline funnel container not found');
        return;
    }
    
    // Check if Supabase client is available, if not wait a bit
    let client = getSupabaseClient();
    if (!client) {
        console.log('⏳ Supabase client not ready, waiting...');
        container.innerHTML = '<div class="loading">Waiting for database connection...</div>';
        
        // Wait up to 3 seconds for client to be available
        for (let i = 0; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            client = getSupabaseClient();
            if (client) {
                console.log('✅ Supabase client now available');
                break;
            }
        }
        
        if (!client) {
            container.innerHTML = '<div class="error">Supabase client not available. Please refresh the page.</div>';
            return;
        }
    }
    
    // Prevent multiple initializations of event listeners
    if (pipelineFunnelInitialized) {
        console.log('⚠️ Pipeline Funnel already initialized, reloading data only...');
        // Still reload data even if already initialized
        await loadFunnelData();
        return;
    }
    
    // Set up date filter watchers (Pipeline Funnel's own date inputs)
    const dateStartEl = document.getElementById('pf-date-start');
    const dateEndEl = document.getElementById('pf-date-end');
    
    // Load initial data
    await loadFunnelData();
    
    // Watch for date changes - use stable function reference
    if (dateStartEl) {
        // Remove any existing listener first
        if (dateChangeHandler) {
            dateStartEl.removeEventListener('change', dateChangeHandler);
        }
        dateStartEl.addEventListener('change', loadFunnelData);
        dateChangeHandler = loadFunnelData;
    }
    if (dateEndEl) {
        // Remove any existing listener first
        if (dateChangeHandler) {
            dateEndEl.removeEventListener('change', dateChangeHandler);
        }
        dateEndEl.addEventListener('change', loadFunnelData);
    }
    
    // Set up date preset buttons
    document.querySelectorAll('.pf-date-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            setDatePresetForFunnel(preset);
        });
    });
    
    // Set up clear filters button
    const clearFiltersBtn = document.getElementById('pf-clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            const dateStartEl = document.getElementById('pf-date-start');
            const dateEndEl = document.getElementById('pf-date-end');
            if (dateStartEl) dateStartEl.value = '';
            if (dateEndEl) dateEndEl.value = '';
            loadFunnelData();
        });
    }
    
    // Set up drill-down panel close handlers (only once)
    const closeBtn = document.getElementById('drilldown-close');
    const panel = document.getElementById('pipeline-funnel-drilldown');
    
    if (closeBtn && !closeBtn.hasAttribute('data-pipeline-funnel-watched')) {
        const closeHandler = () => {
            if (panel) panel.style.display = 'none';
        };
        closeBtn.addEventListener('click', closeHandler);
        closeBtn.setAttribute('data-pipeline-funnel-watched', 'true');
    }
    
    if (panel && !panel.hasAttribute('data-pipeline-funnel-watched')) {
        // Close on click outside
        const clickOutsideHandler = (e) => {
            if (e.target === panel) {
                panel.style.display = 'none';
            }
        };
        panel.addEventListener('click', clickOutsideHandler);
        
        // Close on ESC key - use a named function
        const escKeyHandler = (e) => {
            if (e.key === 'Escape' && panel.style.display === 'block') {
                panel.style.display = 'none';
            }
        };
        document.addEventListener('keydown', escKeyHandler);
        panel.setAttribute('data-pipeline-funnel-watched', 'true');
    }
    
    // Add resize handler for responsive funnel recalculation
    const handleResize = () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            if (currentFunnelStages) {
                renderPipelineFunnel(currentFunnelStages);
            }
        }, 300); // Debounce resize events
    };
    
    window.addEventListener('resize', handleResize);
    
    // Initialize funnel targets modal
    initFunnelTargetsModal();
    
    pipelineFunnelInitialized = true;
    console.log('✅ Pipeline Funnel initialized');
}

// ============================================================================
// FUNNEL TARGETS - Configure and display performance vs targets
// ============================================================================

// Load funnel targets from Supabase
async function loadFunnelTargets() {
    if (cachedFunnelTargets) {
        return cachedFunnelTargets;
    }
    
    const client = getSupabaseClient();
    if (!client) {
        console.warn('⚠️ Supabase client not available for loading targets');
        return null;
    }
    
    try {
        const { data, error } = await client
            .from('funnel_stage_targets')
            .select('*')
            .limit(1)
            .single();
        
        if (error) {
            // Table might not exist yet
            console.warn('⚠️ Could not load funnel targets:', error.message);
            return null;
        }
        
        cachedFunnelTargets = data;
        console.log('✅ Funnel targets loaded:', data);
        return data;
    } catch (err) {
        console.error('❌ Error loading funnel targets:', err);
        return null;
    }
}

// Save funnel targets to Supabase
async function saveFunnelTargets(targets) {
    const client = getSupabaseClient();
    if (!client) {
        alert('Database connection not available. Please refresh the page.');
        return false;
    }
    
    try {
        // Check if a row exists
        const { data: existing } = await client
            .from('funnel_stage_targets')
            .select('id')
            .limit(1)
            .single();
        
        let result;
        if (existing) {
            // Update existing row
            result = await client
                .from('funnel_stage_targets')
                .update({
                    ...targets,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);
        } else {
            // Insert new row
            result = await client
                .from('funnel_stage_targets')
                .insert(targets);
        }
        
        if (result.error) {
            console.error('❌ Error saving funnel targets:', result.error);
            alert('Error saving targets: ' + result.error.message);
            return false;
        }
        
        // Clear cache so next load gets fresh data
        cachedFunnelTargets = null;
        console.log('✅ Funnel targets saved successfully');
        return true;
    } catch (err) {
        console.error('❌ Exception saving funnel targets:', err);
        alert('Error saving targets: ' + err.message);
        return false;
    }
}

// Get performance color based on actual vs target (muted colors for dark theme)
function getPerformanceColor(actual, target) {
    if (!target || target === 0) return null; // No target set - use default color
    
    const ratio = actual / target;
    
    if (ratio >= 1.0) {
        return 'rgba(34, 197, 94, 0.65)';   // Muted green - meeting/exceeding target
    } else if (ratio >= 0.7) {
        return 'rgba(234, 179, 8, 0.55)';   // Muted yellow/amber - close to target
    } else {
        return 'rgba(239, 68, 68, 0.50)';   // Muted red - below target
    }
}

// Initialize funnel targets modal
function initFunnelTargetsModal() {
    const modal = document.getElementById('pf-targets-modal');
    const openBtn = document.getElementById('pf-configure-targets');
    const closeBtn = document.getElementById('pf-targets-modal-close');
    const cancelBtn = document.getElementById('pf-targets-modal-cancel');
    const saveBtn = document.getElementById('pf-targets-modal-save');
    
    if (!modal || !openBtn) {
        console.warn('⚠️ Funnel targets modal elements not found');
        return;
    }
    
    // Open modal
    openBtn.addEventListener('click', () => {
        populateFunnelTargetsModal();
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
        saveBtn.addEventListener('click', async () => {
            const success = await saveFunnelTargetsFromModal();
            if (success) {
                closeModal();
                // Reload funnel to show new colors
                await loadFunnelData();
            }
        });
    }
    
    console.log('✅ Funnel targets modal initialized');
}

// Populate funnel targets modal with current values
async function populateFunnelTargetsModal() {
    const modalBody = document.getElementById('pf-targets-modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = '<div class="loading">Loading targets...</div>';
    
    const targets = await loadFunnelTargets() || {};
    
    const stageOrder = [
        'total_sent', 'unique_contacts', 'real_replies', 'positive_replies',
        'meetings_booked', 'showed_up_to_disco', 'qualified', 'demo_booked',
        'showed_up_to_demo', 'proposal_sent', 'closed'
    ];
    
    const formatValue = (val) => (val === null || val === undefined || val === 0) ? '' : val;
    
    modalBody.innerHTML = `
        <p style="color: rgba(255,255,255,0.7); margin-bottom: 20px; font-size: 13px;">
            Set target values for each funnel stage. Segments will be colored based on performance:
            <span style="color: rgba(34, 197, 94, 0.9);">●</span> On target
            <span style="color: rgba(234, 179, 8, 0.9);">●</span> Close (70%+)
            <span style="color: rgba(239, 68, 68, 0.9);">●</span> Below target
        </p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            ${stageOrder.map(stageKey => `
                <div class="targets-metric-input" style="background: var(--color-surface-subtle); padding: 12px; border-radius: 6px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 12px; color: rgba(255,255,255,0.8);">${STAGE_LABELS[stageKey]}</label>
                    <input type="number" 
                           id="pf-target-${stageKey}"
                           data-stage="${stageKey}" 
                           value="${formatValue(targets[stageKey])}" 
                           placeholder="0"
                           min="0"
                           style="width: 100%; padding: 8px; background: var(--color-surface); border: 1px solid var(--color-border-muted); border-radius: 4px; color: var(--color-text-default); font-size: 14px;">
                </div>
            `).join('')}
        </div>
    `;
}

// Save targets from modal form
async function saveFunnelTargetsFromModal() {
    const targets = {};
    const stageOrder = [
        'total_sent', 'unique_contacts', 'real_replies', 'positive_replies',
        'meetings_booked', 'showed_up_to_disco', 'qualified', 'demo_booked',
        'showed_up_to_demo', 'proposal_sent', 'closed'
    ];
    
    stageOrder.forEach(stageKey => {
        const input = document.getElementById(`pf-target-${stageKey}`);
        if (input) {
            targets[stageKey] = parseInt(input.value) || 0;
        }
    });
    
    console.log('💾 Saving funnel targets:', targets);
    return await saveFunnelTargets(targets);
}

// Expose functions globally
if (typeof window !== 'undefined') {
    window.initPipelineFunnel = initPipelineFunnel;
    window.loadPipelineFunnelData = loadPipelineFunnelData;
    window.loadFunnelTargets = loadFunnelTargets;
    window.saveFunnelTargets = saveFunnelTargets;
}

