
/**
 * PDF Manager for Idara School Software
 * Handles dynamic font loading and standardizes PDF generation using PDFMake.
 */

window.PDFManager = {
    // Font Configuration
    fontName: "Amiri",
    // Official Amiri Font from NPM via jsDelivr (Full version)
    fontUrl: "https://cdn.jsdelivr.net/npm/amiri-font@0.1.3/dist/fonts/amiri-regular.ttf",
    fontBase64: null,

    /**
     * Ensures the Urdu font is loaded and registered with pdfMake.
     * @returns {Promise<void>}
     */
    async ensureFont() {
        if (this.fontBase64) return; // Already loaded

        try {
            console.log("Fetching Urdu font...");
            const response = await fetch(this.fontUrl);
            if (!response.ok) throw new Error("Failed to fetch font");
            const blob = await response.blob();

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    // Result looks like "data:font/ttf;base64,AAEAAA..."
                    // We need just the Base64 part
                    this.fontBase64 = reader.result.split(',')[1];

                    // Register with pdfMake
                    window.pdfMake.vfs = window.pdfMake.vfs || {};
                    window.pdfMake.vfs[this.fontName + "-Regular.ttf"] = this.fontBase64;

                    window.pdfMake.fonts = {
                        [this.fontName]: {
                            normal: this.fontName + "-Regular.ttf",
                            bold: this.fontName + "-Regular.ttf",
                            italics: this.fontName + "-Regular.ttf",
                            bolditalics: this.fontName + "-Regular.ttf"
                        },
                        Roboto: {
                            normal: 'Roboto-Regular.ttf',
                            bold: 'Roboto-Medium.ttf',
                            italics: 'Roboto-Italic.ttf',
                            bolditalics: 'Roboto-MediumItalic.ttf'
                        }
                    };
                    console.log("Urdu font registered successfully.");
                    resolve();
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error("Font loading error:", error);
            alert("Failed to load Urdu font for PDF. Text may not render correctly.");
        }
    },

    /**
     * Generates and downloads a PDF.
     * @param {Object} config
     * @param {string} config.title - Document title
     * @param {Array} config.columns - Array of column headers (strings)
     * @param {Array} config.data - Array of data rows (arrays of strings)
     * @param {string} [config.filename] - Optional filename
     * @param {string} [config.orientation='portrait'] - 'portrait' or 'landscape'
     */
    async generateReport(config) {
        const { title, columns, data, filename, orientation = 'portrait' } = config;

        // Show loading state if possible (optional UI feedback)
        const activeBtn = document.activeElement;
        const originalText = activeBtn ? activeBtn.innerText : '';
        if (activeBtn && activeBtn.tagName === 'BUTTON') {
            activeBtn.innerText = 'Preparing PDF...';
            activeBtn.disabled = true;
        }

        await this.ensureFont();

        const docDefinition = {
            pageSize: 'A4',
            pageOrientation: orientation,
            pageMargins: [30, 30, 30, 30],
            content: [
                // Header
                {
                    columns: [
                        {
                            text: 'Idara Misbah ul Quran',
                            style: 'headerTitle',
                            alignment: 'left'
                        },
                        {
                            text: 'ادارہ مصباح القرآن',
                            style: 'headerUrdu',
                            alignment: 'right'
                        }
                    ],
                    margin: [0, 0, 0, 10]
                },
                { canvas: [{ type: 'line', x1: 0, y1: 0, x2: orientation === 'landscape' ? 780 : 535, y2: 0, lineWidth: 2, lineColor: '#2c3e50' }] },

                // Title
                { text: title, style: 'reportTitle', margin: [0, 20, 0, 20] },

                // Table
                {
                    table: {
                        headerRows: 1,
                        widths: Array(columns.length).fill(orientation === 'landscape' ? '*' : 'auto'),
                        body: [
                            columns.map(col => ({ text: col, style: 'tableHeader' })),
                            ...data.map(row => row.map((cell, index) => ({
                                text: cell,
                                style: 'tableCell'
                            })))
                        ]
                    },
                    layout: 'lightHorizontalLines'
                },

                // Footer
                { text: `Generated on: ${new Date().toLocaleDateString()}`, style: 'footer', margin: [0, 30, 0, 0] }
            ],
            styles: {
                headerTitle: { fontSize: 18, bold: true, color: '#2c3e50' },
                headerUrdu: { fontSize: 18, font: this.fontName, alignment: 'right' },
                reportTitle: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 10, 0, 10] },
                tableHeader: { bold: true, fontSize: 11, color: 'white', fillColor: '#34495e', alignment: 'center' },
                tableCell: { fontSize: 10, font: this.fontName, alignment: 'right' }, // Right align standard for Mixed/Urdu lists
                footer: { fontSize: 8, italics: true, alignment: 'right', color: '#7f8c8d' }
            },
            defaultStyle: {
                font: this.fontName
            }
        };

        const fName = filename || `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdfMake.createPdf(docDefinition).download(fName);

        // Restore button state
        if (activeBtn && activeBtn.tagName === 'BUTTON') {
            activeBtn.innerText = originalText;
            activeBtn.disabled = false;
        }
    },

    /**
     * Advanced: Allows passing a raw docDefinition for custom layouts (like Certificates)
     * while still handling font loading.
     */
    async generateCustom(docDefinition, filename) {
        await this.ensureFont();
        // Override default font if not set
        if (!docDefinition.defaultStyle) docDefinition.defaultStyle = {};
        if (!docDefinition.defaultStyle.font) docDefinition.defaultStyle.font = this.fontName;

        pdfMake.createPdf(docDefinition).download(filename);
    }
};
