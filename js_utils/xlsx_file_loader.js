const LOYALTY_RULES = [
    { name: '30+ Wizyt', min: 30, max: Infinity, discount: 10, validityDays: 365, visitField: 'visitsInPeriod' },
    { name: 'Roczni Lojalni - Grupa 1', min: 10, max: 20, discount: 5, validityDays: 90, visitField: 'visitsInPeriod' },
    { name: 'Roczni Lojalni - Grupa 2', min: 20, max: 30, discount: 10, validityDays: 180, visitField: 'visitsInPeriod' }
];

const SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP = {
    "Name": 1,
    "Surname": 2,
    "Visit Info": 9
};

// Get a reference to your table instance (initialize it here for global access)
const $reportTable = $('#reportTable');

// Helper function to calculate days between two dates
function daysBetween(a, b) {
    return (b - a) / (1000 * 60 * 60 * 24);
}

// Set default starting date to one year ago, with max attribute to today
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('startDate');
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    // set date format
    const fmt = d => d.toISOString().split('T')[0];

    inp.value = fmt(lastYear);
    inp.max   = fmt(today);
});

// Set default starting date to one year ago, with max attribute to today
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('endDate');
    const today = new Date();

    // format
    const fmt = d => d.toISOString().split('T')[0];

    inp.value = fmt(today);
    inp.max   = fmt(today);
});

// Handle file input change event
document.getElementById('fileInput')
    .addEventListener('change', handleFile);

// Bootstrap Table row styling function
function rowStyle(row) {
    const groupClassMap = {
        'Roczni Lojalni - Grupa 1': 'group-yearly1',
        'Roczni Lojalni - Grupa 2': 'group-yearly2',
        '30+ Wizyt':               'group-over30',
        'Brak statusu':            'group-none'
    };

    const result = evaluateLoyalty({
        visitsInPeriod: row.visitsInPeriod,
        lastVisit:      lastVisitDateObj(row.lastVisit)
    });
    const classes = [];
    if (result.highlightNext) classes.push('next-threshold');
    if (result.expired)       classes.push('reached');
    const groupClass = groupClassMap[result.status];
    if (groupClass)            classes.push(groupClass);

    return { classes: classes.join(' ') };
}

