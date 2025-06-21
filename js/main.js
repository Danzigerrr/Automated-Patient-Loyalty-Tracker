// Main application logic, orchestrating loading and initial setup.

// Get a reference to your table instance (initialized here for global access)
const $reportTable = $('#reportTable');

// Set default starting date to one year ago, with max attribute to today
document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('startDate');
    const today = new Date();

    const daysToSubtract = 365;
    const exactDaysAgo = new Date(today); 
    exactDaysAgo.setDate(today.getDate() - daysToSubtract); 

    inp.value = formatDateToISO(exactDaysAgo); 
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
            if (!grouped[key]) {
                grouped[key] = {
                    name: item.name,        // Store name separately for easier access
                    surname: item.surname,  // Store surname separately
                    allVisitDates: []       // Renamed 'dates' to 'allVisitDates' for clarity
                };
            }
            if (item.visitDate && item.visitDate !== '-') {
                // Ensure dates are parsed as Date objects here
                const parsedDate = new Date(item.visitDate);
                if (!isNaN(parsedDate.getTime())) { // Validate date parsing
                    grouped[key].allVisitDates.push(parsedDate);
                } else {
                    console.warn(`Invalid date encountered for ${key}: ${item.visitDate}`);
                }
            }
            // totalVisitsCount from excel is likely a cumulative count.
            // We'll primarily rely on `allVisitDates` length for active loyalty calculations now.
            // grouped[key].totalVisits = item.totalVisitsCount; // This might become redundant for loyalty calculation
        });

        // In handleFile, within the `Object.entries(grouped).map(([fullName, p]) => { ... })` block
        const patients = Object.entries(grouped).map(([fullName, p]) => {
            // Sort visits from oldest to newest for easier processing
            p.allVisitDates.sort((a, b) => a.getTime() - b.getTime());

            // Determine the last visit date
            const lastVisitDate = p.allVisitDates.length > 0
                ? p.allVisitDates[p.allVisitDates.length - 1]
                : null;

            // Pass all necessary info to evaluateLoyalty
            const result = evaluateLoyalty({
                allVisitDates: p.allVisitDates // the entire array of dates
            });

            // Base row data that will be used by Bootstrap Table
            const row = {
                name: fullName,
                visitsInPeriod: result.visitsInPeriodCount, // Store the calculated count for display
                lastVisit: lastVisitDate
                    ? lastVisitDate.toISOString().split('T')[0]
                    : '',
                originalAllVisitDates: p.allVisitDates 
            };

            row.expires = result.expiryDate;
            row.status = result.status;
            row.threshold = result.nextThreshold;
            row.discount = result.discount;

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