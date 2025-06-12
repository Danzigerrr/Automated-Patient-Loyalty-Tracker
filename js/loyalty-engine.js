// Evaluates loyalty status based on the rules defined in config.js

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

// Bootstrap Table row styling function
// Depends on: evaluateLoyalty and lastVisitDateObj (from utils.js)
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

    const todayISO = new Date().toISOString().split('T')[0];
    if (row.expires === todayISO) {
        classes.push('expiresTodayStyle');
    }

    return { classes: classes.join(' ') };
}