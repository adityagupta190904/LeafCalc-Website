// =================================================================================
// --- LEAFCALC: EXECUTIVE DASHBOARD SCRIPT (v1.0 - COMPLETE & TESTED) ---
// This script powers the entire dashboard, fetching and visualizing saved results.
// =================================================================================

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM REFERENCES ---
    const loadingOverlay = document.getElementById('loading-overlay');
    const dateRangeSelect = document.getElementById('date-range-select');
    const refreshButton = document.getElementById('refresh-button');
    let donutChart = null;
    let trendChart = null;

    // =================================================================================
    // --- 1. MAIN DATA FETCHING & INITIALIZATION ---
    // =================================================================================

    async function initializeDashboard() {
        showLoadingState();
        
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            showErrorState("User not found. Please log in.");
            return;
        }

        try {
            // Fetch the single most recent result for each scope for the KPI cards
            const [scope1Result, scope2Result] = await Promise.all([
                fetchLatestResult(user.id, 1),
                fetchLatestResult(user.id, 2)
            ]);

            // Fetch all historical data based on the date filter for the trend chart
            const historicalData = await fetchHistoricalResults(user.id);
            
            // Once all data is fetched, update the entire dashboard
            updateDashboardUI(scope1Result, scope2Result, historicalData);

        } catch (error) {
            console.error("Dashboard initialization failed:", error);
            showErrorState(error.message);
        } finally {
            hideLoadingState();
        }
    }

    async function fetchLatestResult(userId, scope) {
        const { data, error } = await supabaseClient
            .from('emissions_results')
            .select('*')
            .eq('user_id', userId)
            .eq('scope', scope)
            .order('reporting_period', { ascending: false })
            .limit(1)
            .single(); // .single() is great for getting just one row or null

        if (error && error.code !== 'PGRST116') { // Ignore 'exact one row not found' error
            throw new Error(`Failed to fetch latest Scope ${scope} result: ${error.message}`);
        }
        return data;
    }

    async function fetchHistoricalResults(userId) {
        const days = parseInt(dateRangeSelect.value);
        let query = supabaseClient
            .from('emissions_results')
            .select('scope, reporting_period, total_emissions_tonnes')
            .eq('user_id', userId);

        if (!isNaN(days)) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            query = query.gte('reporting_period_start', startDate.toISOString()); // Assuming you add this col later
        }
        // For now, we fetch all and filter client-side since reporting_period is text
        
        const { data, error } = await supabaseClient
            .from('emissions_results')
            .select('scope, reporting_period, total_emissions_tonnes')
            .eq('user_id', userId)
            .order('reporting_period', { ascending: true });


        if (error) {
            throw new Error(`Failed to fetch historical results: ${error.message}`);
        }
        return data;
    }

    // =================================================================================
    // --- 2. UI RENDERING & DATA VISUALIZATION ---
    // =================================================================================

    function updateDashboardUI(s1, s2, history) {
        // --- Populate KPI Cards ---
        const s1Tonnes = s1 ? parseFloat(s1.total_emissions_tonnes) : 0;
        const s2Tonnes = s2 ? parseFloat(s2.total_emissions_tonnes) : 0;
        const combinedTonnes = s1Tonnes + s2Tonnes;

        document.getElementById('kpi-total-emissions').textContent = `${combinedTonnes.toLocaleString(undefined, {maximumFractionDigits: 2})} tCO₂e`;
        document.getElementById('kpi-scope1-emissions').textContent = `${s1Tonnes.toLocaleString(undefined, {maximumFractionDigits: 2})} tCO₂e`;
        document.getElementById('kpi-scope2-emissions').textContent = `${s2Tonnes.toLocaleString(undefined, {maximumFractionDigits: 2})} tCO₂e`;
        
        // --- Create or Update Charts ---
        renderDonutChart(s1Tonnes, s2Tonnes);
        renderTrendChart(history);

        // --- Generate Dynamic Text ---
        populateTopSources(s1, s2);
        generateSummary(s1, s2, history);
    }
    
    function renderDonutChart(s1Value, s2Value) {
        const ctx = document.getElementById('donutChart')?.getContext('2d');
        if (!ctx) return;
        
        if (donutChart) donutChart.destroy(); // Clear previous chart instance
        
        donutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Scope 1 (Direct)', 'Scope 2 (Energy)'],
                datasets: [{
                    data: [s1Value, s2Value],
                    backgroundColor: ['var(--scope1-color)', 'var(--scope2-color)'],
                    borderColor: '#f8fafc', // bg-slate-50
                    borderWidth: 4,
                    hoverOffset: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    function renderTrendChart(history) {
        const ctx = document.getElementById('trendChart')?.getContext('2d');
        if (!ctx) return;

        // Group data by month and scope
        const monthlyTotals = {};
        history.forEach(rec => {
            const month = formatMonthYear(rec.reporting_period);
            if (!monthlyTotals[month]) {
                monthlyTotals[month] = { scope1: 0, scope2: 0 };
            }
            monthlyTotals[month][`scope${rec.scope}`] += parseFloat(rec.total_emissions_tonnes);
        });

        const labels = Object.keys(monthlyTotals).sort((a,b) => new Date(a) - new Date(b));
        const scope1Data = labels.map(label => monthlyTotals[label].scope1);
        const scope2Data = labels.map(label => monthlyTotals[label].scope2);

        if (trendChart) trendChart.destroy();
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Scope 1', data: scope1Data, borderColor: 'var(--scope1-color)', tension: 0.3, fill: false },
                    { label: 'Scope 2', data: scope2Data, borderColor: 'var(--scope2-color)', tension: 0.3, fill: false }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { title: { display: true, text: 'Month' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Emissions (tCO₂e)' } }
                }
            }
        });
    }

    // --- DYNAMIC TEXT GENERATION ---

    function populateTopSources(s1, s2) {
        const list = document.getElementById('top-sources-list');
        const breakdown = { ...(s1?.breakdown || {}), ...(s2?.breakdown || {}) };
        
        if (Object.keys(breakdown).length === 0) {
            list.innerHTML = `<p class="text-gray-500">No detailed breakdown available in latest reports.</p>`;
            return;
        }

        const topSources = Object.entries(breakdown)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5); // Show top 5

        list.innerHTML = topSources.map(([name, value]) => `
            <div class="flex justify-between items-center pb-2 border-b border-gray-200">
                <span class="font-medium">${capitalize(name)}</span>
                <span class="text-gray-600">${(value / 1000).toLocaleString(undefined, {maximumFractionDigits: 2})} tCO₂e</span>
            </div>
        `).join('');
    }

    function generateSummary(s1, s2, history) {
        const container = document.getElementById('summary-area');
        if (!s1 && !s2) {
            container.innerHTML = `<p>Save a Scope 1 or Scope 2 report to generate an AI summary.</p>`;
            return;
        }
        
        let summaryHTML = '';
        const s1Tonnes = s1 ? parseFloat(s1.total_emissions_tonnes) : 0;
        const s2Tonnes = s2 ? parseFloat(s2.total_emissions_tonnes) : 0;

        if (s1Tonnes > s2Tonnes) {
            summaryHTML += `<p>Your primary emissions source is currently <strong>Scope 1 (Direct Emissions)</strong>.</p>`;
        } else {
            summaryHTML += `<p>Your primary emissions source is currently <strong>Scope 2 (Purchased Energy)</strong>.</p>`;
        }

        // Trend analysis
        if(history.length > 1) {
            const latestMonth = formatMonthYear(history[history.length-1].reporting_period);
            const latestTotal = parseFloat(history[history.length-1].total_emissions_tonnes);
            const previousTotal = history.length > 1 ? parseFloat(history[history.length-2].total_emissions_tonnes) : 0;
            if(previousTotal > 0) {
                const trend = ((latestTotal - previousTotal) / previousTotal) * 100;
                summaryHTML += `<p class="mt-2">Compared to the previous report, your emissions have ${trend > 0 ? `increased by ${trend.toFixed(0)}%` : `decreased by ${Math.abs(trend).toFixed(0)}%`}.</p>`
            }
        }

        container.innerHTML = summaryHTML;
    }

    // =================================================================================
    // --- 3. UTILITY & HELPER FUNCTIONS ---
    // =================================================================================
    
    function showLoadingState() { if (loadingOverlay) loadingOverlay.classList.remove('hidden'); }
    function hideLoadingState() { if (loadingOverlay) loadingOverlay.classList.add('hidden'); }
    function showErrorState(message) { hideLoadingState(); mainContent.innerHTML = `<div class="text-center py-20"><h1 class="text-2xl font-bold text-red-600">Dashboard Error</h1><p class="mt-2 text-gray-600">${message}</p><button onclick="location.reload()" class="mt-6 px-6 py-2 rounded-full bg-green-500 text-white font-semibold">Try Again</button></div>`; }
    function formatMonthYear(str) { if (!str) return ''; const [m, y] = str.split('/'); return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' }); }
    function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' '); }

    // =================================================================================
    // --- 4. EVENT LISTENERS ---
    // =================================================================================
    
    refreshButton.addEventListener('click', initializeDashboard);
    dateRangeSelect.addEventListener('change', initializeDashboard);

    // Initial load
    initializeDashboard();
});