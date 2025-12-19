let supportTenantId = 'default';

document.addEventListener('DOMContentLoaded', () => {
    supportTenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
    setSupportStatus('Ready.');
    refreshDiagnostics();
    loadErrorReports();
});

function setSupportStatus(message) {
    const el = document.getElementById('supportStatus');
    if (!el) return;
    el.innerText = message || '';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function buildDiagnostics() {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const branding = (() => {
        try {
            if (typeof getSchoolBranding === 'function') return getSchoolBranding() || {};
        } catch (e) { /* ignore */ }
        return {};
    })();
    const diag = {
        time: new Date().toISOString(),
        tenantId: supportTenantId,
        pageUrl: window.location.href,
        online: navigator.onLine,
        lang: localStorage.getItem('app_lang') || 'en',
        branding: {
            name: branding.name || '',
            primaryColor: branding.primaryColor || '',
            customDomain: branding.customDomain || ''
        },
        user: {
            uid: user.uid || auth?.currentUser?.uid || '',
            email: user.email || auth?.currentUser?.email || '',
            role: user.role || ''
        },
        notifications: {
            supported: ('Notification' in window),
            permission: ('Notification' in window) ? Notification.permission : 'n/a'
        },
        serviceWorker: {
            supported: ('serviceWorker' in navigator),
            registration: null
        },
        firebase: {
            projectId: (firebase?.app?.()?.options?.projectId) || '',
            authUid: auth?.currentUser?.uid || ''
        }
    };

    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                diag.serviceWorker.registration = {
                    scope: reg.scope || '',
                    active: !!reg.active,
                    waiting: !!reg.waiting,
                    installing: !!reg.installing
                };
            }
        }
    } catch (e) { /* ignore */ }

    return diag;
}

async function sendTestErrorReport() {
    try {
        if (typeof reportClientError !== 'function') {
            setSupportStatus('Error reporter not available on this page.');
            return;
        }
        await reportClientError('test', new Error('Support test error'), { source: 'support' });
        setSupportStatus('Test error queued/sent.');
        loadErrorReports();
    } catch (e) {
        setSupportStatus('Failed to send test error.');
    }
}

async function flushQueuedErrorsNow() {
    try {
        if (typeof flushClientErrorQueue !== 'function') {
            setSupportStatus('Queue flush not available on this page.');
            return;
        }
        await flushClientErrorQueue();
        setSupportStatus('Queue flush attempted.');
        loadErrorReports();
    } catch (e) {
        setSupportStatus('Queue flush failed.');
    }
}

async function refreshDiagnostics() {
    const out = document.getElementById('diagnosticsOutput');
    if (!out) return;
    try {
        out.textContent = 'Loading...';
        const diag = await buildDiagnostics();
        out.textContent = JSON.stringify(diag, null, 2);
    } catch (e) {
        out.textContent = `Failed to load diagnostics: ${e?.message || e}`;
    }
}

async function copyDiagnostics() {
    try {
        const diag = await buildDiagnostics();
        const text = JSON.stringify(diag, null, 2);
        await navigator.clipboard.writeText(text);
        setSupportStatus('Diagnostics copied.');
    } catch (e) {
        setSupportStatus('Copy failed.');
    }
}

async function loadErrorReports() {
    const tbody = document.getElementById('errorsTable');
    if (!tbody) return;
    try {
        tbody.innerHTML = `<tr><td colspan="5">${escapeHtml(getTrans?.('loading') || 'Loading...')}</td></tr>`;

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const role = String(user.role || '').toLowerCase();
        const canView = ['owner', 'admin', 'principal'].includes(role);
        if (!canView) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-light);">Not authorized.</td></tr>`;
            return;
        }

        let snap;
        try {
            snap = await db.collection('error_reports')
                .where('tenantId', '==', supportTenantId)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
        } catch (e) {
            snap = await db.collection('error_reports')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
        }

        const rows = [];
        snap.forEach(doc => {
            const d = doc.data() || {};
            if (d.tenantId && d.tenantId !== supportTenantId) return;
            rows.push(d);
        });

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-light);">No errors.</td></tr>`;
            return;
        }

        const fmtTs = (ts) => {
            try {
                if (ts?.toDate) return ts.toDate().toLocaleString();
                if (typeof ts?.seconds === 'number') return new Date(ts.seconds * 1000).toLocaleString();
            } catch (e) { /* ignore */ }
            return '';
        };

        tbody.innerHTML = rows.map(r => {
            const date = escapeHtml(fmtTs(r.createdAt) || '');
            const role = escapeHtml(r.role || '');
            const email = escapeHtml(r.email || '');
            const type = escapeHtml(r.type || '');
            const desc = escapeHtml((r.message || '').slice(0, 220));
            return `<tr><td>${date}</td><td>${role}</td><td>${email}</td><td>${type}</td><td>${desc}</td></tr>`;
        }).join('');
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#dc2626;">Failed to load error reports.</td></tr>`;
    }
}

