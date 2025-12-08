// Global variables for charts or data
let expensesData = [];
let incomeData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadFinanceData();
    loadHeads();
    
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });
});

// --- Data Loading ---

async function loadFinanceData() {
    const expensesTable = document.getElementById('expensesList');
    const incomeTable = document.getElementById('incomeList');
    
    try {
        // Load Expenses
        const expensesSnapshot = await db.collection('expenses').orderBy('date', 'desc').limit(50).get();
        let totalExp = 0;
        let expensesHtml = '';

        if (expensesSnapshot.empty) {
            expensesHtml = '<tr><td colspan="6" class="text-center">No expenses recorded.</td></tr>';
        } else {
            expensesSnapshot.forEach(doc => {
                const data = doc.data();
                totalExp += parseFloat(data.amount);
                expensesHtml += `
                    <tr>
                        <td class="font-medium">${data.title}</td>
                        <td><span class="badge badge-warning">${data.category}</span></td>
                        <td class="text-danger font-bold">Rs. ${parseFloat(data.amount).toLocaleString()}</td>
                        <td>${new Date(data.date).toLocaleDateString()}</td>
                        <td>${data.description || '-'}</td>
                        <td>
                            <button onclick="editTransaction('expenses', '${doc.id}')" class="btn-icon" title="Edit" style="margin-right: 0.5rem;">✏️</button>
                            <button onclick="deleteTransaction('expenses', '${doc.id}')" class="btn-icon text-danger" title="Delete">🗑️</button>
                        </td>
                    </tr>
                `;
            });
        }
        if(expensesTable) expensesTable.innerHTML = expensesHtml;
        document.getElementById('totalExpenses').innerText = `Rs. ${totalExp.toLocaleString()}`;

        // Load Income (Manual + Fees)
        const incomeSnapshot = await db.collection('incomes').orderBy('date', 'desc').limit(50).get();
        let totalInc = 0;
        let incomeHtml = '';

        incomeSnapshot.forEach(doc => {
            const data = doc.data();
            totalInc += parseFloat(data.amount);
            incomeHtml += `
                <tr>
                    <td class="font-medium">${data.title}</td>
                    <td><span class="badge badge-success">${data.category}</span></td>
                    <td class="text-success font-bold">Rs. ${parseFloat(data.amount).toLocaleString()}</td>
                    <td>${new Date(data.date).toLocaleDateString()}</td>
                    <td>${data.description || '-'}</td>
                    <td>
                        <button onclick="editTransaction('incomes', '${doc.id}')" class="btn-icon" title="Edit" style="margin-right: 0.5rem;">✏️</button>
                        <button onclick="deleteTransaction('incomes', '${doc.id}')" class="btn-icon text-danger" title="Delete">🗑️</button>
                    </td>
                </tr>
            `;
        });

        const feesSnapshot = await db.collection('fees').where('status', '==', 'Paid').get();
        let feeIncome = 0;
        feesSnapshot.forEach(doc => {
            feeIncome += (doc.data().amount || 0);
        });
        
        if (feeIncome > 0) {
            incomeHtml += `
                <tr style="background-color: #f0fdf4;">
                    <td class="font-medium">Student Fees (Aggregated)</td>
                    <td><span class="badge badge-success">Fees</span></td>
                    <td class="text-success font-bold">Rs. ${feeIncome.toLocaleString()}</td>
                    <td>-</td>
                    <td>Total collected fees</td>
                    <td>-</td>
                </tr>
            `;
        }

        totalInc += feeIncome;

        if (incomeHtml === '') {
            incomeHtml = '<tr><td colspan="6" class="text-center">No income recorded.</td></tr>';
        }
        
        if(incomeTable) incomeTable.innerHTML = incomeHtml;
        document.getElementById('totalIncome').innerText = `Rs. ${totalInc.toLocaleString()}`;

        // Net Balance
        const net = totalInc - totalExp;
        const netEl = document.getElementById('netBalance');
        netEl.innerText = `Rs. ${net.toLocaleString()}`;
        netEl.className = `amount ${net >= 0 ? 'text-success' : 'text-danger'}`;

    } catch (error) {
        console.error("Error loading finance data:", error);
        alert("Error loading data: " + error.message);
    }
}

// --- Heads Management ---