// Handle file input and parse the Excel file
function handleFile(ev) {
    const file = ev.target.files[0];
    if (!file) return;

    const startDate = new Date(
        document.getElementById('startDate').value
    );

    const reader = new FileReader();
    reader.onload = e => {
        const data   = new Uint8Array(e.target.result);
        const wb     = XLSX.read(data, { type: 'array' });
        const ws     = wb.Sheets[wb.SheetNames[0]];
        const rows   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        rows.pop();                  // drop “Suma”
        const dataRows = rows.slice(1);

        // parse raw
        const raw = dataRows.map(r => ({
            name:             r[SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP["Name"]],
            surname:          r[SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP["Surname"]],
            visitDate:        r[SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP["Visit Info"]].split(' - ')[0].trim(),
            totalVisitsCount: parseInt(r[SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP["Visit Info"]].split(' - ')[1], 10) || 0
        }));

        // group by patient
        const grouped = {};
        raw.forEach(item => {
            const key = `${item.name} ${item.surname}`;
            if (!grouped[key]) grouped[key] = { dates: [], totalVisits: 0 };
            if (item.visitDate && item.visitDate !== '-') {
                grouped[key].dates.push(new Date(item.visitDate));
            }
            grouped[key].totalVisits = item.totalVisitsCount;
        });

        const patients = Object.entries(grouped).map(([fullName, p]) => {
            const visitsInPeriod = p.dates.filter(d => d >= startDate).length;
            const lastVisitDate  = p.dates.length
                ? new Date(Math.max(...p.dates.map(d => d.getTime())))
                : null;

            // Base row data
            const row = {
                name:           fullName,
                visitsInPeriod,
                lastVisit:      lastVisitDate
                    ? lastVisitDate.toISOString().split('T')[0]
                    : '',
                expires:        ''   // placeholder
            };

            // 1) Evaluate loyalty
            let result = evaluateLoyalty({
                visitsInPeriod: row.visitsInPeriod,
                lastVisit:      lastVisitDate
            });

            // 2) Compute the expiration date
            let expiryDate = '----';
            if (lastVisitDate && result.status !== 'Brak statusu') {
                const rule = LOYALTY_RULES.find(r => r.name === result.status);
                const e = new Date(lastVisitDate);
                e.setDate(e.getDate() + (rule?.validityDays || 0));

                // If expiry has passed, override status
                if (e < new Date()) { // Compare against current date
                    result.status = 'Brak statusu';
                    result.discount = 0;
                    expiryDate = '----';
                } else {
                    expiryDate = e.toISOString().split('T')[0];
                }
            }

            row.expires   = expiryDate;
            row.status    = result.status;
            row.threshold = result.nextThreshold;
            row.discount  = result.discount;

            return row;
        });

        // Populate threshold and status dropdowns AFTER patients data is ready
        populateThresholdDropdown(patients);
        populateStatusDropdown(patients); // Now this will populate your custom status filter

        // Attach event listeners for filtering
        document.getElementById('patientSearch')
            .addEventListener('keyup', applyAllFilters);

        // All .threshold-option and .status-option checkboxes get their
        // change listeners in populateThresholdDropdown and populateStatusDropdown.

        document.getElementById('reportSection').style.display = 'block';

        // re-init table with precomputed data
        $reportTable
            .bootstrapTable('destroy')
            .bootstrapTable({
                data:          patients,
                showColumns:   true,
                showMultiSort: true,
                sortPriority: [
                    { sortName: 'expires',      sortOrder: 'desc'  } // Initial sort priority
                ],
                rowStyle:      rowStyle,
                // data-filter-control="true" is important for filter-control-container to work
                dataFilterControl: true // Set this option in JS for the table
            });

        // After initial table load/data set, apply initial filters if any, and then sort
        applyAllFilters();
    };
    reader.readAsArrayBuffer(file);
}

// util to convert lastVisit string back to Date
function lastVisitDateObj(str) {
    return str ? new Date(str) : null;
}

// Evaluate loyalty status based on the rules defined above
function evaluateLoyalty(p) {
    const now = new Date();

    // read dynamic highlight threshold:
    const thresholdInput = document.getElementById('highlightThreshold');
    let threshold = 3;
    if (thresholdInput) {
        const v = parseInt(thresholdInput.value, 10);
        if (!isNaN(v) && v > 0) threshold = v;
    }

    for (let rule of LOYALTY_RULES) {
        // pick the correct count based on the rule
        const count = p[rule.visitField] || 0;

        if (count >= rule.min && count < rule.max) {
            const nextThreshold = rule.max === Infinity
                ? '0'
                : `${rule.max - count}`;

            // expiration always based on lastVisit date
            const expired = p.lastVisit
                ? daysBetween(p.lastVisit, now) > rule.validityDays
                : true; // Consider expired if no last visit but rule requires it

            return {
                status:        rule.name,
                discount:      rule.discount,
                nextThreshold,
                highlightNext: (rule.max !== Infinity && (rule.max - count) <= threshold),
                expired
            };
        }
    }

    // no rule matched → “Brak statusu”
    const first = LOYALTY_RULES[0]; // Assuming there's always at least one rule
    const baseCount = p[first.visitField] || 0;
    const toFirst   = first.min - baseCount;
    return {
        status:        'Brak statusu',
        discount:      0,
        nextThreshold: `${toFirst}`,
        highlightNext: toFirst <= threshold,
        expired:       false
    };
}

// Toggle visibility of the file upload instruction
function hideOrShowFileUploadInstruction() {
    var x = document.getElementById("instruction");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}

