// Define global constants for loyalty rules and column mappings
const LOYALTY_RULES = [
    { name: 'Brak statusu', min: 0, max: 10, discount: 0, validityDays: 0, visitField: 'visitsInPeriod' }, 
    { name: 'Roczni Lojalni - 1', min: 10, max: 20, discount: 5, validityDays: 90, visitField: 'visitsInPeriod' },
    { name: 'Roczni Lojalni - 2', min: 20, max: 30, discount: 10, validityDays: 180, visitField: 'visitsInPeriod' },
    { name: '30+ Wizyt', min: 30, max: Infinity, discount: 10, validityDays: 365, visitField: 'visitsInPeriod' },

];

// indexes of columns in the source XLSX file (counting starts from 0)
const SOURCE_XLSX_FILE_COLUMN_TO_INDEX_MAP = {
    "Name": 1,
    "Surname": 2,
    "Visit Info": 9
};
