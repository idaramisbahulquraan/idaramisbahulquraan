
/**
 * PDF Print Manager (Method 1 - Native Print)
 * Opens a print dialog with a clean, printable version of the data.
 * User can then "Save as PDF" from the browser's print dialog.
 * This is the most reliable method as it uses the browser's native rendering.
 */

window.PDFSnapshot = {
    async generate(config) {
        const { title, columns, data, orientation = 'portrait' } = config;

        // Build HTML for print window
        const dateStr = new Date().toLocaleDateString();

        let tableRows = '';
        // Header row
        tableRows += '<tr class="header-row">';
        columns.forEach(col => {
            tableRows += `<th>${col}</th>`;
        });
        tableRows += '</tr>';

        // Data rows
        data.forEach((row, idx) => {
            tableRows += `<tr class="${idx % 2 === 0 ? 'even' : 'odd'}">`;
            row.forEach(cell => {
                tableRows += `<td>${cell}</td>`;
            });
            tableRows += '</tr>';
        });

        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
        
        @page {
            size: A4 ${orientation};
            margin: 15mm;
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Noto Nastaliq Urdu', 'Amiri', Arial, sans-serif;
            direction: rtl;
            text-align: right;
            padding: 0;
            margin: 0;
            color: #000;
            background: #fff;
        }
        
        .header {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #1e3a8a;
        }
        
        .header h1 {
            margin: 0;
            color: #1e3a8a;
            font-size: 26px;
        }
        
        .header h2 {
            margin: 5px 0;
            color: #555;
            font-size: 16px;
            font-family: Arial, sans-serif;
        }
        
        .header h3 {
            margin: 15px 0 5px;
            font-size: 20px;
        }
        
        .header p {
            margin: 0;
            font-size: 11px;
            color: #666;
            font-family: Arial, sans-serif;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        
        th, td {
            border: 1px solid #ccc;
            padding: 10px;
            text-align: right;
        }
        
        .header-row {
            background-color: #34495e;
            color: white;
        }
        
        .header-row th {
            font-weight: bold;
        }
        
        .even {
            background-color: #f9f9f9;
        }
        
        .odd {
            background-color: #ffffff;
        }
        
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <img src="../../assets/header-image.PNG" alt="Header" style="max-width: 100%; height: auto; margin-bottom: 10px;">
        <h3>${title}</h3>
        <p>Generated: ${dateStr}</p>
    </div>
    
    <table>
        ${tableRows}
    </table>
    
    <script>
        // Auto-trigger print dialog when loaded
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>
        `;

        // Open in new window and print
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
        } else {
            alert('Please allow popups for this site to generate PDFs.');
        }
    }
};
