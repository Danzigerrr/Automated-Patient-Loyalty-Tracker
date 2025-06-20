// Helper functions

// Helper function to calculate days between two dates
function daysBetween(a, b) {
    return (b - a) / (1000 * 60 * 60 * 24);
}

// Helper function to convert lastVisit string back to Date object
function lastVisitDateObj(str) {
    return str ? new Date(str) : null;
}

// Helper function for date formatting to ISO string (YYYY-MM-DD)
const formatDateToISO = d => d.toISOString().split('T')[0];

// Toggle visibility of the file upload instruction
function hideOrShowFileUploadInstruction() {
    // Display/hide instruction text
    var btn = document.getElementById("hideOrShowFileUploadInstructionBtn");
    var text = document.getElementById("fileUploadInstruction");

    if (text.style.display === 'none' || text.style.display === '') {
        text.style.display = 'block'; 
        btn.textContent = 'Ukryj instrukcję pobierania pliku'; 
    } else {
        text.style.display = 'none';
        btn.textContent = 'Pokaż instrukcję pobierania pliku'; 
    }
}