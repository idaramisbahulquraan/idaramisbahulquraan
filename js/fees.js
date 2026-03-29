
const feeDepartmentSelect = document.getElementById('feeDepartmentSelect');
const feeClassSelect = document.getElementById('feeClassSelect');
const feeStudentSelect = document.getElementById('feeStudentSelect');
const nameDisplay = document.getElementById('studentNameDisplay');

let foundStudent = null;
let feeHeadsCache = [];

function getTenantId() {
    if (typeof getCurrentTenant === 'function') return getCurrentTenant();
    return localStorage.getItem('tenant_id') || 'default';
}

function displaySelectedStudent(student) {
    if (!nameDisplay) return;
    if (student) {
        const rollText = student.rollNumber ? `Roll ${student.rollNumber}` : 'Roll N/A';
        const displayClassName = (typeof getClassDisplayName === 'function')
            ? getClassDisplayName(student.className || '', student.className_ur || '')
            : (student.className_ur || student.className || '');
        nameDisplay.textContent = `Selected: ${student.firstName} ${student.lastName} (${rollText}, ${displayClassName})`;
        nameDisplay.style.color = 'var(--primary-color)';
    } else {
        nameDisplay.textContent = '';
        nameDisplay.style.color = 'var(--text-light)';
    }
}

async function loadFeeDepartments(selected = '') {
    if (!feeDepartmentSelect) return;
    const tenantId = getTenantId();
    feeDepartmentSelect.innerHTML = '<option value="">Select Department</option>';
    try {
        let snap = await db.collection('departments')
            .where('tenantId', '==', tenantId)
            .get();
        let departments = snap.docs.map(d => ({ name: d.data().name, name_ur: d.data().name_ur || '' })).filter(d => d.name);
        if (!departments.length) {
            snap = await db.collection('departments').get();
            departments = snap.docs.map(d => ({ name: d.data().name, name_ur: d.data().name_ur || '' })).filter(d => d.name);
        }
        departments.forEach(dep => {
            const opt = document.createElement('option');
            opt.value = dep.name;
            opt.textContent = dep.name_ur || dep.name;
            feeDepartmentSelect.appendChild(opt);
        });
        if (selected) {
            feeDepartmentSelect.value = selected;
            // Handle if selected not in list (legacy)
            if (feeDepartmentSelect.value !== selected) {
                const opt = document.createElement('option');
                opt.value = selected;
                opt.textContent = (typeof getDepartmentDisplayName === 'function') ? getDepartmentDisplayName(selected) : selected;
                feeDepartmentSelect.appendChild(opt);
                feeDepartmentSelect.value = selected;
            }
        }
    } catch (err) {
        console.error('Failed to load departments', err);
    }
}

async function loadFeeClasses(department, selected = '') {
    if (!feeClassSelect) return;
    feeClassSelect.innerHTML = '<option value="">Select Class</option>';
    feeStudentSelect && (feeStudentSelect.innerHTML = '<option value="">Select Student</option>');
    foundStudent = null;
    displaySelectedStudent(null);
    if (!department) return;
    const tenantId = getTenantId();
    try {
        let snap = await db.collection('classes')
            .where('tenantId', '==', tenantId)
            .where('department', '==', department)
            .get();
        if (!snap.size) {
            snap = await db.collection('classes')
                .where('department', '==', department)
                .get();
        }
        const seen = new Set();
        snap.forEach(doc => {
            const data = doc.data();
            if (!data.name) return;
            const label = data.name_ur || data.name;
            if (seen.has(label)) return;
            seen.add(label);

            const opt = document.createElement('option');
            opt.value = data.name;
            opt.textContent = label;
            feeClassSelect.appendChild(opt);
        });
        if (selected) {
            feeClassSelect.value = selected;
            if (feeClassSelect.value !== selected) {
                const opt = document.createElement('option');
                opt.value = selected;
                opt.textContent = (typeof getClassDisplayName === 'function') ? getClassDisplayName(selected) : selected;
                feeClassSelect.appendChild(opt);
                feeClassSelect.value = selected;
            }
        }
    } catch (err) {
        console.error('Failed to load classes', err);
    }
}

