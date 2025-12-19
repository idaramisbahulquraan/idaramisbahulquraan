let complianceTenantId = 'default';

document.addEventListener('DOMContentLoaded', () => {
    complianceTenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');

    const today = new Date().toISOString().slice(0, 10);
    const consentDate = document.getElementById('consentDate');
    if (consentDate && !consentDate.value) consentDate.value = today;

    const auditSearch = document.getElementById('auditSearch');
    if (auditSearch) {
        auditSearch.addEventListener('input', debounce(() => loadAudits(), 400));
    }

    setComplianceStatus(getTransSafe('loading'), 'info');
    loadPrivacyNotice();
    loadRetentionPolicy();
    loadStudentsForConsent();
    loadConsents();
    loadAudits();
});

function getTransSafe(key) {
    try {
        if (typeof getTrans === 'function') return getTrans(key);
    } catch (e) { /* ignore */ }
    return key;
}

function setComplianceStatus(message, type) {
    const el = document.getElementById('complianceStatus');
    if (!el) return;
    el.className = 'status-box';
    if (type === 'success') el.classList.add('status-success');
    if (type === 'error') el.classList.add('status-error');
    el.innerText = message || '';
}

function debounce(fn, delayMs) {
    let t = null;
    return (...args) => {
        if (t) window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), delayMs || 250);
    };
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

// ---------------------------
// Privacy Notice
// ---------------------------

async function loadPrivacyNotice() {
    try {
        const doc = await db.collection('privacy_notices').doc(complianceTenantId).get();
        const data = doc.exists ? (doc.data() || {}) : {};

        const title = document.getElementById('privacyTitle');
        const content = document.getElementById('privacyContent');
        const preview = document.getElementById('privacyPreview');

        if (title) title.value = data.title || 'Privacy Notice';
        if (content) content.value = data.content || '';
        if (preview) preview.innerText = data.content || '';

        setComplianceStatus('Ready.', 'success');
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to load privacy notice.', 'error');
    }
}

async function savePrivacyNotice() {
    const title = document.getElementById('privacyTitle')?.value || 'Privacy Notice';
    const content = document.getElementById('privacyContent')?.value || '';
    const preview = document.getElementById('privacyPreview');
    if (preview) preview.innerText = content;

    try {
        setComplianceStatus('Saving privacy notice...', 'info');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

        await db.collection('privacy_notices').doc(complianceTenantId).set({
            tenantId: complianceTenantId,
            title,
            content,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.uid || ''
        }, { merge: true });

        if (typeof logAudit === 'function') {
            logAudit('privacy_notice_save', `privacy_notices/${complianceTenantId}`, { title });
        }

        setComplianceStatus('Privacy notice saved.', 'success');
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to save privacy notice.', 'error');
    }
}

// ---------------------------
// Retention Policy
// ---------------------------

async function loadRetentionPolicy() {
    try {
        const doc = await db.collection('retention_policies').doc(complianceTenantId).get();
        const data = doc.exists ? (doc.data() || {}) : {};

        const audits = document.getElementById('retentionAudits');
        const attLogs = document.getElementById('retentionAttendanceLogs');
        const messages = document.getElementById('retentionMessages');

        if (audits) audits.value = Number.isFinite(data.auditRetentionDays) ? data.auditRetentionDays : (data.auditRetentionDays || 365);
        if (attLogs) attLogs.value = Number.isFinite(data.attendanceLogsRetentionDays) ? data.attendanceLogsRetentionDays : (data.attendanceLogsRetentionDays || 365);
        if (messages) messages.value = Number.isFinite(data.messagesRetentionDays) ? data.messagesRetentionDays : (data.messagesRetentionDays || 365);
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to load retention policy.', 'error');
    }
}

async function saveRetentionPolicy() {
    const auditRetentionDays = parseInt(document.getElementById('retentionAudits')?.value || '365', 10) || 0;
    const attendanceLogsRetentionDays = parseInt(document.getElementById('retentionAttendanceLogs')?.value || '365', 10) || 0;
    const messagesRetentionDays = parseInt(document.getElementById('retentionMessages')?.value || '365', 10) || 0;

    try {
        setComplianceStatus('Saving retention policy...', 'info');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

        await db.collection('retention_policies').doc(complianceTenantId).set({
            tenantId: complianceTenantId,
            auditRetentionDays,
            attendanceLogsRetentionDays,
            messagesRetentionDays,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.uid || ''
        }, { merge: true });

        if (typeof logAudit === 'function') {
            logAudit('retention_policy_save', `retention_policies/${complianceTenantId}`, {
                auditRetentionDays,
                attendanceLogsRetentionDays,
                messagesRetentionDays
            });
        }

        setComplianceStatus('Retention policy saved.', 'success');
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to save retention policy.', 'error');
    }
}

// ---------------------------
// Consents
// ---------------------------

