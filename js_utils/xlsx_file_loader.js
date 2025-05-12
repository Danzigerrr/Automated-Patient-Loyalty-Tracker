function handleFile(event, version) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); // Ustawiamy defval na ''

        console.log(`Dane z pliku (Wersja ${version}):`);
        console.log(jsonData);

        // Przetwarzanie danych w zależności od wersji
        if (version === 1) {
            processDataVersion1(jsonData);
        } else if (version === 2) {
            processDataVersion2(jsonData);
        }
    };

    reader.onerror = function(error) {
        console.error("Błąd odczytu pliku:", error);
    };

    reader.readAsArrayBuffer(file);
}

function processDataVersion1(data) {
    console.log("Przetwarzanie danych dla Wersji 1:");
    const przetworzoneDane = data.slice(1).map(row => ({
        lp: row[0],
        imie: row[1],
        nazwisko: row[2],
        dataUrodzenia: row[3],
        wiek: row[4],
        plec: row[5],
        telefon: row[6],
        adresEmail: row[7],
        nrKartoteki: row[8],
        kraj: row[9],
        miejscowosc: row[10],
        ulica: row[11],
        nrDomu: row[12],
        nrLokalu: row[13],
        uslugi: row[14],
        wizyty: row[15],
        czasTrwania: row[16],
        dokumentyKsiegowe: row[17],
        wartoscDokumentow: row[18],
        zgodaPrzetwarzanie: row[19],
        zgodaSms: row[20],
        zgodaEmail: row[21],
        zgodaDostepDoDanych: row[22]
    }));
    console.log(przetworzoneDane);

}

function processDataVersion2(data) {
    console.log("Przetwarzanie danych dla Wersji 2:");

    const przetworzoneDane = [];
    let i = 1;
    while (i < data.length) {
        if(data[i].length === 20){
            przetworzoneDane.push({
                lp: data[i][0],
                imie: data[i][1],
                nazwisko: data[i][2],
                dataUrodzenia: data[i][3],
                wiek: data[i][4],
                plec: data[i][5],
                telefon: data[i][6],
                adresEmail: data[i][7],
                nrKartoteki: data[i][8],
                wizyta: null,
                kraj: data[i][9],
                miejscowosc: data[i][10],
                ulica: data[i][11],
                nrDomu: data[i][12],
                nrLokalu: data[i][13],
                uslugi: data[i][14],
                wizyty: data[i][15],
                czasTrwania: data[i][16],
                dokumentyKsiegowe: data[i][17],
                wartoscDokumentow: data[i][18],
                zgodaPrzetwarzanie: data[i][19],
                zgodaSms: data[i][20],
                zgodaEmail: data[i][21],
                zgodaDostepDoDanych: data[i][22]

            });
            i++;
        }
        else{
            przetworzoneDane.push({
                lp: data[i][0],
                imie: data[i][1],
                nazwisko: data[i][2],
                dataUrodzenia: data[i][3],
                wiek: data[i][4],
                plec: data[i][5],
                telefon: data[i][6],
                adresEmail: data[i][7],
                nrKartoteki: data[i][8],
                wizyta: data[i][9],
                kraj: data[i][10],
                miejscowosc: data[i][11],
                ulica: data[i][12],
                nrDomu: data[i][13],
                nrLokalu: data[i][14],
                uslugi: data[i][15],
                wizyty: data[i][16],
                czasTrwania: data[i][17],
                dokumentyKsiegowe: data[i][18],
                wartoscDokumentow: data[i][19],
                zgodaPrzetwarzanie: data[i][20],
                zgodaSms: data[i][21],
                zgodaEmail: data[i][22],
                zgodaDostepDoDanych: data[i][23]

            });
            i+=2;
        }

    }
    console.log(przetworzoneDane);

}