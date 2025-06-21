
const MAX_VISIT_CONSIDERATION_DAYS = Math.max(...LOYALTY_RULES.map(r => r.validityDays));

// Evaluates loyalty status based on the rules defined in config.js

// --- evaluateLoyalty Method (UPDATED) ---
// --- evaluateLoyalty (chronological daily iteration) ---
function evaluateLoyalty({ allVisitDates }) {
    const now = new Date();
    // Read highlight threshold from the DOM (default: 3)
    const thresholdInput = document.getElementById('highlightThreshold');
    const threshold = thresholdInput
        ? Math.max(1, parseInt(thresholdInput.value, 10) || 3)
        : 3;

    // Prepare rules, sorted ascending by min visits
    const rulesByMinAsc = [...LOYALTY_RULES].sort((a, b) => a.min - b.min);
    // Prepare a fast lookup for each day’s visits
    const visitCountsByDay = allVisitDates.reduce((map, dt) => {
        const key = dt.toISOString().slice(0,10);
        map[key] = (map[key] || 0) + 1;
        return map;
    }, {});

    // If no visits at all, immediately return base “Brak statusu”
    if (allVisitDates.length === 0) {
        const nextRule = rulesByMinAsc.find(r => r.name !== 'Brak statusu');
        const nextThreshold = nextRule ? Math.max(0, nextRule.min) : 0;
        return {
            status: 'Brak statusu',
            discount: 0,
            nextThreshold: String(nextThreshold),
            highlightNext: nextThreshold <= threshold,
            expired: false,
            visitsInPeriodCount: 0,
            expiryDate: '----'
        };
    }

    // Start from the date of the very first visit
    const startDate = new Date(allVisitDates[0].toISOString().slice(0,10));
    let currentStatus   = 'Brak statusu';
    let currentDiscount = 0;
    let visitsCount     = 0;
    let validityLeft    = 0;    // days remaining before current status expires

    // Walk each day from the first visit to today
    for (let day = new Date(startDate); day <= now; day.setDate(day.getDate() + 1)) {
        const key = day.toISOString().slice(0,10);
        // 1) Check expiry before counting today’s visits
        if (validityLeft <= 0 && currentStatus !== 'Brak statusu') {
            // Status has expired: reset completely
            currentStatus   = 'Brak statusu';
            currentDiscount = 0;
            visitsCount     = 0;
            validityLeft    = 0;
        }

        // 2) If there was a visit today, absorb it
        const todayVisits = visitCountsByDay[key] || 0;
        if (todayVisits > 0) {
            visitsCount += todayVisits;

            // Determine highest‐level rule we now qualify for
            // (rule.min <= visitsCount < rule.max)
            const newRule = LOYALTY_RULES
                .filter(r => r.name !== 'Brak statusu')
                .find(r => visitsCount >= r.min && visitsCount < r.max);

            if (newRule) {
                // If we’ve moved into a higher tier (or reinstated the same),
                // set status and reset validityLeft from this day
                currentStatus   = newRule.name;
                currentDiscount = newRule.discount;
                validityLeft    = newRule.validityDays;
            }
        }

        // 3) At end of day, decrement validity counter
        if (validityLeft > 0) {
            validityLeft--;
        }
    }

    // After looping, today’s visitsCount and currentStatus are final
    // Compute nextThreshold: how many more visits to reach the next tier
    const activeRule = LOYALTY_RULES.find(r => r.name === currentStatus);
    let nextThreshold;
    if (activeRule && activeRule.max !== Infinity) {
        nextThreshold = Math.max(0, activeRule.max - visitsCount);
    } else {
        // from Brak statusu into first real tier
        const firstRule = rulesByMinAsc.find(r => r.name !== 'Brak statusu');
        nextThreshold = firstRule ? Math.max(0, firstRule.min - visitsCount) : 0;
    }

    // Compute expiryDate for display
    let expiryDate = '----';
    if (activeRule && activeRule.validityDays > 0 && currentStatus !== 'Brak statusu') {
        const exp = new Date(now);
        exp.setDate(exp.getDate() + validityLeft);
        expiryDate = exp.toISOString().slice(0,10);
    }

    return {
        status: currentStatus,
        discount: currentDiscount,
        nextThreshold: String(nextThreshold),
        highlightNext: nextThreshold > 0 && nextThreshold <= threshold,
        expired: (currentStatus === 'Brak statusu' && visitsCount > 0),
        visitsInPeriodCount: visitsCount,
        expiryDate
    };
}



// --- rowStyle Method ---
function rowStyle(row) {
    const groupClassMap = {
        'Roczni Lojalni - 1': 'group-yearly1',
        'Roczni Lojalni - 2': 'group-yearly2',
        '30+ Wizyt': 'group-over30',
        'Brak statusu': 'group-none'
    };

    // Make sure `row.originalAllVisitDates` is present in your `row` object.
    // This is the array of Date objects we saved earlier in `handleFile`.
    if (!row.originalAllVisitDates) {
        console.warn("row.originalAllVisitDates is missing in rowStyle. Loyalty calculation might be inaccurate.");
        // Fallback or handle gracefully if data is unexpectedly missing
        return { classes: 'group-none' };
    }

    const originalLastVisitDate = row.lastVisit ? lastVisitDateObj(row.lastVisit) : null;

    const result = evaluateLoyalty({
        lastVisit: originalLastVisitDate,
        allVisitDates: row.originalAllVisitDates // <--- Use the new property name here
    });

    const classes = [];
    if (result.highlightNext) classes.push('next-threshold');
    if (result.expired) classes.push('expired-status'); // Changed for clarity as discussed
    const groupClass = groupClassMap[result.status];
    if (groupClass) classes.push(groupClass);

    const todayISO = new Date().toISOString().split('T')[0];
    if (row.expires === todayISO) {
        classes.push('expiresTodayStyle');
    }

    return { classes: classes.join(' ') };
}