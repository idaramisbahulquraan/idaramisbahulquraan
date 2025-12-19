// Global variables for charts or data
let expensesData = [];
let incomeData = [];
let financeHeadsCache = [];

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function getMonthRange(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based here
    const start = `${year}-${pad2(month)}-01`;
    const end = `${year}-${pad2(month)}-${pad2(daysInMonth)}`;
    return { start, end };
}

document.addEventListener('DOMContentLoaded', () => {
    initBudgetControls();
    loadFinanceData();
    loadHeads();

    // Tab switching logic
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const target = tab.dataset.target;
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.add('active');
            if (target === 'budget-tab') loadBudgetView();
        });
    });
});

// --- Data Loading ---

async function loadFinanceData() {
    const expensesTable = document.getElementById('expensesList');
    const incomeTable = document.getElementById('incomeList');
    const tenantId = getTenantId();

    try {
        // Load Expenses
        let expenseDocs = [];
        try {
            let snap = await db.collection('expenses')
                .where('tenantId', '==', tenantId)
                .orderBy('date', 'desc')
                .limit(50)
                .get();
            expenseDocs = snap.docs;

            if (expenseDocs.length === 0) {
                snap = await db.collection('expenses').orderBy('date', 'desc').limit(200).get();
                expenseDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId)).slice(0, 50);
            }
        } catch (err) {
            console.warn('Expenses tenant query fallback', err?.message || err);
            const snap = await db.collection('expenses').orderBy('date', 'desc').limit(200).get();
            expenseDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId)).slice(0, 50);
        }
        let totalExp = 0;
        let expensesHtml = '';

        if (expenseDocs.length === 0) {
            expensesHtml = '<tr><td colspan="6" class="text-center">No expenses recorded.</td></tr>';
        } else {
            expenseDocs.forEach(doc => {
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
        if (expensesTable) expensesTable.innerHTML = expensesHtml;
        document.getElementById('totalExpenses').innerText = `Rs. ${totalExp.toLocaleString()}`;

        // Load Income (Manual + Fees)
        let incomeDocs = [];
        try {
            let snap = await db.collection('incomes')
                .where('tenantId', '==', tenantId)
                .orderBy('date', 'desc')
                .limit(50)
                .get();
            incomeDocs = snap.docs;

            if (incomeDocs.length === 0) {
                snap = await db.collection('incomes').orderBy('date', 'desc').limit(200).get();
                incomeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId)).slice(0, 50);
            }
        } catch (err) {
            console.warn('Income tenant query fallback', err?.message || err);
            const snap = await db.collection('incomes').orderBy('date', 'desc').limit(200).get();
            incomeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId)).slice(0, 50);
        }
        let totalInc = 0;
        let incomeHtml = '';

        incomeDocs.forEach(doc => {
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

        let feeDocs = [];
        try {
            let snap = await db.collection('fees')
                .where('tenantId', '==', tenantId)
                .where('status', '==', 'Paid')
                .get();
            feeDocs = snap.docs;

            if (feeDocs.length === 0) {
                snap = await db.collection('fees').where('status', '==', 'Paid').get();
                feeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
        } catch (err) {
            console.warn('Fees tenant query fallback', err?.message || err);
            const snap = await db.collection('fees').where('status', '==', 'Paid').get();
            feeDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }

        let feeIncome = 0;
        feeDocs.forEach(doc => {
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

        if (incomeTable) incomeTable.innerHTML = incomeHtml;
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
        const tenantId = getTenantId();

        let headDocs = [];
        try {
            let snap = await db.collection('finance_heads')
                .where('tenantId', '==', tenantId)
                .orderBy('name')
                .get();
            headDocs = snap.docs;

            if (headDocs.length === 0) {
                snap = await db.collection('finance_heads').orderBy('name').limit(500).get();
                headDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
        } catch (err) {
            console.warn('Heads tenant query fallback', err?.message || err);
            const snap = await db.collection('finance_heads').orderBy('name').limit(500).get();
            headDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }

        financeHeadsCache = headDocs.map(d => ({ id: d.id, ...d.data() }));
        const expenseSelect = document.getElementById('expenseCategory'); // For expense form
        const incomeSelect = document.getElementById('incomeCategory'); // For income form
        const headsList = document.getElementById('headsList');

        let expenseOptions = '<option value="" disabled selected>Select Category</option>';
        let incomeOptions = '<option value="" disabled selected>Select Category</option>';
        let headsHtml = '';

        headDocs.forEach(doc => {
            const head = doc.data();
            const displayName = head.code ? `${head.code} - ${head.name}` : head.name;
            const codePrefix = head.code ? `<small class="text-muted" style="margin-right: 0.35rem;">${head.code}</small>` : '';

            headsHtml += `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${codePrefix}${head.name} <small class="text-muted">(${head.type})</small></span>
                    <button onclick="deleteHead('${doc.id}')" class="btn-icon text-danger">&times;</button>
                </li>
            `;

            if (head.type === 'expense') {
                expenseOptions += `<option value="${head.name}">${displayName}</option>`;
            } else if (head.type === 'income') {
                incomeOptions += `<option value="${head.name}">${displayName}</option>`;
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

        return financeHeadsCache;
    } catch (error) {
        console.error("Error loading heads:", error);
        return [];
    }
}

async function addHead(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.headName.value.trim();
    const codeRaw = (form.headCode ? form.headCode.value : '').trim();
    const code = codeRaw ? codeRaw.toUpperCase() : '';
    const type = form.headType.value;

    if (!name) return;

    try {
        const payload = {
            name,
            type,
            tenantId: getTenantId(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (code) payload.code = code;

        await db.collection('finance_heads').add(payload);
        if (typeof logAudit === 'function') logAudit('finance_head_create', 'finance_heads', { name, type, code });
        form.reset();
        loadHeads(); // Refresh lists
        if (document.getElementById('budget-tab')?.classList.contains('active')) loadBudgetView();
    } catch (error) {
        console.error("Error adding head:", error);
        alert("Error adding head: " + error.message);
    }
}

async function deleteHead(id) {
    if (!confirm("Delete this category head?")) return;
    try {
        await db.collection('finance_heads').doc(id).delete();
        if (typeof logAudit === 'function') logAudit('finance_head_delete', `finance_heads/${id}`, { id });
        loadHeads();
        if (document.getElementById('budget-tab')?.classList.contains('active')) loadBudgetView();
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
        const tenantId = getTenantId();
        if (docId) {
            await db.collection(collection).doc(docId).update({
                title: data.title,
                category: data.category,
                amount: parseFloat(data.amount),
                date: data.date,
                description: data.description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (typeof logAudit === 'function') {
                logAudit(`${type}_update`, `${collection}/${docId}`, { title: data.title, category: data.category, amount: parseFloat(data.amount), date: data.date });
            }
            alert(`${type === 'income' ? 'Income' : 'Expense'} updated successfully!`);
        } else {
            const ref = await db.collection(collection).add({
                title: data.title,
                category: data.category,
                amount: parseFloat(data.amount),
                date: data.date,
                description: data.description,
                tenantId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if (typeof logAudit === 'function') {
                logAudit(`${type}_create`, `${collection}/${ref.id}`, { title: data.title, category: data.category, amount: parseFloat(data.amount), date: data.date });
            }
            alert(`${type === 'income' ? 'Income' : 'Expense'} added successfully!`);
        }

        closeModal(type === 'income' ? 'incomeModal' : 'expenseModal');
        loadFinanceData();
        if (document.getElementById('budget-tab')?.classList.contains('active')) loadBudgetView();

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}

async function editTransaction(collection, id) {
    try {
        const doc = await db.collection(collection).doc(id).get();
        if (!doc.exists) return;
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
        if (typeof logAudit === 'function') logAudit('finance_delete', `${collection}/${id}`, { id, collection });
        loadFinanceData();
        if (document.getElementById('budget-tab')?.classList.contains('active')) loadBudgetView();
    } catch (error) {
        console.error(error);
        alert('Error deleting record');
    }
}

// --- Budgeting ---

function initBudgetControls() {
    const monthEl = document.getElementById('budgetMonth');
    const yearEl = document.getElementById('budgetYear');
    if (!monthEl || !yearEl) return;

    const now = new Date();
    if (!monthEl.value) monthEl.value = String(now.getMonth() + 1);
    if (!yearEl.value) yearEl.value = String(now.getFullYear());

    const maybeReload = () => {
        if (document.getElementById('budget-tab')?.classList.contains('active')) loadBudgetView();
    };

    monthEl.addEventListener('change', maybeReload);
    yearEl.addEventListener('change', maybeReload);

    const budgetBody = document.getElementById('budgetBody');
    if (budgetBody && budgetBody.dataset.totalsWired !== '1') {
        budgetBody.addEventListener('input', (e) => {
            const target = e.target;
            if (!target || !target.classList.contains('budget-amount-input')) return;

            const row = target.closest('tr[data-head-id]');
            if (row) {
                const actual = parseFloat(row.dataset.actual || '0') || 0;
                const budget = parseFloat(target.value || '0') || 0;
                const variance = budget - actual;
                const varianceCell = row.querySelector('[data-variance-cell="1"]') || row.children[3];
                if (varianceCell) {
                    varianceCell.innerText = `Rs. ${variance.toLocaleString()}`;
                    varianceCell.className = variance >= 0 ? 'text-success' : 'text-danger';
                }
            }

            recalcBudgetTotals();
        });
        budgetBody.dataset.totalsWired = '1';
    }
}

function recalcBudgetTotals() {
    const budgetTotalEl = document.getElementById('budgetTotal');
    const actualTotalEl = document.getElementById('actualTotal');
    const varianceTotalEl = document.getElementById('varianceTotal');
    if (!budgetTotalEl || !actualTotalEl || !varianceTotalEl) return;

    let budgetSum = 0;
    document.querySelectorAll('#budgetBody input.budget-amount-input').forEach(inp => {
        budgetSum += parseFloat(inp.value || '0') || 0;
    });

    const actual = parseFloat(actualTotalEl.dataset.value || '0') || 0;
    const variance = budgetSum - actual;

    budgetTotalEl.innerText = `Rs. ${budgetSum.toLocaleString()}`;
    varianceTotalEl.innerText = `Rs. ${variance.toLocaleString()}`;
    varianceTotalEl.className = `font-bold ${variance >= 0 ? 'text-success' : 'text-danger'}`;
}

async function loadBudgetView() {
    const budgetBody = document.getElementById('budgetBody');
    if (!budgetBody) return;

    budgetBody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 2rem;">Loading budget...</td>
        </tr>
    `;

    const month = parseInt(document.getElementById('budgetMonth')?.value || '0', 10);
    const year = parseInt(document.getElementById('budgetYear')?.value || '0', 10);
    if (!month || !year) {
        budgetBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">Select a month and year.</td>
            </tr>
        `;
        return;
    }

    const tenantId = getTenantId();

    if (!financeHeadsCache || financeHeadsCache.length === 0) {
        await loadHeads();
    }

    const expenseHeads = (financeHeadsCache || [])
        .filter(h => h && h.type === 'expense')
        .sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));

    if (expenseHeads.length === 0) {
        budgetBody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem;">
                    No expense categories found. Add categories via Manage Heads first.
                </td>
            </tr>
        `;
        return;
    }

    // Load saved budgets for the period
    let budgetDocs = [];
    try {
        let snap = await db.collection('finance_budgets')
            .where('tenantId', '==', tenantId)
            .where('year', '==', year)
            .where('month', '==', month)
            .get();
        budgetDocs = snap.docs;

        if (budgetDocs.length === 0) {
            snap = await db.collection('finance_budgets')
                .where('year', '==', year)
                .where('month', '==', month)
                .limit(500)
                .get();
            budgetDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Budget query fallback', err?.message || err);
        const snap = await db.collection('finance_budgets').limit(500).get();
        budgetDocs = snap.docs.filter(d => {
            const b = d.data();
            return isInTenant(b, tenantId) && b?.year === year && b?.month === month;
        });
    }

    const budgetsByHeadId = new Map();
    budgetDocs.forEach(doc => {
        const b = doc.data() || {};
        if (!isInTenant(b, tenantId)) return;
        if (!b.headId) return;
        budgetsByHeadId.set(b.headId, { id: doc.id, ...b });
    });

    // Load actual expenses for the month
    const { start, end } = getMonthRange(year, month);
    let expenseDocs = [];
    try {
        let snap = await db.collection('expenses')
            .where('tenantId', '==', tenantId)
            .where('date', '>=', start)
            .where('date', '<=', end)
            .orderBy('date', 'asc')
            .get();
        expenseDocs = snap.docs;

        if (expenseDocs.length === 0) {
            snap = await db.collection('expenses')
                .where('date', '>=', start)
                .where('date', '<=', end)
                .orderBy('date', 'asc')
                .get();
            expenseDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Budget expenses query fallback', err?.message || err);
        const snap = await db.collection('expenses')
            .where('date', '>=', start)
            .where('date', '<=', end)
            .orderBy('date', 'asc')
            .get();
        expenseDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    }

    const actualByCategory = new Map();
    let actualTotal = 0;
    expenseDocs.forEach(doc => {
        const d = doc.data() || {};
        if (!isInTenant(d, tenantId)) return;
        const category = d.category || 'Uncategorized';
        const amount = parseFloat(d.amount || '0') || 0;
        actualTotal += amount;
        actualByCategory.set(category, (actualByCategory.get(category) || 0) + amount);
    });

    let budgetTotal = 0;
    let rowsHtml = '';

    expenseHeads.forEach(head => {
        const b = budgetsByHeadId.get(head.id);
        const budgetAmount = b ? (parseFloat(b.amount || '0') || 0) : 0;
        const actualAmount = actualByCategory.get(head.name) || 0;
        const variance = budgetAmount - actualAmount;
        const varianceClass = variance >= 0 ? 'text-success' : 'text-danger';
        const hasExistingBudget = budgetsByHeadId.has(head.id) ? '1' : '0';

        budgetTotal += budgetAmount;

        rowsHtml += `
            <tr data-head-id="${head.id}" data-head-name="${encodeURIComponent(head.name || '')}" data-existing-budget="${hasExistingBudget}" data-actual="${actualAmount}">
                <td>${head.code ? `<span class="row-muted">${head.code}</span> ` : ''}${head.name}</td>
                <td>
                    <input class="budget-amount-input" type="number" min="0" step="0.01" placeholder="0" value="${budgetAmount ? budgetAmount : ''}">
                </td>
                <td>Rs. ${parseFloat(actualAmount || 0).toLocaleString()}</td>
                <td data-variance-cell="1" class="${varianceClass}">Rs. ${parseFloat(variance || 0).toLocaleString()}</td>
            </tr>
        `;
    });

    const varianceTotal = budgetTotal - actualTotal;
    rowsHtml += `
        <tr id="budgetTotalsRow" style="background-color: #f8fafc; font-weight: 600;">
            <td>Total</td>
            <td id="budgetTotal">Rs. ${budgetTotal.toLocaleString()}</td>
            <td id="actualTotal" data-value="${actualTotal}">Rs. ${actualTotal.toLocaleString()}</td>
            <td id="varianceTotal" class="font-bold ${varianceTotal >= 0 ? 'text-success' : 'text-danger'}">Rs. ${varianceTotal.toLocaleString()}</td>
        </tr>
    `;

    budgetBody.innerHTML = rowsHtml;
    recalcBudgetTotals();
}

async function saveBudgets() {
    const month = parseInt(document.getElementById('budgetMonth')?.value || '0', 10);
    const year = parseInt(document.getElementById('budgetYear')?.value || '0', 10);
    if (!month || !year) {
        alert('Select a month and year first.');
        return;
    }

    const tenantId = getTenantId();
    const rows = Array.from(document.querySelectorAll('#budgetBody tr[data-head-id]'));
    if (rows.length === 0) {
        alert('No categories to budget. Add expense heads first.');
        return;
    }

    const batch = db.batch();
    let upserts = 0;
    let clears = 0;

    rows.forEach(row => {
        const headId = row.dataset.headId;
        const headName = decodeURIComponent(row.dataset.headName || '') || 'Unknown';
        const existingBudget = row.dataset.existingBudget === '1';
        const input = row.querySelector('input.budget-amount-input');
        const amount = parseFloat(input?.value || '0') || 0;

        const docId = `budget_${tenantId}_${year}_${month}_${headId}`;
        const ref = db.collection('finance_budgets').doc(docId);

        if (!amount || amount <= 0) {
            batch.delete(ref);
            clears += 1;
            return;
        }

        const payload = {
            tenantId,
            year,
            month,
            headId,
            categoryName: headName,
            type: 'expense',
            amount,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!existingBudget) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

        batch.set(ref, payload, { merge: true });
        upserts += 1;
    });

    try {
        await batch.commit();
        if (typeof logAudit === 'function') {
            logAudit('finance_budget_save', 'finance_budgets', { tenantId, year, month, upserts, clears });
        }
        alert(`Budget saved.\nUpdated: ${upserts}\nCleared: ${clears}`);
        loadBudgetView();
    } catch (err) {
        console.error(err);
        alert('Failed to save budget: ' + (err?.message || err));
    }
}

async function downloadFinancePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const startY = (typeof applyPdfBranding === 'function')
        ? await applyPdfBranding(doc, { title: 'Financial Report' })
        : 35;
    doc.setFontSize(10);

    // Summary
    const totalInc = document.getElementById('totalIncome').innerText;
    const totalExp = document.getElementById('totalExpenses').innerText;
    const net = document.getElementById('netBalance').innerText;

    const summaryY = startY + 5;
    doc.text(`Total Income: ${totalInc}`, 14, summaryY);
    doc.text(`Total Expenses: ${totalExp}`, 80, summaryY);
    doc.text(`Net Balance: ${net}`, 150, summaryY);

    // Expenses Table
    doc.text("Expenses", 14, summaryY + 10);
    const expRows = [];
    document.querySelectorAll('#expensesList tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 5 && !tds[0].innerText.includes('Loading') && !tds[0].innerText.includes('No expenses')) {
            expRows.push([tds[0].innerText, tds[1].innerText, tds[2].innerText, tds[3].innerText, tds[4].innerText]);
        }
    });

    doc.autoTable({
        head: [['Title', 'Category', 'Amount', 'Date', 'Description']],
        body: expRows,
        startY: summaryY + 15,
        theme: 'striped'
    });

    // Income Table
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.text("Income", 14, finalY);

    const incRows = [];
    document.querySelectorAll('#incomeList tr').forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 5 && !tds[0].innerText.includes('Loading') && !tds[0].innerText.includes('No income')) {
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
            if (form.querySelector('input[name="docId"]')) {
                form.querySelector('input[name="docId"]').value = '';
            }
        }

        if (id === 'expenseModal') document.getElementById('expenseModalTitle').textContent = 'Add Expense';
        if (id === 'incomeModal') document.getElementById('incomeModalTitle').textContent = 'Add Income';
    }
}
