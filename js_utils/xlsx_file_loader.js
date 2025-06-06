// --- 1. Definicja reguł lojalnościowych ---
const LOYALTY_RULES = [
    { name: 'Roczni Lojalni – Grupa 1', min: 10, max: 20, discount: 5, validityDays: 90 },
    { name: 'Roczni Lojalni – Grupa 2', min: 20, max: 30, discount: 10, validityDays: 180 },
    { name: '30+ Wizyt',               min: 30, max: Infinity, discount: 10, validityDays: 365 }
];

// --- 2. Pomocnik do obliczeń datowych ---
function daysBetween(a, b) {
    return (b - a) / (1000 * 60 * 60 * 24);
}

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
            imie:      r[1],
            nazwisko:  r[2],
            visits: r[9].split(' - ')[0].trim()
        }));

        // grupowanie i budowanie historii dat
        const grouped = {};
        raw.forEach(item => {
            const key = `${item.imie} ${item.nazwisko}`;
            if (!grouped[key]) {
                grouped[key] = { ...item, dates: [] };
            }
            if (item.visits !== '-' && item.visits !== '') {
                // "2025-02-24 - 4"
                const datePart = item.visits;
                grouped[key].dates.push(new Date(datePart));
            }
        });

        // przygotuj obiekt pacjenta z liczbą wizyt i datą ostatniej wizyty
        const patients = Object.values(grouped).map(p => {
            const visitsInPeriod = p.dates.filter(d => d >= startDate).length;
            const lastVisit = p.dates.length
                ? new Date(Math.max(...p.dates.map(d => d.getTime())))
                : null;
            return {
                name:            `${p.imie} ${p.nazwisko}`,
                visitsInPeriod,
                lastVisit
            };
        });

        renderReport(patients);
    };
    reader.readAsArrayBuffer(file);
}

// --- 4. Ewaluacja statusu lojalnościowego ---
function evaluateLoyalty(p) {
    const now = new Date();

    // 2a. read user‐configured threshold:
    const thresholdInput = document.getElementById('highlightThreshold');
    // parseInt → if invalid, fall back to 2:
    let threshold = 2;
    if (thresholdInput) {
        const v = parseInt(thresholdInput.value, 10);
        if (!isNaN(v) && v > 0) threshold = v;
    }

    for (let rule of LOYALTY_RULES) {
        if (p.visitsInPeriod >= rule.min && p.visitsInPeriod < rule.max) {
            const nextThreshold = rule.max === Infinity
                ? '0 wizyt'
                : `${rule.max - p.visitsInPeriod} wizyt`;

            const expired = p.lastVisit
                ? daysBetween(p.lastVisit, now) > rule.validityDays
                : true;

            return {
                status:        rule.name,
                discount:      rule.discount,
                nextThreshold,
                // use the dynamic “threshold” here:
                highlightNext: (rule.max !== Infinity && (rule.max - p.visitsInPeriod) <= threshold),
                expired
            };
        }
    }

    // jeśli poza progami → ile do pierwszego
    const first = LOYALTY_RULES[0];
    const toFirst = first.min - p.visitsInPeriod;
    return {
        status:        'Brak statusu',
        discount:      0,
        nextThreshold: `${toFirst} wizyt`,
        // use the same threshold for “no‐status” patients:
        highlightNext: toFirst <= threshold,
        expired:       false
    };
}

// --- 5. Renderowanie tabeli raportu ---
function renderReport(patients) {
    const tbody = document.querySelector('#reportTable tbody');
    tbody.innerHTML = '';

    // 1. map status → CSS class
    const groupClassMap = {
        'Roczni Lojalni - Grupa 1': 'group-yearly1',
        'Roczni Lojalni - Grupa 2': 'group-yearly2',
        '30+ Wizyt':               'group-over30',
        'Brak statusu':            'group-none'
    };

    patients.forEach(p => {
        const result = evaluateLoyalty(p);

        // 2. create row and apply classes
        const tr = document.createElement('tr');
        const groupCls = groupClassMap[result.status];
        if (groupCls)       tr.classList.add(groupCls);
        if (result.highlightNext) tr.classList.add('next-threshold');
        if (result.expired)       tr.classList.add('reached');

        // 3. fill content
        tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.visitsInPeriod}</td>
      <td>${p.lastVisit ? p.lastVisit.toISOString().split('T')[0] : '—'}</td>
      <td>${result.status}</td>
      <td>${result.nextThreshold}</td>
      <td>${result.discount}%</td>
    `;

        // 4. append to table
        tbody.appendChild(tr);
    });

    document.getElementById('reportSection').style.display = 'block';
}


function hideOrShowFileUploadInstruction() {
    var x = document.getElementById("instruction");
    if (x.style.display === "none") {
        x.style.display = "block";
    } else {
        x.style.display = "none";
    }
}