async function loadHeads() {
    try {
        const headsSnapshot = await db.collection('finance_heads').orderBy('name').get();
        const expenseSelect = document.getElementById('expenseCategory'); // For expense form
        const incomeSelect = document.getElementById('incomeCategory'); // For income form
        const headsList = document.getElementById('headsList');

        let expenseOptions = '<option value="" disabled selected>Select Category</option>';
        let incomeOptions = '<option value="" disabled selected>Select Category</option>';
        let headsHtml = '';

        // Default heads if none exist (could be seeded)
        const defaultExpenseHeads = ['Utilities', 'Salaries', 'Maintenance', 'Supplies', 'Other'];
        const defaultIncomeHeads = ['Donations', 'Grants', 'Other'];

        const existingHeads = [];

        headsSnapshot.forEach(doc => {
            const head = doc.data();
            existingHeads.push(head);
            
            headsHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${head.name} <small class="text-muted">(${head.type})</small></span>
                    <button onclick="deleteHead('${doc.id}')" class="btn-icon text-danger">&times;</button>
                </li>
            `;

            if (head.type === 'expense') {
                expenseOptions += `<option value="${head.name}">${head.name}</option>`;
            } else if (head.type === 'income') {
                incomeOptions += `<option value="${head.name}">${head.name}</option>`;
            }
        });

        // Add defaults if not in DB (visual only, or we could save them)
        // Ideally we should just rely on DB. If DB is empty, user must add heads.
        // But for better UX, let's keep the hardcoded ones in the select if DB is empty? 
        // No, let's encourage using the "Manage Heads" feature. 
        // However, to prevent broken UI, we can fallback.
        
        if (expenseSelect) expenseSelect.innerHTML = expenseOptions;
        if (incomeSelect) incomeSelect.innerHTML = incomeOptions;
        if (headsList) headsList.innerHTML = headsHtml || '<li class="text-muted">No custom heads found.</li>';

    } catch (error) {
        console.error("Error loading heads:", error);
    }
}

async function addHead(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.headName.value.trim();
    const type = form.headType.value;

    if (!name) return;

    try {
        await db.collection('finance_heads').add({
            name,
            type,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        form.reset();
        loadHeads(); // Refresh lists
    } catch (error) {
        console.error("Error adding head:", error);
        alert("Error adding head: " + error.message);
    }
}

async function deleteHead(id) {
    if (!confirm("Delete this category head?")) return;
    try {
        await db.collection('finance_heads').doc(id).delete();
        loadHeads();
    } catch (error) {
        console.error(error);
        alert("Error deleting head");
    }
}

// --- Transaction Management ---

async function handleAddTransaction(event, type) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const docId = data.docId;
    
    const collection = type === 'income' ? 'incomes' : 'expenses';

    try {
        if(docId) {
             await db.collection(collection).doc(docId).update({
                title: data.title,
                category: data.category,
                amount: parseFloat(data.amount),
                date: data.date,
                description: data.description
            });
            alert(`${type === 'income' ? 'Income' : 'Expense'} updated successfully!`);
        } else {
            await db.collection(collection).add({
                title: data.title,
                category: data.category,
                amount: parseFloat(data.amount),
                date: data.date,
                description: data.description,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert(`${type === 'income' ? 'Income' : 'Expense'} added successfully!`);
        }

        closeModal(type === 'income' ? 'incomeModal' : 'expenseModal');
        loadFinanceData();

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}

async function editTransaction(collection, id) {
    try {
        const doc = await db.collection(collection).doc(id).get();
        if(!doc.exists) return;
        const data = doc.data();
        
        const type = collection === 'incomes' ? 'income' : 'expense';
        const modalId = type === 'income' ? 'incomeModal' : 'expenseModal';
        const modal = document.getElementById(modalId);
        const form = modal.querySelector('form');
        
        form.querySelector('input[name="docId"]').value = id;
        form.querySelector('input[name="title"]').value = data.title;
        
        // Wait for categories to load if empty? usually loaded on loadHeads
        const select = form.querySelector('select[name="category"]');
        select.value = data.category;
        
        form.querySelector('input[name="amount"]').value = data.amount;
        form.querySelector('input[name="date"]').value = data.date;
        form.querySelector('textarea[name="description"]').value = data.description || '';
        
        document.getElementById(`${type}ModalTitle`).textContent = `Edit ${type === 'income' ? 'Income' : 'Expense'}`;
        
        openModal(modalId);
        
    } catch (error) {
        console.error(error);
        alert('Error loading data');
    }
}

async function deleteTransaction(collection, id) {
    if (!confirm('Delete this record?')) return;
    try {
        await db.collection(collection).doc(id).delete();
        loadFinanceData();
    } catch (error) {
        console.error(error);
        alert('Error deleting record');
    }
}

function downloadFinancePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.text("Financial Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 26);
    
    // Summary
    const totalInc = document.getElementById('totalIncome').innerText;
    const totalExp = document.getElementById('totalExpenses').innerText;
    const net = document.getElementById('netBalance').innerText;
    
    doc.text(`Total Income: ${totalInc}`, 14, 35);
    doc.text(`Total Expenses: ${totalExp}`, 80, 35);
    doc.text(`Net Balance: ${net}`, 150, 35);
    
    // Expenses Table
    doc.text("Expenses", 14, 45);
    const expRows = [];
    document.querySelectorAll('#expensesList tr').forEach(tr => {
         const tds = tr.querySelectorAll('td');
         if(tds.length >= 5 && !tds[0].innerText.includes('Loading') && !tds[0].innerText.includes('No expenses')) {
             expRows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText, tds[4].innerText]);
         }
    });
    
    doc.autoTable({
        head: [['Title', 'Category', 'Amount', 'Date', 'Description']],
        body: expRows,
        startY: 50,
        theme: 'striped'
    });
    
    // Income Table
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Income", 14, finalY);
    
    const incRows = [];
    document.querySelectorAll('#incomeList tr').forEach(tr => {
         const tds = tr.querySelectorAll('td');
         if(tds.length >= 5 && !tds[0].innerText.includes('Loading') && !tds[0].innerText.includes('No income')) {
             incRows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText, tds[4].innerText]);
         }
    });
    
    doc.autoTable({
        head: [['Title', 'Category', 'Amount', 'Date', 'Description']],
        body: incRows,
        startY: finalY + 5,
        theme: 'striped'
    });
    
    doc.save('finance_report.pdf');
}

// --- UI Helpers ---

function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        // Set today as default date if present
        const dateInput = modal.querySelector('input[type="date"]');
        if (dateInput && !dateInput.value) {
            dateInput.valueAsDate = new Date();
        }
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            if(form.querySelector('input[name="docId"]')) {
                form.querySelector('input[name="docId"]').value = '';
            }
        }
        
        if(id === 'expenseModal') document.getElementById('expenseModalTitle').textContent = 'Add Expense';
        if(id === 'incomeModal') document.getElementById('incomeModalTitle').textContent = 'Add Income';
    }
}