async function loadFeeStudents(department, className, selectedId = '') {
    if (!feeStudentSelect) return;
    feeStudentSelect.innerHTML = '<option value="">Select Student</option>';
    foundStudent = null;
    displaySelectedStudent(null);
    if (!department || !className) return;
    const tenantId = getTenantId();
    try {
        let snap = await db.collection('students')
            .where('tenantId', '==', tenantId)
            .where('department', '==', department)
            .where('className', '==', className)
            .get();
        if (snap.empty) {
            snap = await db.collection('students')
                .where('department', '==', department)
                .where('className', '==', className)
                .get();
        }
        snap.forEach(doc => {
            const data = doc.data();
            const opt = document.createElement('option');
            opt.value = doc.id;
            opt.textContent = `${data.firstName || ''} ${data.lastName || ''}`.trim() + ` (Roll ${data.rollNumber || 'N/A'})`;
            opt.dataset.rollNumber = data.rollNumber || '';
            opt.dataset.className = data.className || '';
            opt.dataset.department = data.department || department || '';
            opt.dataset.firstName = data.firstName || '';
            opt.dataset.lastName = data.lastName || '';
            feeStudentSelect.appendChild(opt);
            if (selectedId && doc.id === selectedId) {
                feeStudentSelect.value = selectedId;
                foundStudent = {
                    id: doc.id,
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    rollNumber: data.rollNumber || '',
                    className: data.className || '',
                    department: data.department || '',
                    tenantId
                };
            }
        });
        if (foundStudent) {
            displaySelectedStudent(foundStudent);
        }
    } catch (err) {
        console.error('Failed to load students', err);
    }
}

function onFeeDepartmentChange() {
    const dep = feeDepartmentSelect ? feeDepartmentSelect.value : '';
    loadFeeClasses(dep);
}

function onFeeClassChange() {
    const dep = feeDepartmentSelect ? feeDepartmentSelect.value : '';
    const cls = feeClassSelect ? feeClassSelect.value : '';
    loadFeeStudents(dep, cls);
}

function onFeeStudentChange() {
    const opt = feeStudentSelect ? feeStudentSelect.options[feeStudentSelect.selectedIndex] : null;
    if (!opt || !opt.value) {
        foundStudent = null;
        displaySelectedStudent(null);
        return;
    }
    foundStudent = {
        id: opt.value,
        firstName: opt.dataset.firstName || '',
        lastName: opt.dataset.lastName || '',
        rollNumber: opt.dataset.rollNumber || '',
        className: opt.dataset.className || '',
        department: opt.dataset.department || '',
        tenantId: getTenantId()
    };
    displaySelectedStudent(foundStudent);
}

async function loadFeeDropdowns(prefill = {}) {
    await loadFeeDepartments(prefill.department || '');
    if (prefill.department) {
        await loadFeeClasses(prefill.department, prefill.className || '');
    }
    if (prefill.department && prefill.className) {
        await loadFeeStudents(prefill.department, prefill.className, prefill.studentId || '');
    } else {
        foundStudent = null;
        displaySelectedStudent(null);
    }
}