// Populate the dropdown with unique "nextThreshold" values
function populateThresholdDropdown(patients) {
    const menu = document.getElementById('thresholdMenu');
    menu.innerHTML = '';

    // 1) Add Select/Deselect all buttons for Threshold filter
    const actions = document.createElement('div');
    actions.className = 'px-2 py-1';
    actions.innerHTML = `
    <button type="button" id="selectAllThreshold"   class="btn btn-sm btn-link">Zaznacz wszystkie</button>
    <button type="button" id="deselectAllThreshold" class="btn btn-sm btn-link">Odznacz wszystkie</button>
    <div class="dropdown-divider"></div>
  `;
    menu.appendChild(actions);

    // Wire up those buttons (keep dropdown open)
    ['selectAllThreshold','deselectAllThreshold'].forEach(id => {
        const btn = actions.querySelector('#' + id);
        btn.addEventListener('click', e => {
            e.stopPropagation(); // Keep dropdown open
            const shouldCheck = (id === 'selectAllThreshold');

            document.querySelectorAll('.threshold-option').forEach(inp => {
                if (inp.checked !== shouldCheck) {
                    inp.checked = shouldCheck;
                }
            });
            applyAllFilters(); // Apply filters once after all checkboxes are updated
        });
    });

    // 2) Populate each threshold option
    const unique = Array.from(new Set(
        patients.map(p => p.threshold) // Use p.threshold directly as it's already computed
    )).sort((a,b) => (parseInt(a,10)||0) - (parseInt(b,10)||0));

    unique.forEach(val => {
        const id = 'th-' + String(val).replace(/\s+/g,'_'); // Ensure val is string for replace
        const label = document.createElement('label');
        label.className = 'dropdown-item form-check mb-0';
        label.style.cursor = 'pointer';
        label.innerHTML = `
      <input class="form-check-input threshold-option me-2"
             type="checkbox"
             value="${val}"
             id="${id}"
             checked>
      ${val}
    `;

        // prevent dropdown from closing when clicking label or checkbox
        label.addEventListener('click', e => e.stopPropagation());
        label.querySelector('input').addEventListener('click', e => e.stopPropagation());

        menu.appendChild(label);
    });

    // 3) Use the change event to trigger filtering
    document.querySelectorAll('.threshold-option').forEach(inp => {
        inp.addEventListener('change', applyAllFilters);
    });
}

// Populate the dropdown with unique "Status" values
function populateStatusDropdown(patients) {
    const menu = document.getElementById('statusMenu');
    menu.innerHTML = '';  // clear old items

    // 1) Select/Deselect All buttons
    const actions = document.createElement('div');
    actions.className = 'px-2 py-1';
    actions.innerHTML = `
    <button type="button" id="selectAllStatus"   class="btn btn-sm btn-link">Zaznacz wszystkie</button>
    <button type="button" id="deselectAllStatus" class="btn btn-sm btn-link">Odznacz wszystkie</button>
    <div class="dropdown-divider"></div>
  `;
    menu.appendChild(actions);

    actions.querySelector('#selectAllStatus')
        .addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.status-option')
                .forEach(cb => cb.checked = true);
            applyAllFilters();
        });
    actions.querySelector('#deselectAllStatus')
        .addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.status-option')
                .forEach(cb => cb.checked = false);
            applyAllFilters();
        });

    // 2) Unique statuses from patients array
    const uniqueStatuses = Array.from(new Set(
        patients.map(p => p.status)
    )).sort();

    // 3) Populate checkboxes
    uniqueStatuses.forEach(status => {
        const id = 'st-' + String(status).replace(/\s+/g,'_');
        const label = document.createElement('label');
        label.className = 'dropdown-item form-check mb-0';
        label.style.cursor = 'pointer';
        label.innerHTML = `
      <input type="checkbox"
             class="form-check-input status-option me-2"
             id="${id}"
             value="${status}"
             checked>
      ${status}
    `;
        // prevent dropdown from closing
        label.addEventListener('click', e => e.stopPropagation());
        label.querySelector('input')
            .addEventListener('click', e => e.stopPropagation());

        menu.appendChild(label);
    });

    // 4) Bind filter logic
    document.querySelectorAll('.status-option')
        .forEach(cb => cb.addEventListener('change', applyAllFilters));
}

