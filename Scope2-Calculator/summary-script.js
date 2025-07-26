// =================================================================================
// --- LEAFCALC: SUMMARY PAGE MASTER SCRIPT (PHASE 2 - AGGREGATION COMPLETE) ---
// =================================================================================

// --- DOM ELEMENT REFERENCES ---
const container = document.getElementById('summaryCardsContainer');
const calculateBtn = document.getElementById('calculateBtn');
const calculateBtnWrapper = document.getElementById('calculateBtnWrapper');
const toastElement = document.getElementById('toast');
const modalElement = document.getElementById('confirmationModal');
const selectedPeriodDisplay = document.getElementById('selected-period-display');
const navUserIcon = document.getElementById('nav-user-icon');

// --- GLOBAL STATE ---
let allData = {}; // Raw, un-aggregated data from Supabase
let aggregatedData = {}; // Processed, aggregated data for display
let selectedMonthYear = null; // Tracks the currently selected reporting period, e.g., "05/2024"
let currentUser = null; // Holds the logged-in user object

// =================================================================================
// --- UNIT CONVERSION UTILITY ---
// Converts all values to a standard for accurate aggregation and calculation.
// =================================================================================
const UNIT_CONVERSION_FACTORS = {
    // Standard unit: kWh
    'kWh': 1, 'MWh': 1000, 'GWh': 1000000,
    'BTU': 0.000293071, 'Tonnes of Refrigeration': 3.51685,
    'GJ': 277.778, 'Therm': 29.3001, 'MMBtu': 293.071,
    // Standard unit: lbs
    'lbs (pounds)': 1, 'kg (kilograms)': 2.20462
};

function convertToStandardUnit(quantity, unit) {
    const factor = UNIT_CONVERSION_FACTORS[unit] || 1;
    return parseFloat(quantity) * factor;
}

// =================================================================================
// --- CORE DATA HANDLING & INITIALIZATION ---
// =================================================================================

async function initializePage() {
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Development guard to prevent redirection
    if (!user) { 
        console.warn("No user logged in. Page functionality will be limited.");
        renderAllTables(); // Render empty state
        return;
    }
    currentUser = user;

    const { data: records, error: fetchError } = await supabaseClient
        .from('emissions_data')
        .select('*')
        .eq('user_id', user.id); // Security: Only fetch the current user's data

    if (fetchError) {
        showToast(`Error fetching data: ${fetchError.message}`, 'error');
        return;
    }
    
    allData = processRawData(records);
    aggregatedData = aggregateData(allData);
    renderAllTables();
}

function processRawData(records) {
    const processed = { electricity: [], heating: [], cooling: [], steam: [] };
    records.forEach(record => {
        if (processed[record.category]) {
            processed[record.category].push({ id: record.id, ...record.form_data });
        }
    });

    for (const category in processed) {
        processed[category].sort((a, b) => {
            const [aMonth, aYear] = a.month.split('/');
            const [bMonth, bYear] = b.month.split('/');
            if (bYear !== aYear) return bYear - aYear;
            return bMonth - aMonth;
        });
    }
    return processed;
}

function aggregateData(data) {
    const result = { electricity: [], heating: [], cooling: [], steam: [] };
    for (const category in data) {
        const groups = {};
        data[category].forEach(row => {
            if (!groups[row.month]) groups[row.month] = [];
            groups[row.month].push(row);
        });
        
        for (const month in groups) {
            const entries = groups[month];
            if (entries.length > 1) {
                const totalQuantity = entries.reduce((sum, entry) => sum + convertToStandardUnit(entry.quantity, entry.unit), 0);
                const standardUnit = category === 'steam' ? 'lbs' : 'kWh'; // Common unit for aggregation display
                result[category].push({
                    isAggregated: true,
                    month: month,
                    region: 'Multiple',
                    quantity: totalQuantity,
                    unit: standardUnit,
                    subRows: entries,
                    id: entries.map(e => e.id).join(',')
                });
            } else {
                result[category].push(entries[0]);
            }
        }
    }
    return result;
}

// =================================================================================
// --- UI RENDERING (AGGREGATION-AWARE) ---
// =================================================================================

function renderAllTables() {
    Object.keys(aggregatedData).forEach(category => renderTable(category));
    updateCalculateButtonState();
}

