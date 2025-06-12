// Main application logic, orchestrating loading and initial setup.

// Get a reference to your table instance (initialized here for global access)
const $reportTable = $('#reportTable');

// Set default starting date to one year ago, with max attribute to today
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('startDate');
    const today = new Date();
    const lastYear = new Date();
    lastYear.setFullYear(today.getFullYear() - 1);

    inp.value = formatDateToISO(lastYear); // Use helper from utils.js
    inp.max   = formatDateToISO(today);   // Use helper from utils.js
});

// Set default starting date to one year ago, with max attribute to today
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('endDate');
    const today = new Date();

    inp.value = formatDateToISO(today); // Use helper from utils.js
    inp.max   = formatDateToISO(today);   // Use helper from utils.js
});

// Handle file input change event
document.getElementById('fileInput')
    .addEventListener('change', handleFile);

// Handles file input and processes the Excel data
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
                if (e < new Date()) {
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
        populateStatusDropdown(patients);

        // Attach event listeners for filtering
        document.getElementById('patientSearch')
            .addEventListener('keyup', applyAllFilters);

        // Add event listeners for the new quick filter checkboxes
        document.getElementById('statusExpiringButton').addEventListener('change', applyAllFilters);
        document.getElementById('statusUpgradingButton').addEventListener('change', applyAllFilters);

        document.getElementById('reportSection').style.display = 'block';

        // re-init table with precomputed data
        $reportTable
            .bootstrapTable('destroy')
            .bootstrapTable({
                data: patients,
                showColumns: true,
                showMultiSort: true,
                sortPriority: [
                    { sortName: 'expires', sortOrder: 'desc' },
                    { sortName: 'threshold', sortOrder: 'asc' },
                ],
                rowStyle: rowStyle,
                dataFilterControl: true
            });

        // After initial table load/data set, apply initial filters if any, and then sort
        applyAllFilters();
    };
    reader.readAsArrayBuffer(file);
}