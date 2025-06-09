// --- 1. Definicja reguł lojalnościowych ---
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


// --- 2. Pomocnik do obliczeń datowych ---
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


// --- 3. Wczytanie i parsowanie pliku XLSX ---
document.getElementById('fileInput')
    .addEventListener('change', handleFile);

function handleFile(ev) {
    const file = ev.target.files[0];
    if (!file) return;

    const startDate = new Date(
        document.getElementById('startDate').value
    );

    const reader = new FileReader();
    reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        const wb   = XLSX.read(data, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // remove the first and the last rows
        rows.pop();
        const dataRows = rows.slice(1);

        const raw = dataRows.map(r => ({
            name:     r[1],
            surname:  r[2],
            datesOfVisits: r[9].split(' - ')[0].trim(),
            totalVisitsCounter: r[9].split(' - ')[1] ? r[9].split(' - ')[1] : '-'
        }));

        // grupowanie i budowanie historii dat
        const grouped = {};
        raw.forEach(item => {
            const key = `${item.name} ${item.surname}`;
            if (!grouped[key]) {
                grouped[key] = { ...item, dates: [] };
            }
            if (item.datesOfVisits !== '-' && item.datesOfVisits !== '') {
                const datePart = item.datesOfVisits;
                grouped[key].dates.push(new Date(datePart));
            }
            if (item.totalVisitsCounter !== '-' && item.totalVisitsCounter !== '') {
                grouped[key].maxVisits = parseInt(item.totalVisitsCounter, 10) || 0;
            }
        });

        // przygotuj obiekt pacjenta z liczbą wizyt i datą ostatniej wizyty
        const patients = Object.values(grouped).map(p => {
            const visitsInPeriod = p.dates.filter(d => d >= startDate).length;
            const lastVisit = p.dates.length
                ? new Date(Math.max(...p.dates.map(d => d.getTime())))
                : null;
            const visitsInTotal = p.maxVisits || 0;
            return {
                name:            `${p.name} ${p.surname}`,
                visitsInPeriod,
                lastVisit,
                visitsInTotal
            };
        });

        renderReport(patients);
    };
    reader.readAsArrayBuffer(file);
}

// --- 4. Ewaluacja statusu lojalnościowego ---
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
                ? '0 wizyt'
                : `${rule.max - count} wizyt`;

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
        nextThreshold: `${toFirst} wizyt`,
        highlightNext: toFirst <= threshold,
        expired:       false
    };
}




function hideOrShowFileUploadInstruction() {
    var x = document.getElementById("instruction");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}


// TABLE FILTERING AND SORTING


// Sort by "Do kolejnej wizyty" column - using the threshold values
// Toggle flag for ascending / descending of "Do kolejnej wizyty" column
let thresholdSortAsc = false;

document.getElementById('sortThreshold')
    .addEventListener('click', () => {
        const tbody = document.querySelector('#reportTable tbody');
        // Grab existing rows
        const rows = Array.from(tbody.querySelectorAll('tr'));

        // Sort them by integer in 6th cell ("Do kolejnej wizyty")
        rows.sort((a, b) => {
            const aText = a.children[5].textContent.trim();
            const bText = b.children[5].textContent.trim();
            const aNum  = parseInt(aText, 10) || 0;
            const bNum  = parseInt(bText, 10) || 0;
            return thresholdSortAsc
                ? aNum - bNum
                : bNum - aNum;
        });

        // Clear and re-append in sorted order
        tbody.innerHTML = '';
        rows.forEach(r => tbody.appendChild(r));

        // Flip the sort order for next click
        thresholdSortAsc = !thresholdSortAsc;
    });


// THRESHOLD FILTERING
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

function renderReport(patients) {
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = '';

    const groupClassMap = {
        'Roczni Lojalni - Grupa 1': 'group-yearly1',
        'Roczni Lojalni - Grupa 2': 'group-yearly2',
        '30+ Wizyt':               'group-over30',
        'Brak statusu':            'group-none'
    };

    // --- Sort patients by their numeric “nextThreshold” ascending ---
    patients.sort((a, b) => {
        const aTh = parseInt(evaluateLoyalty(a).nextThreshold, 10) || 0;
        const bTh = parseInt(evaluateLoyalty(b).nextThreshold, 10) || 0;
        return aTh - bTh;
    });

    patients.forEach(p => {
        const result = evaluateLoyalty(p);
        const tr = document.createElement('tr');
        const groupCls = groupClassMap[result.status];
        if (groupCls)            tr.classList.add(groupCls);
        if (result.highlightNext) tr.classList.add('next-threshold');
        if (result.expired)       tr.classList.add('reached');
        tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.visitsInPeriod}</td>
     <td>${p.visitsInTotal}</td>
      <td>${p.lastVisit ? p.lastVisit.toISOString().split('T')[0] : '—'}</td>
      <td>${result.status}</td>
      <td>${result.nextThreshold}</td>
      <td>${result.discount}%</td>
    `;
        tbody.appendChild(tr);
    });

    populateThresholdDropdown(patients);

    // Attach listeners once
    document.querySelectorAll('.threshold-option')
        .forEach(cb => cb.addEventListener('change', applyAllFilters));
    document.getElementById('patientSearch')
        .addEventListener('keyup', applyAllFilters);


    document.getElementById('reportSection').style.display = 'block';
}
