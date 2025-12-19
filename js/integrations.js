let integrationsTenantId = 'default';
let cachedWebhookEndpoints = [];

document.addEventListener('DOMContentLoaded', () => {
    integrationsTenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
    setIntegrationStatus(getTransSafe('loading'), 'info');
    loadIntegrationSettings();
    loadWebhookEndpoints();
    loadPushTokens();
});

function getTransSafe(key) {
    try {
        if (typeof getTrans === 'function') return getTrans(key);
    } catch (e) { /* ignore */ }
    return key;
}

function setIntegrationStatus(message, type) {
    const el = document.getElementById('integrationStatus');
    if (!el) return;
    el.className = 'status-box';
    if (type === 'success') el.classList.add('status-success');
    if (type === 'error') el.classList.add('status-error');
    el.innerText = message || '';
}

function isInTenant(data, tenantId) {
    return !data?.tenantId || data.tenantId === tenantId;
}

function parseDomains(raw) {
    const parts = String(raw || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    return Array.from(new Set(parts));
}

function parseWebhookEventTypes() {
    const types = [];
    if (document.getElementById('whEventAudit')?.checked) types.push('audit');
    if (document.getElementById('whEventPayments')?.checked) types.push('payments');
    if (document.getElementById('whEventEvents')?.checked) types.push('events');
    if (document.getElementById('whEventMessages')?.checked) types.push('messages');
    return types;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ---------------------------
// Integration Settings (SSO)
// ---------------------------

async function loadIntegrationSettings() {
    try {
        const doc = await db.collection('integration_settings').doc(integrationsTenantId).get();
        const data = doc.exists ? (doc.data() || {}) : {};

        const allowedDomains = document.getElementById('allowedDomains');
        if (allowedDomains) allowedDomains.value = Array.isArray(data.allowedDomains) ? data.allowedDomains.join(', ') : '';

        const googleEnabled = document.getElementById('googleEnabled');
        if (googleEnabled) googleEnabled.checked = (data.googleEnabled !== false);

        const microsoftEnabled = document.getElementById('microsoftEnabled');
        if (microsoftEnabled) microsoftEnabled.checked = (data.microsoftEnabled !== false);

        const fcmVapidKey = document.getElementById('fcmVapidKey');
        if (fcmVapidKey) fcmVapidKey.value = String(data.fcmWebPushVapidKey || data.fcmVapidKey || '');

        setIntegrationStatus('Ready.', 'success');
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to load integration settings.', 'error');
    }
}

async function saveIntegrationSettings() {
    try {
        setIntegrationStatus('Saving settings...', 'info');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

        const allowedDomains = parseDomains(document.getElementById('allowedDomains')?.value || '');
        const googleEnabled = !!document.getElementById('googleEnabled')?.checked;
        const microsoftEnabled = !!document.getElementById('microsoftEnabled')?.checked;
        const fcmWebPushVapidKey = String(document.getElementById('fcmVapidKey')?.value || '').trim();

        await db.collection('integration_settings').doc(integrationsTenantId).set({
            tenantId: integrationsTenantId,
            allowedDomains,
            googleEnabled,
            microsoftEnabled,
            fcmWebPushVapidKey,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.uid || ''
        }, { merge: true });

        if (typeof logAudit === 'function') {
            logAudit('integration_settings_save', `integration_settings/${integrationsTenantId}`, { allowedDomains, googleEnabled, microsoftEnabled });
        }

        setIntegrationStatus('Settings saved.', 'success');
        loadPushTokens();
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to save settings.', 'error');
    }
}

// ---------------------------
// Push Tokens (Devices)
// ---------------------------

function formatTs(ts) {
    try {
        if (ts?.toDate) return ts.toDate().toLocaleString();
        if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString();
    } catch (e) { /* ignore */ }
    return '';
}

async function loadPushTokens() {
    const tbody = document.getElementById('pushTokensTable');
    if (!tbody) return;
    try {
        tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(getTransSafe('loading'))}</td></tr>`;

        let snap;
        try {
            snap = await db.collection('push_tokens')
                .where('tenantId', '==', integrationsTenantId)
                .limit(200)
                .get();
        } catch (e) {
            // If tenant field is missing in old docs, fallback to a full scan (admin-only).
            snap = await db.collection('push_tokens').limit(200).get();
        }

        const rows = [];
        snap.forEach(doc => {
            const data = doc.data() || {};
            if (!isInTenant(data, integrationsTenantId)) return;
            rows.push({ id: doc.id, ...data });
        });

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-light);">No devices.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(r => {
            const name = escapeHtml(r.name || r.email || r.uid || '');
            const role = escapeHtml(r.role || '');
            const device = escapeHtml(r.deviceId || '');
            const updated = escapeHtml(formatTs(r.updatedAt) || '');
            return `
                <tr>
                    <td>${name}</td>
                    <td>${role}</td>
                    <td>${device}</td>
                    <td>${updated}</td>
                    <td style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn-secondary-sm" style="border-color:#fee2e2;color:#dc2626;" onclick="deletePushToken('${escapeHtml(r.id)}')">${escapeHtml(getTransSafe('delete'))}</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626;">Failed to load devices.</td></tr>`;
    }
}

async function deletePushToken(id) {
    if (!id) return;
    if (!confirm('Delete this device token?')) return;
    try {
        await db.collection('push_tokens').doc(id).delete();
        if (typeof logAudit === 'function') {
            logAudit('push_token_delete', `push_tokens/${id}`, {});
        }
        loadPushTokens();
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to delete device.', 'error');
    }
}

// ---------------------------
// Calendar Export (iCal)
// ---------------------------

function toIcsDate(dateStr) {
    const d = String(dateStr || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
    return d.replace(/-/g, '');
}

function addDaysIso(dateStr, days) {
    try {
        const d = new Date(`${dateStr}T00:00:00Z`);
        if (Number.isNaN(d.getTime())) return dateStr;
        d.setUTCDate(d.getUTCDate() + (days || 0));
        return d.toISOString().slice(0, 10);
    } catch (e) {
        return dateStr;
    }
}

function escapeIcsText(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r\n|\r|\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

async function downloadICal() {
    try {
        setIntegrationStatus('Generating iCal...', 'info');

        let snap;
        try {
            snap = await db.collection('events')
                .where('tenantId', '==', integrationsTenantId)
                .orderBy('date', 'asc')
                .limit(500)
                .get();
        } catch (e) {
            snap = await db.collection('events').orderBy('date', 'asc').limit(500).get();
        }

        const events = [];
        snap.forEach(d => {
            const e = d.data() || {};
            if (!isInTenant(e, integrationsTenantId)) return;
            events.push({ id: d.id, ...e });
        });

        if (!events.length) {
            setIntegrationStatus('No events found.', 'error');
            return;
        }

        const now = new Date();
        const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//NewAppSMS2//Integrations//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH'
        ];

        events.forEach(ev => {
            const date = String(ev.date || '').slice(0, 10);
            const start = toIcsDate(date);
            if (!start) return;
            const end = toIcsDate(addDaysIso(date, 1));
            const uid = `${ev.id}@newappsms2`;

            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${dtstamp}`);
            lines.push(`DTSTART;VALUE=DATE:${start}`);
            lines.push(`DTEND;VALUE=DATE:${end}`);
            lines.push(`SUMMARY:${escapeIcsText(ev.title || 'Event')}`);
            if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
            if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');

        const ics = lines.join('\r\n');
        const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `events-${integrationsTenantId}.ics`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setIntegrationStatus('iCal downloaded.', 'success');
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to generate iCal.', 'error');
    }
}

// ---------------------------
// Webhooks
// ---------------------------

async function addWebhookEndpoint() {
    const name = String(document.getElementById('webhookName')?.value || '').trim();
    const url = String(document.getElementById('webhookUrl')?.value || '').trim();
    const enabled = !!document.getElementById('webhookEnabled')?.checked;
    const eventTypes = parseWebhookEventTypes();

    if (!name || !url) {
        alert('Please enter Name and URL.');
        return;
    }
    if (!/^https?:\/\//i.test(url)) {
        alert('URL must start with http:// or https://');
        return;
    }

    try {
        setIntegrationStatus('Saving webhook...', 'info');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');

        const ref = await db.collection('webhook_endpoints').add({
            tenantId: integrationsTenantId,
            name,
            url,
            enabled,
            eventTypes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: user.uid || ''
        });

        if (typeof logAudit === 'function') {
            logAudit('webhook_endpoint_create', `webhook_endpoints/${ref.id}`, { name, url, enabled, eventTypes });
        }

        document.getElementById('webhookName').value = '';
        document.getElementById('webhookUrl').value = '';
        document.getElementById('webhookEnabled').checked = true;
        document.getElementById('whEventAudit').checked = true;
        document.getElementById('whEventPayments').checked = false;
        document.getElementById('whEventEvents').checked = false;
        document.getElementById('whEventMessages').checked = false;

        setIntegrationStatus('Webhook added.', 'success');
        loadWebhookEndpoints();
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to add webhook.', 'error');
    }
}

async function loadWebhookEndpoints() {
    const tbody = document.getElementById('webhooksTable');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">${getTransSafe('loading')}</td></tr>`;

    try {
        let snap;
        try {
            snap = await db.collection('webhook_endpoints')
                .where('tenantId', '==', integrationsTenantId)
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
        } catch (e) {
            snap = await db.collection('webhook_endpoints')
                .orderBy('createdAt', 'desc')
                .limit(200)
                .get();
        }

        const rows = [];
        snap.forEach(d => {
            const w = d.data() || {};
            if (!isInTenant(w, integrationsTenantId)) return;
            rows.push({ id: d.id, ...w });
        });

        cachedWebhookEndpoints = rows;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-light);">No webhooks.</td></tr>`;
            return;
        }

        tbody.innerHTML = rows.map(w => {
            const safeUrl = escapeHtml(w.url || '');
            const events = Array.isArray(w.eventTypes) ? w.eventTypes.join(', ') : '';
            const checked = w.enabled !== false;
            return `
                <tr>
                    <td>${escapeHtml(w.name || '')}</td>
                    <td><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeUrl}</a></td>
                    <td>${escapeHtml(events || '-')}</td>
                    <td>
                        <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleWebhookEnabled('${w.id}', this.checked)">
                    </td>
                    <td style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn-secondary-sm" onclick="sendTestWebhook('${w.id}')">${escapeHtml(getTransSafe('send_test'))}</button>
                        <button class="btn-secondary-sm" style="border-color:#fee2e2;color:#dc2626;" onclick="deleteWebhookEndpoint('${w.id}')">${escapeHtml(getTransSafe('delete'))}</button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626;">Failed to load webhooks.</td></tr>`;
    }
}

async function toggleWebhookEnabled(id, enabled) {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        await db.collection('webhook_endpoints').doc(id).set({
            enabled: !!enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: user.uid || ''
        }, { merge: true });

        if (typeof logAudit === 'function') {
            logAudit('webhook_endpoint_toggle', `webhook_endpoints/${id}`, { enabled: !!enabled });
        }
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to update webhook.', 'error');
        loadWebhookEndpoints();
    }
}

async function deleteWebhookEndpoint(id) {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
        await db.collection('webhook_endpoints').doc(id).delete();
        if (typeof logAudit === 'function') {
            logAudit('webhook_endpoint_delete', `webhook_endpoints/${id}`, {});
        }
        setIntegrationStatus('Webhook deleted.', 'success');
        loadWebhookEndpoints();
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to delete webhook.', 'error');
    }
}

function buildTestWebhookPayload(extra = {}) {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
        eventType: 'test',
        tenantId: integrationsTenantId,
        createdAt: new Date().toISOString(),
        actor: {
            uid: user.uid || '',
            email: user.email || '',
            role: user.role || ''
        },
        payload: {
            message: 'Test webhook payload',
            ...extra
        }
    };
}

async function sendTestWebhook(endpointId) {
    try {
        const ep = cachedWebhookEndpoints.find(x => x.id === endpointId);
        const url = ep?.url;
        if (!url) {
            alert('Webhook URL not found.');
            return;
        }

        setIntegrationStatus('Sending test webhook...', 'info');
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildTestWebhookPayload({ endpointId }))
        });

        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} ${body ? '- ' + body.slice(0, 200) : ''}`);
        }

        if (typeof logAudit === 'function') {
            logAudit('webhook_test_sent', `webhook_endpoints/${endpointId}`, {});
        }

        setIntegrationStatus('Test webhook sent.', 'success');
    } catch (err) {
        console.error(err);
        setIntegrationStatus(`Test webhook failed: ${err.message || err}`, 'error');
    }
}

async function queueTestWebhookJob() {
    try {
        setIntegrationStatus('Queueing test jobs...', 'info');
        const enabledEndpoints = cachedWebhookEndpoints.filter(e => isInTenant(e, integrationsTenantId) && e.enabled !== false);
        if (!enabledEndpoints.length) {
            setIntegrationStatus('No enabled webhook endpoints to queue.', 'error');
            return;
        }

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const batch = db.batch();

        enabledEndpoints.forEach(ep => {
            const ref = db.collection('webhook_jobs').doc();
            batch.set(ref, {
                tenantId: integrationsTenantId,
                endpointId: ep.id,
                endpointUrl: ep.url || '',
                eventType: 'test',
                status: 'pending',
                payload: buildTestWebhookPayload({ endpointId: ep.id }),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: user.uid || ''
            });
        });

        await batch.commit();
        if (typeof logAudit === 'function') {
            logAudit('webhook_test_jobs_queued', 'webhook_jobs', { count: enabledEndpoints.length });
        }
        setIntegrationStatus(`Queued ${enabledEndpoints.length} test job(s).`, 'success');
    } catch (err) {
        console.error(err);
        setIntegrationStatus('Failed to queue jobs.', 'error');
    }
}