function startSupportWalkthrough() {
    const steps = [
        { title: 'Sidebar', body: 'Use the sidebar to navigate between modules.', selector: '.sidebar' },
        { title: 'Language', body: 'Use the language toggle in the header to switch EN/UR.', selector: '#langToggle' },
        { title: 'Notifications', body: 'Enable notifications to receive in-app and push alerts.', selector: '#notifToggle' },
        { title: 'Offline', body: 'When offline, changes sync automatically after reconnect.', selector: '#offlineBanner' }
    ];
    startWalkthroughOverlay(steps);
}

function startWalkthroughOverlay(steps) {
    if (!Array.isArray(steps) || !steps.length) return;

    const existing = document.getElementById('walkthroughOverlay');
    if (existing) existing.remove();

    let idx = 0;
    let highlightedEl = null;

    const overlay = document.createElement('div');
    overlay.id = 'walkthroughOverlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(2,6,23,0.55)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'flex-end';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '1rem';

    const card = document.createElement('div');
    card.style.background = 'white';
    card.style.borderRadius = '0.75rem';
    card.style.maxWidth = '720px';
    card.style.width = '100%';
    card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.25)';
    card.style.overflow = 'hidden';

    const body = document.createElement('div');
    body.style.padding = '1rem 1.25rem';

    const title = document.createElement('div');
    title.style.fontWeight = '700';
    title.style.marginBottom = '0.5rem';

    const text = document.createElement('div');
    text.style.color = '#475569';
    text.style.marginBottom = '1rem';

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.gap = '0.75rem';
    footer.style.justifyContent = 'flex-end';
    footer.style.padding = '0.75rem 1.25rem';
    footer.style.background = '#f1f5f9';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'btn-secondary';
    btnPrev.textContent = 'Back';

    const btnNext = document.createElement('button');
    btnNext.className = 'btn-primary';
    btnNext.style.width = 'auto';
    btnNext.style.padding = '0.6rem 1rem';
    btnNext.textContent = 'Next';

    const btnClose = document.createElement('button');
    btnClose.className = 'btn-secondary';
    btnClose.textContent = 'Close';

    const cleanupHighlight = () => {
        if (highlightedEl) {
            highlightedEl.style.outline = '';
            highlightedEl.style.outlineOffset = '';
            highlightedEl = null;
        }
    };

    const render = () => {
        cleanupHighlight();
        const step = steps[idx];
        title.textContent = `${idx + 1}/${steps.length} - ${step.title}`;
        text.textContent = step.body;

        btnPrev.disabled = idx === 0;
        btnNext.textContent = idx === steps.length - 1 ? 'Done' : 'Next';

        if (step.selector) {
            const el = document.querySelector(step.selector);
            if (el) {
                highlightedEl = el;
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.style.outline = '3px solid #f59e0b';
                el.style.outlineOffset = '3px';
            }
        }
    };

    const close = () => {
        cleanupHighlight();
        overlay.remove();
    };

    btnPrev.onclick = () => { if (idx > 0) { idx -= 1; render(); } };
    btnNext.onclick = () => {
        if (idx >= steps.length - 1) { close(); return; }
        idx += 1;
        render();
    };
    btnClose.onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { once: true });

    footer.appendChild(btnPrev);
    footer.appendChild(btnClose);
    footer.appendChild(btnNext);
    body.appendChild(title);
    body.appendChild(text);
    card.appendChild(body);
    card.appendChild(footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    render();
}
