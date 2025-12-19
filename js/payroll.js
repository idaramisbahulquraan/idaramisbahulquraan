
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    populateYears();

    // Set current month/year
    const now = new Date();
    document.getElementById('genMonth').value = now.getMonth();
    document.getElementById('genYear').value = now.getFullYear();
    document.getElementById('histMonth').value = now.getMonth();
    document.getElementById('histYear').value = now.getFullYear();
    const bankMonth = document.getElementById('bankMonth');
    const bankYear = document.getElementById('bankYear');
    if (bankMonth) bankMonth.value = now.getMonth();
    if (bankYear) bankYear.value = now.getFullYear();

    // Event Listeners
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) paymentForm.addEventListener('submit', handlePaymentSubmit);

    const structureForm = document.getElementById('structureForm');
    if (structureForm) structureForm.addEventListener('submit', handleSaveStructure);

    const advanceForm = document.getElementById('advanceForm');
    if (advanceForm) advanceForm.addEventListener('submit', handleSaveAdvance);

    const repaymentForm = document.getElementById('repaymentForm');
    if (repaymentForm) repaymentForm.addEventListener('submit', handleSaveRepayment);

    const leaveForm = document.getElementById('leaveForm');
    if (leaveForm) leaveForm.addEventListener('submit', handleSaveLeave);

    // Load initial history
    loadHistory();
});

