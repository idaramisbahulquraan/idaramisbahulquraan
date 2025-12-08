// Ensure jsPDF is available
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', () => {
    // Maybe load some initial stats if needed
});

async function generateReport(type) {
    // Show loading state if we had a spinner, but for now just alert or change cursor
    document.body.style.cursor = 'wait';
    
    try {
        const doc = new jsPDF();
        
        // Add Header
        await addHeader(doc, type);

        // Fetch Data and Add Table
        if (type === 'students') {
            await generateStudentReport(doc);
        } else if (type === 'teachers') {
            await generateTeacherReport(doc);
        } else if (type === 'finance') {
            await generateFinanceReport(doc);
        } else if (type === 'fees') {
            await generateFeesReport(doc);
        }

        // Add Footer
        addFooter(doc);

        // Save
        doc.save(`${type}_report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error("Error generating report:", error);
        alert("Failed to generate report: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}

async function addHeader(doc, title) {
    // Logo
    try {
        const img = new Image();
        img.src = '../../assets/logo.png';
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = () => {
                console.warn("Logo failed to load");
                resolve();
            };
        });
        // Check if image loaded successfully by checking naturalWidth
        if (img.naturalWidth > 0) {
            doc.addImage(img, 'PNG', 14, 10, 20, 20);
        }
    } catch (e) {
        console.warn("Logo processing error", e);
    }

    doc.setFontSize(18);
    doc.text("Idara Misbah ul Quran", 40, 20);
    
    doc.setFontSize(12);
    doc.text(`${title.charAt(0).toUpperCase() + title.slice(1)} Report`, 40, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 34);
    
    // Line separator
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);
}

function addFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text('Page ' + i + ' of ' + pageCount, 196, 290, { align: 'right' });
        doc.text('Idara Misbah ul Quran - Confidential', 14, 290);
    }
}

async function generateStudentReport(doc) {
    const classFilter = document.getElementById('studentClassFilter').value;
    // Order by firstName since 'name' doesn't exist
    const snapshot = await db.collection('students').orderBy('firstName').get();
    const data = [];
    
    snapshot.forEach(d => {
        const s = d.data();
        
        // Apply Filter
        if (classFilter && s.className !== classFilter) {
            return;
        }

        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim();
        // Use parentPhone as per students.html, fallback to phone or empty
        const phone = s.parentPhone || s.phone || '-';
        
        data.push([
            fullName, 
            s.rollNumber || '-', 
            s.parentName || '-', 
            s.className || '-', 
            phone
        ]);
    });

    let title = 'Student Report';
    if (classFilter) title += ` - Class ${classFilter}`;
    
    // Add specific subtitle for the table
    doc.setFontSize(10);
    doc.text(title, 14, 43);

    doc.autoTable({
        startY: 45,
        head: [['Name', 'Roll No', 'Father Name', 'Class', 'Phone']],
        body: data,
        theme: 'striped',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 62, 80] },
        margin: { top: 45 }
    });
}

async function generateTeacherReport(doc) {
    const snapshot = await db.collection('teachers').orderBy('firstName').get();
    const data = [];
    
    snapshot.forEach(d => {
        const t = d.data();
        const fullName = `${t.firstName || ''} ${t.lastName || ''}`.trim();
        
        data.push([
            fullName, 
            t.subject || '-', 
            t.phone || '-', 
            t.email || '-'
        ]);
    });

    doc.autoTable({
        startY: 45,
        head: [['Name', 'Subject', 'Phone', 'Email']],
        body: data,
        theme: 'grid',
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 62, 80] }
    });
}

async function generateFinanceReport(doc) {
    const monthFilter = document.getElementById('financeMonthFilter').value;
    
    let expensesQuery = db.collection('expenses');
    let incomesQuery = db.collection('incomes');

    if (monthFilter) {
        // monthFilter is YYYY-MM
        const start = monthFilter + '-01';
        const end = monthFilter + '-31';
        
        // Use where clause for filtering by date range
        // Note: This assumes date is stored as YYYY-MM-DD string
        expensesQuery = expensesQuery.where('date', '>=', start).where('date', '<=', end);
        incomesQuery = incomesQuery.where('date', '>=', start).where('date', '<=', end);
    } else {
        // Default: Last 50 items
        expensesQuery = expensesQuery.orderBy('date', 'desc').limit(50);
        incomesQuery = incomesQuery.orderBy('date', 'desc').limit(50);
    }

    // Get Data
    const [expensesSnapshot, incomeSnapshot] = await Promise.all([
        expensesQuery.get(),
        incomesQuery.get()
    ]);

    const items = [];
    
    expensesSnapshot.forEach(d => {
        const e = d.data();
        items.push({
            date: e.date,
            type: 'Expense',
            title: e.title,
            category: e.category,
            amount: parseFloat(e.amount) || 0
        });
    });

    incomeSnapshot.forEach(d => {
        const i = d.data();
        items.push({
            date: i.date,
            type: 'Income',
            title: i.title,
            category: i.category,
            amount: parseFloat(i.amount) || 0
        });
    });
    
    // Sort combined list by date descending (since we might have lost order in filtered queries)
    items.sort((a,b) => new Date(b.date) - new Date(a.date));

    const tableData = items.map(item => [
        item.date,
        item.type,
        item.title,
        item.category,
        `Rs. ${item.amount.toLocaleString()}`
    ]);

    let title = 'Finance Report';
    if (monthFilter) title += ` - ${monthFilter}`;
    doc.setFontSize(10);
    doc.text(title, 14, 43);

    doc.autoTable({
        startY: 45,
        head: [['Date', 'Type', 'Title', 'Category', 'Amount']],
        body: tableData,
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 1) {
                if (data.cell.raw === 'Income') {
                    data.cell.styles.textColor = [40, 167, 69]; // Green
                } else {
                    data.cell.styles.textColor = [220, 53, 69]; // Red
                }
            }
        },
        styles: { fontSize: 9 },
        headStyles: { fillColor: [44, 62, 80] },
        margin: { top: 45 }
    });
}

async function generateFeesReport(doc) {
    const statusFilter = document.getElementById('feeStatusFilter').value;
    
    // Base query
    let query = db.collection('fees').orderBy('createdAt', 'desc');
    
    if (statusFilter) {
        // Fetch more if filtering to ensure we get enough matches
        query = query.limit(500); 
    } else {
        query = query.limit(100);
    }

    const snapshot = await query.get();
    const data = [];
    
    snapshot.forEach(d => {
        const f = d.data();
        
        // Apply Filter in Memory
        if (statusFilter && f.status !== statusFilter) {
            return;
        }

        const date = f.createdAt ? new Date(f.createdAt.seconds * 1000).toLocaleDateString() : (f.date || '-');
        const period = `${f.month} ${f.year}`;
        
        data.push([
            f.studentName || '-',
            f.rollNumber || '-',
            f.feeType || '-',
            period,
            `Rs. ${f.amount}`,
            f.status,
            date
        ]);
    });

    let title = 'Fees Report';
    if (statusFilter) title += ` - ${statusFilter}`;
    doc.setFontSize(10);
    doc.text(title, 14, 43);

    doc.autoTable({
        startY: 45,
        head: [['Student', 'Roll No', 'Type', 'Period', 'Amount', 'Status', 'Date']],
        body: data,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [44, 62, 80] },
        columnStyles: {
            5: { fontStyle: 'bold' } // Status
        },
        didParseCell: function(data) {
            if (data.section === 'body' && data.column.index === 5) {
                if (data.cell.raw === 'Paid') {
                    data.cell.styles.textColor = [40, 167, 69];
                } else {
                    data.cell.styles.textColor = [255, 193, 7]; // Yellow/Orange
                }
            }
        },
        margin: { top: 45 }
    });
}