// Tab Switching
function switchTab(tab) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`);
    if (btn) btn.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(div => div.classList.remove('active'));
    if (tab === 'fees') {
        document.getElementById('fees-tab').classList.add('active');
        loadFees();
    } else if (tab === 'heads') {
        document.getElementById('heads-tab').classList.add('active');
        loadFeeHeads();
    } else if (tab === 'defaulters') {
        document.getElementById('defaulters-tab').classList.add('active');
        loadDefaulters();
    }
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
    if (id === 'feeModal') {
        document.querySelector('#feeModal input[name="year"]').value = new Date().getFullYear();
        populateFeeTypes();
        calculateNet(); // Reset net calculation
        loadFeeDropdowns();
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
    // Reset forms
    if (id === 'feeModal') {
        document.getElementById('addFeeForm').reset();
        document.querySelector('input[name="docId"]').value = '';
        document.getElementById('feeModalTitle').textContent = 'Add Fee Record';
        nameDisplay.textContent = '';
        foundStudent = null;
        document.getElementById('netAmountDisplay').innerText = '0';
        if (feeDepartmentSelect) feeDepartmentSelect.value = '';
        if (feeClassSelect) feeClassSelect.innerHTML = '<option value="">Select Class</option>';
        if (feeStudentSelect) feeStudentSelect.innerHTML = '<option value="">Select Student</option>';
    } else if (id === 'headModal') {
        document.querySelector('#headModal form').reset();
    }
}

// --- Fees Logic ---

async function populateFeeTypes() {
    const select = document.getElementById('feeTypeSelect');
    if (feeHeadsCache.length === 0) {
        const tenantId = getTenantId();
        feeHeadsCache = [];
        try {
            let snapshot = await db.collection('fee_heads').where('tenantId', '==', tenantId).orderBy('name').get();
            if (snapshot.empty) {
                snapshot = await db.collection('fee_heads').orderBy('name').get();
            }
            snapshot.forEach(doc => {
                const data = doc.data();
                if (!data.tenantId || data.tenantId === tenantId) {
                    feeHeadsCache.push({ ...data, id: doc.id });
                }
            });
        } catch (err) {
            console.error('Failed to load fee heads', err);
        }
    }

    select.innerHTML = '<option value="" data-i18n="select_fee_type">Select Fee Type</option>';

    // Default options
    const defaults = ['Monthly Fee', 'Admission Fee', 'Exam Fee', 'Other'];
    defaults.forEach(t => {
        // Only add if not in custom heads to avoid duplicates if user added them
        if (!feeHeadsCache.find(h => h.name === t)) {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            select.appendChild(opt);
        }
    });

    // Custom heads
    feeHeadsCache.forEach(head => {
        const opt = document.createElement('option');
        opt.value = head.name;
        opt.innerText = head.name;
        opt.dataset.amount = head.amount || '';
        select.appendChild(opt);
    });

    if (typeof updatePageLanguage === 'function') updatePageLanguage();
}

function updateAmountFromHead() {
    const select = document.getElementById('feeTypeSelect');
    const amountInput = document.getElementById('amountInput');
    const selectedOpt = select.options[select.selectedIndex];

    if (selectedOpt.dataset.amount) {
        amountInput.value = selectedOpt.dataset.amount;
        calculateNet();
    }
}

function calculateNet() {
    const amount = parseFloat(document.getElementById('amountInput').value) || 0;
    const discount = parseFloat(document.getElementById('discountInput').value) || 0;
    const fine = parseFloat(document.getElementById('fineInput').value) || 0;

    const net = amount + fine - discount;
    document.getElementById('netAmountDisplay').innerText = net > 0 ? net : 0;
}

async function handleAddFee(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const docId = data.docId;

    if (!foundStudent) {
        alert('Please select a student first.');
        return;
    }

    try {
        const tenantId = getTenantId();
        const feeData = {
            feeType: data.feeType,
            month: data.month,
            year: parseInt(data.year),
            amount: parseFloat(data.amount),
            discount: parseFloat(data.discount) || 0,
            fine: parseFloat(data.fine) || 0,
            dueDate: data.dueDate || null,
            status: data.status,
            tenantId,
            studentId: foundStudent.id,
            studentName: `${foundStudent.firstName} ${foundStudent.lastName}`.trim(),
            rollNumber: foundStudent.rollNumber,
            className: foundStudent.className,
            department: foundStudent.department
        };

        if (docId) {
            if (data.status === 'Paid') {
                feeData.paidAt = firebase.firestore.FieldValue.serverTimestamp();
            }
            await db.collection('fees').doc(docId).set(feeData, { merge: true });
            alert('Fee record updated successfully!');
        } else {
            feeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            feeData.paidAt = data.status === 'Paid' ? firebase.firestore.FieldValue.serverTimestamp() : null;
            await db.collection('fees').add(feeData);
            alert('Fee record added successfully!');
        }

        closeModal('feeModal');
        // Refresh current tab
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.getAttribute('onclick').includes('defaulters')) {
            loadDefaulters();
        } else {
            loadFees();
        }

    } catch (error) {
        console.error("Error saving fee:", error);
        alert("Error: " + error.message);
    }
}

async function editFee(id) {
    try {
        const doc = await db.collection('fees').doc(id).get();
        if (!doc.exists) return;

        const fee = doc.data();

        // Pre-fill form
        const form = document.getElementById('addFeeForm');
        form.querySelector('input[name="docId"]').value = id;
        await loadFeeDropdowns({ department: fee.department, className: fee.className, studentId: fee.studentId });
        // Ensure foundStudent is set even if option missing
        if (!foundStudent) {
            const nameParts = (fee.studentName || '').split(' ');
            foundStudent = {
                id: fee.studentId,
                firstName: nameParts[0] || '',
                lastName: nameParts.slice(1).join(' '),
                rollNumber: fee.rollNumber,
                className: fee.className,
                department: fee.department
            };
            displaySelectedStudent(foundStudent);
            if (feeStudentSelect && fee.studentId) {
                const opt = document.createElement('option');
                opt.value = fee.studentId;
                opt.textContent = `${fee.studentName} (Roll ${fee.rollNumber || 'N/A'})`;
                feeStudentSelect.appendChild(opt);
                feeStudentSelect.value = fee.studentId;
            }
        }

        // Fee Type - wait for populate if needed
        const feeTypeSelect = form.querySelector('select[name="feeType"]');
        if (feeTypeSelect.options.length <= 1) await populateFeeTypes();
        feeTypeSelect.value = fee.feeType;

        form.querySelector('select[name="month"]').value = fee.month;
        form.querySelector('input[name="year"]').value = fee.year;
        form.querySelector('input[name="amount"]').value = fee.amount;
        form.querySelector('select[name="status"]').value = fee.status;

        // New fields
        form.querySelector('input[name="dueDate"]').value = fee.dueDate || '';
        form.querySelector('input[name="discount"]').value = fee.discount || '';
        form.querySelector('input[name="fine"]').value = fee.fine || '';

        calculateNet();

        document.getElementById('feeModalTitle').textContent = 'Edit Fee Record';
        openModal('feeModal');

    } catch (e) {
        console.error(e);
        alert('Error loading fee details');
    }
}

async function downloadFeesPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const startY = (typeof applyPdfBranding === 'function')
        ? await applyPdfBranding(doc, { title: 'Fee Records Report' })
        : 35;

    const table = document.getElementById('feesTable');
    const headers = [['Student', 'Class', 'Roll No', 'Month/Year', 'Amount', 'Status', 'Date']];
    const rows = [];

    const trs = table.querySelectorAll('tbody tr');
    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 5) return;

        const studentText = tds[0].innerText.split('\n');
        const name = studentText[0];
        const cls = studentText[1] || '';

        const roll = tds[1].innerText;
        const monthYear = tds[2].innerText.replace('\n', ' ');
        const amount = tds[3].innerText;
        const status = tds[4].innerText;
        const date = tds[5].innerText;

        rows.push([name, cls, roll, monthYear, amount, status, date]);
    });

    doc.autoTable({
        head: headers,
        body: rows,
        startY,
    });

    doc.save('fees_report.pdf');
}

async function loadFees() {
    const tbody = document.getElementById('feesList');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        let snapshot;
        try {
            snapshot = await db.collection('fees')
                .where('tenantId', '==', tenantId)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            if (snapshot.empty) {
                snapshot = await db.collection('fees').orderBy('createdAt', 'desc').limit(50).get();
            }
        } catch (err) {
            console.warn('Fees tenant query failed, fallback to all', err);
            snapshot = await db.collection('fees').orderBy('createdAt', 'desc').limit(50).get();
        }

        const docs = snapshot.docs.filter(doc => {
            const fee = doc.data();
            return !fee.tenantId || fee.tenantId === tenantId;
        });

        if (!docs.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-light);" data-i18n="loading_fees">
                        No fee records found. Click "Add Fee Record" to start.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        docs.forEach(doc => {
            const fee = doc.data();
            const statusClass = fee.status === 'Paid' ? 'status-paid' : 'status-pending';
            const date = fee.createdAt ? new Date(fee.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                    <td>
                        <div style="font-weight: 500;">${fee.studentName}</div>
                    <div style="font-size: 0.75rem; color: var(--text-light);">${(typeof getClassDisplayName === 'function') ? getClassDisplayName(fee.className || '', fee.className_ur || '') : (fee.className_ur || fee.className || '')}</div>
                    </td>
                <td>${fee.rollNumber}</td>
                <td>${fee.month} ${fee.year} <br><span style="font-size: 0.75rem; color: var(--text-light);">${fee.feeType}</span></td>
                <td style="font-weight: 600;">Rs. ${fee.amount}</td>
                <td><span class="status-badge ${statusClass}">${fee.status}</span></td>
                <td>${date}</td>
                <td>
                    <button style="color: var(--primary-color); background: none; border: none; cursor: pointer; margin-right: 0.5rem;" onclick="editFee('${doc.id}')" data-i18n="edit">Edit</button>
                    ${fee.status === 'Pending' ?
                    `<button class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-right:0.25rem;" onclick="startPayment('stripe','${doc.id}')">Pay</button>
                     <button class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="markPaid('${doc.id}')" data-i18n="paid">Mark Paid</button>`
                    : `<span style="color: var(--primary-color); margin-right: 0.5rem;" data-i18n="paid">✓ Paid</span>
                       <button onclick="window.open('fee-receipt.html?id=${doc.id}', '_blank')" style="background: none; border: none; cursor: pointer; font-size: 1.2rem;" title="Print Receipt">🖨️</button>`}
                    <button style="margin-left: 0.5rem; color: red; background: none; border: none; cursor: pointer;" onclick="deleteFee('${doc.id}')" data-i18n="delete">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
        if (typeof updatePageLanguage === 'function') updatePageLanguage();

    } catch (error) {
        console.error("Error loading fees:", error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

async function markPaid(id) {
    if (!confirm('Mark this fee as Paid?')) return;

    try {
        await db.collection('fees').doc(id).update({
            status: 'Paid',
            paidAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Refresh current tab
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab && activeTab.getAttribute('onclick').includes('defaulters')) {
            loadDefaulters();
        } else {
            loadFees();
        }
    } catch (error) {
        console.error(error);
        alert('Error updating status');
    }
}

async function deleteFee(id) {
    if (!confirm('Delete this record?')) return;

    try {
        await db.collection('fees').doc(id).delete();
        loadFees();
    } catch (error) {
        console.error(error);
        alert('Error deleting record');
    }
}

// --- Defaulters Logic ---

async function loadDefaulters() {
    const tbody = document.getElementById('defaultersList');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        const snapshot = await db.collection('fees')
            .where('status', '==', 'Pending')
            .limit(100)
            .get();

        const filtered = snapshot.docs.filter(doc => {
            const fee = doc.data();
            return !fee.tenantId || fee.tenantId === tenantId;
        });

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No defaulters found.</td></tr>`;
            return;
        }

        let html = '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        filtered.forEach(doc => {
            const fee = doc.data();
            const dueDate = fee.dueDate ? new Date(fee.dueDate) : null;
            const isOverdue = dueDate && dueDate < today;
            const dueDateStr = dueDate ? dueDate.toLocaleDateString() : 'N/A';

            html += `
                <tr>
                    <td>
                        <div style="font-weight: 500;">${fee.studentName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light);">${(typeof getClassDisplayName === 'function') ? getClassDisplayName(fee.className || '', fee.className_ur || '') : (fee.className_ur || fee.className || '')}</div>
                    </td>
                    <td>${fee.rollNumber}</td>
                    <td>${fee.month} ${fee.year} <br><span style="font-size: 0.75rem; color: var(--text-light);">${fee.feeType}</span></td>
                    <td style="font-weight: 600;">Rs. ${fee.amount}</td>
                    <td style="${isOverdue ? 'color: red; font-weight: bold;' : ''}">${dueDateStr}</td>
                    <td>
                        <button onclick="sendReminder('${doc.id}', '${fee.studentName.replace(/'/g, "\\'")}')" class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; background-color: #f59e0b;" data-i18n="send_reminder">Remind</button>
                        <button class="btn-add" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; margin-left: 0.5rem;" onclick="markPaid('${doc.id}')" data-i18n="paid">Paid</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    } catch (error) {
        console.error("Error loading defaulters:", error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

async function sendReminder(id, name) {
    alert(`Reminder successfully sent to ${name}!`);
    // In a real app, this would trigger an email/SMS cloud function
}

// --- Fee Heads Logic ---

async function handleAddHead(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const formData = new FormData(e.target);
    const name = formData.get('name');
    const amount = formData.get('amount') ? parseFloat(formData.get('amount')) : null;

    try {
        await db.collection('fee_heads').add({
            name: name,
            amount: amount,
            tenantId: getTenantId(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        feeHeadsCache = []; // Clear cache
        closeModal('headModal');
        loadFeeHeads();
        alert('Fee Head added!');
    } catch (error) {
        console.error(error);
        alert('Error adding fee head');
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Head';
    }
}

async function loadFeeHeads() {
    const tbody = document.getElementById('headsList');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Loading...</td></tr>';

    try {
        const tenantId = getTenantId();
        let snapshot;
        try {
            snapshot = await db.collection('fee_heads')
                .where('tenantId', '==', tenantId)
                .orderBy('createdAt', 'desc')
                .get();
            if (snapshot.empty) {
                snapshot = await db.collection('fee_heads').orderBy('createdAt', 'desc').get();
            }
        } catch (err) {
            console.warn('Fallback to global fee heads', err);
            snapshot = await db.collection('fee_heads').orderBy('createdAt', 'desc').get();
        }

        const docs = snapshot.docs.filter(doc => {
            const data = doc.data();
            return !data.tenantId || data.tenantId === tenantId;
        });

        if (!docs.length) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No fee heads found.</td></tr>';
            return;
        }

        let html = '';
        docs.forEach(doc => {
            const h = doc.data();
            html += `
                <tr>
                    <td style="font-weight: 500;">${h.name}</td>
                    <td>${h.amount ? 'Rs. ' + h.amount : '-'}</td>
                    <td>
                        <button onclick="deleteHead('${doc.id}')" style="color: var(--danger); background: none; border: none; font-weight: 600; cursor: pointer;" data-i18n="delete">Delete</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
        if (typeof updatePageLanguage === 'function') updatePageLanguage();
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: red;">Error loading data.</td></tr>';
    }
}

async function deleteHead(id) {
    if (!confirm('Delete this fee head?')) return;
    try {
        await db.collection('fee_heads').doc(id).delete();
        feeHeadsCache = [];
        loadFeeHeads();
    } catch (error) {
        console.error(error);
        alert('Error deleting fee head');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFees();
    // Preload heads for dropdown
    populateFeeTypes();
    loadFeeDropdowns();
});
