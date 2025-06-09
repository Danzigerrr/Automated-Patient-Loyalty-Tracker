const LOYALTY_RULES = [
    {
        name:       '30+ Wizyt',
        min:        30,
        max:        Infinity,
        discount:   10,
        validityDays: 365,
        visitField: 'visitsInTotal'     // use total‐ever count
    },
    {
        name:       'Roczni Lojalni – Grupa 1',
        min:        10,
        max:        20,
        discount:   5,
        validityDays: 90,
        visitField: 'visitsInPeriod'    // use last‐365‐days count
    },
    {
        name:       'Roczni Lojalni – Grupa 2',
        min:        20,
        max:        30,
        discount:   10,
        validityDays: 180,
        visitField: 'visitsInPeriod'    // use last‐365‐days count
    }
];

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

    // format YYYY-MM-DD
    const fmt = d => d.toISOString().split('T')[0];

    inp.value = fmt(lastYear);
    inp.max   = fmt(today);
});


// Handle file input change event
document.getElementById('fileInput')
    .addEventListener('change', handleFile);


// Bootstrap Table row styling
function rowStyle(row, index) {
        const groupClassMap = {
        'Roczni Lojalni - Grupa 1': 'group-yearly1',
        'Roczni Lojalni - Grupa 2': 'group-yearly2',
        '30+ Wizyt':               'group-over30',
        'Brak statusu':            'group-none'
        };

    const result = evaluateLoyalty({
        visitsInPeriod: row.visitsInPeriod,
        visitsInTotal:  row.visitsInTotal,
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
            name:             r[1],
            surname:          r[2],
            visitDate:        r[9].split(' - ')[0].trim(),
            totalVisitsCount: parseInt(r[9].split(' - ')[1], 10) || 0
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

        // build final array with all bootstrap-table fields
        const patients = Object.entries(grouped).map(([fullName, p]) => {
            const visitsInPeriod = p.dates.filter(d => d >= startDate).length;
            const lastVisitDate  = p.dates.length
                ? new Date(Math.max(...p.dates.map(d=>d.getTime())))
                : null;

            const row = {
                name:            fullName,
                visitsInPeriod,
                visitsInTotal:   p.totalVisits,
                lastVisit:       lastVisitDate
                    ? lastVisitDate.toISOString().split('T')[0]
                    : '',
            };

            // evaluate loyalty once, attach to row
            const result = evaluateLoyalty({
                visitsInPeriod: row.visitsInPeriod,
                visitsInTotal:  row.visitsInTotal,
                lastVisit:      lastVisitDate
            });
            row.status    = result.status;
            row.threshold = result.nextThreshold;
            row.discount  = result.discount;

            return row;
        });

            populateThresholdDropdown(patients);

            // Attach listeners once
            document.querySelectorAll('.threshold-option')
                .forEach(cb => cb.addEventListener('change', applyAllFilters));
            document.getElementById('patientSearch')
                .addEventListener('keyup', applyAllFilters);


            document.getElementById('reportSection').style.display = 'block';

        // re-init table with precomputed data
        $('#reportTable')
            .bootstrapTable('destroy')
            .bootstrapTable({
                data:          patients,
                showColumns:   true,
                showMultiSort: true,
                sortPriority: [
                    { sortName: 'threshold',      sortOrder: 'asc'  },
                    { sortName: 'visitsInPeriod', sortOrder: 'desc' }
                ],
                rowStyle:      rowStyle
            })
        ;
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
                : true;

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
    const first = LOYALTY_RULES[0];
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
    menu.innerHTML = '';  // clear old items

    const unique = Array.from(new Set(
        patients.map(p => evaluateLoyalty(p).nextThreshold)
    )).sort((a, b) =>
        (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0)
    );

    unique.forEach(val => {
        const id = 'th-' + val.replace(/\s+/g, '_');

        // Create the label-as-item
        const label = document.createElement('label');
        label.className = 'dropdown-item form-check mb-0';
        label.style.cursor = 'pointer';

        label.innerHTML = `
      <input class="form-check-input threshold-option me-2"
             type="checkbox"
             value="${val}"
             id="${id}">
      ${val}
    `;

        // **Prevent dropdown from closing when label clicked**
        label.addEventListener('click', e => {
            e.stopPropagation();
            // Also manually toggle the checkbox
            const cb = label.querySelector('input[type="checkbox"]');
            cb.checked = !cb.checked;
            applyAllFilters();
        });

        menu.appendChild(label);
    });

    // Re-bind filter logic on checkboxes as well (if needed)
    document.querySelectorAll('.threshold-option').forEach(cb => {
        cb.addEventListener('change', applyAllFilters);
    });
}


// Apply both name search + threshold dropdown filtering
function applyAllFilters() {
    const nameFilter = document.getElementById('patientSearch').value.toLowerCase();

    // Gather all checked thresholds
    const selected = Array.from(document.querySelectorAll('.threshold-option:checked'))
        .map(cb => cb.value);
    const matchAll = selected.length === 0;

    document.querySelectorAll('#reportTable tbody tr').forEach(tr => {
        const name = tr.children[0].textContent.toLowerCase();
        const threshold = tr.children[5].textContent.trim();

        const nameOk = name.includes(nameFilter);
        const thresholdOk = matchAll || selected.includes(threshold);

        tr.style.display = (nameOk && thresholdOk) ? '' : 'none';
    });
}