function renderTable(category) {
    const tableBody = document.getElementById(`tableBody-${category}`);
    const data = aggregatedData[category] || [];

    if (!tableBody) return;
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-gray-500">No entries added for this category.</td></tr>`;
        return;
    }
    
    data.forEach((row, index) => {
        const standardUnit = category === 'steam' ? 'lbs' : 'kWh';
        const quantityDisplay = row.isAggregated 
            ? `${row.quantity.toLocaleString(undefined, {maximumFractionDigits: 0})} <span class="text-xs text-gray-500">(${row.subRows.length} entries)</span>`
            : parseFloat(row.quantity).toLocaleString();

        const tr = document.createElement('tr');
        tr.className = 'animate-fade-in-row';
        tr.innerHTML = `
            <td class="p-3 w-8 text-center"><input type="checkbox" class="form-checkbox row-checkbox text-[#53d22c] rounded" data-month-year="${row.month}" data-category="${category}"></td>
            <td class="p-3">${row.month}</td>
            <td class="p-3">${row.region}</td>
            <td class="p-3">${quantityDisplay}</td>
            <td class="p-3">${row.isAggregated ? standardUnit : row.unit}</td>
            <td class="p-3 text-right">
                ${row.isAggregated ? 
                    `<button onclick="toggleSubRows('${category}', ${index})" class="p-1 rounded-full hover:bg-gray-200/50"><span class="material-icons text-base transition-transform" id="chevron-${category}-${index}">expand_more</span></button>` :
                    `<div class="space-x-2">
                        <button onclick="handleEdit('${category}', '${row.id}')" class="text-gray-500 hover:text-[#53d22c] transition" title="Edit"><span class="material-icons text-base">edit</span></button>
                        <button onclick="handleDelete('${category}', '${row.id}')" class="text-gray-500 hover:text-red-500 transition" title="Delete"><span class="material-icons text-base">delete</span></button>
                    </div>`
                }
            </td>
        `;
        tableBody.appendChild(tr);

        if (row.isAggregated) {
            row.subRows.forEach(subRow => {
                const subTr = document.createElement('tr');
                subTr.className = `hidden sub-row sub-row-${category}-${index} bg-gray-50/30`;
                subTr.innerHTML = `
                    <td class="p-3 w-8"></td>
                    <td class="p-3 pl-6 text-gray-600 text-xs" colspan="2">${subRow.region}</td>
                    <td class="p-3 text-gray-600 text-xs">${parseFloat(subRow.quantity).toLocaleString()}</td>
                    <td class="p-3 text-gray-600 text-xs">${subRow.unit}</td>
                    <td class="p-3 text-right space-x-2">
                        <button onclick="handleEdit('${category}', '${subRow.id}')" class="text-gray-400 hover:text-[#53d22c] transition" title="Edit"><span class="material-icons text-sm">edit</span></button>
                        <button onclick="handleDelete('${category}', '${subRow.id}')" class="text-gray-400 hover:text-red-500 transition" title="Delete"><span class="material-icons text-sm">delete</span></button>
                    </td>
                `;
                tableBody.appendChild(subTr);
            });
        }
    });
}

function toggleSubRows(category, index) {
    document.querySelectorAll(`.sub-row-${category}-${index}`).forEach(row => row.classList.toggle('hidden'));
    document.getElementById(`chevron-${category}-${index}`).classList.toggle('rotate-180');
}

// =================================================================================
// --- INTERACTION LOGIC & UI STATE MANAGEMENT ---
// =================================================================================

function handleCheckboxChange(event) {
    const targetCheckbox = event.target;
    const monthYear = targetCheckbox.dataset.monthYear;
    
    if (targetCheckbox.checked) {
        selectedMonthYear = monthYear;
        synchronizeCheckboxes(selectedMonthYear);
        selectedPeriodDisplay.textContent = `Calculating for: ${formatMonthYear(selectedMonthYear)}`;
    } else {
        const remainingChecked = Array.from(document.querySelectorAll('.row-checkbox')).some(cb => cb.checked);
        if (!remainingChecked) {
            selectedMonthYear = null;
            selectedPeriodDisplay.textContent = 'Please select a month to begin calculation.';
        }
    }
    updateCalculateButtonState();
}

function synchronizeCheckboxes(monthYear) {
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.checked = cb.dataset.monthYear === monthYear;
    });
}

