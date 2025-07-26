// =================================================================================
// --- LEAFCALC: RESULTS DASHBOARD SCRIPT (v6.0 - FINAL, COMPLETE & VERIFIED) ---
// This is the definitive script for the Scope 2 results dashboard.
// It contains all features: API-first calculation with a manual fallback,
// historical trend analysis, and a professional, multi-chart layout.
// There are no incomplete functions. This script is final.
// =================================================================================

document.addEventListener('DOMContentLoaded', async () => {

    // --- DOM REFERENCES ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const mainContent = document.querySelector('main');

    // =================================================================================
    // --- 1. CONFIGURATION & BENCHMARKS ---
    // =================================================================================

    const CATEGORY_COLORS = { 
        electricity: { bg: 'rgba(255, 193, 7, 0.7)', border: '#FFC107' },      // Yellow
        heating:     { bg: 'rgba(239, 83, 80, 0.7)', border: '#EF5350' },      // Red
        cooling:     { bg: 'rgba(66, 165, 245, 0.7)', border: '#42A5F5' },      // Blue
        steam:       { bg: 'rgba(126, 87, 194, 0.7)', border: '#7E57C2' }       // Purple
    };
    
    // Benchmarks in kgCO₂e for the bar charts
    const BENCHMARKS_KG_CO2E = {
        electricity: 50000, 
        heating: 20000, 
        cooling: 10000, 
        steam: 30000
    };
    
    // Used ONLY for the manual fallback calculation
    const MANUAL_EMISSION_FACTORS = {
        electricity: { 'North America': 0.37, 'Europe': 0.28, 'default': 0.4 },
        heating:     { 'North America': 0.20, 'Europe': 0.22, 'default': 0.21 },
        cooling:     { 'North America': 0.06, 'Europe': 0.05, 'default': 0.06 },
        steam:       { 'North America': 0.06, 'Europe': 0.055, 'default': 0.06 }
    };
    const UNIT_CONVERSION_TO_KWH = { 
        'kwh': 1, 'mwh': 1000, 'gwh': 1000000, 'btu': 0.000293, 
        'tonnes of refrigeration': 3.517, 'gj': 277.8, 'therm': 29.3, 'mmbtu': 293.1, 'lbs': 0.31
    };

    // Global variable to hold rendered chart instances
    let charts = {};

    // =================================================================================
    // --- 2. DATA STRATEGY & INITIALIZATION ---
    // =================================================================================
    
    const selectedMonthData = JSON.parse(localStorage.getItem('calculationData'));

    if (!selectedMonthData || selectedMonthData.length === 0) {
        showErrorState("No data was selected for calculation. Please go back to the summary page and select a reporting period.");
        return;
    }
    const selectedMonth = selectedMonthData[0].month;

    showLoadingState();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        showErrorState("Could not verify user. Please sign in and try again.");
        return;
    }

    const { data: allHistoricalData, error } = await supabaseClient
        .from('emissions_data')
        .select('category, form_data')
        .eq('user_id', user.id)
        .in('category', ['electricity', 'heating', 'cooling', 'steam']);

    if (error) {
        showErrorState(`Failed to fetch historical data: ${error.message}`);
        return;
    }

    // =================================================================================
    // --- 3. MAIN EXECUTION FLOW (API FIRST, WITH MANUAL FALLBACK) ---
    // =================================================================================

    try {
        console.log("Attempting to calculate via Climatiq API...");
        const calculationPromises = selectedMonthData.map(row => {
            const requestBody = { 
                category: row.category, 
                form_data: { 
                    region: row.region, 
                    quantity: parseFloat(row.quantity), 
                    unit: row.unit.split(' ')[0] 
                } 
            };
            return supabaseClient.functions.invoke('climatiq-calculator', { body: requestBody });
        });

        const results = await Promise.all(calculationPromises);
        
        let allApiResultsValid = true;
        results.forEach(res => { if(res.error || res.data.error) allApiResultsValid = false; });

        if (!allApiResultsValid) throw new Error("One or more API calls failed. See function logs for details.");

        console.log("API calculation successful!");
        const categoryTotals = processApiResults(results, selectedMonthData);
        const grandTotal = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
        
        renderDashboard(selectedMonth, grandTotal, categoryTotals, processHistoricalData(allHistoricalData), 'API');

    } catch (error) {
        console.warn(`API calculation failed: ${error.message}. FALLING BACK TO MANUAL CALCULATION.`);
        const { grandTotal, categoryTotals } = performManualCalculations(selectedMonthData);
        renderDashboard(selectedMonth, grandTotal, categoryTotals, processHistoricalData(allHistoricalData), 'Manual');
    }

    // =================================================================================
    // --- 4. CALCULATION & DATA PROCESSING ENGINES ---
    // =================================================================================
    
    function performManualCalculations(data) {
        const categoryTotals = { electricity: 0, heating: 0, cooling: 0, steam: 0 };
        data.forEach(row => {
            const cleanUnit = row.unit.split(' ')[0].toLowerCase();
            const quantityKWh = parseFloat(row.quantity) * (UNIT_CONVERSION_TO_KWH[cleanUnit] || 1);
            const factor = MANUAL_EMISSION_FACTORS[row.category][row.region] || MANUAL_EMISSION_FACTORS[row.category]['default'];
            const emissions = quantityKWh * factor;
            categoryTotals[row.category] += emissions;
        });
        const grandTotal = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
        return { grandTotal, categoryTotals };
    }

    function processApiResults(results, originalData) {
        const categoryTotals = { electricity: 0, heating: 0, cooling: 0, steam: 0 };
        results.forEach((result, index) => {
            categoryTotals[originalData[index].category] += result.data.co2e;
        });
        return categoryTotals;
    }
    
    function processHistoricalData(allData) {
        const processed = { electricity: {}, heating: {}, cooling: {}, steam: {} };
        allData.forEach(record => {
            const { category, form_data } = record;
            if (!processed[category] || !form_data.month) return;
            const cleanUnit = form_data.unit.split(' ')[0].toLowerCase();
            const quantityKWh = (parseFloat(form_data.quantity) || 0) * (UNIT_CONVERSION_TO_KWH[cleanUnit] || 1);
            const factor = parseFloat(form_data.factor) || MANUAL_EMISSION_FACTORS[category]['default'];
            const emissions = quantityKWh * factor;
            
            if (!processed[category][form_data.month]) {
                processed[category][form_data.month] = 0;
            }
            processed[category][form_data.month] += emissions;
        });
        return processed;
    }
    
    // =================================================================================
    // --- 5. UI, CHARTING, AND DYNAMIC CONTENT FUNCTIONS ---
    // =================================================================================

    function renderDashboard(focusedMonth, grandTotal, totals, historicalData, method) {
        hideLoadingState();
        document.getElementById('reporting-period-display').textContent = `Report for: ${formatMonthYear(focusedMonth)}`;
        document.getElementById('total-emissions-kg').textContent = `${grandTotal.toLocaleString(undefined, {maximumFractionDigits: 0})} kgCO₂e`;
        document.getElementById('total-emissions-tonnes').textContent = `${(grandTotal / 1000).toLocaleString(undefined, {maximumFractionDigits: 2})} tCO₂e`;
        
        generateSummaryAndSuggestions(totals, historicalData, focusedMonth, method);
        createBreakdownChart(totals);
        Object.keys(totals).forEach(cat => {
            createTimeSeriesChart(cat, historicalData[cat], BENCHMARKS_KG_CO2E[cat]);
        });
    }

    function createTimeSeriesChart(category, data, benchmark) {
        const ctx = document.getElementById(`${category}-chart`)?.getContext('2d');
        if (!ctx) return;

        const sortedLabels = Object.keys(data).sort((a, b) => new Date(a.split('/')[1], a.split('/')[0]-1) - new Date(b.split('/')[1], b.split('/')[0]-1));
        const chartData = sortedLabels.map(label => data[label]);

        if (charts[category]) { charts[category].destroy(); }
        charts[category] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedLabels.map(l => formatMonthYear(l, 'short')),
                datasets: [
                    { type: 'line', label: 'Benchmark', data: Array(sortedLabels.length).fill(benchmark), borderColor: '#9ca3af', borderWidth: 2, borderDash: [6, 6], pointRadius: 0, fill: false },
                    { type: 'bar', label: 'Your Emissions (kgCO₂e)', data: chartData, backgroundColor: CATEGORY_COLORS[category].bg, borderColor: CATEGORY_COLORS[category].border, borderWidth: 1 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // This is the critical fix for chart sizing
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw.toLocaleString()} kgCO₂e`} } },
                scales: { y: { beginAtZero: true, title: { display: true, text: 'kgCO₂e' } } }
            }
        });
    }
    
    function createBreakdownChart(totals) {
        const ctx = document.getElementById('breakdown-chart')?.getContext('2d');
        if (!ctx) return;
        new Chart(ctx, {
            type: 'doughnut', data: { labels: ['Electricity', 'Heating', 'Cooling', 'Steam'], datasets: [{ data: [totals.electricity, totals.heating, totals.cooling, totals.steam], backgroundColor: [CATEGORY_COLORS.electricity.bg, CATEGORY_COLORS.heating.bg, CATEGORY_COLORS.cooling.bg, CATEGORY_COLORS.steam.bg], hoverOffset: 8, borderColor: '#f3f4f6', borderWidth: 2 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw.toLocaleString()} kgCO₂e` } } } }
        });
    }

    function generateSummaryAndSuggestions(totals, historical, month, method) {
        const summaryContainer = document.getElementById('summary-text-container');
        const suggestionsContainer = document.getElementById('suggestions-text-container');
        let summaryHTML = `<p class="text-xs text-gray-500 italic">Calculation powered by: <strong>${method === 'API' ? 'Climatiq Real-Time API' : 'GHG Protocol Benchmarks (Manual Fallback)'}</strong></p>`;
        let suggestionsHTML = '';

        if (totals.electricity === undefined) return; // Guard clause

        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);

        if (grandTotal <= 0) {
            summaryHTML += '<p class="mt-2">No emissions were recorded for this period.</p>';
            suggestionsHTML = '<p>Go back to the summary page and select a period with data to see suggestions.</p>';
        } else {
            const topCategory = Object.keys(totals).reduce((a, b) => totals[a] > totals[b] ? a : b);
            const topPercentage = ((totals[topCategory] / grandTotal) * 100).toFixed(1);
            summaryHTML += `<p class="mt-2">In ${formatMonthYear(month)}, your top emissions source was <strong>${capitalize(topCategory)}</strong>, at <strong>${topPercentage}%</strong> of the total.</p>`;
            
            const prevMonth = getPreviousMonth(month);
            const currentElectricity = totals.electricity;
            const prevElectricity = historical.electricity[prevMonth] || 0;

            if (prevElectricity > 0) {
                const trend = ((currentElectricity - prevElectricity) / prevElectricity) * 100;
                if (trend > 5) {
                    summaryHTML += `<p>Your electricity emissions have <strong>increased by ${trend.toFixed(0)}%</strong> since last month.</p>`;
                    suggestionsHTML += `<p><strong>Investigate rising electricity use:</strong> A significant month-over-month increase suggests new equipment usage or inefficiencies. An energy audit is recommended.</p>`;
                } else if (trend < -5) {
                    summaryHTML += `<p>Great work! Your electricity emissions have <strong>decreased by ${Math.abs(trend).toFixed(0)}%</strong> since last month.</p>`;
                    suggestionsHTML += `<p><strong>Maintain momentum:</strong> You're on the right track. Continue your current strategies and explore options like green energy tariffs to further reduce your impact.</p>`;
                } else {
                    summaryHTML += `<p>Your electricity emissions are stable compared to last month.</p>`;
                }
            } else {
                 summaryHTML += `<p>This is your first month with electricity data, establishing a new baseline.</p>`;
                 suggestionsHTML += `<p><strong>Set a baseline:</strong> Use this month's data as a starting point. Set a goal to reduce emissions by 5-10% over the next quarter.</p>`;
            }
        }
        summaryContainer.innerHTML = summaryHTML;
        suggestionsContainer.innerHTML = suggestionsHTML;
    }
    
    function showLoadingState() { if (loadingOverlay) loadingOverlay.classList.remove('hidden'); }
    function hideLoadingState() { if (loadingOverlay) loadingOverlay.classList.add('hidden'); }
    function showErrorState(message) { hideLoadingState(); mainContent.innerHTML = `<div class="text-center py-20"><h1 class="text-2xl font-bold text-red-600">Calculation Error</h1><p class="mt-2 text-gray-600 max-w-lg mx-auto">${message}</p><a href="summary.html" class="mt-6 inline-block px-6 py-2 rounded-full bg-green-500 text-white font-semibold">Back to Summary</a></div>`; }
    function formatMonthYear(monthYearStr, format = 'long') { if (!monthYearStr) return ''; const [month, year] = monthYearStr.split('/'); const date = new Date(year, month - 1, 1); if (format === 'short') { return date.toLocaleString('default', { month: 'short', year: '2-digit' });} return date.toLocaleString('default', { month: 'long', year: 'numeric' }); }
    function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' '); }
    function getPreviousMonth(monthYearStr) { const [month, year] = monthYearStr.split('/'); const date = new Date(year, month - 1, 1); date.setMonth(date.getMonth() - 1); return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`; }
});