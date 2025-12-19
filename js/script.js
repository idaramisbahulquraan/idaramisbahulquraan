// Auth Logic
// Language Management
let currentLang = localStorage.getItem('app_lang') || 'en';
let notificationsEnabled = false;
let notificationsState = {
    tenantId: 'default',
    uid: '',
    noticesUnsubs: [],
    threadsUnsub: null,
    fcmOnMessageUnsub: null,
    fcmToken: null,
    pushDocId: null
};

function normalizeLang(lang) {
    const v = String(lang || '').toLowerCase();
    return (v === 'en' || v === 'ur') ? v : null;
}

function applyLanguagePreference(lang) {
    const normalized = normalizeLang(lang);
    if (!normalized || normalized === currentLang) return;

    currentLang = normalized;
    localStorage.setItem('app_lang', currentLang);

    try {
        if (typeof translations !== 'undefined') updatePageLanguage();
        updateToggleButton();
        updateNotificationsToggle();
    } catch (e) { /* ignore */ }

    try {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        if (user) renderSidebar(user.role);
    } catch (e) { /* ignore */ }

    try {
        const botContainer = document.getElementById('floating-bot-container');
        if (botContainer) {
            botContainer.remove();
            injectFloatingBot();
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('language-changed', { detail: { lang: currentLang } }));
            if (typeof window.onLanguageChanged === 'function') window.onLanguageChanged(currentLang);
        }
    } catch (e) { /* ignore */ }
}