function updateCalculateButtonState() {
    const hasSelection = !!selectedMonthYear; // Coerces to boolean
    calculateBtn.disabled = !hasSelection;
    calculateBtnWrapper.classList.toggle('cursor-not-allowed', !hasSelection);
    
    if (hasSelection) {
        calculateBtn.classList.remove('bg-gray-400/20', 'border-gray-400/30', 'pointer-events-none');
        calculateBtn.classList.add('bg-[#53d22c]', 'border-[#53d22c]/30', 'text-white');
    } else {
        calculateBtn.classList.add('bg-gray-400/20', 'border-gray-400/30', 'pointer-events-none');
        calculateBtn.classList.remove('bg-[#53d22c]', 'text-white', 'border-[#53d22c]/30');
    }
}

function formatMonthYear(monthYearStr) {
    const [month, year] = monthYearStr.split('/');
    return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

// =================================================================================
// --- CRUD ACTIONS & MODALS ---
// =================================================================================

async function handleDelete(category, id) {
    const isConfirmed = await showConfirmationModal('Delete Entry?', 'This action is permanent and cannot be undone.');
    if (!isConfirmed) return;
    
    const { error } = await supabaseClient.from('emissions_data').delete().eq('id', id);

    if (error) {
        showToast(`Error: ${error.message}`, 'error');
    } else {
        showToast('Entry deleted successfully.', 'success');
        initializePage(); // Full reload to get fresh data
    }
}

function handleEdit(category, id) {
    alert("Edit functionality is coming soon. For now, please delete this entry and create a new one.");
    // Future implementation: window.location.href = `${category}.html?edit=${id}`;
}

function showToast(message, type = 'success') {
    toastElement.textContent = message;
    toastElement.className = 'fixed bottom-24 right-6 bg-white/90 backdrop-blur-md text-sm px-4 py-2 rounded-lg shadow-lg z-[100] border'; // Reset classes
    toastElement.classList.add(type === 'error' ? 'text-red-700' : 'text-green-700', type === 'error' ? 'border-red-200' : 'border-green-200');
    toastElement.classList.remove('hidden');
    setTimeout(() => toastElement.classList.add('hidden'), 4000);
}

function showConfirmationModal(title, message) {
    return new Promise(resolve => {
        modalElement.innerHTML = `
            <div class="bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl p-8 w-full max-w-md animate-fade-in-up">
                <h3 class="text-xl font-bold text-gray-800 text-center mb-4">${title}</h3>
                <p class="text-center text-gray-700 mb-8">${message}</p>
                <div class="flex justify-center gap-4">
                    <button id="modalCancelBtn" class="px-6 py-2 rounded-full bg-gray-200/50 text-black font-semibold hover:bg-gray-300/60 transition">Cancel</button>
                    <button id="modalConfirmBtn" class="px-6 py-2 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 transition">Confirm</button>
                </div>
            </div>`;
        modalElement.classList.remove('hidden');

        document.getElementById('modalConfirmBtn').onclick = () => { modalElement.classList.add('hidden'); resolve(true); };
        document.getElementById('modalCancelBtn').onclick = () => { modalElement.classList.add('hidden'); resolve(false); };
    });
}

// =================================================================================
// --- FINAL CALCULATION & NAVIGATION ---
// =================================================================================

function handleCalculate() {
    if (!selectedMonthYear) {
        showToast('Please select a reporting period.', 'error');
        return;
    }

    const selectedRowsForCalc = [];
    const categories = ['electricity', 'heating', 'cooling', 'steam'];

    // This logic ensures we use the raw, individual entries for calculation, not the aggregated display data.
    categories.forEach(category => {
        if(allData[category]) {
            allData[category].forEach(row => {
                if (row.month === selectedMonthYear) {
                    selectedRowsForCalc.push({ category, ...row });
                }
            });
        }
    });
    
    if (document.querySelectorAll('.row-checkbox:checked').length === 0) {
        showToast('You have deselected all entries for this period.', 'error');
        return;
    }
    
    // Pass the raw data to the results page via localStorage
    localStorage.setItem('calculationData', JSON.stringify(selectedRowsForCalc));
    window.location.href = '/Scope2-Calculator/result.html';
}

// =================================================================================
// --- EVENT LISTENERS ---
// =================================================================================

// Initialize the page when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePage);

// THIS IS THE MISSING LINE THAT FIXES THE PROBLEM
// Listen for any 'change' event (like a checkbox click) inside the main container
container.addEventListener('change', handleCheckboxChange);

// Attach event listener to the calculate button
calculateBtn.addEventListener('click', handleCalculate)