function getTenantId() {
    return (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

function populateYears() {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 2;
    const endYear = currentYear + 2;

    const genSelect = document.getElementById('genYear');
    const histSelect = document.getElementById('histYear');
    const bankSelect = document.getElementById('bankYear');

    let html = '';
    for (let y = startYear; y <= endYear; y++) {
        html += `<option value="${y}">${y}</option>`;
    }
    if (genSelect) genSelect.innerHTML = html;

    // For history, add 'All Years' option if needed, but for now just same range
    if (histSelect) histSelect.innerHTML = html;
    if (bankSelect) bankSelect.innerHTML = html;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
    if (btn) btn.classList.add('active');

    const tabMap = {
        generate: 'generateTab',
        history: 'historyTab',
        leaves: 'leavesTab',
        structures: 'structuresTab',
        advances: 'advancesTab',
        bank: 'bankTab'
    };

    Object.values(tabMap).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    const targetId = tabMap[tab] || 'historyTab';
    const target = document.getElementById(targetId);
    if (target) target.style.display = 'block';

    if (tab === 'leaves') loadLeaves();
    else if (tab === 'structures') loadSalaryStructures();
    else if (tab === 'advances') loadAdvances();
    else if (tab === 'bank') loadBankPreview();
    else if (tab === 'generate') { /* loaded on-demand */ }
    else loadHistory();
}

// Generate Payroll Logic
async function loadStaffForPayroll() {
    const month = parseInt(document.getElementById('genMonth').value);
    const year = parseInt(document.getElementById('genYear').value);
    const tbody = document.getElementById('staffList');

    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">Loading staff status...</td></tr>';

    try {
        const tenantId = getTenantId();

        // 1. Fetch all payroll records for this month/year
        let payrollSnapshot;
        try {
            payrollSnapshot = await db.collection('payroll')
                .where('tenantId', '==', tenantId)
                .where('month', '==', month)
                .where('year', '==', year)
                .get();

            if (payrollSnapshot.empty) {
                payrollSnapshot = await db.collection('payroll')
                    .where('month', '==', month)
                    .where('year', '==', year)
                    .get();
            }
        } catch (err) {
            console.warn('Payroll status tenant query fallback', err?.message || err);
            payrollSnapshot = await db.collection('payroll')
                .where('month', '==', month)
                .where('year', '==', year)
                .get();
        }

        const paidStaffIds = new Set();
        payrollSnapshot.docs.filter(d => isInTenant(d.data(), tenantId)).forEach(doc => {
            paidStaffIds.add(doc.data().staffId);
        });

        // 2. Fetch all teachers
        let teacherDocs = [];
        try {
            let snap = await db.collection('teachers').where('tenantId', '==', tenantId).orderBy('firstName').get();
            teacherDocs = snap.docs;

            if (teacherDocs.length === 0) {
                snap = await db.collection('teachers').orderBy('firstName').get();
                teacherDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
        } catch (err) {
            console.warn('Teachers tenant query fallback', err?.message || err);
            const snap = await db.collection('teachers').orderBy('firstName').get();
            teacherDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }

        if (teacherDocs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No staff found.</td></tr>';
            return;
        }

        let html = '';
        teacherDocs.forEach(doc => {
            const t = doc.data();
            const isPaid = paidStaffIds.has(doc.id);
            const name = `${t.firstName} ${t.lastName}`;
            const basicSalary = t.basicSalary || 0;

            html += `
                <tr>
                    <td>${name}</td>
                    <td>Teacher</td>
                    <td>
                        <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">
                            ${isPaid ? 'Paid' : 'Pending'}
                        </span>
                    </td>
                    <td>
                        ${isPaid ?
                    `<button class="btn-action btn-secondary" disabled>Paid</button>` :
                    `<button class="btn-action btn-primary" onclick="openPaymentModal('${doc.id}', '${name}', 'Teacher', ${basicSalary})">Process Pay</button>`
                }
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (typeof updatePageLanguage === 'function') updatePageLanguage();

    } catch (error) {
        console.error("Error loading payroll status:", error);
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

// Modal & Payment Logic
const modal = document.getElementById('paymentModal');
let currentPaymentContext = {
    staffId: null,
    staffName: '',
    staffRole: '',
    teacher: null,
    structure: null,
    openAdvances: [],
    advanceOutstanding: 0
};

async function openPaymentModal(id, name, role, basicSalary = 0) {
    const form = document.getElementById('paymentForm');
    if (!form) return;
    form.reset();

    currentPaymentContext = {
        staffId: id,
        staffName: name,
        staffRole: role,
        teacher: null,
        structure: null,
        openAdvances: [],
        advanceOutstanding: 0
    };

    form.querySelector('input[name="staffId"]').value = id;
    form.querySelector('input[name="staffName"]').value = name;
    form.querySelector('input[name="staffRole"]').value = role;
    form.querySelector('input[name="month"]').value = document.getElementById('genMonth').value;
    form.querySelector('input[name="year"]').value = document.getElementById('genYear').value;

    const breakdownEl = document.getElementById('structureBreakdown');
    if (breakdownEl) breakdownEl.innerHTML = '';

    const bankEl = document.getElementById('bankDetails');
    if (bankEl) bankEl.value = '';

    const basicEl = document.getElementById('basicSalary');
    if (basicEl) basicEl.value = basicSalary;

    const allowancesEl = document.getElementById('allowances');
    if (allowancesEl) allowancesEl.value = 0;

    const structDedEl = document.getElementById('structureDeductions');
    if (structDedEl) structDedEl.value = 0;

    const taxPercentEl = document.getElementById('taxPercent');
    if (taxPercentEl) taxPercentEl.value = 0;

    const takafulPercentEl = document.getElementById('takafulPercent');
    if (takafulPercentEl) takafulPercentEl.value = 0;

    const advanceEl = document.getElementById('advanceDeduction');
    if (advanceEl) advanceEl.value = 0;

    const totalDedEl = document.getElementById('totalDeductions');
    if (totalDedEl) totalDedEl.value = 0;

    const taxHintEl = document.getElementById('taxAmountHint');
    if (taxHintEl) taxHintEl.innerText = '';

    const takafulHintEl = document.getElementById('takafulAmountHint');
    if (takafulHintEl) takafulHintEl.innerText = '';

    const advHintEl = document.getElementById('advanceOutstandingHint');
    if (advHintEl) advHintEl.innerText = '';

    // Refresh staff details
    try {
        const tenantId = getTenantId();
        const tDoc = await db.collection('teachers').doc(id).get();
        if (tDoc.exists && isInTenant(tDoc.data(), tenantId)) {
            const t = tDoc.data();
            currentPaymentContext.teacher = t;
            if (basicEl) basicEl.value = (t.basicSalary || t.basicSalary === 0) ? t.basicSalary : basicSalary;
            if (bankEl) bankEl.value = t.bankDetails || '';
        }
    } catch (e) {
        console.warn('Teacher fetch failed', e?.message || e);
    }

    // Load structure (doc id = staffId)
    try {
        const tenantId = getTenantId();
        const sDoc = await db.collection('salary_structures').doc(id).get();
        if (sDoc.exists && isInTenant(sDoc.data(), tenantId)) {
            currentPaymentContext.structure = sDoc.data();
        }
    } catch (e) {
        console.warn('Salary structure fetch failed', e?.message || e);
    }

    // Load open advances
    try {
        const adv = await fetchOpenAdvancesForStaff(id);
        currentPaymentContext.openAdvances = adv.items;
        currentPaymentContext.advanceOutstanding = adv.outstanding;

        if (advanceEl) advanceEl.max = String(adv.outstanding || 0);
        if (advHintEl) advHintEl.innerText = adv.outstanding > 0
            ? `Outstanding: Rs. ${adv.outstanding.toLocaleString()}`
            : 'No outstanding advances.';
    } catch (e) {
        console.warn('Advance fetch failed', e?.message || e);
    }

    applyStructureToPayment();
    calculateNet();

    modal.classList.add('active');
}

function closeModal() {
    modal.classList.remove('active');
}

function calculateNet() {
    const basic = parseFloat(document.getElementById('basicSalary')?.value || '0') || 0;
    const allowances = parseFloat(document.getElementById('allowances')?.value || '0') || 0;
    const bonuses = parseFloat(document.getElementById('bonuses')?.value || '0') || 0;

    const gross = basic + allowances + bonuses;

    const structDed = parseFloat(document.getElementById('structureDeductions')?.value || '0') || 0;
    const taxPercent = parseFloat(document.getElementById('taxPercent')?.value || '0') || 0;
    const takafulPercent = parseFloat(document.getElementById('takafulPercent')?.value || '0') || 0;

    const taxAmount = (gross * taxPercent) / 100;
    const takafulAmount = (gross * takafulPercent) / 100;

    const taxHintEl = document.getElementById('taxAmountHint');
    if (taxHintEl) taxHintEl.innerText = taxPercent > 0 ? `Tax: Rs. ${taxAmount.toLocaleString()}` : '';

    const takafulHintEl = document.getElementById('takafulAmountHint');
    if (takafulHintEl) takafulHintEl.innerText = takafulPercent > 0 ? `Takaful: Rs. ${takafulAmount.toLocaleString()}` : '';

    const advanceInput = document.getElementById('advanceDeduction');
    const advanceMax = parseFloat(advanceInput?.max || '0') || 0;
    let advanceDeduction = parseFloat(advanceInput?.value || '0') || 0;
    if (advanceMax > 0 && advanceDeduction > advanceMax) {
        advanceDeduction = advanceMax;
        if (advanceInput) advanceInput.value = advanceMax;
    }

    const otherDeductions = parseFloat(document.getElementById('deductions')?.value || '0') || 0;

    const totalDeductions = structDed + taxAmount + takafulAmount + advanceDeduction + otherDeductions;
    const net = gross - totalDeductions;

    const totalDedEl = document.getElementById('totalDeductions');
    if (totalDedEl) totalDedEl.value = Math.round(totalDeductions * 100) / 100;

    const netEl = document.getElementById('netSalary');
    if (netEl) netEl.value = Math.round(net * 100) / 100;
}

function sumLineItems(items) {
    if (!Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (parseFloat(item?.amount || item?.value || '0') || 0), 0);
}

function applyStructureToPayment() {
    const s = currentPaymentContext.structure;
    const breakdownEl = document.getElementById('structureBreakdown');

    const allowancesEl = document.getElementById('allowances');
    const structDedEl = document.getElementById('structureDeductions');
    const taxPercentEl = document.getElementById('taxPercent');
    const takafulPercentEl = document.getElementById('takafulPercent');

    if (!s) {
        if (allowancesEl) allowancesEl.value = 0;
        if (structDedEl) structDedEl.value = 0;
        if (taxPercentEl) taxPercentEl.value = 0;
        if (takafulPercentEl) takafulPercentEl.value = 0;
        if (breakdownEl) {
            breakdownEl.innerHTML = '<div>No salary structure configured. Use the Salary Structures tab to set one.</div>';
        }
        calculateNet();
        return;
    }

    const allowanceItems = Array.isArray(s.allowances) ? s.allowances : [];
    const deductionItems = Array.isArray(s.deductions) ? s.deductions : [];

    const allowanceTotal = Math.round(sumLineItems(allowanceItems) * 100) / 100;
    const deductionTotal = Math.round(sumLineItems(deductionItems) * 100) / 100;

    if (allowancesEl) allowancesEl.value = allowanceTotal;
    if (structDedEl) structDedEl.value = deductionTotal;
    if (taxPercentEl) taxPercentEl.value = (parseFloat(s.taxPercent || '0') || 0);
    if (takafulPercentEl) takafulPercentEl.value = (parseFloat(s.takafulPercent || '0') || 0);

    if (breakdownEl) {
        const parts = [];
        if (allowanceItems.length) {
            parts.push(`<div><strong>Allowances:</strong> ${allowanceItems.map(a => `${a.name}: ${a.amount}`).join(', ')}</div>`);
        }
        if (deductionItems.length) {
            parts.push(`<div><strong>Fixed Deductions:</strong> ${deductionItems.map(d => `${d.name}: ${d.amount}`).join(', ')}</div>`);
        }
        if (s.taxPercent) parts.push(`<div><strong>Tax:</strong> ${s.taxPercent}%</div>`);
        if (s.takafulPercent) parts.push(`<div><strong>Takaful:</strong> ${s.takafulPercent}%</div>`);
        if (currentPaymentContext.advanceOutstanding > 0) {
            parts.push(`<div><strong>Outstanding Advances:</strong> Rs. ${currentPaymentContext.advanceOutstanding.toLocaleString()}</div>`);
        }
        breakdownEl.innerHTML = parts.join('') || '<div>Structure loaded.</div>';
    }

    calculateNet();
}

async function fetchOpenAdvancesForStaff(staffId) {
    const tenantId = getTenantId();
    let docs = [];

    // Most-specific query (may require composite indexes)
    try {
        const snap = await db.collection('salary_advances')
            .where('tenantId', '==', tenantId)
            .where('staffId', '==', staffId)
            .where('status', '==', 'Open')
            .orderBy('createdAt', 'asc')
            .get();
        docs = snap.docs;
    } catch (err) {
        console.warn('Advances tenant query fallback', err?.message || err);
    }

    // Fallback for legacy docs (no tenantId) or missing indexes
    if (docs.length === 0) {
        try {
            const snap = await db.collection('salary_advances')
                .where('staffId', '==', staffId)
                .where('status', '==', 'Open')
                .orderBy('createdAt', 'asc')
                .get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        } catch (err) {
            console.warn('Advances query fallback', err?.message || err);
            try {
                const snap = await db.collection('salary_advances').orderBy('createdAt', 'asc').limit(500).get();
                docs = snap.docs.filter(d => {
                    const a = d.data() || {};
                    return isInTenant(a, tenantId) && a.staffId === staffId && (a.status || 'Open') === 'Open';
                });
            } catch (err2) {
                console.warn('Advances full fallback', err2?.message || err2);
                const snap = await db.collection('salary_advances').limit(500).get();
                docs = snap.docs.filter(d => {
                    const a = d.data() || {};
                    return isInTenant(a, tenantId) && a.staffId === staffId && (a.status || 'Open') === 'Open';
                });
            }
        }
    }

    const items = docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(a => {
            const bal = parseFloat(a.balanceAmount || a.remainingAmount || a.amount || '0') || 0;
            return (a.status || 'Open') === 'Open' && bal > 0;
        })
        .sort((a, b) => {
            const aT = (a.createdAt?.seconds || a.issuedAt?.seconds || 0);
            const bT = (b.createdAt?.seconds || b.issuedAt?.seconds || 0);
            return aT - bT;
        });

    const outstanding = Math.round(items.reduce((sum, a) => {
        const bal = parseFloat(a.balanceAmount || a.remainingAmount || a.amount || '0') || 0;
        return sum + bal;
    }, 0) * 100) / 100;

    return { items, outstanding };
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = 'Processing...';
    btn.disabled = true;

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const tenantId = getTenantId();
        const staffId = data.staffId;
        const staffName = data.staffName;
        const staffRole = data.staffRole;
        const month = parseInt(data.month);
        const year = parseInt(data.year);

        const basicSalary = parseFloat(data.basicSalary || '0') || 0;
        const allowances = parseFloat(data.allowances || '0') || 0;
        const bonuses = parseFloat(data.bonuses || '0') || 0;
        const grossSalary = basicSalary + allowances + bonuses;

        const structureDeductions = parseFloat(data.structureDeductions || '0') || 0;
        const taxPercent = parseFloat(data.taxPercent || '0') || 0;
        const takafulPercent = parseFloat(data.takafulPercent || '0') || 0;
        const taxAmount = (grossSalary * taxPercent) / 100;
        const takafulAmount = (grossSalary * takafulPercent) / 100;

        const otherDeductions = parseFloat(data.deductions || '0') || 0;
        const requestedAdvanceDeduction = parseFloat(data.advanceDeduction || '0') || 0;

        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthName = months[month] || String(month);
        const todayStr = new Date().toISOString().slice(0, 10);

        const recordExpense = data.recordExpense === 'on';
        const bankDetails = data.bankDetails || currentPaymentContext.teacher?.bankDetails || '';

        let openAdvances = { items: [], outstanding: 0 };
        try {
            openAdvances = await fetchOpenAdvancesForStaff(staffId);
        } catch (e) {
            console.warn('Open advances fetch failed', e?.message || e);
        }

        const maxAdvance = openAdvances.outstanding || 0;
        const advanceDeduction = Math.max(0, Math.min(requestedAdvanceDeduction, maxAdvance));

        const payrollDocId = `payroll_${tenantId}_${staffId}_${year}_${month}`;
        const payrollRef = db.collection('payroll').doc(payrollDocId);

        await db.runTransaction(async (tx) => {
            const existing = await tx.get(payrollRef);
            if (existing.exists) throw new Error('Payroll already processed for this staff/month/year.');

            const allocations = [];
            let remaining = advanceDeduction;

            for (const advItem of openAdvances.items) {
                if (remaining <= 0) break;
                const advRef = db.collection('salary_advances').doc(advItem.id);
                const advSnap = await tx.get(advRef);
                if (!advSnap.exists) continue;

                const adv = advSnap.data() || {};
                if (!isInTenant(adv, tenantId)) continue;
                if ((adv.status || 'Open') !== 'Open') continue;

                const currentBalance = parseFloat(adv.balanceAmount || adv.remainingAmount || adv.amount || '0') || 0;
                if (currentBalance <= 0) continue;

                const payAmt = Math.min(currentBalance, remaining);
                const roundedPay = Math.round(payAmt * 100) / 100;
                remaining -= roundedPay;

                allocations.push({ advanceId: advRef.id, amount: roundedPay });

                const newBalance = Math.max(0, Math.round((currentBalance - roundedPay) * 100) / 100);
                tx.update(advRef, {
                    balanceAmount: newBalance,
                    status: newBalance <= 0 ? 'Closed' : 'Open',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                const payRef = db.collection('salary_advance_payments').doc();
                tx.set(payRef, {
                    tenantId,
                    advanceId: advRef.id,
                    staffId,
                    staffName,
                    amount: roundedPay,
                    source: 'payroll',
                    payrollId: payrollRef.id,
                    month,
                    year,
                    date: todayStr,
                    remarks: `Payroll deduction (${monthName} ${year})`,
                    paidAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            const appliedAdvance = allocations.reduce((sum, a) => sum + (parseFloat(a.amount || '0') || 0), 0);
            const totalDeductions = structureDeductions + taxAmount + takafulAmount + appliedAdvance + otherDeductions;
            const netSalary = Math.round((grossSalary - totalDeductions) * 100) / 100;

            const paymentData = {
                staffId,
                staffName,
                staffRole,
                month,
                year,
                basicSalary,
                allowances,
                bonuses,
                grossSalary,
                structureDeductions,
                taxPercent,
                taxAmount,
                takafulPercent,
                takafulAmount,
                advanceDeduction: appliedAdvance,
                advanceAllocations: allocations,
                deductions: otherDeductions,
                totalDeductions,
                netSalary,
                bankDetails,
                remarks: data.remarks || '',
                tenantId,
                structureSnapshot: currentPaymentContext.structure || null,
                paidAt: firebase.firestore.FieldValue.serverTimestamp(),
                processedBy: firebase.auth().currentUser ? firebase.auth().currentUser.email : 'Admin'
            };

            tx.set(payrollRef, paymentData);

            if (recordExpense) {
                const expDocId = `salary_${tenantId}_${staffId}_${year}_${month}`;
                const expRef = db.collection('expenses').doc(expDocId);
                tx.set(expRef, {
                    title: `Salary - ${staffName} (${monthName} ${year})`,
                    category: 'Salaries',
                    amount: netSalary,
                    date: todayStr,
                    description: `Auto from payroll (${payrollRef.id})`,
                    tenantId,
                    source: 'payroll',
                    payrollId: payrollRef.id,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            }
        });

        if (typeof logAudit === 'function') {
            logAudit('payroll_process', `payroll/${payrollDocId}`, { staffId, month, year });
        }

        alert('Payment processed successfully!');
        closeModal();
        loadStaffForPayroll(); // Refresh list
    } catch (error) {
        console.error("Error processing payment:", error);
        alert("Error: " + (error?.message || error));
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// History Logic
async function loadHistory() {
    const month = document.getElementById('histMonth').value;
    const year = document.getElementById('histYear').value;
    const tbody = document.getElementById('historyList');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">Loading history...</td></tr>';

    try {
        const tenantId = getTenantId();
        const monthFilter = month !== "" ? parseInt(month) : null;
        const yearFilter = year !== "" ? parseInt(year) : null;
        let query = db.collection('payroll').where('tenantId', '==', tenantId);

        if (monthFilter !== null) {
            query = query.where('month', '==', monthFilter);
        }
        if (yearFilter !== null) {
            query = query.where('year', '==', yearFilter);
        }

        let snapshot;
        try {
            snapshot = await query.orderBy('paidAt', 'desc').get();
        } catch (err) {
            console.warn('History tenant query fallback', err);
            snapshot = await db.collection('payroll').orderBy('paidAt', 'desc').get();
        }

        const docs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => isInTenant(p, tenantId))
            .filter(p => (monthFilter === null || p.month === monthFilter) && (yearFilter === null || p.year === yearFilter));

        if (!docs.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-light);">No payment records found.</td></tr>';
            return;
        }

        let html = '';
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        docs.forEach(p => {
            const date = p.paidAt?.seconds ? new Date(p.paidAt.seconds * 1000).toLocaleDateString() : 'N/A';
            const monthName = months[p.month] || '';

            html += `
                <tr>
                    <td>${date}</td>
                    <td>
                        <div style="font-weight: 500;">${p.staffName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light);">${p.staffRole}</div>
                    </td>
                    <td>${monthName} ${p.year}</td>
                    <td style="font-weight: 600;">${p.netSalary}</td>
                    <td>
                        <button onclick="printSlip('${p.id}')" class="btn-action btn-secondary" style="font-size: 0.8rem;">
                            Print Slip
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (typeof updatePageLanguage === 'function') updatePageLanguage();

    } catch (error) {
        console.error("Error loading history:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

// Print Slip
async function printSlip(id) {
    try {
        const doc = await db.collection('payroll').doc(id).get();
        if (!doc.exists) return;
        const p = doc.data();

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();

        const startY = (typeof applyPdfBranding === 'function')
            ? await applyPdfBranding(pdf, { title: 'Salary Slip' })
            : 40;

        // Info
        pdf.setFontSize(12);
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        const paidDate = p.paidAt?.seconds ? new Date(p.paidAt.seconds * 1000) : new Date();
        pdf.text(`Slip ID: ${doc.id.substring(0, 8).toUpperCase()}`, 15, startY + 5);
        pdf.text(`Payment Date: ${paidDate.toLocaleDateString()}`, 150, startY + 5);

        pdf.line(15, startY + 10, 195, startY + 10);

        // Employee Details
        pdf.text(`Employee Name: ${p.staffName}`, 15, startY + 20);
        pdf.text(`Role: ${p.staffRole}`, 15, startY + 30);
        pdf.text(`Month/Year: ${months[p.month]} ${p.year}`, 15, startY + 40);
        if (p.bankDetails) {
            pdf.text(`Bank Details: ${p.bankDetails}`, 15, startY + 50);
        }

        // Payment Details
        pdf.line(15, startY + 55, 195, startY + 55);

        let y = startY + 65;
        const basic = parseFloat(p.basicSalary || 0) || 0;
        const allowances = parseFloat(p.allowances || 0) || 0;
        const bonuses = parseFloat(p.bonuses || 0) || 0;
        const gross = (p.grossSalary || p.grossSalary === 0) ? (parseFloat(p.grossSalary) || 0) : (basic + allowances + bonuses);

        const structDed = parseFloat(p.structureDeductions || 0) || 0;
        const taxAmount = parseFloat(p.taxAmount || 0) || 0;
        const takafulAmount = parseFloat(p.takafulAmount || 0) || 0;
        const advanceDed = parseFloat(p.advanceDeduction || 0) || 0;
        const otherDed = parseFloat(p.deductions || 0) || 0;
        const totalDed = (p.totalDeductions || p.totalDeductions === 0)
            ? (parseFloat(p.totalDeductions) || 0)
            : (structDed + taxAmount + takafulAmount + advanceDed + otherDed);
        const net = (p.netSalary || p.netSalary === 0) ? (parseFloat(p.netSalary) || 0) : (gross - totalDed);

        const addLine = (label, amount, negative = false) => {
            pdf.text(`${label}:`, 15, y);
            const v = Math.round((parseFloat(amount || 0) || 0) * 100) / 100;
            const amtText = negative ? `-${Math.abs(v).toLocaleString()}` : v.toLocaleString();
            pdf.text(amtText, 180, y, { align: "right" });
            y += 8;
        };

        pdf.setFont(undefined, 'normal');
        pdf.text('Earnings', 15, y);
        y += 8;
        addLine('Basic Salary', basic);
        if (allowances > 0) addLine('Allowances', allowances);
        if (bonuses > 0) addLine('Bonuses', bonuses);
        addLine('Gross Salary', gross);

        pdf.line(15, y, 195, y);
        y += 10;

        pdf.text('Deductions', 15, y);
        y += 8;
        if (structDed > 0) addLine('Structure Deductions', structDed, true);
        if (taxAmount > 0) addLine('Tax', taxAmount, true);
        if (takafulAmount > 0) addLine('Takaful', takafulAmount, true);
        if (advanceDed > 0) addLine('Advance Deduction', advanceDed, true);
        if (otherDed > 0) addLine('Other Deductions', otherDed, true);
        addLine('Total Deductions', totalDed, true);

        pdf.line(15, y, 195, y);
        y += 10;

        pdf.setFont(undefined, 'bold');
        pdf.text(`Net Salary:`, 15, y);
        pdf.text(`${Math.round(net * 100) / 100}`, 180, y, { align: "right" });

        // Footer
        y += 20;
        pdf.setFont(undefined, 'normal');
        pdf.setFontSize(10);
        if (p.remarks) {
            pdf.text(`Remarks: ${p.remarks}`, 15, y);
            y += 10;
        }
        pdf.text("This is a computer-generated slip.", 105, y, { align: "center" });

        pdf.save(`Salary_Slip_${p.staffName}_${months[p.month]}_${p.year}.pdf`);

    } catch (error) {
        console.error(error);
        alert("Error generating slip");
    }
}

// ==========================================
// LEAVE MANAGEMENT
// ==========================================

async function loadLeaves() {
    const tbody = document.getElementById('leavesList');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        let snapshot;
        try {
            snapshot = await db.collection('leaves')
                .where('tenantId', '==', tenantId)
                .orderBy('startDate', 'desc')
                .limit(50)
                .get();
        } catch (err) {
            console.warn('Leaves tenant query fallback', err?.message || err);
            snapshot = await db.collection('leaves').orderBy('startDate', 'desc').limit(50).get();
        }

        if (snapshot.empty) {
            snapshot = await db.collection('leaves').orderBy('startDate', 'desc').limit(50).get();
        }
        const docs = snapshot.docs.filter(doc => {
            const l = doc.data();
            return !l.tenantId || l.tenantId === tenantId;
        });

        if (!docs.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No leave records found.</td></tr>';
            return;
        }

        let html = '';
        docs.forEach(doc => {
            const l = doc.data();
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

            html += `
                <tr>
                    <td>${l.staffName}</td>
                    <td>${l.leaveType}</td>
                    <td>${l.startDate} to ${l.endDate}</td>
                    <td>${days > 0 ? days : 1}</td>
                    <td><span class="status-badge" style="${getLeaveStatusStyle(l.status)}">${l.status}</span></td>
                    <td>
                        <button class="btn-action btn-secondary" onclick="deleteLeave('${doc.id}')" style="background-color: #fee2e2; color: #991b1b;">Delete</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error loading leaves:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

function getLeaveStatusStyle(status) {
    if (status === 'Approved') return 'background-color: #dcfce7; color: #166534';
    if (status === 'Rejected') return 'background-color: #fee2e2; color: #991b1b';
    return 'background-color: #fef9c3; color: #854d0e';
}

function getLeaveModal() {
    return document.getElementById('leaveModal');
}

async function openLeaveModal() {
    const modal = getLeaveModal();
    const select = document.getElementById('leaveStaffId');
    if (!modal || !select) return;
    select.innerHTML = '';
    try {
        const teachers = await fetchTeachersList();
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `${t.firstName} ${t.lastName}`;
            opt.dataset.name = `${t.firstName} ${t.lastName}`;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
    modal.classList.add('active');
}

function closeLeaveModal() {
    const modal = getLeaveModal();
    if (!modal) return;
    modal.classList.remove('active');
    const form = document.getElementById('leaveForm');
    if (form) form.reset();
}

async function handleSaveLeave(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const formData = new FormData(e.target);
    const staffSelect = document.getElementById('leaveStaffId');
    const staffName = staffSelect.options[staffSelect.selectedIndex].dataset.name;

    const data = {
        staffId: formData.get('staffId'),
        staffName: staffName,
        leaveType: formData.get('leaveType'),
        status: formData.get('status'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        reason: formData.get('reason'),
        tenantId: getTenantId(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection('leaves').add(data);
        alert('Leave recorded successfully!');
        closeLeaveModal();
        loadLeaves();
    } catch (error) {
        console.error(error);
        alert('Error saving leave: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function deleteLeave(id) {
    if (!confirm('Are you sure you want to delete this leave record?')) return;
    try {
        await db.collection('leaves').doc(id).delete();
        loadLeaves();
    } catch (e) {
        console.error(e);
        alert('Error deleting leave');
    }
}

// --- Salary Structures ---

async function fetchTeachersList() {
    const tenantId = getTenantId();
    let docs = [];

    try {
        let snap = await db.collection('teachers').where('tenantId', '==', tenantId).orderBy('firstName').get();
        docs = snap.docs;

        if (docs.length === 0) {
            snap = await db.collection('teachers').orderBy('firstName').get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Teachers tenant query fallback', err?.message || err);
        const snap = await db.collection('teachers').orderBy('firstName').get();
        docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
    }

    return docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadSalaryStructures() {
    const tbody = document.getElementById('structuresList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        const teachers = await fetchTeachersList();

        let structDocs = [];
        try {
            let snap = await db.collection('salary_structures').where('tenantId', '==', tenantId).get();
            structDocs = snap.docs;

            if (structDocs.length === 0) {
                snap = await db.collection('salary_structures').limit(500).get();
                structDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
        } catch (err) {
            console.warn('Salary structures tenant query fallback', err?.message || err);
            const snap = await db.collection('salary_structures').limit(500).get();
            structDocs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }

        const structByStaffId = new Map();
        structDocs.forEach(d => {
            const s = d.data() || {};
            const staffId = s.staffId || d.id;
            structByStaffId.set(staffId, { id: d.id, ...s });
        });

        if (teachers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No staff found.</td></tr>';
            return;
        }

        let html = '';
        teachers.forEach(t => {
            const staffName = `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Teacher';
            const basicSalary = parseFloat(t.basicSalary || '0') || 0;

            const s = structByStaffId.get(t.id);
            const allowanceTotal = s ? (Math.round(sumLineItems(s.allowances) * 100) / 100) : 0;
            const deductionTotal = s ? (Math.round(sumLineItems(s.deductions) * 100) / 100) : 0;
            const taxPercent = s ? (parseFloat(s.taxPercent || '0') || 0) : 0;
            const takafulPercent = s ? (parseFloat(s.takafulPercent || '0') || 0) : 0;

            html += `
                <tr>
                    <td>${staffName}</td>
                    <td>${basicSalary}</td>
                    <td>${allowanceTotal}</td>
                    <td>${deductionTotal}</td>
                    <td>${taxPercent}</td>
                    <td>${takafulPercent}</td>
                    <td>
                        <button class="btn-action btn-secondary" onclick="openStructureModal('${t.id}', '${encodeURIComponent(staffName)}', ${basicSalary})">
                            ${s ? 'Edit' : 'Set'}
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

function getStructureModal() {
    return document.getElementById('structureModal');
}

async function openStructureModal(staffId, staffName, basicSalary = 0) {
    const modal = getStructureModal();
    const form = document.getElementById('structureForm');
    if (!modal || !form) return;

    let decodedName = staffName || '';
    try { decodedName = decodeURIComponent(decodedName); } catch (e) { /* keep original */ }

    form.reset();
    form.dataset.exists = '0';

    form.querySelector('input[name="staffId"]').value = staffId;
    const nameEl = document.getElementById('structureStaffName');
    if (nameEl) nameEl.value = decodedName || '';
    const basicEl = document.getElementById('structureBasicSalary');
    if (basicEl) basicEl.value = basicSalary || 0;

    const allowancesContainer = document.getElementById('allowancesContainer');
    const deductionsContainer = document.getElementById('structureDeductionsContainer');
    if (allowancesContainer) allowancesContainer.innerHTML = '';
    if (deductionsContainer) deductionsContainer.innerHTML = '';

    try {
        const tenantId = getTenantId();
        const doc = await db.collection('salary_structures').doc(staffId).get();
        if (doc.exists && isInTenant(doc.data(), tenantId)) {
            const s = doc.data() || {};
            form.dataset.exists = '1';

            const taxEl = document.getElementById('structureTaxPercent');
            if (taxEl) taxEl.value = parseFloat(s.taxPercent || '0') || 0;
            const takafulEl = document.getElementById('structureTakafulPercent');
            if (takafulEl) takafulEl.value = parseFloat(s.takafulPercent || '0') || 0;

            (Array.isArray(s.allowances) ? s.allowances : []).forEach(a => addAllowanceRow(a?.name || '', a?.amount || 0));
            (Array.isArray(s.deductions) ? s.deductions : []).forEach(d => addStructureDeductionRow(d?.name || '', d?.amount || 0));
        }
    } catch (e) {
        console.warn('Failed to load structure', e?.message || e);
    }

    if (document.querySelectorAll('#allowancesContainer .kv-row').length === 0) addAllowanceRow();
    if (document.querySelectorAll('#structureDeductionsContainer .kv-row').length === 0) addStructureDeductionRow();

    modal.classList.add('active');
}

function closeStructureModal() {
    const modal = getStructureModal();
    if (!modal) return;
    modal.classList.remove('active');
    const form = document.getElementById('structureForm');
    if (form) {
        form.reset();
        form.dataset.exists = '0';
    }
    const allowancesContainer = document.getElementById('allowancesContainer');
    const deductionsContainer = document.getElementById('structureDeductionsContainer');
    if (allowancesContainer) allowancesContainer.innerHTML = '';
    if (deductionsContainer) deductionsContainer.innerHTML = '';
}

function addKeyAmountRow(containerId, name = '', amount = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'kv-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.style.marginBottom = '0.5rem';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Name';
    nameInput.value = name || '';
    nameInput.className = 'kv-name';
    nameInput.style.flex = '1';

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.step = '0.01';
    amountInput.placeholder = '0';
    amountInput.value = (amount || amount === 0) ? amount : '';
    amountInput.className = 'kv-amount';
    amountInput.style.width = '160px';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-action btn-secondary';
    removeBtn.style.padding = '0.5rem';
    removeBtn.innerText = 'Remove';
    removeBtn.onclick = () => row.remove();

    row.appendChild(nameInput);
    row.appendChild(amountInput);
    row.appendChild(removeBtn);

    container.appendChild(row);
}

function addAllowanceRow(name = '', amount = '') {
    addKeyAmountRow('allowancesContainer', name, amount);
}

function addStructureDeductionRow(name = '', amount = '') {
    addKeyAmountRow('structureDeductionsContainer', name, amount);
}

function readKeyAmountRows(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];

    return Array.from(container.querySelectorAll('.kv-row')).map(row => {
        const name = (row.querySelector('.kv-name')?.value || '').trim();
        const amount = parseFloat(row.querySelector('.kv-amount')?.value || '0') || 0;
        return { name, amount };
    }).filter(x => x.name && x.amount > 0);
}

async function handleSaveStructure(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn?.innerText || 'Save';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const tenantId = getTenantId();
        const staffId = e.target.querySelector('input[name="staffId"]')?.value;
        const staffName = document.getElementById('structureStaffName')?.value || '';
        if (!staffId) throw new Error('Missing staff id.');

        const taxPercent = parseFloat(document.getElementById('structureTaxPercent')?.value || '0') || 0;
        const takafulPercent = parseFloat(document.getElementById('structureTakafulPercent')?.value || '0') || 0;

        const allowances = readKeyAmountRows('allowancesContainer');
        const deductions = readKeyAmountRows('structureDeductionsContainer');
        const exists = e.target.dataset.exists === '1';

        const payload = {
            tenantId,
            staffId,
            staffName,
            taxPercent,
            takafulPercent,
            allowances,
            deductions,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!exists) payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('salary_structures').doc(staffId).set(payload, { merge: true });
        if (typeof logAudit === 'function') logAudit('salary_structure_save', `salary_structures/${staffId}`, { staffId });

        alert('Salary structure saved.');
        closeStructureModal();
        loadSalaryStructures();
    } catch (err) {
        console.error(err);
        alert('Failed to save structure: ' + (err?.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

// --- Advances / Loans ---

async function loadAdvances() {
    const tbody = document.getElementById('advancesList');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        let docs = [];

        try {
            let snap = await db.collection('salary_advances')
                .where('tenantId', '==', tenantId)
                .orderBy('createdAt', 'desc')
                .get();
            docs = snap.docs;

            if (docs.length === 0) {
                snap = await db.collection('salary_advances').orderBy('createdAt', 'desc').limit(500).get();
                docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
            }
        } catch (err) {
            console.warn('Advances tenant query fallback', err?.message || err);
            const snap = await db.collection('salary_advances').orderBy('createdAt', 'desc').limit(500).get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }

        if (docs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);">No advances/loans found.</td></tr>';
            return;
        }

        let html = '';
        docs.forEach(doc => {
            const a = doc.data() || {};
            if (!isInTenant(a, tenantId)) return;

            const date = a.issuedDate
                || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toLocaleDateString() : 'N/A');
            const staffName = a.staffName || 'Staff';
            const type = a.type || a.advanceType || 'Advance';
            const principal = parseFloat(a.principalAmount || a.amount || '0') || 0;
            const balance = parseFloat(a.balanceAmount || a.remainingAmount || principal || '0') || 0;
            const status = a.status || (balance > 0 ? 'Open' : 'Closed');

            html += `
                <tr>
                    <td>${date}</td>
                    <td>${staffName}</td>
                    <td>${type}</td>
                    <td>${principal}</td>
                    <td style="font-weight: 600;">${balance}</td>
                    <td>
                        <span class="status-badge ${status === 'Closed' ? 'status-paid' : 'status-pending'}">${status}</span>
                    </td>
                    <td>
                        ${status === 'Open' && balance > 0
                    ? `<button class="btn-action btn-primary" onclick="openRepaymentModal('${doc.id}')" style="font-size: 0.8rem; margin-right: 0.5rem;">Repay</button>`
                    : ''
                }
                        ${status === 'Open'
                    ? `<button class="btn-action btn-secondary" onclick="closeAdvance('${doc.id}')" style="font-size: 0.8rem;">Close</button>`
                    : ''
                }
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html || '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);">No advances/loans found.</td></tr>';
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

function getAdvanceModal() {
    return document.getElementById('advanceModal');
}

async function openAdvanceModal() {
    const modal = getAdvanceModal();
    const form = document.getElementById('advanceForm');
    const select = document.getElementById('advanceStaffId');
    if (!modal || !form || !select) return;

    form.reset();
    select.innerHTML = '';

    try {
        const teachers = await fetchTeachersList();
        teachers.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `${t.firstName || ''} ${t.lastName || ''}`.trim();
            select.appendChild(opt);
        });
    } catch (e) {
        console.warn('Failed to load staff for advance', e?.message || e);
    }

    const dateInput = form.querySelector('input[name="date"]');
    if (dateInput) dateInput.valueAsDate = new Date();

    modal.classList.add('active');
}

function closeAdvanceModal() {
    const modal = getAdvanceModal();
    if (!modal) return;
    modal.classList.remove('active');
    const form = document.getElementById('advanceForm');
    if (form) form.reset();
}

async function handleSaveAdvance(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn?.innerText || 'Save';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const tenantId = getTenantId();
        const formData = new FormData(e.target);
        const staffId = formData.get('staffId');
        const staffName = document.getElementById('advanceStaffId')?.selectedOptions?.[0]?.innerText || '';
        const type = formData.get('advanceType') || 'Advance';
        const amount = parseFloat(formData.get('amount') || '0') || 0;
        const issuedDate = formData.get('date') || new Date().toISOString().slice(0, 10);
        const remarks = formData.get('remarks') || '';

        if (!staffId) throw new Error('Select a staff member.');
        if (!amount || amount <= 0) throw new Error('Enter a valid amount.');

        const payload = {
            tenantId,
            staffId,
            staffName,
            type,
            principalAmount: amount,
            balanceAmount: amount,
            status: 'Open',
            issuedDate,
            remarks,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const ref = await db.collection('salary_advances').add(payload);
        if (typeof logAudit === 'function') logAudit('salary_advance_create', `salary_advances/${ref.id}`, { staffId, amount, type });

        alert('Advance/loan saved.');
        closeAdvanceModal();
        loadAdvances();
    } catch (err) {
        console.error(err);
        alert('Failed to save advance: ' + (err?.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

function getRepaymentModal() {
    return document.getElementById('repaymentModal');
}

async function openRepaymentModal(advanceId) {
    const modal = getRepaymentModal();
    const form = document.getElementById('repaymentForm');
    if (!modal || !form) return;

    form.reset();
    form.querySelector('input[name="advanceId"]').value = advanceId;

    try {
        const tenantId = getTenantId();
        const doc = await db.collection('salary_advances').doc(advanceId).get();
        if (!doc.exists) throw new Error('Advance not found.');
        const a = doc.data() || {};
        if (!isInTenant(a, tenantId)) throw new Error('Not allowed.');

        const balance = parseFloat(a.balanceAmount || a.remainingAmount || a.amount || '0') || 0;
        form.querySelector('input[name="staffId"]').value = a.staffId || '';

        const staffNameEl = document.getElementById('repaymentStaffName');
        if (staffNameEl) staffNameEl.value = a.staffName || '';

        const balEl = document.getElementById('repaymentBalance');
        if (balEl) balEl.value = balance;

        const amtEl = document.getElementById('repaymentAmount');
        if (amtEl) {
            amtEl.max = String(balance || 0);
            amtEl.value = balance > 0 ? balance : 0;
        }

        const dateInput = form.querySelector('input[name="date"]');
        if (dateInput) dateInput.valueAsDate = new Date();
    } catch (err) {
        console.error(err);
        alert('Failed to open repayment: ' + (err?.message || err));
        return;
    }

    modal.classList.add('active');
}

function closeRepaymentModal() {
    const modal = getRepaymentModal();
    if (!modal) return;
    modal.classList.remove('active');
    const form = document.getElementById('repaymentForm');
    if (form) form.reset();
}

async function handleSaveRepayment(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn?.innerText || 'Save';
    if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

    try {
        const tenantId = getTenantId();
        const formData = new FormData(e.target);
        const advanceId = formData.get('advanceId');
        const staffId = formData.get('staffId');
        const amount = parseFloat(formData.get('amount') || '0') || 0;
        const date = formData.get('date') || new Date().toISOString().slice(0, 10);
        const remarks = formData.get('remarks') || '';

        if (!advanceId) throw new Error('Advance not selected.');
        if (!amount || amount <= 0) throw new Error('Enter a valid amount.');

        const advanceRef = db.collection('salary_advances').doc(advanceId);

        await db.runTransaction(async (tx) => {
            const snap = await tx.get(advanceRef);
            if (!snap.exists) throw new Error('Advance not found.');
            const a = snap.data() || {};
            if (!isInTenant(a, tenantId)) throw new Error('Not allowed.');

            const currentBalance = parseFloat(a.balanceAmount || a.remainingAmount || a.amount || '0') || 0;
            const payAmt = Math.min(currentBalance, amount);
            const roundedPay = Math.round(payAmt * 100) / 100;
            const newBalance = Math.max(0, Math.round((currentBalance - roundedPay) * 100) / 100);

            tx.update(advanceRef, {
                balanceAmount: newBalance,
                status: newBalance <= 0 ? 'Closed' : 'Open',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const payRef = db.collection('salary_advance_payments').doc();
            tx.set(payRef, {
                tenantId,
                advanceId,
                staffId: a.staffId || staffId,
                staffName: a.staffName || '',
                amount: roundedPay,
                source: 'manual',
                date,
                remarks,
                paidAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        if (typeof logAudit === 'function') logAudit('salary_advance_repay', `salary_advances/${advanceId}`, { advanceId, amount });

        alert('Repayment recorded.');
        closeRepaymentModal();
        loadAdvances();
    } catch (err) {
        console.error(err);
        alert('Failed to save repayment: ' + (err?.message || err));
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = originalText; }
    }
}

async function closeAdvance(id) {
    if (!confirm('Close this advance/loan?')) return;
    try {
        await db.collection('salary_advances').doc(id).set({
            status: 'Closed',
            balanceAmount: 0,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        if (typeof logAudit === 'function') logAudit('salary_advance_close', `salary_advances/${id}`, { id });
        loadAdvances();
    } catch (err) {
        console.error(err);
        alert('Failed to close advance: ' + (err?.message || err));
    }
}

// --- Bank Export ---

async function fetchPayrollForPeriod(month, year) {
    const tenantId = getTenantId();
    let docs = [];

    try {
        let snap = await db.collection('payroll')
            .where('tenantId', '==', tenantId)
            .where('month', '==', month)
            .where('year', '==', year)
            .get();
        docs = snap.docs;

        if (docs.length === 0) {
            snap = await db.collection('payroll')
                .where('month', '==', month)
                .where('year', '==', year)
                .get();
            docs = snap.docs.filter(d => isInTenant(d.data(), tenantId));
        }
    } catch (err) {
        console.warn('Payroll bank query fallback', err?.message || err);
        try {
            const snap = await db.collection('payroll').orderBy('paidAt', 'desc').limit(500).get();
            docs = snap.docs.filter(d => {
                const p = d.data() || {};
                return isInTenant(p, tenantId) && p.month === month && p.year === year;
            });
        } catch (err2) {
            console.warn('Payroll bank full fallback', err2?.message || err2);
            const snap = await db.collection('payroll').limit(500).get();
            docs = snap.docs.filter(d => {
                const p = d.data() || {};
                return isInTenant(p, tenantId) && p.month === month && p.year === year;
            });
        }
    }

    return docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(p => isInTenant(p, tenantId) && p.month === month && p.year === year);
}

async function loadBankPreview() {
    const tbody = document.getElementById('bankList');
    if (!tbody) return;

    const monthEl = document.getElementById('bankMonth');
    const yearEl = document.getElementById('bankYear');
    if (!monthEl || !yearEl) return;

    const month = parseInt(monthEl.value);
    const year = parseInt(yearEl.value);
    if (Number.isNaN(month) || Number.isNaN(year)) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Select month/year to preview.</td></tr>';
        return;
    }

    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">Loading...</td></tr>';

    try {
        const records = await fetchPayrollForPeriod(month, year);
        if (!records.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-light);">No payroll payments found for this period.</td></tr>';
            return;
        }

        records.sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''));

        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${r.staffName || '-'}</td>
                <td>${r.bankDetails || '-'}</td>
                <td style="font-weight: 600;">${r.netSalary || 0}</td>
            </tr>
        `).join('');

        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

function csvEscape(value) {
    const str = String(value ?? '');
    if (/[\",\r\n]/.test(str)) return `"${str.replace(/\"/g, '\"\"')}"`;
    return str;
}

function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBankCSV() {
    const monthEl = document.getElementById('bankMonth');
    const yearEl = document.getElementById('bankYear');
    if (!monthEl || !yearEl) return;

    const month = parseInt(monthEl.value);
    const year = parseInt(yearEl.value);
    if (Number.isNaN(month) || Number.isNaN(year)) {
        alert('Select a month and year.');
        return;
    }

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[month] || String(month);

    try {
        const records = await fetchPayrollForPeriod(month, year);
        if (!records.length) {
            alert('No payroll payments found for this period.');
            return;
        }

        records.sort((a, b) => (a.staffName || '').localeCompare(b.staffName || ''));

        const header = ['Staff Name', 'Bank Details', 'Net Salary', 'Month', 'Year', 'Payroll ID'];
        const lines = [header.map(csvEscape).join(',')];

        records.forEach(r => {
            lines.push([
                r.staffName || '',
                r.bankDetails || '',
                r.netSalary || 0,
                monthName,
                year,
                r.id
            ].map(csvEscape).join(','));
        });

        const csv = lines.join('\r\n');
        downloadTextFile(`bank_export_${year}_${month + 1}.csv`, csv, 'text/csv;charset=utf-8');
        if (typeof logAudit === 'function') logAudit('bank_export_csv', 'payroll', { month, year, count: records.length });
    } catch (err) {
        console.error(err);
        alert('Failed to export CSV: ' + (err?.message || err));
    }
}
