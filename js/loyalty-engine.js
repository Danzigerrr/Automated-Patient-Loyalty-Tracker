// Evaluates loyalty status based on the rules defined in config.js
function evaluateLoyalty({ lastVisit, allVisitDates }) {
    const now = new Date();

    // Read dynamic highlight threshold:
    const thresholdInput = document.getElementById('highlightThreshold');
    let threshold = 3;
    if (thresholdInput) {
        const v = parseInt(thresholdInput.value, 10);
        if (!isNaN(v) && v > 0) threshold = v;
    }

    let visitsInCurrentPeriod = 0; // This will hold the count relevant to the current rule's validity

    // Sort rules by min visits descending to match highest applicable status first
    // This is important because a patient with 10 visits might qualify for Group 2 (min 10)
    // before Group 1 (min 5).
    const sortedRules = [...LOYALTY_RULES].sort((a, b) => b.min - a.min);

    let foundStatus = null;

    for (let rule of sortedRules) {
        if (rule.name === 'Brak statusu' && allVisitDates.length > 0 && lastVisit) {
            // Special handling for "Brak statusu" - only apply if no other rule matches
            // or if all applicable rules have expired visits.
            continue;
        }

        let validityStartConsideringLastVisit = null;
        if (lastVisit && rule.validityDays > 0) {
            validityStartConsideringLastVisit = new Date(lastVisit);
            validityStartConsideringLastVisit.setDate(validityStartConsideringLastVisit.getDate() - rule.validityDays);
        } else if (lastVisit && rule.validityDays === 0) {
            // For rules with 0 validity, visits must be today (or very recent) to count
            // This case might be more for 'Brak statusu' or special promotions.
            validityStartConsideringLastVisit = new Date(now); // Set to now to effectively check if last visit is today
            validityStartConsideringLastVisit.setHours(0, 0, 0, 0); // Start of today
        } else {
            // No last visit, so no visits in any validity period for status rules that require them
            // This is handled by visitsInCurrentPeriod remaining 0
        }

        // Filter visits based on the *current rule's* validity period
        // If no last visit, visitsInCurrentPeriod remains 0, naturally failing min thresholds.
        visitsInCurrentPeriod = allVisitDates.filter(visitDate => {
            return lastVisit && validityStartConsideringLastVisit && visitDate >= validityStartConsideringLastVisit && visitDate <= now;
        }).length;

        // Check if the current patient's *active* visits meet this rule's criteria
        if (visitsInCurrentPeriod >= rule.min && visitsInCurrentPeriod < rule.max) {
            // Determine if the status has effectively "expired" due to lack of recent visits
            const expiredDueToNoRecentVisits = (rule.validityDays > 0 && lastVisit && daysBetween(lastVisit, now) > rule.validityDays);

            if (!expiredDueToNoRecentVisits) {
                foundStatus = {
                    status: rule.name,
                    discount: rule.discount,
                    nextThreshold: rule.max === Infinity ? '0' : `${rule.max - visitsInCurrentPeriod}`,
                    highlightNext: (rule.max !== Infinity && (rule.max - visitsInCurrentPeriod) <= threshold),
                    expired: false, // Not expired based on this check
                    visitsInPeriodCount: visitsInCurrentPeriod // Add this to return
                };
                break; // Found the highest applicable status, exit loop
            }
        }
    }

    // If no status was found based on the new logic, or it explicitly expired, set to "Brak statusu"
    if (!foundStatus) {
        const firstRule = sortedRules.find(r => r.name === 'Brak statusu') || LOYALTY_RULES[0]; // Fallback to first defined rule
        let toFirst = firstRule.min - visitsInCurrentPeriod;
        if (toFirst < 0) toFirst = 0; // Cannot be negative

        return {
            status: 'Brak statusu',
            discount: 0,
            nextThreshold: `${toFirst}`,
            highlightNext: toFirst <= threshold,
            expired: true, // Mark as expired if no active status
            visitsInPeriodCount: 0 // Reset count for 'Brak statusu'
        };
    }

    return foundStatus;
}

// --- rowStyle Method ---
// Depends on: evaluateLoyalty and lastVisitDateObj (from utils.js)
// Assuming lastVisitDateObj converts a string date to a Date object,
// but now evaluateLoyalty needs the *raw Date object* for allVisitDates,
// and the lastVisitDateObj should handle parsing if `row.lastVisit` is a string.
// --- rowStyle Method ---
function rowStyle(row) {
    const groupClassMap = {
        'Roczni Lojalni - Grupa 1': 'group-yearly1',
        'Roczni Lojalni - Grupa 2': 'group-yearly2',
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