async function syncUserLanguagePreference(userId) {
    try {
        if (typeof db === 'undefined' || !db) return;
        const uid = userId || auth?.currentUser?.uid;
        if (!uid) return;

        const ref = db.collection('user_settings').doc(uid);
        const doc = await ref.get();
        if (doc.exists) {
            const preferred = doc.data()?.language;
            applyLanguagePreference(preferred);
            return;
        }

        await ref.set({
            language: currentLang,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.warn('Language preference sync skipped', err?.message || err);
    }
}

async function persistUserLanguagePreference() {
    try {
        if (typeof db === 'undefined' || !db) return;
        const uid = auth?.currentUser?.uid;
        if (!uid) return;

        await db.collection('user_settings').doc(uid).set({
            language: currentLang,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.warn('Language preference save skipped', err?.message || err);
    }
}

// Simple audit logger (fire-and-forget). Use for important writes.
async function logAudit(action, targetPath, payload = {}) {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const entry = {
            action,
            targetPath,
            payload,
            role: user.role || 'unknown',
            userId: user.uid || 'anonymous',
            email: user.email || '',
            tenantId: (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default'),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent || ''
        };
        await db.collection('audits').add(entry);
    } catch (err) {
        console.warn('Audit log skipped', err?.message || err);
    }
}

// Client-side error reporting (supportability)
let errorReportingState = {
    initialized: false,
    lastSentAt: 0,
    sentInWindow: 0,
    windowStartedAt: 0
};

function errorQueueKey(tenantId, uid) {
    return `error_queue_v1_${tenantId || 'default'}_${uid || ''}`;
}

function safeString(v, maxLen = 2000) {
    const s = v === null || v === undefined ? '' : String(v);
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function shouldRateLimitError() {
    const now = Date.now();
    const windowMs = 60_000;
    const maxPerWindow = 5;

    if (!errorReportingState.windowStartedAt || now - errorReportingState.windowStartedAt > windowMs) {
        errorReportingState.windowStartedAt = now;
        errorReportingState.sentInWindow = 0;
    }

    if (errorReportingState.sentInWindow >= maxPerWindow) return true;
    errorReportingState.sentInWindow += 1;
    errorReportingState.lastSentAt = now;
    return false;
}

async function enqueueClientError(entry) {
    try {
        const tenantId = entry?.tenantId || (typeof getCurrentTenant === 'function' ? getCurrentTenant() : 'default');
        const uid = entry?.uid || auth?.currentUser?.uid || '';
        const key = errorQueueKey(tenantId, uid);
        const raw = localStorage.getItem(key) || '[]';
        const arr = JSON.parse(raw);
        const next = Array.isArray(arr) ? arr : [];
        next.push(entry);
        localStorage.setItem(key, JSON.stringify(next.slice(-50)));
    } catch (e) { /* ignore */ }
}

async function flushClientErrorQueue() {
    try {
        if (typeof db === 'undefined' || !db) return;
        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
        const uid = auth?.currentUser?.uid || '';
        if (!uid) return;

        const key = errorQueueKey(tenantId, uid);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const queued = JSON.parse(raw);
        if (!Array.isArray(queued) || !queued.length) return;

        const batch = db.batch();
        queued.slice(0, 20).forEach(item => {
            const ref = db.collection('error_reports').doc();
            batch.set(ref, {
                ...item,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();

        localStorage.setItem(key, JSON.stringify(queued.slice(20)));
    } catch (e) { /* ignore */ }
}

async function reportClientError(type, err, extra = {}) {
    try {
        if (shouldRateLimitError()) return;

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
        const uid = auth?.currentUser?.uid || user.uid || '';

        const message = safeString(err?.message || err || extra?.message || '');
        const stack = safeString(err?.stack || extra?.stack || '');

        const entry = {
            tenantId,
            uid,
            role: user.role || '',
            email: user.email || '',
            pageUrl: safeString(window.location.href, 1000),
            userAgent: safeString(navigator.userAgent, 500),
            type: safeString(type || 'error', 50),
            message,
            stack,
            extra: extra && typeof extra === 'object' ? extra : {}
        };

        // Queue if offline or not ready.
        if (!navigator.onLine || typeof db === 'undefined' || !db || !auth?.currentUser?.uid) {
            await enqueueClientError(entry);
            return;
        }

        await db.collection('error_reports').add({
            ...entry,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { /* ignore */ }
}

function initErrorReporting() {
    if (errorReportingState.initialized) return;
    errorReportingState.initialized = true;

    window.addEventListener('error', (event) => {
        try {
            const err = event?.error || new Error(event?.message || 'Unknown error');
            reportClientError('error', err, {
                source: 'window.error',
                filename: event?.filename || '',
                lineno: event?.lineno || 0,
                colno: event?.colno || 0
            });
        } catch (e) { /* ignore */ }
    });

    window.addEventListener('unhandledrejection', (event) => {
        try {
            const reason = event?.reason;
            const err = reason instanceof Error ? reason : new Error(safeString(reason || 'Unhandled rejection'));
            reportClientError('unhandledrejection', err, { source: 'window.unhandledrejection' });
        } catch (e) { /* ignore */ }
    });

    window.addEventListener('online', () => {
        flushClientErrorQueue();
    });
}

function initLanguage() {
    // Set initial state
    updatePageLanguage();

    // Inject Toggle Button if not exists
    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('langToggle')) {
        const btn = document.createElement('button');
        btn.id = 'langToggle';
        btn.className = 'btn-secondary';
        // Remove inline margins/padding to let CSS handle it
        btn.onclick = toggleLanguage;
        // Insert before user profile or append - let's prepend to keep profile on far right
        headerActions.prepend(btn);
        updateToggleButton();
        return;
    }

    // Login page (no header)
    const loginHeader = document.querySelector('.login-header');
    if (loginHeader && !document.getElementById('langToggle')) {
        const btn = document.createElement('button');
        btn.id = 'langToggle';
        btn.className = 'btn-secondary';
        btn.style.marginTop = '1rem';
        btn.style.padding = '0.5rem 1rem';
        btn.style.width = 'auto';
        btn.onclick = toggleLanguage;
        loginHeader.appendChild(btn);
        updateToggleButton();
    }
}

function initPWA() {
    try { ensureManifestLink(); } catch (e) { /* ignore */ }
    try { ensureThemeColorMeta(); } catch (e) { /* ignore */ }
    try { setupOfflineBanner(); } catch (e) { /* ignore */ }
    try { registerServiceWorker(); } catch (e) { /* ignore */ }
}

function initNotifications() {
    try { injectNotificationsToggle(); } catch (e) { /* ignore */ }
    try { updateNotificationsToggle(); } catch (e) { /* ignore */ }
}

function ensureManifestLink() {
    if (document.querySelector('link[rel="manifest"]')) return;
    const pathname = String(window.location.pathname || '');
    const isPages = pathname.includes('/pages/');
    const isTeacher = pathname.includes('/pages/teacher/');
    const isStudent = pathname.includes('/pages/student/');
    const isParent = pathname.includes('/pages/parent/');
    const link = document.createElement('link');
    link.rel = 'manifest';
    if (isTeacher) link.href = '../../manifest.teacher.json';
    else if (isStudent) link.href = '../../manifest.student.json';
    else if (isParent) link.href = '../../manifest.parent.json';
    else link.href = isPages ? '../../manifest.json' : 'manifest.json';
    document.head.appendChild(link);
}

function ensureThemeColorMeta() {
    const themeColor = (() => {
        try {
            const css = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();
            return css || '#4f46e5';
        } catch (e) {
            return '#4f46e5';
        }
    })();
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = themeColor;
}

function setupOfflineBanner() {
    const ensureBanner = () => {
        let banner = document.getElementById('offlineBanner');
        if (banner) return banner;

        banner = document.createElement('div');
        banner.id = 'offlineBanner';
        banner.style.position = 'fixed';
        banner.style.left = '0';
        banner.style.right = '0';
        banner.style.bottom = '0';
        banner.style.padding = '0.5rem 1rem';
        banner.style.background = '#0f172a';
        banner.style.color = '#ffffff';
        banner.style.fontSize = '0.85rem';
        banner.style.textAlign = 'center';
        banner.style.zIndex = '9998';
        banner.style.display = 'none';
        banner.setAttribute('data-i18n', 'offline_mode');
        document.body.appendChild(banner);
        return banner;
    };

    const setState = (isOnline) => {
        const banner = ensureBanner();
        if (!banner) return;

        if (!isOnline) {
            banner.style.display = 'block';
            banner.setAttribute('data-i18n', 'offline_mode');
            if (typeof translations !== 'undefined' && typeof updatePageLanguage === 'function') {
                updatePageLanguage();
            } else {
                banner.innerText = "Offline mode: changes will sync when you're back online.";
            }
            return;
        }

        if (banner.style.display === 'block') {
            banner.setAttribute('data-i18n', 'back_online');
            if (typeof translations !== 'undefined' && typeof updatePageLanguage === 'function') {
                updatePageLanguage();
            } else {
                banner.innerText = 'Back online.';
            }
            window.setTimeout(() => { banner.style.display = 'none'; }, 2500);
        }
    };

    window.addEventListener('offline', () => setState(false));
    window.addEventListener('online', () => setState(true));
    setState(navigator.onLine);
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (!['http:', 'https:'].includes(window.location.protocol)) return;

    const isPages = window.location.pathname.includes('/pages/');
    const swUrl = isPages ? '../../sw.js' : 'sw.js';
    try {
        await navigator.serviceWorker.register(swUrl);
    } catch (err) {
        console.warn('Service worker registration failed', err?.message || err);
    }
}

function getOrCreateDeviceId() {
    const key = 'sms_device_id_v1';
    try {
        const existing = localStorage.getItem(key);
        if (existing) return existing;
        const id = `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
        localStorage.setItem(key, id);
        return id;
    } catch (e) {
        return `dev_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    }
}

async function ensureFirebaseMessagingCompat() {
    if (typeof firebase !== 'undefined' && typeof firebase.messaging === 'function') return true;

    const src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js';
    return new Promise((resolve) => {
        try {
            const existing = Array.from(document.querySelectorAll('script'))
                .find(s => (s.src || '').includes('firebase-messaging-compat.js'));
            if (existing) {
                if (typeof firebase !== 'undefined' && typeof firebase.messaging === 'function') return resolve(true);
                const done = () => resolve(typeof firebase !== 'undefined' && typeof firebase.messaging === 'function');
                existing.addEventListener('load', done, { once: true });
                existing.addEventListener('error', () => resolve(false), { once: true });
                setTimeout(done, 2500);
                return;
            }

            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.onload = () => {
                try { s.setAttribute('data-loaded', '1'); } catch (e) { /* ignore */ }
                resolve(true);
            };
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        } catch (e) {
            resolve(false);
        }
    });
}

async function getMessagingRegistration() {
    try {
        if (!('serviceWorker' in navigator)) return null;
        await registerServiceWorker();
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) return reg;
        return await navigator.serviceWorker.ready;
    } catch (e) {
        return null;
    }
}

async function getFcmVapidKeyForTenant(tenantId) {
    try {
        const settings = await loadIntegrationSettings(tenantId);
        const key = settings?.fcmWebPushVapidKey || settings?.fcmVapidKey || '';
        return String(key || '').trim();
    } catch (e) {
        return '';
    }
}

async function syncPushRegistration() {
    try {
        if (!notificationsEnabled) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (typeof db === 'undefined' || !db) return;
        if (!auth?.currentUser?.uid) return;

        const ok = await ensureFirebaseMessagingCompat();
        if (!ok) return;
        if (typeof firebase?.messaging !== 'function') return;

        const reg = await getMessagingRegistration();
        if (!reg) return;

        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
        const vapidKey = await getFcmVapidKeyForTenant(tenantId);
        if (!vapidKey) return;

        const messaging = firebase.messaging();
        const token = await messaging.getToken({ vapidKey, serviceWorkerRegistration: reg });
        if (!token) return;

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const uid = auth.currentUser.uid;
        const deviceId = getOrCreateDeviceId();
        const docId = `${tenantId}_${uid}_${deviceId}`;

        notificationsState.fcmToken = token;
        notificationsState.pushDocId = docId;

        await db.collection('push_tokens').doc(docId).set({
            tenantId,
            uid,
            email: user.email || auth.currentUser.email || '',
            name: user.name || auth.currentUser.displayName || '',
            role: user.role || '',
            deviceId,
            token,
            platform: 'web',
            userAgent: navigator.userAgent || '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: uid
        }, { merge: true });

        if (typeof notificationsState.fcmOnMessageUnsub === 'function') {
            try { notificationsState.fcmOnMessageUnsub(); } catch (e) { /* ignore */ }
            notificationsState.fcmOnMessageUnsub = null;
        }

        notificationsState.fcmOnMessageUnsub = messaging.onMessage((payload) => {
            try {
                const title = payload?.notification?.title || payload?.data?.title || 'Notification';
                const body = payload?.notification?.body || payload?.data?.body || '';
                const url = payload?.data?.url || 'dashboard.html';
                showAppNotification(title, body, url);
            } catch (e) { /* ignore */ }
        });
    } catch (err) {
        console.warn('Push registration skipped', err?.message || err);
    }
}

async function removePushRegistration() {
    try {
        if (typeof notificationsState.fcmOnMessageUnsub === 'function') {
            try { notificationsState.fcmOnMessageUnsub(); } catch (e) { /* ignore */ }
        }
        notificationsState.fcmOnMessageUnsub = null;

        const docId = notificationsState.pushDocId;
        const token = notificationsState.fcmToken;
        notificationsState.pushDocId = null;
        notificationsState.fcmToken = null;

        if (docId && typeof db !== 'undefined' && db) {
            await db.collection('push_tokens').doc(docId).delete().catch(() => { /* ignore */ });
        }

        const ok = await ensureFirebaseMessagingCompat();
        if (!ok) return;
        if (token && typeof firebase?.messaging === 'function') {
            try {
                const messaging = firebase.messaging();
                if (typeof messaging?.deleteToken === 'function') {
                    await messaging.deleteToken(token);
                }
            } catch (e) { /* ignore */ }
        }
    } catch (err) {
        console.warn('Push deregistration skipped', err?.message || err);
    }
}

function getNotificationsStorageKey(suffix) {
    const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
    const uid = auth?.currentUser?.uid || '';
    return `notif_${suffix}_${tenantId}_${uid}`;
}

function injectNotificationsToggle() {
    if (!('Notification' in window)) return;

    const headerActions = document.querySelector('.header-actions');
    if (headerActions && !document.getElementById('notifToggle')) {
        const btn = document.createElement('button');
        btn.id = 'notifToggle';
        btn.className = 'btn-secondary';
        // Remove inline styles
        btn.onclick = toggleNotifications;
        // Prepend so it sits next to language button
        headerActions.prepend(btn);
        return;
    }
}

function updateNotificationsToggle() {
    const btn = document.getElementById('notifToggle');
    if (!btn) return;

    const perm = ('Notification' in window) ? Notification.permission : 'denied';
    if (perm === 'denied') {
        btn.disabled = true;
        btn.innerText = getTrans('notifications_blocked');
        return;
    }

    btn.disabled = false;
    btn.innerText = notificationsEnabled ? getTrans('notifications_on') : getTrans('enable_notifications');
}

async function toggleNotifications() {
    if (!('Notification' in window)) return;
    const perm = Notification.permission;
    if (perm === 'denied') {
        alert(getTrans('notifications_blocked'));
        return;
    }

    if (notificationsEnabled) {
        notificationsEnabled = false;
        stopNotificationListeners();
        await removePushRegistration();
        await persistUserNotificationPreference(false);
        updateNotificationsToggle();
        return;
    }

    const res = await Notification.requestPermission();
    if (res !== 'granted') {
        notificationsEnabled = false;
        stopNotificationListeners();
        await persistUserNotificationPreference(false);
        updateNotificationsToggle();
        return;
    }

    notificationsEnabled = true;
    await persistUserNotificationPreference(true);
    updateNotificationsToggle();
    startNotificationListeners();
    await syncPushRegistration();
}

async function syncUserNotificationPreference(userId) {
    try {
        if (typeof db === 'undefined' || !db) return;
        const uid = userId || auth?.currentUser?.uid;
        if (!uid) return;

        const ref = db.collection('user_settings').doc(uid);
        const doc = await ref.get();
        if (doc.exists) {
            const val = doc.data()?.notificationsEnabled;
            if (typeof val === 'boolean') notificationsEnabled = val;
        } else {
            await ref.set({
                notificationsEnabled: false,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        updateNotificationsToggle();
        if (notificationsEnabled && Notification.permission === 'granted') {
            startNotificationListeners();
            await syncPushRegistration();
        } else {
            stopNotificationListeners();
            await removePushRegistration();
        }
    } catch (err) {
        console.warn('Notification preference sync skipped', err?.message || err);
    }
}

async function persistUserNotificationPreference(enabled) {
    try {
        if (typeof db === 'undefined' || !db) return;
        const uid = auth?.currentUser?.uid;
        if (!uid) return;

        await db.collection('user_settings').doc(uid).set({
            notificationsEnabled: !!enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.warn('Notification preference save skipped', err?.message || err);
    }
}

function stopNotificationListeners() {
    try {
        if (Array.isArray(notificationsState.noticesUnsubs)) {
            notificationsState.noticesUnsubs.forEach(fn => {
                try { if (typeof fn === 'function') fn(); } catch (e) { /* ignore */ }
            });
        }
        notificationsState.noticesUnsubs = [];
    } catch (e) { /* ignore */ }

    try {
        if (typeof notificationsState.threadsUnsub === 'function') notificationsState.threadsUnsub();
    } catch (e) { /* ignore */ }
    notificationsState.threadsUnsub = null;

    try {
        if (typeof notificationsState.fcmOnMessageUnsub === 'function') notificationsState.fcmOnMessageUnsub();
    } catch (e) { /* ignore */ }
    notificationsState.fcmOnMessageUnsub = null;
}

function noticeTimestampMillis(data) {
    const ts = data?.createdAt || data?.updatedAt;
    if (ts?.toMillis) return ts.toMillis();
    if (ts?.toDate) return ts.toDate().getTime();
    if (typeof ts?.seconds === 'number') return ts.seconds * 1000;

    const dateStr = String(data?.date || '').trim();
    if (dateStr) {
        const d = new Date(`${dateStr}T00:00:00Z`);
        if (!Number.isNaN(d.getTime())) return d.getTime();
    }
    return Date.now();
}

function startNotificationListeners() {
    try {
        if (Notification.permission !== 'granted') return;
        if (typeof db === 'undefined' || !db) return;

        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const uid = user?.uid || auth?.currentUser?.uid || '';
        if (!uid) return;

        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
        if (notificationsState.uid === uid && notificationsState.tenantId === tenantId && (notificationsState.noticesUnsubs.length || notificationsState.threadsUnsub)) {
            return;
        }

        stopNotificationListeners();
        notificationsState.uid = uid;
        notificationsState.tenantId = tenantId;

        startNoticeNotifications(user);
        startMessageNotifications(user);
    } catch (e) {
        console.warn('Notification listeners skipped', e?.message || e);
    }
}

function startNoticeNotifications(user) {
    const uid = user?.uid || '';
    if (!uid) return;

    const role = String(user?.role || '').toLowerCase();
    const audience = role === 'parent' ? 'parents' : (role === 'student' ? 'students' : '');

    const key = getNotificationsStorageKey('last_notice_ms');
    let lastSeen = parseInt(localStorage.getItem(key) || '0', 10) || 0;

    const isStaffRole = (r) => ['owner', 'admin', 'principal', 'teacher', 'accountant', 'clerk'].includes(r);

    const handlers = [];
    const attach = (q) => {
        let initial = true;
        const unsub = q.onSnapshot((snap) => {
            if (initial) {
                let maxTs = lastSeen;
                snap.forEach(doc => {
                    const ts = noticeTimestampMillis(doc.data() || {});
                    if (ts > maxTs) maxTs = ts;
                });
                lastSeen = maxTs;
                localStorage.setItem(key, String(lastSeen));
                initial = false;
                return;
            }

            snap.docChanges().forEach(change => {
                if (change.type !== 'added') return;
                const data = change.doc.data() || {};
                const ts = noticeTimestampMillis(data);
                if (ts <= lastSeen) return;

                lastSeen = ts;
                localStorage.setItem(key, String(lastSeen));

                const title = String(data.title || getTrans('new_notice') || 'New Notice');
                const body = String(data.content || '').slice(0, 140);
                showAppNotification(title, body, 'pages/admin/communication.html');
            });
        }, (err) => {
            console.warn('Notice notifications listener failed', err?.message || err);
        });
        handlers.push(unsub);
    };

    if (isStaffRole(role)) {
        attach(db.collection('notices').orderBy('createdAt', 'desc').limit(25));
    } else if (audience) {
        attach(db.collection('notices').where('targetAudience', '==', 'all'));
        attach(db.collection('notices').where('targetAudience', '==', audience));
    }

    notificationsState.noticesUnsubs = handlers;
}

function startMessageNotifications(user) {
    const uid = user?.uid || '';
    if (!uid) return;

    const key = getNotificationsStorageKey('last_msg_ms');
    let lastSeen = parseInt(localStorage.getItem(key) || '0', 10) || 0;

    let initial = true;
    const unsub = db.collection('message_threads')
        .where('participantIds', 'array-contains', uid)
        .limit(200)
        .onSnapshot((snap) => {
            if (initial) {
                let maxTs = lastSeen;
                snap.forEach(doc => {
                    const data = doc.data() || {};
                    const ts = (data.lastMessageAt?.toDate ? data.lastMessageAt.toDate().getTime() : (data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : 0));
                    if (ts > maxTs) maxTs = ts;
                });
                lastSeen = maxTs;
                localStorage.setItem(key, String(lastSeen));
                initial = false;
                return;
            }

            snap.docChanges().forEach(change => {
                if (change.type !== 'modified') return;
                const data = change.doc.data() || {};
                const ts = (data.lastMessageAt?.toDate ? data.lastMessageAt.toDate().getTime() : (data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : 0));
                if (!ts || ts <= lastSeen) return;
                if ((data.updatedBy || '') === uid) return;

                lastSeen = ts;
                localStorage.setItem(key, String(lastSeen));

                const participants = Array.isArray(data.participants) ? data.participants : [];
                const others = participants.filter(p => p && p.uid && p.uid !== uid);
                const from = others.length ? (others[0].name || others[0].email || others[0].uid) : 'New Message';
                const title = `${from}`;
                const body = String(data.lastMessage || '').slice(0, 140);
                showAppNotification(title, body, 'pages/admin/communication.html#messages');
            });
        }, (err) => {
            console.warn('Message notifications listener failed', err?.message || err);
        });

    notificationsState.threadsUnsub = unsub;
}

async function showAppNotification(title, body, url) {
    try {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const appBasePath = (() => {
            const path = window.location.pathname || '/';
            const idx = path.indexOf('/pages/');
            if (idx >= 0) return path.slice(0, idx + 1);
            const lastSlash = path.lastIndexOf('/');
            return lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
        })();
        const toAppUrl = (relative) => new URL(relative, window.location.origin + appBasePath).toString();

        const icon = toAppUrl('assets/icon-192.png');
        const targetUrl = toAppUrl(url || 'dashboard.html');

        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title || 'Notification', {
                body: body || '',
                icon,
                data: { url: targetUrl }
            });
            return;
        }

        const n = new Notification(title || 'Notification', { body: body || '', icon });
        n.onclick = () => {
            try { window.location.href = targetUrl; } catch (e) { /* ignore */ }
        };
    } catch (e) {
        // ignore
    }
}

function toggleLanguage() {
    const next = currentLang === 'en' ? 'ur' : 'en';
    applyLanguagePreference(next);
    persistUserLanguagePreference();
    injectFloatingBot();
}

function updateToggleButton() {
    const btn = document.getElementById('langToggle');
    if (btn) {
        btn.innerText = currentLang === 'en' ? 'اردو' : 'English';
    }
}

function updatePageLanguage() {
    if (typeof translations === 'undefined' || !translations) return;
    const t = translations[currentLang] || {};
    const enPack = translations.en || {};

    // 1. Toggle RTL class and attributes
    if (currentLang === 'ur') {
        document.documentElement.setAttribute('lang', 'ur');
        document.documentElement.setAttribute('dir', 'rtl');
        document.body.classList.add('rtl-mode');
    } else {
        document.documentElement.setAttribute('lang', 'en');
        document.documentElement.setAttribute('dir', 'ltr');
        document.body.classList.remove('rtl-mode');
    }

    // 2. Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const value = t[key] || enPack[key];
        if (!value) return;

        if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.getAttribute('placeholder')) {
            el.placeholder = value;
            return;
        }

        el.innerText = value;
    });
}

// Helper to get translation
function getTrans(key) {
    try {
        if (typeof translations === 'undefined' || !translations) return key;
        const langPack = translations[currentLang] || translations.en || {};
        return langPack[key] || key;
    } catch (e) {
        return key;
    }
}

function getTransOr(key, fallback) {
    const v = getTrans(key);
    return v === key ? (fallback || key) : v;
}

async function linkGoogleForCurrentUser() {
    const user = auth?.currentUser;
    if (!user) {
        alert('Please sign in first.');
        return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) { /* ignore */ }
    try {
        await user.linkWithPopup(provider);
        alert('Google linked to your account.');
        if (typeof renderLinkedProviders === 'function') renderLinkedProviders();
    } catch (err) {
        const code = err?.code || '';
        if (code === 'auth/provider-already-linked') {
            alert('Google is already linked to this account.');
            return;
        }
        if (code === 'auth/credential-already-in-use') {
            alert('This Google account is already linked to another user.');
            return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        if (code === 'auth/popup-blocked') {
            alert('Popup blocked. Please allow popups for this site and try again.');
            return;
        }
        console.error('Link Google failed', err);
        alert('Failed to link Google: ' + (err?.message || code || 'Unknown error'));
    }
}

async function linkMicrosoftForCurrentUser() {
    const user = auth?.currentUser;
    if (!user) {
        alert('Please sign in first.');
        return;
    }
    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    try {
        provider.addScope('email');
        provider.addScope('profile');
    } catch (e) { /* ignore */ }
    try {
        await user.linkWithPopup(provider);
        alert('Microsoft linked to your account.');
        if (typeof renderLinkedProviders === 'function') renderLinkedProviders();
    } catch (err) {
        const code = err?.code || '';
        if (code === 'auth/provider-already-linked') {
            alert('Microsoft is already linked to this account.');
            return;
        }
        if (code === 'auth/credential-already-in-use') {
            alert('This Microsoft account is already linked to another user.');
            return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        if (code === 'auth/popup-blocked') {
            alert('Popup blocked. Please allow popups for this site and try again.');
            return;
        }
        console.error('Link Microsoft failed', err);
        alert('Failed to link Microsoft: ' + (err?.message || code || 'Unknown error'));
    }
}

function renderLinkedProviders(targetId = 'linkedProviders') {
    try {
        const el = document.getElementById(targetId);
        if (!el) return;
        const user = auth?.currentUser;
        if (!user) {
            el.innerText = 'Not signed in.';
            return;
        }
        const ids = (user.providerData || []).map(p => p?.providerId).filter(Boolean);
        const human = ids.map(id => {
            if (id === 'password') return 'Email/Password';
            if (id === 'google.com') return 'Google';
            if (id === 'microsoft.com') return 'Microsoft';
            return id;
        });
        el.innerText = human.length ? human.join(', ') : 'None';
    } catch (e) { /* ignore */ }
}

// Tenant helpers (multi-tenant scaffolding)
function getCurrentTenant() {
    return localStorage.getItem('tenant_id') || 'default';
}

function setCurrentTenant(tenantId) {
    if (tenantId) {
        localStorage.setItem('tenant_id', tenantId);
    }
}

// Branding / White-label (per-tenant)
let brandingState = {
    tenantId: 'default',
    data: null
};

function brandingCacheKey(tenantId) {
    return `branding_cache_${tenantId || 'default'}`;
}

function readCachedBranding(tenantId) {
    try {
        const raw = localStorage.getItem(brandingCacheKey(tenantId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

function writeCachedBranding(tenantId, data) {
    try {
        if (!data || typeof data !== 'object') return;
        localStorage.setItem(brandingCacheKey(tenantId), JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

function clampByte(n) {
    const v = Math.round(Number(n) || 0);
    return Math.max(0, Math.min(255, v));
}

function hexToRgb(hex) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}

function rgbToHex(r, g, b) {
    const toHex = (x) => clampByte(x).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darkenHex(hex, amount = 0.12) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '';
    const factor = 1 - Math.max(0, Math.min(1, amount));
    return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

function getSchoolBranding() {
    try {
        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : 'default';
        return brandingState.data || readCachedBranding(tenantId) || {};
    } catch (e) {
        return {};
    }
}

function applyBrandingToDom(branding) {
    try {
        if (!branding || typeof branding !== 'object') return;
        const root = document.documentElement;

        const primary = String(branding.primaryColor || '').trim();
        if (primary) {
            root.style.setProperty('--primary-color', primary);
            const hover = String(branding.primaryHover || '').trim() || darkenHex(primary, 0.14);
            if (hover) root.style.setProperty('--primary-hover', hover);
        }

        const banner = String(branding.banner || '').trim();
        if (banner) {
            root.style.setProperty('--header-image', `url('${banner}')`);
        }

        const logo = String(branding.logo || '').trim();
        if (logo) {
            document.querySelectorAll('img.sidebar-logo').forEach(img => {
                try { img.src = logo; } catch (e) { /* ignore */ }
            });
        }

        const name = String(branding.name || '').trim();
        if (name) {
            document.querySelectorAll('.sidebar-header h2').forEach(el => {
                try { el.textContent = name; } catch (e) { /* ignore */ }
            });
            if (document.title && document.title.includes('-')) {
                const parts = document.title.split('-').map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) document.title = `${parts[0]} - ${name}`;
            }
        }

        // Login page logo (optional)
        const loginHeader = document.querySelector('.login-header');
        if (loginHeader && logo && !loginHeader.querySelector('img[data-branding-logo="1"]')) {
            const img = document.createElement('img');
            img.setAttribute('data-branding-logo', '1');
            img.src = logo;
            img.alt = 'Logo';
            img.style.width = '64px';
            img.style.height = '64px';
            img.style.objectFit = 'contain';
            img.style.margin = '0 auto 0.75rem';
            img.style.display = 'block';
            loginHeader.insertBefore(img, loginHeader.firstChild);
        }

        // Update theme-color meta to match primary color
        if (primary) {
            let meta = document.querySelector('meta[name="theme-color"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'theme-color';
                document.head.appendChild(meta);
            }
            meta.content = primary;
        }
    } catch (e) { /* ignore */ }
}

async function syncBrandingSettings() {
    try {
        if (typeof db === 'undefined' || !db) return;

        const tenantId = (typeof getCurrentTenant === 'function') ? getCurrentTenant() : (localStorage.getItem('tenant_id') || 'default');
        brandingState.tenantId = tenantId;

        // Apply cached first for instant UI
        const cached = readCachedBranding(tenantId);
        if (cached) applyBrandingToDom(cached);

        // Only fetch when authenticated (rules require auth)
        if (!auth?.currentUser?.uid) return;

        const doc = await db.collection('branding').doc(tenantId).get();
        if (!doc.exists) return;

        const data = doc.data() || {};
        brandingState.data = data;
        writeCachedBranding(tenantId, data);
        applyBrandingToDom(data);
    } catch (e) {
        console.warn('Branding sync skipped', e?.message || e);
    }
}

function getBrandPrimaryRgb() {
    const branding = getSchoolBranding();
    const rgb = hexToRgb(branding.primaryColor || '#4f46e5');
    return rgb ? [rgb.r, rgb.g, rgb.b] : [79, 70, 229];
}

function getSchoolBranding() {
    return (typeof brandingState !== 'undefined' && brandingState.data) ? brandingState.data : {};
}

async function applyPdfBranding(doc, options = {}) {
    try {
        if (!doc) return 40;
        const branding = getSchoolBranding();
        const primaryRgb = getBrandPrimaryRgb();
        doc.__brandPrimaryRgb = primaryRgb;

        const schoolName = String(branding.name || 'School').trim();
        const title = String(options.title || '').trim();
        const generated = options.generated === false ? '' : `Generated on: ${new Date().toLocaleDateString()}`;

        // Load images
        const logoImg = new Image();
        logoImg.src = '../../assets/logo.png';
        const headerImg = new Image();
        headerImg.src = '../../assets/header-image.png';

        await Promise.all([
            new Promise(resolve => {
                if (logoImg.complete) resolve();
                else { logoImg.onload = resolve; logoImg.onerror = resolve; }
            }),
            new Promise(resolve => {
                if (headerImg.complete) resolve();
                else { headerImg.onload = resolve; headerImg.onerror = resolve; }
            })
        ]);

        let nextY = 40;

        // Header Image (Priority)
        if (headerImg.naturalWidth > 0) {
            // Assume A4 Portrait (210mm width). Margins ~10mm.
            // Image aspect ratio preservation would be good, but let's fit to width for now.
            // 190mm width, 30mm height (approx)
            doc.addImage(headerImg, 'PNG', 10, 5, 190, 30);
            nextY = 40;
        } else {
            // Fallback: Logo + Text
            if (logoImg.naturalWidth > 0) {
                doc.addImage(logoImg, 'PNG', 14, 10, 20, 20);
            }
            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.text(schoolName, 40, 20);
            nextY = 40;
        }

        // Title
        if (title) {
            doc.setFontSize(14);
            doc.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
            doc.text(title, 105, nextY, { align: 'center' });
            nextY += 8;
        }

        // Generated Date
        if (generated) {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(generated, 105, nextY, { align: 'center' });
            nextY += 10;
        }

        // Divider Line
        doc.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
        doc.setLineWidth(0.5);
        doc.line(10, nextY, 200, nextY);

        return nextY + 5;

    } catch (e) {
        console.error("applyPdfBranding error:", e);
        return 40;
    }
}

async function loadIntegrationSettings(tenantId) {
    try {
        if (typeof db === 'undefined' || !db) return null;
        const id = tenantId || getCurrentTenant();
        const doc = await db.collection('integration_settings').doc(id).get();
        return doc.exists ? (doc.data() || null) : null;
    } catch (e) {
        return null;
    }
}

function getEmailDomain(email) {
    const parts = String(email || '').toLowerCase().split('@');
    if (parts.length !== 2) return '';
    return parts[1].trim();
}

async function ensureProvisionedAccess(authUser) {
    try {
        if (!authUser?.uid) return false;

        const tenantId = getCurrentTenant();
        const settings = await loadIntegrationSettings(tenantId);
        const lastProvider = String(localStorage.getItem('last_auth_provider') || '');
        // Restrict only SSO sign-ins (Google/Microsoft). Email/password admins should not be blocked.
        // `last_auth_provider` is set during the SSO click flow (popup/redirect) and remains "password" for normal logins.
        const isSsoSignIn = lastProvider === 'google.com' || lastProvider === 'microsoft.com';
        const allowedDomains = Array.isArray(settings?.allowedDomains)
            ? settings.allowedDomains.map(d => String(d || '').toLowerCase().trim()).filter(Boolean)
            : [];

        // Allowed domains are meant to restrict SSO sign-ins, not email/password admins.
        if (allowedDomains.length && isSsoSignIn) {
            const domain = getEmailDomain(authUser.email);
            if (!domain || !allowedDomains.includes(domain)) {
                await auth.signOut();
                const details = [
                    getTransOr('domain_not_allowed', 'Sign-in not allowed for this email domain.'),
                    '',
                    `Email: ${authUser.email || ''}`,
                    `Domain: ${domain || '(unknown)'}`,
                    `Allowed: ${allowedDomains.join(', ')}`,
                    '',
                    'Fix: go to Admin → Integrations → SSO and either clear "Allowed Email Domains" (allow all) or add this domain, then Save.'
                ].join('\n');
                alert(details);
                return false;
            }
        }

        if (settings?.googleEnabled === false && lastProvider === 'google.com') {
            await auth.signOut();
            alert(getTrans('sso_provider_disabled'));
            return false;
        }

        if (settings?.microsoftEnabled === false && lastProvider === 'microsoft.com') {
            await auth.signOut();
            alert(getTrans('sso_provider_disabled'));
            return false;
        }

        const userDoc = await db.collection("users").doc(authUser.uid).get();
        if (!userDoc.exists) {
            await auth.signOut();
            const last = String(localStorage.getItem('last_auth_provider') || '');
            const msg = [
                getTransOr('account_not_provisioned', 'Account not provisioned. Please contact the administrator.'),
                '',
                `Email: ${authUser.email || ''}`,
                `UID: ${authUser.uid || ''}`,
                `Sign-in method: ${last || 'unknown'}`,
                '',
                'Fix (admin): Firebase Console → Firestore → create `users/{UID}` with role + email (or sign in as an existing admin and add this user in Users page).',
                'Fix (recommended for Google): sign in with Email/Password first, then go to Admin → Settings → Sign-in Providers → Link Google.'
            ].join('\n');
            alert(msg);
            return false;
        }

        try { localStorage.removeItem('last_auth_provider'); } catch (e) { /* ignore */ }
        return true;
    } catch (e) {
        console.warn('Provisioning check skipped', e?.message || e);
        return true;
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const btn = event.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = 'Signing in...';
    btn.disabled = true;

    try {
        try { localStorage.setItem('last_auth_provider', 'password'); } catch (e) { /* ignore */ }
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        void userCredential;

        // Auth state listener will handle the rest
    } catch (error) {
        console.error("Login Error:", error);
        alert("Login failed: " + error.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try { provider.setCustomParameters({ prompt: 'select_account' }); } catch (e) { /* ignore */ }
    return signInWithProvider(provider);
}

async function signInWithMicrosoft() {
    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    try {
        provider.addScope('email');
        provider.addScope('profile');
    } catch (e) { /* ignore */ }
    return signInWithProvider(provider);
}

async function signInWithProvider(provider) {
    try {
        try { localStorage.setItem('last_auth_provider', provider?.providerId || ''); } catch (e) { /* ignore */ }
        await auth.signInWithPopup(provider);
    } catch (err) {
        const code = err?.code || '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await auth.signInWithRedirect(provider);
            return;
        }
        if (code === 'auth/popup-closed-by-user') return;
        if (code === 'auth/cancelled-popup-request') return;

        if (code === 'auth/account-exists-with-different-credential') {
            const email = String(err?.email || '').trim();
            let methods = [];
            try {
                if (email) methods = await auth.fetchSignInMethodsForEmail(email);
            } catch (e) { /* ignore */ }

            const hint = methods.length
                ? `Existing sign-in method(s): ${methods.join(', ')}`
                : 'Existing sign-in method(s): unknown';

            alert(
                getTransOr(
                    'sso_account_exists_different_credential',
                    'This email already has an account using a different sign-in method.'
                ) +
                `\n\nEmail: ${email || '(unknown)'}\n${hint}\n\nFix: sign in using the existing method (Email/Password), then we can link Google for this account.`
            );
            return;
        }

        if (code === 'auth/unauthorized-domain') {
            const host = window?.location?.hostname || '';
            const origin = window?.location?.origin || '';
            alert(`${getTransOr('sso_unauthorized_domain', 'Unauthorized domain for OAuth sign-in.')}\n\nAdd this domain in Firebase Console → Authentication → Settings → Authorized domains:\n- ${host}\n\nCurrent origin:\n- ${origin}`);
            return;
        }

        if (code === 'auth/operation-not-allowed') {
            alert(getTransOr('sso_provider_not_enabled', 'This sign-in provider is not enabled in Firebase Authentication.'));
            return;
        }

        if (code === 'auth/invalid-oauth-client-id' || code === 'auth/invalid-oauth-client-secret') {
            alert(getTransOr('sso_invalid_oauth_client', 'OAuth client configuration is invalid. Check the provider configuration in Firebase Authentication.'));
            return;
        }

        console.error('SSO sign-in failed', err);
        alert(getTransOr('sso_login_failed', 'SSO sign-in failed') + ': ' + (err?.message || code || 'Unknown error'));
        return;
    }
}

function initSSOButtons() {
    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.addEventListener('click', () => signInWithGoogle());

    const microsoftBtn = document.getElementById('microsoftSignInBtn');
    if (microsoftBtn) microsoftBtn.addEventListener('click', () => signInWithMicrosoft());
}

async function handleLogout() {
    try {
        await auth.signOut();
        localStorage.removeItem('currentUser');

        // Redirect logic
        if (window.location.pathname.includes('/pages/')) {
            window.location.href = '../../index.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// Global Auth Check & Dashboard Init
auth.onAuthStateChanged(async (user) => {
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const getSafeNext = () => {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = String(params.get('next') || '').trim();
            if (!raw) return '';
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return ''; // no schemes
            if (raw.startsWith('//')) return '';
            const cleaned = raw.replace(/^\/+/, '');
            if (cleaned.includes('..')) return '';
            return cleaned;
        } catch (e) {
            return '';
        }
    };

    if (user) {
        if (isLoginPage) {
            const allowed = await ensureProvisionedAccess(user);
            if (!allowed) return;
            const next = getSafeNext();
            window.location.href = next || 'dashboard.html';
        } else {
            const allowed = await ensureProvisionedAccess(user);
            if (!allowed) return;

            // We are on a protected page (Dashboard or Inner Page)
            // Ensure we have user details (Role) to render the sidebar
            let currentUser = JSON.parse(localStorage.getItem('currentUser'));

            // If local storage is missing or doesn't match auth user, fetch fresh data
            if (!currentUser || currentUser.uid !== user.uid) {
                console.log("Fetching user data from Firestore...");
                let role = 'student'; // Default
                try {
                    const userDoc = await db.collection("users").doc(user.uid).get();
                    if (userDoc.exists) {
                        role = userDoc.data().role || 'student';
                    } else {
                        await auth.signOut();
                        alert(getTrans('account_not_provisioned'));
                        return;
                    }
                } catch (e) {
                    console.log("Error fetching role:", e);
                    role = 'student'; // Fallback
                }

                currentUser = {
                    uid: user.uid,
                    email: user.email,
                    role: role,
                    name: user.displayName || user.email.split('@')[0]
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            }

            // Initialize Dashboard/Sidebar
            initDashboard(currentUser);

            // Branding (tenant-scoped)
            syncBrandingSettings();

            // Error reporting
            initErrorReporting();
            flushClientErrorQueue();

            // Per-user language preference (user_settings/{uid})
            syncUserLanguagePreference(user.uid);

            // Per-user notification preference (user_settings/{uid})
            syncUserNotificationPreference(user.uid);

            // Initialize AI Features (Global)
            initGlobalAI();
        }
    } else {
        if (!isLoginPage) {
            // Check if we are already redirecting to avoid loops
            if (!window.location.href.includes('index.html')) {
                const pathname = String(window.location.pathname || '');
                const search = String(window.location.search || '');
                const hash = String(window.location.hash || '');
                const next = (() => {
                    const idx = pathname.indexOf('/pages/');
                    if (idx >= 0) return `${pathname.slice(idx + 1)}${search}${hash}`.replace(/^\/+/, '');
                    const leaf = pathname.split('/').filter(Boolean).pop() || 'dashboard.html';
                    return `${leaf}${search}${hash}`.replace(/^\/+/, '');
                })();

                const loginHref = pathname.includes('/pages/') ? '../../index.html' : 'index.html';
                window.location.href = `${loginHref}?next=${encodeURIComponent(next)}`;
            }
        }
    }
});

// Dashboard Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    initSSOButtons();

    // Error reporting (captures early runtime issues)
    initErrorReporting();

    // We rely on onAuthStateChanged to trigger initDashboard now, 
    // but we can also check localStorage for immediate render to avoid flicker
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user && !loginForm) {
        initDashboard(user);
        initGlobalAI();
    }

    // Initialize Language
    if (typeof translations !== 'undefined') {
        initLanguage();
    }

    // Initialize Notifications UI
    initNotifications();

    // Apply cached branding immediately; then sync when authed
    syncBrandingSettings();

    // Initialize PWA helpers (manifest, SW, offline banner)
    initPWA();
});

function initDashboard(user) {
    const nameEl = document.getElementById('userName');
    const roleEl = document.getElementById('userRole');

    if (nameEl) nameEl.innerText = user.name;
    if (roleEl) roleEl.innerText = user.role.toUpperCase();

    renderSidebar(user.role);
    setupMobileSidebar();
}

function setupMobileSidebar() {
    // 1. Inject Hamburger Button if not exists
    const header = document.querySelector('.header');
    if (header && !document.querySelector('.hamburger-toggle')) {
        const btn = document.createElement('button');
        btn.className = 'hamburger-toggle';
        btn.innerHTML = '&#9776;';
        btn.onclick = toggleSidebar;
        header.insertBefore(btn, header.firstChild);
    }

    // 2. Inject Overlay if not exists
    if (!document.querySelector('.sidebar-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

function renderSidebar(role) {
    const sidebarNav = document.getElementById('sidebarNav');
    if (!sidebarNav) return;

    // Clear existing to avoid duplicates if called multiple times
    sidebarNav.innerHTML = '';

    const isInPages = window.location.pathname.includes('/pages/');
    const basePath = isInPages ? '../../' : '';

    const commonLinks = [
        { name: getTrans('dashboard'), icon: '📊', href: basePath + 'dashboard.html' }
    ];

    const roleLinks = {
        owner: 'admin',
        admin: [
            { name: getTrans('students'), icon: '👨‍🎓', href: basePath + 'pages/admin/students.html' },
            { name: getTrans('teachers'), icon: '👨‍🏫', href: basePath + 'pages/admin/teachers.html' },
            { name: getTrans('attendance'), icon: '✅', href: basePath + 'pages/admin/attendance.html' },
            { name: getTrans('timetable'), icon: '📅', href: basePath + 'pages/admin/timetable.html' },
            { name: getTrans('classes'), icon: '🏫', href: basePath + 'pages/admin/classes.html' },
            { name: getTrans('subjects'), icon: '📚', href: basePath + 'pages/admin/subjects.html' },
            { name: getTrans('exams'), icon: '📝', href: basePath + 'pages/admin/exams.html' },
            { name: getTrans('fees'), icon: '💸', href: basePath + 'pages/admin/fees.html' },
            { name: getTrans('finance'), icon: '💼', href: basePath + 'pages/admin/finance.html' },
            { name: getTrans('payroll'), icon: '🧾', href: basePath + 'pages/admin/payroll.html' },
            { name: getTrans('communication'), icon: '💬', href: basePath + 'pages/admin/communication.html' },
            { name: getTrans('library'), icon: '📖', href: basePath + 'pages/admin/library.html' },
            { name: getTrans('transport'), icon: '🚌', href: basePath + 'pages/admin/transport.html' },
            { name: getTrans('inventory'), icon: '📦', href: basePath + 'pages/admin/inventory.html' },
            { name: getTrans('reports'), icon: '📈', href: basePath + 'pages/admin/reports.html' },
            { name: getTrans('attendance_report'), icon: '📄', href: basePath + 'pages/admin/attendance-report.html' },
            { name: getTrans('certificates'), icon: '🎓', href: basePath + 'pages/admin/certificates.html' },
            { name: getTrans('users'), icon: '👥', href: basePath + 'pages/admin/users.html' },
            { name: getTrans('settings'), icon: '⚙️', href: basePath + 'pages/admin/settings.html' },
            { name: getTrans('ai_features'), icon: '🤖', href: basePath + 'pages/admin/ai-features.html' },
            { name: getTrans('compliance_privacy'), icon: '🔒', href: basePath + 'pages/admin/compliance.html' },
            { name: getTrans('integrations'), icon: '🔗', href: basePath + 'pages/admin/integrations.html' },
            { name: getTrans('backup'), icon: '💾', href: basePath + 'pages/admin/backup.html' }
        ],
        principal: 'admin',
        teacher: [
            { name: getTrans('portal'), icon: '🏠', href: basePath + 'pages/teacher/portal.html' },
            { name: getTrans('attendance'), icon: '✅', href: basePath + 'pages/teacher/attendance.html' },
            { name: getTrans('attendance_report'), icon: '📄', href: basePath + 'pages/teacher/attendance-report.html' },
            { name: getTrans('grades'), icon: '📊', href: basePath + 'pages/teacher/grades.html' },
            { name: getTrans('homework'), icon: '📝', href: basePath + 'pages/teacher/homework.html' },
            { name: getTrans('communication'), icon: '💬', href: basePath + 'pages/admin/communication.html#messages' },
            { name: getTrans('timetable'), icon: '📅', href: basePath + 'pages/teacher/timetable.html' }
        ],
        student: [
            { name: getTrans('portal'), icon: '🏠', href: basePath + 'pages/student/portal.html' },
            { name: getTrans('my_attendance'), icon: '✅', href: basePath + 'pages/student/attendance.html' },
            { name: getTrans('my_timetable'), icon: '📅', href: basePath + 'pages/student/timetable.html' },
            { name: getTrans('results'), icon: '📊', href: basePath + 'pages/student/results.html' },
            { name: getTrans('communication'), icon: '💬', href: basePath + 'pages/admin/communication.html#messages' },
            { name: getTrans('homework'), icon: '📝', href: basePath + 'pages/student/homework.html' }
        ],
        parent: [
            { name: getTrans('portal'), icon: '🏠', href: basePath + 'pages/parent/portal.html' },
            { name: getTrans('attendance'), icon: '✅', href: basePath + 'pages/student/attendance.html' },
            { name: getTrans('timetable'), icon: '📅', href: basePath + 'pages/student/timetable.html' },
            { name: getTrans('results'), icon: '📊', href: basePath + 'pages/student/results.html' },
            { name: getTrans('communication'), icon: '💬', href: basePath + 'pages/admin/communication.html#messages' }
        ],
        accountant: [
            { name: getTrans('fees'), icon: '💸', href: basePath + 'pages/admin/fees.html' },
            { name: getTrans('finance'), icon: '💼', href: basePath + 'pages/admin/finance.html' },
            { name: getTrans('payroll'), icon: '🧾', href: basePath + 'pages/admin/payroll.html' },
            { name: getTrans('reports'), icon: '📈', href: basePath + 'pages/admin/reports.html' }
        ],
        clerk: [
            { name: getTrans('attendance'), icon: '✅', href: basePath + 'pages/admin/attendance.html' },
            { name: getTrans('attendance_report'), icon: '📄', href: basePath + 'pages/admin/attendance-report.html' },
            { name: getTrans('students'), icon: '👨‍🎓', href: basePath + 'pages/admin/students.html' },
            { name: getTrans('fees'), icon: '💸', href: basePath + 'pages/admin/fees.html' },
            { name: getTrans('transport'), icon: '🚌', href: basePath + 'pages/admin/transport.html' },
            { name: getTrans('library'), icon: '📖', href: basePath + 'pages/admin/library.html' }
        ]
    };

    // Normalize role to lowercase to match keys
    const normalizedRole = role ? role.toLowerCase() : 'student';
    const resolvedRoleLinks = Array.isArray(roleLinks[normalizedRole])
        ? roleLinks[normalizedRole]
        : Array.isArray(roleLinks[roleLinks[normalizedRole]])
            ? roleLinks[roleLinks[normalizedRole]]
            : [];

    // Add Support link at the very end
    const supportLink = { name: getTrans('support'), icon: '🛟', href: basePath + 'pages/admin/support.html' };
    const links = [...commonLinks, ...resolvedRoleLinks, supportLink];

    sidebarNav.innerHTML = links.map(link => `
        <a href="${link.href}" class="nav-item ${window.location.href.includes(link.href) ? 'active' : ''}">
            <span class="nav-icon">${link.icon}</span>
            ${link.name}
        </a>
    `).join('');

    const logoutBtn = document.createElement('a');
    logoutBtn.href = '#';
    logoutBtn.className = 'nav-item';
    logoutBtn.style.marginTop = 'auto';
    logoutBtn.style.color = 'var(--danger)';
    logoutBtn.innerHTML = `<span class="nav-icon">🚪</span>${getTrans('logout')}`;
    logoutBtn.onclick = (e) => {
        e.preventDefault();
        handleLogout();
    };
    sidebarNav.appendChild(logoutBtn);
}
// ==========================================
// AI & Floating Bot Logic
// ==========================================

/**
 * Global Schema Definition for School Management System
 * Used by AI to understand data structure for Reports and Data Entry.
 */
// Prefer external schema if loaded (schema-config.js). Fallback to built-in.
let APP_SCHEMA = (typeof window !== 'undefined' && window.APP_SCHEMA) ? window.APP_SCHEMA : {
    users: {
        description: "Authentication and User Roles",
        fields: {
            email: { type: "string", required: true },
            role: { type: "string", enum: ["owner", "admin", "principal", "teacher", "accountant", "clerk", "parent", "student"], required: true },
            tenantId: { type: "string", required: true },
            createdAt: { type: "timestamp" }
        }
    },
    students: {
        description: "Student Records",
        fields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
            rollNumber: { type: "string", unique: true, required: true },
            className: { type: "string", required: true, description: "Class Name e.g. 'Class 10'" },
            department: { type: "string", required: true, description: "Department e.g. 'Science'" },
            parentName: { type: "string", required: true },
            parentPhone: { type: "string", required: true },
            email: { type: "string" },
            dob: { type: "date" },
            address: { type: "string" },
            gender: { type: "string" }
        }
    },
    teachers: {
        description: "Teacher Records. Note: To enable login, a corresponding 'users' record is also required.",
        fields: {
            firstName: { type: "string", required: true },
            lastName: { type: "string", required: true },
            subject: { type: "string", required: true },
            email: { type: "string", required: true },
            phone: { type: "string", required: true },
            role: { type: "string", enum: ["teacher"], default: "teacher" },
            createdAt: { type: "timestamp" }
        }
    },
    classes: {
        description: "Class Definitions",
        fields: {
            name: { type: "string", required: true, description: "e.g. 'Class 10'" },
            department: { type: "string", required: true },
            teacherId: { type: "string", description: "Class Teacher ID" }
        }
    },
    departments: {
        description: "School Departments",
        fields: {
            name: { type: "string", required: true, unique: true }
        }
    },
    attendance: {
        description: "Class Attendance Records (Aggregated by Class/Date)",
        fields: {
            date: { type: "string", format: "YYYY-MM-DD", required: true },
            department: { type: "string", required: true },
            className: { type: "string", required: true },
            subject: { type: "string" },
            records: {
                type: "array",
                description: "Array of objects: { uid: string, status: 'Present'|'Absent'|'Leave' }"
            }
        }
    },
    timetable: {
        description: "Class Schedules",
        fields: {
            department: { type: "string", required: true },
            className: { type: "string", required: true },
            day: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
            startTime: { type: "string", format: "HH:mm" },
            endTime: { type: "string", format: "HH:mm" },
            subject: { type: "string", required: true },
            teacherId: { type: "string", required: true },
            teacherName: { type: "string" }
        }
    },
    fees: {
        description: "Fee Records and Payments",
        fields: {
            studentId: { type: "string" },
            studentName: { type: "string", required: true },
            rollNumber: { type: "string" },
            className: { type: "string" },
            amount: { type: "number", required: true },
            feeType: { type: "string", description: "Tuition, Transport, etc." },
            month: { type: "string" },
            year: { type: "number" },
            status: { type: "string", enum: ["Paid", "Pending"] },
            paidDate: { type: "date" }
        }
    },
    fee_heads: {
        description: "Fee Types Configuration",
        fields: {
            name: { type: "string", required: true, description: "Fee Type Name" },
            amount: { type: "number", description: "Default Amount" }
        }
    },
    incomes: {
        description: "Financial Income Records (Donations, Grants, etc.)",
        fields: {
            title: { type: "string", required: true, description: "e.g. 'Donation from Ali'" },
            category: { type: "string", required: true, enum: ["Donations", "Grants", "Other"] },
            amount: { type: "number", required: true },
            date: { type: "date", required: true, description: "YYYY-MM-DD" },
            description: { type: "string" }
        }
    },
    expenses: {
        description: "Financial Expense Records",
        fields: {
            title: { type: "string", required: true, description: "e.g. 'Electricity Bill'" },
            category: { type: "string", required: true, enum: ["Utilities", "Salaries", "Maintenance", "Supplies", "Other"] },
            amount: { type: "number", required: true },
            date: { type: "date", required: true, description: "YYYY-MM-DD" },
            description: { type: "string" }
        }
    },
    payroll: {
        description: "Staff Salary Records",
        fields: {
            staffId: { type: "string", required: true },
            staffName: { type: "string" },
            staffRole: { type: "string" },
            month: { type: "number", required: true, description: "0-11" },
            year: { type: "number", required: true },
            basicSalary: { type: "number" },
            bonuses: { type: "number" },
            deductions: { type: "number" },
            netSalary: { type: "number" },
            status: { type: "string", enum: ["Draft", "Paid"] },
            generatedAt: { type: "timestamp" }
        }
    },
    leaves: {
        description: "Staff Leave Applications",
        fields: {
            staffId: { type: "string", required: true },
            leaveType: { type: "string", enum: ["Sick", "Casual", "Earned", "Unpaid"] },
            startDate: { type: "date", required: true },
            endDate: { type: "date", required: true },
            reason: { type: "string" },
            status: { type: "string", enum: ["Pending", "Approved", "Rejected"] },
            appliedAt: { type: "timestamp" }
        }
    },
    inventory_items: {
        description: "Inventory Stock Items",
        fields: {
            name: { type: "string", required: true },
            category: { type: "string" },
            sku: { type: "string" },
            quantity: { type: "number", required: true },
            minQuantity: { type: "number", description: "Low stock alert level" }
        }
    },
    inventory_categories: {
        description: "Inventory Categories",
        fields: {
            name: { type: "string", required: true }
        }
    },
    inventory_transactions: {
        description: "Inventory Movements",
        fields: {
            itemId: { type: "string", required: true },
            type: { type: "string", enum: ["Purchase", "Issue", "Consume"] },
            quantity: { type: "number", required: true },
            date: { type: "timestamp" },
            performedBy: { type: "string" },
            notes: { type: "string" }
        }
    },
    events: {
        description: "School Events & Calendar",
        fields: {
            title: { type: "string", required: true },
            description: { type: "string" },
            date: { type: "date", required: true },
            location: { type: "string" }
        }
    },
    notices: {
        description: "Notice Board",
        fields: {
            title: { type: "string", required: true },
            content: { type: "string", required: true },
            date: { type: "timestamp" },
            targetAudience: { type: "string", enum: ["all", "teachers", "students"] },
            updatedAt: { type: "timestamp" }
        }
    }
};

// Share schema globally so other scripts (e.g., schema-config.js) can reuse/override a single source.
if (typeof window !== 'undefined') {
    window.APP_SCHEMA = APP_SCHEMA;
}

function ensureSchemaLatest() {
    if (typeof window !== 'undefined' && window.APP_SCHEMA && window.APP_SCHEMA !== APP_SCHEMA) {
        APP_SCHEMA = window.APP_SCHEMA;
    }
}

function getSchemaSummary() {
    ensureSchemaLatest();
    let summary = "DATABASE SCHEMAS (Reference for Data Entry & Queries):\n";
    for (const [collection, schema] of Object.entries(APP_SCHEMA)) {
        const fieldEntries = Object.entries(schema.fields || {});
        const requiredFields = fieldEntries
            .filter(([, field]) => field.required)
            .map(([name]) => name);
        const optionalFields = fieldEntries
            .filter(([, field]) => !field.required)
            .map(([name]) => name);
        const fieldHints = fieldEntries
            .map(([name, field]) => {
                const meta = [];
                if (field.type) meta.push(field.type);
                if (field.description) meta.push(field.description);
                return `${name}${meta.length ? ` (${meta.join(' - ')})` : ''}`;
            })
            .join(', ');
        const constraintHints = fieldEntries
            .filter(([, field]) => field.enum)
            .map(([name, field]) => `${name}: [${field.enum.join(', ')}]`)
            .join('; ');

        summary += `\n- Collection: '${collection}' (${schema.description})\n`;
        summary += `  Required: ${requiredFields.length ? requiredFields.join(', ') : 'None'}\n`;
        summary += `  Optional: ${optionalFields.length ? optionalFields.join(', ') : 'None'}\n`;
        if (fieldHints) summary += `  Field Hints: ${fieldHints}\n`;
        if (constraintHints) summary += `  Constraints: ${constraintHints}\n`;
    }
    summary += "\nAlways use exact field names and honor the required set when producing JSON.";
    return summary;
}

const AI_PLACEHOLDER_VALUES = ['n/a', 'na', 'pending', 'unknown', 'tbd', '???', '?', '-', 'none', 'null'];

const AI_COLLECTION_PERMISSIONS = {
    admin: ['*'],
    teacher: ['attendance', 'timetable', 'notices', 'leaves', 'students', 'results'],
    student: []
};

function getCurrentUserRole() {
    try {
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return stored?.role || 'student';
    } catch (error) {
        console.warn("Failed to read current user role:", error);
        return 'student';
    }
}

function userCanEditCollection(collection) {
    if (!collection) return false;
    const role = getCurrentUserRole();
    const allowedCollections = AI_COLLECTION_PERMISSIONS[role] || [];
    if (allowedCollections === '*') return true;
    if (Array.isArray(allowedCollections)) {
        if (allowedCollections.includes('*')) return true;
        return allowedCollections.includes(collection);
    }
    return false;
}

function isPlaceholderValue(value) {
    if (typeof value !== 'string') return false;
    return AI_PLACEHOLDER_VALUES.includes(value.trim().toLowerCase());
}

function validateValueByType(fieldDef = {}, value) {
    if (value === undefined || value === null) return null;
    const expectedType = fieldDef.type;
    if (!expectedType) return null;

    switch (expectedType) {
        case 'string':
            if (typeof value !== 'string') return `Expected a string but received ${typeof value}`;
            break;
        case 'number':
            if (typeof value !== 'number') return `Expected a number but received ${typeof value}`;
            break;
        case 'array':
            if (!Array.isArray(value)) return 'Expected an array';
            break;
        case 'timestamp':
            if (typeof value !== 'object' && typeof value !== 'string') return 'Expected a timestamp or ISO string';
            break;
        case 'date':
            if (typeof value !== 'string') return 'Expected a date string';
            if (fieldDef.format === 'YYYY-MM-DD' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                return 'Date must match YYYY-MM-DD';
            }
            break;
        default:
            break;
    }
    return null;
}

function validateAiEntry(collection, data = {}) {
    ensureSchemaLatest();
    const result = { errors: [], warnings: [] };

    if (!collection || !APP_SCHEMA[collection]) {
        result.errors.push(`Unknown collection '${collection}'.`);
        return result;
    }

    const schema = APP_SCHEMA[collection];
    const schemaFields = schema.fields || {};

    for (const [fieldName, fieldConfig] of Object.entries(schemaFields)) {
        const value = data[fieldName];
        if (fieldConfig.required && (value === undefined || value === null || value === '')) {
            result.errors.push(`Missing required field '${fieldName}'.`);
            continue;
        }
        if (value === undefined || value === null) continue;

        const typeError = validateValueByType(fieldConfig, value);
        if (typeError) {
            result.errors.push(`Field '${fieldName}': ${typeError}`);
        }

        if (fieldConfig.enum && !fieldConfig.enum.includes(value)) {
            result.errors.push(`Field '${fieldName}' must be one of [${fieldConfig.enum.join(', ')}].`);
        }

        if (typeof value === 'string' && isPlaceholderValue(value)) {
            result.warnings.push(`Field '${fieldName}' contains a placeholder value ('${value}').`);
        }
    }

    for (const key of Object.keys(data || {})) {
        if (key === 'docId' || key === 'id') continue;
        if (!schemaFields[key]) {
            result.warnings.push(`Field '${key}' is not defined in the schema and will be stored as-is.`);
        }
    }

    return result;
}

function formatDiffValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

function diffObjects(existing = {}, updated = {}) {
    const diffs = [];
    if (!existing || !updated) return diffs;

    Object.keys(updated).forEach((key) => {
        if (key === 'docId' || key === 'id') return;
        if (!(key in existing)) return;
        const oldValue = existing[key];
        const newValue = updated[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            diffs.push({
                field: key,
                before: formatDiffValue(oldValue),
                after: formatDiffValue(newValue)
            });
        }
    });

    return diffs;
}

async function prepareAiEntriesForReview(entries = []) {
    if (!Array.isArray(entries)) return [];
    const review = new Array(entries.length);

    await Promise.all(entries.map(async (entry, index) => {
        const normalized = entry || {};
        const record = {
            collection: normalized.collection || '',
            data: normalized.data || {},
            meta: {
                allowed: normalized.collection ? userCanEditCollection(normalized.collection) : false,
                errors: [],
                warnings: [],
                diff: [],
                docId: null
            }
        };

        const validation = validateAiEntry(record.collection, record.data);
        record.meta.errors.push(...validation.errors);
        record.meta.warnings.push(...validation.warnings);

        const docId = record.data?.docId || record.data?.id || normalized.docId || null;
        if (docId) {
            record.meta.docId = docId;
            try {
                const snapshot = await db.collection(record.collection).doc(docId).get();
                if (snapshot.exists) {
                    const existingData = snapshot.data();
                    record.meta.diff = diffObjects(existingData, record.data);
                } else {
                    record.meta.errors.push(`No existing record found for ID '${docId}'.`);
                }
            } catch (error) {
                record.meta.warnings.push(`Unable to preview existing data: ${error.message}`);
            }
        }

        review[index] = record;
    }));

    return review;
}

function sanitizeDataPayload(data = {}) {
    const payload = { ...data };
    delete payload.docId;
    delete payload.id;
    return payload;
}

async function logAiAuditEvent(payload = {}) {
    try {
        await db.collection('ai_audit_logs').add({
            ...payload,
            loggedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.warn("AI audit log failed:", error);
    }
}

async function saveAiEntries(entries = [], meta = {}) {
    const report = { success: [], failed: [] };
    if (!Array.isArray(entries) || entries.length === 0) return report;

    const user = (() => {
        try {
            return JSON.parse(localStorage.getItem('currentUser') || '{}');
        } catch (error) {
            console.warn("Failed to parse currentUser during AI save:", error);
            return {};
        }
    })();

    for (const entry of entries) {
        const { collection, data } = entry || {};
        if (!collection || !data) {
            report.failed.push({ entry, reason: 'Missing collection or data.' });
            continue;
        }

        if (!userCanEditCollection(collection)) {
            report.failed.push({ entry, reason: `You do not have permission to modify '${collection}'.` });
            continue;
        }

        const validation = validateAiEntry(collection, data);
        if (validation.errors.length) {
            report.failed.push({ entry, reason: validation.errors.join(' | ') });
            continue;
        }

        const docId = data.docId || data.id || entry.docId || null;
        const payload = sanitizeDataPayload(data);
        let docRef = null;
        let action = 'create';
        let previousData = null;

        try {
            if (docId) {
                docRef = db.collection(collection).doc(docId);
                const existing = await docRef.get();
                if (!existing.exists) {
                    report.failed.push({ entry, reason: `Document '${docId}' not found for update.` });
                    continue;
                }
                previousData = existing.data();
                payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                await docRef.set(payload, { merge: true });
                action = 'update';
            } else {
                payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                docRef = await db.collection(collection).add(payload);
            }

            const savedId = docId || docRef.id;
            report.success.push({ collection, docId: savedId });

            await logAiAuditEvent({
                source: meta.source || 'unknown',
                collection,
                docId: savedId,
                action,
                payload,
                rawInput: meta.rawInput || '',
                attachments: meta.attachmentNames || [],
                validationWarnings: validation.warnings || [],
                userId: user?.uid || null,
                userRole: user?.role || getCurrentUserRole(),
                previousData
            });
        } catch (error) {
            report.failed.push({ entry, reason: error.message });
        }
    }

    return report;
}

// Configuration
// Keys are now managed in ai-features.js/localStorage.
const DEFAULT_GEMINI_KEY = '';

// Ensure marked.js is loaded
function ensureMarkedLib() {
    if (typeof marked === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
        document.head.appendChild(script);
    }
}

// Ensure DOMPurify is loaded for safe HTML rendering
function ensureSanitizer() {
    if (typeof DOMPurify === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js';
        document.head.appendChild(script);
    }
}

// Render markdown safely (or raw text) and sanitize HTML output
function renderSafeMarkdown(text) {
    ensureMarkedLib();
    ensureSanitizer();
    const rawHtml = (typeof marked !== 'undefined') ? marked.parse(text) : text;
    if (typeof DOMPurify !== 'undefined') {
        return DOMPurify.sanitize(rawHtml);
    }
    // Fallback: escape HTML if sanitizer is not yet loaded
    const tmp = document.createElement('div');
    tmp.textContent = text;
    return tmp.innerHTML;
}

async function ensureAIKeysLoaded() {
    try {
        const keysDoc = await db.collection('system_settings').doc('ai_keys').get();
        if (keysDoc.exists) {
            const keys = keysDoc.data();
            if (keys.gemini) localStorage.setItem('gemini_api_key', keys.gemini);
            if (keys.groq) localStorage.setItem('groq_api_key', keys.groq);
            if (keys.huggingface) localStorage.setItem('huggingface_api_key', keys.huggingface);
            if (keys.mistral) localStorage.setItem('mistral_api_key', keys.mistral);
            if (keys.xai) localStorage.setItem('xai_api_key', keys.xai);
        }
    } catch (e) {
        console.warn("Could not load system AI keys:", e);
    }
    try {
        const cfgDoc = await db.collection('system_settings').doc('ai_config').get();
        if (cfgDoc.exists) {
            const cfg = cfgDoc.data();
            const provider = cfg.provider || 'gemini';
            const model = cfg.model || (provider === 'gemini' ? 'gemini-2.5-flash' :
                provider === 'groq' ? 'llama-3.1-8b-instant' :
                provider === 'mistral' ? 'mistral-tiny' :
                provider === 'xai' ? 'grok-beta' :
                '');
            localStorage.setItem('ai_provider', provider);
            if (model) localStorage.setItem('ai_model', model);
        }
    } catch (e) {
        console.warn("Could not load AI config:", e);
    }
}

function initGlobalAI() {
    ensureMarkedLib();

    // Load Voice Commands Script
    if (!document.getElementById('voice-cmd-script')) {
        const script = document.createElement('script');
        script.id = 'voice-cmd-script';
        // Adjust path based on location (root or pages)
        const isPages = window.location.pathname.includes('/pages/');
        script.src = isPages ? '../../js/voice-commands.js' : 'js/voice-commands.js';
        document.head.appendChild(script);
    }

    ensureAIKeysLoaded(); // Fire and forget (or await if critical, but we don't want to block UI)
    injectFloatingBot();
}

/**
 * Unified AI Call Function supporting multiple providers
 * @param {string} prompt - The user prompt
 * @param {Array} attachments - Optional array of {mimeType, data} objects (base64)
 */
async function callGemini(prompt, attachments = []) {
    const provider = localStorage.getItem('ai_provider') || 'gemini';
    const model = localStorage.getItem('ai_model');

    try {
        switch (provider) {
            case 'gemini':
                return await callGoogleGemini(prompt, model, attachments);
            // Other providers might not support multimodal easily in this simple implementation
            // We'll just pass text for them
            case 'groq':
            case 'huggingface':
            case 'mistral':
            case 'xai':
                let fullPrompt = prompt;
                if (attachments.length > 0) {
                    fullPrompt += "\n\n[System Note: User attached files, but this provider only supports text. Warn the user.]";
                }
                // ... existing calls ...
                return await callOpenAICompatible(getProviderUrl(provider), fullPrompt, model, getProviderKey(provider));
            default:
                return await callGoogleGemini(prompt, model, attachments);
        }
    } catch (error) {
        console.error(`AI Error (${provider}):`, error);
        throw new Error(`${provider.toUpperCase()} Error: ${error.message}`);
    }
}

function getProviderUrl(provider) {
    const urls = {
        'groq': 'https://api.groq.com/openai/v1/chat/completions',
        'mistral': 'https://api.mistral.ai/v1/chat/completions',
        'xai': 'https://api.x.ai/v1/chat/completions',
        'huggingface': 'https://api-inference.huggingface.co/models/' // Special handling needed
    };
    return urls[provider];
}

function getProviderKey(provider) {
    return localStorage.getItem(`${provider}_api_key`);
}

async function callGoogleGemini(prompt, model, attachments = []) {
    const apiKey = localStorage.getItem('gemini_api_key') || DEFAULT_GEMINI_KEY;

    if (!apiKey) {
        throw new Error("Missing API Key. Please go to AI Features > Settings and enter your Gemini API Key.");
    }

    // Default to a vision-capable model if attachments are present
    let modelId = (model || 'gemini-2.5-flash').replace('models/', '');

    // User requested to trust the selected model and not force gemini-1.5
    // if (attachments.length > 0 && !modelId.includes('1.5') && !modelId.includes('vision')) {
    //     modelId = 'gemini-1.5-flash'; // Fallback to a multimodal model
    // }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const parts = [{ text: prompt }];

    // Add attachments (images/pdfs)
    attachments.forEach(att => {
        parts.push({
            inline_data: {
                mime_type: att.mimeType,
                data: att.data // base64 string
            }
        });
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: parts }]
        })
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || response.statusText);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("No response generated.");
    }
    return data.candidates[0].content.parts[0].text;
}

async function callOpenAICompatible(url, prompt, model, apiKey) {
    if (!apiKey) throw new Error("API Key missing for selected provider.");

    // Simple heuristic: If prompt looks like a raw string with newlines, treat as single user message.
    // If we wanted to support system prompts better, we'd need to parse or change signature.
    // For now, we wrap the whole text.

    const messages = [
        { role: "user", content: prompt }
    ];

    const body = {
        model: model,
        messages: messages,
        temperature: 0.7
    };

    // Special case adjustments if needed
    if (url.includes('mistral') && !model) body.model = 'mistral-tiny';
    if (url.includes('groq') && !model) body.model = 'llama-3.1-8b-instant';
    if (url.includes('x.ai') && !model) body.model = 'grok-beta';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`API Request Failed: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Floating Bot UI Injection
function injectFloatingBot() {
    if (document.getElementById('floating-bot-container')) return;

    // Styles (Modern & Glassmorphism)
    const style = document.createElement('style');
    style.textContent = `
        .floating-bot-trigger {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, var(--primary-color, #4f46e5), #818cf8);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(79, 70, 229, 0.4);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 9999;
        }
        .floating-bot-trigger:hover {
            transform: scale(1.1) rotate(5deg);
            box-shadow: 0 15px 35px rgba(79, 70, 229, 0.5);
        }
        .floating-bot-window {
            position: fixed;
            bottom: 6rem;
            right: 2rem;
            width: 380px;
            height: 600px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 1.5rem;
            box-shadow: 0 20px 50px rgba(0,0,0,0.15);
            display: none;
            flex-direction: column;
            z-index: 9999;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.5);
            animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .bot-header {
            background: linear-gradient(135deg, var(--primary-color, #4f46e5), #6366f1);
            color: white;
            padding: 1.2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .bot-header h3 { margin: 0; font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
        .close-bot { cursor: pointer; font-size: 1.5rem; opacity: 0.8; transition: opacity 0.2s; }
        .close-bot:hover { opacity: 1; }
        .bot-messages {
            flex: 1;
            padding: 1.2rem;
            overflow-y: auto;
            background: #f8fafc;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        .bot-input-area {
            padding: 1rem;
            background: white;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 0.75rem;
            align-items: flex-end;
        }
        .bot-input-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .bot-input-area input {
            width: 100%;
            padding: 0.75rem 1rem;
            border: 1px solid #e2e8f0;
            border-radius: 1.5rem;
            background: #f8fafc;
            transition: all 0.2s;
            font-size: 0.95rem;
        }
        .bot-input-area input:focus {
            outline: none;
            border-color: var(--primary-color);
            background: white;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
        }
        .bot-action-btn {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
            background: transparent;
            color: #64748b;
        }
        .bot-action-btn:hover { background: #f1f5f9; color: var(--primary-color); }
        .bot-send-btn {
            background: var(--primary-color, #4f46e5);
            color: white;
        }
        .bot-send-btn:hover { background: #4338ca; transform: scale(1.05); }
        
        .bot-action-btn.listening {
            color: #ef4444;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .bot-message {
            max-width: 85%;
            padding: 1rem;
            border-radius: 1rem;
            font-size: 0.95rem;
            line-height: 1.5;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            position: relative;
        }
        .bot-message.ai {
            background: white;
            border-bottom-left-radius: 0.2rem;
            margin-right: auto;
        }
        .bot-message.user {
            background: linear-gradient(135deg, var(--primary-color, #4f46e5), #6366f1);
            color: white;
            border-bottom-right-radius: 0.2rem;
            margin-left: auto;
        }
        .quick-actions {
            padding: 0.75rem;
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            border-bottom: 1px solid #e2e8f0;
            background: white;
            scrollbar-width: none;
        }
        .action-chip {
            background: #eef2ff;
            color: var(--primary-color);
            padding: 0.4rem 1rem;
            border-radius: 2rem;
            font-size: 0.8rem;
            cursor: pointer;
            white-space: nowrap;
            border: 1px solid transparent;
            transition: all 0.2s;
            font-weight: 500;
        }
        .action-chip:hover { 
            background: white; 
            border-color: var(--primary-color);
            transform: translateY(-1px);
        }
        /* Attachment Preview */
        .attachment-preview {
            display: flex;
            gap: 0.5rem;
            padding: 0.5rem 0;
            overflow-x: auto;
        }
        .preview-item {
            position: relative;
            width: 60px;
            height: 60px;
            border-radius: 0.5rem;
            overflow: hidden;
            border: 1px solid #e2e8f0;
            flex-shrink: 0;
        }
        .preview-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .preview-item .remove-btn {
            position: absolute;
            top: 2px;
            right: 2px;
            background: rgba(0,0,0,0.6);
            color: white;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // HTML Structure
    const container = document.createElement('div');
    container.id = 'floating-bot-container';
    const branding = (typeof getSchoolBranding === 'function') ? (getSchoolBranding() || {}) : {};
    const brandName = String(branding.name || document.querySelector('.sidebar-header h2')?.textContent || '').trim();
    const upperFirst = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
    const computeSectionLabel = () => {
        const path = String(window.location.pathname || '');
        const parts = path.split('/').filter(Boolean);
        const leafFile = parts.pop() || '';
        const leaf = leafFile.replace(/\.[^/.]+$/, '');
        const role = parts.includes('pages') ? (parts.pop() || '') : '';
        const h1 = String(document.querySelector('.page-title h1')?.textContent || '').trim();
        const labels = {
            dashboard: getTrans('dashboard') || 'Dashboard',
            settings: getTrans('settings') || 'Settings',
            integrations: getTrans('integrations') || 'Integrations',
            support: getTrans('support') || 'Support',
            timetable: getTrans('timetable') || 'Timetable',
            attendance: getTrans('attendance') || 'Attendance',
            'attendance-report': getTrans('attendance_report') || 'Attendance Report',
            classes: getTrans('classes') || 'Classes',
            subjects: getTrans('subjects') || 'Subjects',
            exams: getTrans('exams') || 'Exams',
            fees: getTrans('fees') || 'Fees',
            finance: getTrans('finance') || 'Finance',
            payroll: getTrans('payroll') || 'Payroll',
            library: getTrans('library') || 'Library',
            transport: getTrans('transport') || 'Transport',
            inventory: getTrans('inventory') || 'Inventory',
            reports: getTrans('reports') || 'Reports',
            users: getTrans('users') || 'Users',
            'ai-features': getTrans('ai_features') || 'AI Features',
            communication: getTrans('communication') || 'Communication',
            backup: getTrans('backup') || 'Backup',
            grades: getTrans('grades') || 'Grades',
            homework: getTrans('homework') || 'Homework',
            results: getTrans('results') || 'Results',
            portal: getTrans('portal') || 'Portal'
        };
        let label = labels[leaf] || h1 || '';
        if (/overview$/i.test(label)) label = label.replace(/overview$/i, '').trim();
        if (leaf === 'portal' && role) label = `${upperFirst(role)} ${labels.portal}`;
        if (!label) label = leaf.replace(/[-_]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) || (document.title || '').trim() || 'this page';
        return label;
    };
    const sectionName = computeSectionLabel();
    const pageLabel = brandName ? `${sectionName} - ${brandName}` : sectionName;
    const greetingText = `Assalam o Alekum! I'm here to help. I see you are on the ${pageLabel} page. How can I assist you?`;
    container.innerHTML = `
        <div class="floating-bot-trigger" onclick="toggleBot()">
            <span style="font-size: 1.8rem;">🤖</span>
        </div>
        <div class="floating-bot-window" id="botWindow">
            <div class="bot-header">
                <h3>🤖 ${getTrans('ai_assistant') || 'AI Assistant'}</h3>
                <span class="close-bot" onclick="toggleBot()">&times;</span>
            </div>
            <div class="quick-actions">
                <span class="action-chip" onclick="askBot('${getTrans('draft_email') || 'Draft Email'}')">📧 Email</span>
                <span class="action-chip" onclick="askBot('${getTrans('write_notice') || 'Notice'}')">📢 Notice</span>
                <span class="action-chip" onclick="askBot('${getTrans('summarize_page') || 'Summarize'}')">📝 Summary</span>
                <span class="action-chip" onclick="askBot('Help me with Data Entry')">⌨️ Data Entry</span>
            </div>
            <div class="bot-messages" id="botMessages">
                <div class="bot-message ai">
                    ${greetingText}
                </div>
            </div>
            <div class="bot-input-area">
                <input type="file" id="botFileUpload" multiple style="display: none;" onchange="handleBotFileSelect(event)">
                <button class="bot-action-btn" onclick="document.getElementById('botFileUpload').click()" title="Attach File">
                    📎
                </button>
                <button class="bot-action-btn" id="voiceTriggerBtn" onclick="startVoiceRecognition()" title="Voice Command">
                    🎙️
                </button>
                <div class="bot-input-wrapper">
                    <div id="botAttachmentPreview" class="attachment-preview" style="display: none;"></div>
                    <input type="text" id="botInput" placeholder="${getTrans('ask_anything') || 'Ask anything...'}" onkeypress="handleBotKey(event)">
                </div>
                <button class="bot-action-btn bot-send-btn" onclick="sendBotMessage()">
                    ➤
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(container);
}

// State for attachments
let currentBotAttachments = [];

function handleBotFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    const previewContainer = document.getElementById('botAttachmentPreview');
    previewContainer.style.display = 'flex';

    Array.from(files).forEach(file => {
        // Read file
        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Data = e.target.result.split(',')[1]; // Remove data URL prefix
            const mimeType = file.type;

            // Store attachment
            currentBotAttachments.push({
                mimeType: mimeType,
                data: base64Data,
                name: file.name
            });

            // Create preview
            const div = document.createElement('div');
            div.className = 'preview-item';

            if (mimeType.startsWith('image/')) {
                div.innerHTML = `<img src="${e.target.result}"><span class="remove-btn" onclick="removeBotAttachment('${file.name}', this)">×</span>`;
            } else {
                div.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:0.8rem;background:#eee;">📄</div><span class="remove-btn" onclick="removeBotAttachment('${file.name}', this)">×</span>`;
            }
            previewContainer.appendChild(div);
        };
        reader.readAsDataURL(file);
    });

    // Reset input
    event.target.value = '';
}

function removeBotAttachment(fileName, btnElement) {
    currentBotAttachments = currentBotAttachments.filter(a => a.name !== fileName);
    btnElement.parentElement.remove();
    if (currentBotAttachments.length === 0) {
        document.getElementById('botAttachmentPreview').style.display = 'none';
    }
}

function toggleBot() {
    const win = document.getElementById('botWindow');
    if (win.style.display === 'flex') {
        win.style.display = 'none';
    } else {
        win.style.display = 'flex';
        setTimeout(() => document.getElementById('botInput').focus(), 100);
    }
}

function handleBotKey(e) {
    if (e.key === 'Enter') sendBotMessage();
}

function askBot(text) {
    document.getElementById('botInput').value = text;
    sendBotMessage();
}

async function sendBotMessage() {
    const input = document.getElementById('botInput');
    const messages = document.getElementById('botMessages');
    const text = input.value.trim();
    const attachments = [...currentBotAttachments]; // Copy

    if (!text && attachments.length === 0) return;

    // User Message
    const userDiv = document.createElement('div');
    userDiv.className = 'bot-message user';
    let userContent = text;
    if (attachments.length > 0) {
        userContent += `<div style="margin-top:0.5rem;font-size:0.8rem;opacity:0.8;">📎 ${attachments.length} file(s) attached</div>`;
    }
    userDiv.innerHTML = userContent;
    messages.appendChild(userDiv);

    // Clear Input & Attachments
    input.value = '';
    currentBotAttachments = [];
    document.getElementById('botAttachmentPreview').innerHTML = '';
    document.getElementById('botAttachmentPreview').style.display = 'none';

    messages.scrollTop = messages.scrollHeight;

    // Loading
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'bot-message ai';
    loadingDiv.innerHTML = '<span class="typing-indicator">Thinking...</span>'; // We could add a nice CSS animation here
    messages.appendChild(loadingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
        const pageText = (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').substring(0, 3000);

        const pageContext = `
            Current Page: ${document.title}
            URL: ${window.location.href}
            User Role: ${document.getElementById('userRole')?.innerText || 'Unknown'}
            Page Content Snippet: ${pageText}...
        `;

        // Get Schema Context if available
        const schemaContext = typeof getSchemaSummary === 'function' ? getSchemaSummary() : '';

        const systemPrompt = `
            You are a helpful AI assistant embedded in a School Management System.
            
            CONTEXT:
            ${pageContext}

            ${schemaContext}
            
            INSTRUCTIONS:
            - Answer the user's request concisely.
            - If files are attached, analyze them to answer the user's question.
            - If asked to draft an email or notice, provide a professional template.
            - If asked about the page, explain its function based on the title and content provided.
            - If asked to summarize, use the provided Page Content Snippet.
            - **DATA ENTRY**: If the user wants to add/record data (e.g. "Add a new student", "Record leave"), YOU MUST:
              1. Extract the data according to the DATABASE SCHEMAS.
              2. Return the data as a JSON ARRAY of objects with 'collection' and 'data' keys.
              3. Do NOT wrap it in markdown code blocks if possible, or if you do, I will parse it.
              4. If required fields are missing, ask for them instead of generating JSON.
              5. Only output JSON when you are confident about field names, required values, and data types.
              
              Example JSON Output:
              [{"collection":"students","data":{"firstName":"Ali","lastName":"Khan","rollNumber":"123","className":"Class 10"}}]
        `;

        const response = await callGemini(systemPrompt + "\n\nUser: " + text, attachments);

        // Remove loading
        messages.removeChild(loadingDiv);

        // Check for Data Entry JSON
        const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
        let dataEntryJson = null;

        if (cleanResponse.startsWith('[') || cleanResponse.startsWith('{')) {
            try {
                const parsed = JSON.parse(cleanResponse);
                const arrayData = Array.isArray(parsed) ? parsed : [parsed];
                if (arrayData[0] && arrayData[0].collection && arrayData[0].data) {
                    dataEntryJson = arrayData;
                }
            } catch (e) {
                // Not valid JSON, treat as text
            }
        }

        const aiDiv = document.createElement('div');
        aiDiv.className = 'bot-message ai';

        if (dataEntryJson) {
            const reviewedEntries = typeof prepareAiEntriesForReview === 'function'
                ? await prepareAiEntriesForReview(dataEntryJson)
                : dataEntryJson.map(entry => ({ ...entry, meta: { allowed: true, errors: [], warnings: [], diff: [] } }));

            const hasBlockingIssues = reviewedEntries.some(entry => (entry.meta?.errors?.length || entry.meta?.allowed === false));
            const hasWarnings = reviewedEntries.some(entry => entry.meta?.warnings?.length);
            const attachmentNames = attachments.map(a => a.name);
            const rawAttr = encodeURIComponent(text || '');
            const attachmentsAttr = encodeURIComponent(JSON.stringify(attachmentNames));

            let cardHtml = `
                <div style="background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; font-size: 0.9rem;">
                    <div style="padding: 0.75rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                        <strong>✅ Proposed Action (${reviewedEntries.length})</strong>
                    </div>
                    <div style="padding: 0.75rem; max-height: 220px; overflow-y: auto;">
            `;
            reviewedEntries.forEach(item => {
                const meta = item.meta || { errors: [], warnings: [], diff: [], allowed: true };
                cardHtml += `
                    <div style="margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px dashed #e2e8f0;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <span style="color: var(--primary-color); font-weight: 600; font-size: 0.85rem;">${item.collection}</span>
                            <span style="font-size:0.7rem;color:#94a3b8;">${Object.keys(item.data || {}).length} fields</span>
                        </div>
                        <pre style="margin-top:0.5rem;background:#f1f5f9;padding:0.5rem;border-radius:0.4rem;font-size:0.7rem;white-space:pre-wrap;">${JSON.stringify(item.data, null, 2)}</pre>
                `;
                if (meta.diff && meta.diff.length) {
                    cardHtml += `
                        <div style="margin-top:0.4rem;font-size:0.75rem;color:#0f172a;">
                            <strong>Detected Changes:</strong>
                            <ul style="padding-left:1rem;margin:0.25rem 0;">
                                ${meta.diff.map(d => `<li>${d.field}: <span style="color:#ef4444;">${d.before}</span> → <span style="color:#10b981;">${d.after}</span></li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                if (meta.errors && meta.errors.length) {
                    cardHtml += `
                        <div style="margin-top:0.4rem; font-size:0.75rem; color:#dc2626;">
                            ⚠ ${meta.errors.join('<br>⚠ ')}
                        </div>
                    `;
                }
                if (meta.allowed === false) {
                    cardHtml += `
                        <div style="margin-top:0.4rem; font-size:0.75rem; color:#b91c1c;">
                            You do not have permission to modify the '${item.collection}' collection.
                        </div>
                    `;
                }
                if (meta.warnings && meta.warnings.length) {
                    cardHtml += `
                        <div style="margin-top:0.4rem; font-size:0.75rem; color:#b45309;">
                            🔎 ${meta.warnings.join('<br>🔎 ')}
                        </div>
                    `;
                }
                cardHtml += `</div>`;
            });
            cardHtml += `
                    </div>
                    <div style="padding: 0.75rem; background: #f1f5f9; display:flex;flex-direction:column;gap:0.5rem;">
                        ${hasBlockingIssues ? '<div style="color:#dc2626;font-size:0.8rem;">Resolve highlighted errors or ask the AI to regenerate the data.</div>' : ''}
                        ${hasWarnings ? '<div style="color:#b45309;font-size:0.8rem;">Review warnings carefully before confirming.</div>' : ''}
                        <div style="text-align:right;">
                            <button onclick='confirmBotDataEntry(this, ${JSON.stringify(dataEntryJson)})'
                                data-source="floating-bot"
                                data-raw="${rawAttr}"
                                data-attachments="${attachmentsAttr}"
                                style="background: var(--primary-color); color: white; border: none; padding: 0.4rem 0.9rem; border-radius: 0.4rem; cursor: pointer; font-size: 0.8rem;"
                                ${hasBlockingIssues ? 'disabled' : ''}>
                                ${hasBlockingIssues ? 'Fix Issues First' : 'Confirm & Save'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
            aiDiv.innerHTML = cardHtml;
        } else {
            // Normal Text Response
            aiDiv.innerHTML = renderSafeMarkdown(response);
        }

        messages.appendChild(aiDiv);
        messages.scrollTop = messages.scrollHeight;

    } catch (error) {
        loadingDiv.textContent = 'Error: ' + error.message;
        loadingDiv.style.color = 'red';
    }
}

async function confirmBotDataEntry(btn, dataEntries) {
    if (!dataEntries || !dataEntries.length) return;

    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = '...';

    try {
        const rawInput = decodeURIComponent(btn.dataset.raw || '');
        const attachments = btn.dataset.attachments
            ? JSON.parse(decodeURIComponent(btn.dataset.attachments))
            : [];
        const report = typeof saveAiEntries === 'function'
            ? await saveAiEntries(dataEntries, {
                source: btn.dataset.source || 'floating-bot',
                rawInput,
                attachmentNames: attachments
            })
            : { success: [], failed: [] };

        if (report.failed.length && !report.success.length) {
            throw new Error(report.failed[0].reason || 'Validation failed.');
        }

        const summary = [];
        if (report.success.length) summary.push(`Saved ${report.success.length} item(s)`);
        if (report.failed.length) summary.push(`Skipped ${report.failed.length}: ${report.failed.map(f => f.reason).join(' | ')}`);

        btn.parentElement.innerHTML = `<span style="color:${report.failed.length ? '#b45309' : '#16a34a'};">${summary.join(' | ')}</span>`;

    } catch (error) {
        console.error(error);
        btn.innerText = 'Error';
        alert("Failed to save: " + error.message);
        btn.disabled = false;
        btn.innerText = originalText;
    }
}