// Apply filtering
function applyAllFilters() {
    const nameFilter = document.getElementById('patientSearch').value.toLowerCase().trim();

    // Get selected statuses from the custom checkboxes
    const selectedStatuses = Array.from(document.querySelectorAll('.status-option:checked'))
        .map(cb => cb.value);

    // Get selected thresholds
    const selectedThresholds = Array.from(document.querySelectorAll('.threshold-option:checked'))
        .map(cb => cb.value);

    // Prepare the filters object for filterBy
    const filters = {};

    // Add name filter if present
    if (nameFilter !== '') {
        filters.name = nameFilter;
    }

    // Add status filter if selections exist, OR if empty, make it so no rows match
    if (selectedStatuses.length > 0) {
        filters.status = selectedStatuses;
    } else {
        // If no status is selected (Deselect All), explicitly set an empty array
        // This will be handled by the filterAlgorithm to return false for all rows
        filters.status = [];
    }

    // Add threshold filter if selections exist, OR if empty, make it so no rows match
    if (selectedThresholds.length > 0) {
        filters.threshold = selectedThresholds;
    } else {
        // If no threshold is selected (Deselect All), explicitly set an empty array
        // This will be handled by the filterAlgorithm to return false for all rows
        filters.threshold = [];
    }


    // Define a custom filter algorithm to combine all filter types (AND logic between types)
    const filterAlgorithm = (row, filters) => {
        let match = true; // Assume row matches initially

        // Check for name filter (case-insensitive includes)
        if (filters.name) {
            const rowName = row.name ? String(row.name).toLowerCase() : '';
            match = match && rowName.includes(filters.name);
        }

        // Check for status filter (multi-select 'OR' logic)
        // If filters.status is an empty array (from 'Deselect All'), it means no rows should match this criteria.
        if (filters.status) { // Ensure filters.status is defined in the filters object
            const rowStatus = row.status ? String(row.status) : '';
            if (Array.isArray(filters.status)) {
                if (filters.status.length === 0) {
                    // If no statuses are selected, then this filter should cause no matches
                    match = false;
                } else {
                    // Match if the row's status is one of the selected ones
                    match = match && filters.status.includes(rowStatus);
                }
            } else {
                // This case should not typically happen with checkboxes, but for robustness
                match = match && (rowStatus === filters.status);
            }
        }

        // Check for threshold filter (multi-select 'OR' logic)
        // If filters.threshold is an empty array (from 'Deselect All'), it means no rows should match this criteria.
        if (filters.threshold) { // Ensure filters.threshold is defined in the filters object
            const rowThreshold = row.threshold ? String(row.threshold) : '';
            if (Array.isArray(filters.threshold)) {
                if (filters.threshold.length === 0) {
                    // If no thresholds are selected, then this filter should cause no matches
                    match = false;
                } else {
                    // Match if the row's threshold is one of the selected ones
                    match = match && filters.threshold.includes(rowThreshold);
                }
            } else {
                // This case should not typically happen with checkboxes, but for robustness
                match = match && (rowThreshold === filters.threshold);
            }
        }

        return match; // Return true if the row should be shown, false otherwise
    };

    // Apply filters using Bootstrap Table's filterBy method
    $reportTable.bootstrapTable('filterBy', filters, {
        filterAlgorithm: filterAlgorithm
    });

    // === Crucial Addition: Reapply current sorting after filtering ===
    const currentOptions = $reportTable.bootstrapTable('getOptions');
    const sortOrder = currentOptions.sortOrder;
    const sortName = currentOptions.sortName;
    const sortPriority = currentOptions.sortPriority; // Get the initial sort priority


    if (sortPriority && sortPriority.length > 0) {
        $reportTable.bootstrapTable('multiSort', sortPriority);
    }
}
