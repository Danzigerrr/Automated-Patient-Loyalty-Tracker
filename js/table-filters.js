// Applies all active filters to the Bootstrap Table and reapplies sorting.


// Apply filtering
function applyAllFilters() {
    const nameFilter = document.getElementById('patientSearch').value.toLowerCase().trim();

    // Get selected statuses from the custom checkboxes
    const selectedStatuses = Array.from(document.querySelectorAll('.status-option:checked'))
        .map(cb => cb.value);

    // Get selected thresholds
    const selectedThresholds = Array.from(document.querySelectorAll('.threshold-option:checked'))
        .map(cb => cb.value);

    // Get state of the new quick filter checkboxes
    const isExpiringChecked = document.getElementById('statusExpiringButton').checked;
    const isUpgradingChecked = document.getElementById('statusUpgradingButton').checked;

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

    // Add new quick filter states to the filters object
    if (isExpiringChecked) {
        filters.isExpiring = true;
    }
    if (isUpgradingChecked) {
        filters.isUpgrading = true;
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
        // --- Quick Filter Logic ---
        const today = new Date(); // Current date for expiration calculations

        // "Status do wygaśnięcia" filter
        if (filters.isExpiring) {
            const currentStatus = row.status;
            const expiryDateStr = row.expires;
            const expiryDate = expiryDateStr !== '----' ? new Date(expiryDateStr) : null;

            let rowIsExpiring = false;
            if (currentStatus !== 'Brak statusu' && expiryDate) {
                const timeDiff = expiryDate.getTime() - today.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Round up to include today
                rowIsExpiring = daysLeft >= 0 && daysLeft <= 7; // Expires today or in next 7 days
            }
            match = match && rowIsExpiring;
        }

        // "Status do ulepszenia" filter
        if (filters.isUpgrading) {
            const rowThreshold = parseInt(row.threshold, 10);
            let rowIsUpgrading = false;
            if (!isNaN(rowThreshold)) {
                rowIsUpgrading = rowThreshold >= 1 && rowThreshold <= 3;
            }
            match = match && rowIsUpgrading;
        }

        return match; // Return true if the row should be shown, false otherwise
    };

    // Apply filters using Bootstrap Table's filterBy method
    $reportTable.bootstrapTable('filterBy', filters, {
        filterAlgorithm: filterAlgorithm
    });

    // Reapply current sorting after filtering ===
    const currentOptions = $reportTable.bootstrapTable('getOptions');
    const sortPriority = currentOptions.sortPriority; // Get the initial sort priority

    if (sortPriority && sortPriority.length > 0) {
        $reportTable.bootstrapTable('multiSort', sortPriority);
    }
}


// Populate the dropdown with unique "nextThreshold" values
// Depends on: applyAllFilters (defined here), evaluateLoyalty (from loyalty-engine.js)

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

