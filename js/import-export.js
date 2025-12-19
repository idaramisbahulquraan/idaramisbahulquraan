let importState = {
    entity: 'students',
    fileName: '',
    rows: [],
    validRows: [],
    errors: []
};

const IMPORT_SCHEMAS = {
    students: {
        required: ['first_name', 'last_name', 'department', 'class_name'],
        templateHeaders: ['firstName', 'lastName', 'email', 'password', 'department', 'className', 'rollNumber', 'parentName', 'parentPhone'],
        aliases: {
            first_name: ['first_name', 'firstname', 'first'],
            last_name: ['last_name', 'lastname', 'last'],
            email: ['email', 'email_address', 'login_email'],
            password: ['password', 'pass'],
            department: ['department', 'dept'],
            class_name: ['class_name', 'classname', 'class', 'admissionclass', 'admission_class'],
            roll_number: ['roll_number', 'rollno', 'roll_no', 'rollnumber', 'roll'],
            parent_name: ['parent_name', 'parentname', 'guardian_name', 'father_name', 'parent'],
            parent_phone: ['parent_phone', 'parentphone', 'guardian_phone', 'father_phone', 'phone_parent', 'parent_mobile']
        }
    },
    teachers: {
        required: ['first_name', 'last_name'],
        templateHeaders: ['firstName', 'lastName', 'email', 'password', 'subject', 'phone'],
        aliases: {
            first_name: ['first_name', 'firstname', 'first'],
            last_name: ['last_name', 'lastname', 'last'],
            email: ['email', 'email_address', 'login_email'],
            password: ['password', 'pass'],
            subject: ['subject', 'subjects'],
            phone: ['phone', 'mobile', 'contact', 'contact_no']
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const entitySelect = document.getElementById('importEntity');
    const fileInput = document.getElementById('importFile');

    if (entitySelect) {
        importState.entity = entitySelect.value || 'students';
        entitySelect.addEventListener('change', () => {
            importState.entity = entitySelect.value || 'students';
            resetImportState();
            renderImportPreview();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => handleImportFileSelected(fileInput.files?.[0]));
    }
});

function resetImportState() {
    importState.fileName = '';
    importState.rows = [];
    importState.validRows = [];
    importState.errors = [];

    const fileInput = document.getElementById('importFile');
    if (fileInput) fileInput.value = '';
}

function normalizeKey(key) {
    return String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function normalizeValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return String(value).trim();
}

function canonicalizeRow(rawRow, entity) {
    const schema = IMPORT_SCHEMAS[entity];
    const normalized = {};
    Object.keys(rawRow || {}).forEach((k) => {
        const nk = normalizeKey(k);
        normalized[nk] = normalizeValue(rawRow[k]);
    });

    const out = {};
    Object.entries(schema.aliases).forEach(([canonical, aliases]) => {
        const found = aliases.find((a) => normalized[a] !== undefined && normalized[a] !== '');
        out[canonical] = found ? normalized[found] : '';
    });

    // Keep raw extras if needed later
    out.__raw = normalized;
    return out;
}

function isValidEmail(email) {
    const v = String(email || '').trim();
    if (!v) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validateRows(rows, entity) {
    const schema = IMPORT_SCHEMAS[entity];
    const errors = [];
    const valid = [];

    const seenEmails = new Set();

    rows.forEach((r, idx) => {
        const rowNum = idx + 2; // header row = 1
        const missing = schema.required.filter((k) => !String(r[k] || '').trim());
        if (missing.length) {
            errors.push(`Row ${rowNum}: Missing required fields: ${missing.join(', ')}`);
            return;
        }

        const email = String(r.email || '').trim();
        const password = String(r.password || '').trim();
        if (email) {
            if (!isValidEmail(email)) {
                errors.push(`Row ${rowNum}: Invalid email format.`);
                return;
            }
            if (seenEmails.has(email.toLowerCase())) {
                errors.push(`Row ${rowNum}: Duplicate email in file.`);
                return;
            }
            seenEmails.add(email.toLowerCase());
        }

        if (password && password.length < 6) {
            errors.push(`Row ${rowNum}: Password must be at least 6 characters (Firebase requirement).`);
            return;
        }

        valid.push(r);
    });

    return { valid, errors };
}

async function handleImportFileSelected(file) {
    if (!file) return;

    const previewEl = document.getElementById('importPreview');
    if (previewEl) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `<span class="status-info">${getTransSafe('loading')}</span>`;
    }

    importState.fileName = file.name;
    importState.rows = [];
    importState.validRows = [];
    importState.errors = [];

    try {
        if (typeof XLSX === 'undefined' || !XLSX?.read) {
            throw new Error('SheetJS library not loaded.');
        }

        const ext = String(file.name || '').toLowerCase().split('.').pop();
        let workbook;

        if (ext === 'csv') {
            const text = await file.text();
            workbook = XLSX.read(text, { type: 'string' });
        } else {
            const data = await file.arrayBuffer();
            workbook = XLSX.read(data, { type: 'array' });
        }

        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) throw new Error('No sheets found in file.');

        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const entity = importState.entity || 'students';
        const canonicalRows = rawRows.map((r) => canonicalizeRow(r, entity));

        const { valid, errors } = validateRows(canonicalRows, entity);
        importState.rows = canonicalRows;
        importState.validRows = valid;
        importState.errors = errors;
    } catch (err) {
        importState.errors = [err?.message || String(err)];
    }

    renderImportPreview();
}

function renderImportPreview() {
    const previewEl = document.getElementById('importPreview');
    if (!previewEl) return;

    const entity = importState.entity || 'students';
    const schema = IMPORT_SCHEMAS[entity];

    if (!importState.fileName) {
        previewEl.style.display = 'none';
        previewEl.innerHTML = '';
        return;
    }

    previewEl.style.display = 'block';

    const total = importState.rows.length;
    const ok = importState.validRows.length;
    const errCount = importState.errors.length;

    const header = `
        <div style="display:flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div><strong>File:</strong> ${escapeHtml(importState.fileName)}</div>
            <div><strong>Rows:</strong> ${total} | <strong>Valid:</strong> ${ok} | <strong>Errors:</strong> ${errCount}</div>
        </div>
    `;

    const errorsHtml = errCount
        ? `<div style="margin-top: 0.75rem; color: #dc2626;"><strong>Errors</strong><ul style="margin: 0.5rem 0 0 1.25rem;">${importState.errors.slice(0, 10).map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>${errCount > 10 ? `<div style="margin-top:0.5rem;">+ ${errCount - 10} more...</div>` : ''}</div>`
        : `<div style="margin-top: 0.75rem; color: #16a34a; font-weight: 600;">Ready to import.</div>`;

    const sample = importState.validRows.slice(0, 5);
    const sampleHtml = sample.length ? renderPreviewTable(sample, schema) : '';

    previewEl.innerHTML = header + errorsHtml + sampleHtml;
}

function renderPreviewTable(rows, schema) {
    const keys = Object.keys(schema.aliases).filter(k => k !== '__raw');
    const cols = keys.filter(k => k !== '__raw');

    const headerRow = cols.map(c => `<th style="text-align:left; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(c)}</th>`).join('');
    const body = rows.map(r => {
        const tds = cols.map(c => `<td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${escapeHtml(r[c] || '')}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }).join('');

    return `
        <div style="margin-top: 0.75rem; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 700px;">
                <thead><tr>${headerRow}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getTransSafe(key) {
    try {
        if (typeof getTrans === 'function') return getTrans(key);
    } catch (e) { /* ignore */ }
    return key;
}

function downloadTextFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadImportTemplate() {
    const entity = document.getElementById('importEntity')?.value || 'students';
    const schema = IMPORT_SCHEMAS[entity];
    const headers = schema.templateHeaders;

    const example = entity === 'students'
        ? ['Ali', 'Khan', 'ali.student@example.com', 'Pass1234', 'Dars-e-Nizami', 'Class A', '001', 'Ahmed Khan', '03001234567']
        : ['Ayesha', 'Ahmed', 'ayesha.teacher@example.com', 'Pass1234', 'Math', '03001234567'];

    const csv = [headers.join(','), example.join(',')].join('\n');
    downloadTextFile(csv, `${entity}_import_template.csv`, 'text/csv');
}

async function runImport() {
    const statusEl = document.getElementById('statusMessage');
    const entity = document.getElementById('importEntity')?.value || 'students';

    if (!importState.fileName || !importState.rows.length) {
        alert('Please choose a CSV/Excel file first.');
        return;
    }

    if (importState.errors.length) {
        alert('Fix import errors first (see preview).');
        return;
    }

    if (!importState.validRows.length) {
        alert('No valid rows found to import.');
        return;
    }

    if (!confirm(`Import ${importState.validRows.length} ${entity}?`)) return;

    const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
    const needsAuth = importState.validRows.some(r => r.email && r.password);
    if (needsAuth && !navigator.onLine) {
        alert('You must be online to create login accounts (email + password). Remove those columns or import while online.');
        return;
    }

    let secondaryAuth = null;
    if (needsAuth) {
        secondaryAuth = getOrCreateSecondaryAuth();
        if (!secondaryAuth) {
            alert('Unable to initialize secondary auth (required for bulk account creation).');
            return;
        }
    }

    let imported = 0;
    let failed = 0;
    const failures = [];

    statusEl.innerText = `Importing ${entity}...`;
    statusEl.className = 'status-info';

    for (let i = 0; i < importState.validRows.length; i++) {
        const row = importState.validRows[i];
        const progress = `${i + 1}/${importState.validRows.length}`;
        statusEl.innerText = `Importing ${entity}: ${progress}`;

        try {
            if (entity === 'students') {
                await importStudentRow(row, tenantId, secondaryAuth);
            } else if (entity === 'teachers') {
                await importTeacherRow(row, tenantId, secondaryAuth);
            } else {
                throw new Error('Unsupported import type.');
            }
            imported += 1;
        } catch (err) {
            failed += 1;
            const msg = err?.message || String(err);
            failures.push(`Row ${i + 2}: ${msg}`);
        }
    }

    if (secondaryAuth) {
        try { await secondaryAuth.signOut(); } catch (e) { /* ignore */ }
    }

    if (failed === 0) {
        statusEl.innerText = `Import complete! Imported ${imported} ${entity}.`;
        statusEl.className = 'status-success';
    } else {
        statusEl.innerText = `Import finished with errors. Imported ${imported}, failed ${failed}.`;
        statusEl.className = 'status-error';
    }

    if (failures.length) {
        importState.errors = failures;
        renderImportPreview();
    } else {
        resetImportState();
        renderImportPreview();
    }
}

function getOrCreateSecondaryAuth() {
    try {
        let secondaryApp = null;
        try {
            secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
        } catch (e) {
            const apps = firebase.apps || [];
            secondaryApp = apps.find(app => app.name === 'Secondary') || null;
        }
        return secondaryApp ? secondaryApp.auth() : null;
    } catch (err) {
        console.warn('Secondary auth init failed', err?.message || err);
        return null;
    }
}

async function importStudentRow(row, tenantId, secondaryAuth) {
    const firstName = row.first_name;
    const lastName = row.last_name;
    const department = row.department;
    const className = row.class_name;
    const rollNumber = row.roll_number || '';
    const parentName = row.parent_name || '';
    const parentPhone = row.parent_phone || '';
    const email = String(row.email || '').trim();
    const password = String(row.password || '').trim();

    let uid = '';

    if (email && password && secondaryAuth) {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        uid = cred.user.uid;
        await secondaryAuth.signOut();

        await db.collection('users').doc(uid).set({
            email,
            role: 'student',
            tenantId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } else {
        uid = db.collection('students').doc().id;
    }

    await db.collection('students').doc(uid).set({
        uid,
        firstName,
        lastName,
        email: email || '',
        department,
        className,
        rollNumber,
        parentName,
        parentPhone,
        role: 'student',
        tenantId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

async function importTeacherRow(row, tenantId, secondaryAuth) {
    const firstName = row.first_name;
    const lastName = row.last_name;
    const subject = row.subject || '';
    const phone = row.phone || '';
    const email = String(row.email || '').trim();
    const password = String(row.password || '').trim();

    let uid = '';

    if (email && password && secondaryAuth) {
        const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        uid = cred.user.uid;
        await secondaryAuth.signOut();

        await db.collection('users').doc(uid).set({
            email,
            role: 'teacher',
            tenantId,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } else {
        uid = db.collection('teachers').doc().id;
    }

    await db.collection('teachers').doc(uid).set({
        uid,
        firstName,
        lastName,
        email: email || '',
        subject,
        phone,
        role: 'teacher',
        tenantId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