async function loadStudentsForConsent() {
    const select = document.getElementById('consentStudent');
    if (!select) return;

    try {
        const docs = await db.collection('students').orderBy('firstName').limit(800).get();
        const rows = [];
        docs.forEach(d => {
            const s = d.data() || {};
            if (!isInTenant(s, complianceTenantId)) return;
            rows.push({ id: d.id, ...s });
        });

        // Preserve first option
        const firstOpt = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (firstOpt) select.appendChild(firstOpt);
        else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.innerText = 'Select Student';
            select.appendChild(opt);
        }

        rows.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.uid || s.id;
            opt.innerText = `${(s.firstName || '').trim()} ${(s.lastName || '').trim()}`.trim() || (s.email || s.uid || s.id);
            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to load students list.', 'error');
    }
}

async function saveConsent() {
    const studentId = document.getElementById('consentStudent')?.value || '';
    const date = document.getElementById('consentDate')?.value || new Date().toISOString().slice(0, 10);
    const notes = document.getElementById('consentNotes')?.value || '';

    const dataProcessing = !!document.getElementById('consentDataProcessing')?.checked;
    const communications = !!document.getElementById('consent_communications')?.checked;
    const media = !!document.getElementById('consent_media')?.checked;

    if (!studentId) {
        alert('Select a student.');
        return;
    }

    try {
        setComplianceStatus('Saving consent...', 'info');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

        await db.collection('consents').add({
            tenantId: complianceTenantId,
            studentId,
            date,
            dataProcessing,
            communications,
            media,
            notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: user.uid || ''
        });

        if (typeof logAudit === 'function') {
            logAudit('consent_save', 'consents', { studentId, date, dataProcessing, communications, media });
        }

        setComplianceStatus('Consent saved.', 'success');
        document.getElementById('consentNotes').value = '';
        document.getElementById('consentDataProcessing').checked = false;
        document.getElementById('consent_communications').checked = false;
        document.getElementById('consent_media').checked = false;
        loadConsents();
    } catch (err) {
        console.error(err);
        setComplianceStatus('Failed to save consent.', 'error');
    }
}

async function loadConsents() {
    const tbody = document.getElementById('consentsTable');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">${getTransSafe('loading')}</td></tr>`;

    try {
        let snap;
        try {
            snap = await db.collection('consents').where('tenantId', '==', complianceTenantId).orderBy('createdAt', 'desc').limit(200).get();
        } catch (e) {
            snap = await db.collection('consents').orderBy('createdAt', 'desc').limit(200).get();
        }

        const consents = [];
        snap.forEach(d => {
            const c = d.data() || {};
            if (!isInTenant(c, complianceTenantId)) return;
            consents.push({ id: d.id, ...c });
        });

        // build student name map
        const studentNames = new Map();
        try {
            const docs = await db.collection('students').orderBy('firstName').limit(800).get();
            docs.forEach(d => {
                const s = d.data() || {};
                if (!isInTenant(s, complianceTenantId)) return;
                const name = `${(s.firstName || '').trim()} ${(s.lastName || '').trim()}`.trim() || (s.email || d.id);
                studentNames.set(s.uid || d.id, name);
            });
        } catch (e) { /* ignore */ }

        if (!consents.length) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No consent records.</td></tr>`;
            return;
        }

        tbody.innerHTML = consents.map(c => {
            const types = [];
            if (c.dataProcessing) types.push('Data');
            if (c.communications) types.push('Comms');
            if (c.media) types.push('Media');
            return `
                <tr>
                    <td>${escapeHtml(studentNames.get(c.studentId) || c.studentId)}</td>
                    <td>${escapeHtml(c.date || '')}</td>
                    <td>${escapeHtml(types.join(', ') || '-')}</td>
                    <td>${escapeHtml(c.notes || '')}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#dc2626;">Failed to load consents.</td></tr>`;
    }
}

// ---------------------------
// Audits
// ---------------------------

async function loadAudits() {
    const tbody = document.getElementById('auditsTable');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${getTransSafe('loading')}</td></tr>`;

    const q = String(document.getElementById('auditSearch')?.value || '').trim().toLowerCase();

    try {
        const snap = await db.collection('audits').orderBy('createdAt', 'desc').limit(200).get();
        const rows = [];
        snap.forEach(d => {
            const a = d.data() || {};
            if (a.tenantId && a.tenantId !== complianceTenantId) return;
            rows.push({ id: d.id, ...a });
        });

        const filtered = q
            ? rows.filter(r =>
                String(r.action || '').toLowerCase().includes(q)
                || String(r.email || '').toLowerCase().includes(q)
                || String(r.targetPath || '').toLowerCase().includes(q)
                || String(r.userId || '').toLowerCase().includes(q)
            )
            : rows;

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No audit records.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(r => {
            const ts = r.createdAt?.toDate ? r.createdAt.toDate() : null;
            const dateStr = ts ? ts.toLocaleString() : '';
            return `
                <tr>
                    <td>${escapeHtml(dateStr)}</td>
                    <td>${escapeHtml(r.email || '')}</td>
                    <td>${escapeHtml(r.role || '')}</td>
                    <td>${escapeHtml(r.action || '')}</td>
                    <td>${escapeHtml(r.targetPath || '')}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626;">Failed to load audits.</td></tr>`;
    }
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

