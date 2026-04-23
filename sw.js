const CACHE_VERSION = 'v25';
const APP_CACHE = `sms-app-${CACHE_VERSION}`;
const RUNTIME_CACHE = `sms-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = 'offline.html';

const PRECACHE_URLS = [
  './',
  'index.html',
  'dashboard.html',
  'pages/admin/support.html',
  'pages/teacher/portal.html',
  'pages/student/portal.html',
  'pages/parent/portal.html',
  'pages/admin/attendance.html',
  'pages/teacher/attendance.html',
  'pages/teacher/grades.html',
  'pages/teacher/attendance-report.html',
  'pages/shared/teachers_diary.html',
  'pages/shared/model_lesson_plan.html',
  'pages/shared/assembly_responsibility.html',
  'pages/shared/daily_assembly_performance.html',
  'pages/shared/teacher_academic_quality_scorecard.html',
  'pages/shared/student_feedback.html',
  'pages/shared/hifz_progress_forms.html',
  OFFLINE_URL,
  'css/style.css',
  'js/firebase-config.js',
  'js/translations.js',
  'js/script.js',
  'js/teachers-diary.js',
  'js/model-lesson-plan.js',
  'js/assembly-responsibility.js',
  'js/daily-assembly-performance.js',
  'js/teacher-academic-quality-scorecard.js',
  'js/student-feedback.js',
  'js/hifz-progress-forms.js',
  'js/support.js',
  'manifest.json',
  'manifest.teacher.json',
  'manifest.student.json',
  'manifest.parent.json',
  'assets/logo.png',
  'assets/icon-192.png',
  'assets/icon-512.png'
];

const EXTERNAL_URLS = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.7.1/jspdf.plugin.autotable.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

async function precacheExternal(cache) {
  await Promise.allSettled(EXTERNAL_URLS.map(async (url) => {
    try {
      const request = new Request(url, { mode: 'no-cors' });
      const response = await fetch(request);
      if (response) await cache.put(request, response);
    } catch (e) { /* ignore */ }
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const appCache = await caches.open(APP_CACHE);
    await appCache.addAll(PRECACHE_URLS);

    const runtimeCache = await caches.open(RUNTIME_CACHE);
    await precacheExternal(runtimeCache);

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== APP_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

function shouldBypassCaching(url) {
  const host = url.hostname || '';
  if (host.endsWith('googleapis.com')) return true; // Firestore/Auth/AI APIs
  if (host.endsWith('firebaseio.com')) return true;
  if (host.endsWith('firebasedatabase.app')) return true;
  return false;
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const appCache = await caches.open(APP_CACHE);
    return appCache.match(OFFLINE_URL);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (shouldBypassCaching(url)) return;

  // HTML navigations: network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    // App JS/CSS change frequently; prefer fresh network with offline fallback
    if (['script', 'style'].includes(request.destination)) {
      event.respondWith(networkFirst(request));
      return;
    }
    event.respondWith(cacheFirst(request));
    return;
  }

  // Cross-origin scripts/styles/images/fonts: cache-first (opaque responses supported)
  if (['script', 'style', 'image', 'font'].includes(request.destination)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request));
});

self.addEventListener('notificationclick', (event) => {
  try {
    event.notification?.close?.();
  } catch (e) { /* ignore */ }

  const rawUrl = event.notification?.data?.url;
  if (!rawUrl) return;
  let targetUrl = rawUrl;
  try {
    targetUrl = new URL(rawUrl, self.registration.scope).toString();
  } catch (e) { /* ignore */ }

  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsArr) {
      try {
        if (client.url === targetUrl && 'focus' in client) {
          await client.focus();
          return;
        }
      } catch (e) { /* ignore */ }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});

// Optional: Firebase Cloud Messaging background notifications (requires VAPID key on the client).
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyB0oPTLEYuNiWCx5s9GmZzGzyH1z-HXwb8",
    authDomain: "onlineadmission-f85c6.firebaseapp.com",
    projectId: "onlineadmission-f85c6",
    storageBucket: "onlineadmission-f85c6.firebasestorage.app",
    messagingSenderId: "996707362986",
    appId: "1:996707362986:web:fea98a07bea032ff7e48d3",
    measurementId: "G-6H910NXDM1"
  });

  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    try {
      const title = payload?.notification?.title || payload?.data?.title || 'Notification';
      const body = payload?.notification?.body || payload?.data?.body || '';
      const icon = 'assets/icon-192.png';
      const url = (() => {
        const raw = payload?.data?.url || 'dashboard.html';
        try { return new URL(raw, self.registration.scope).toString(); } catch (e) { return raw; }
      })();

      self.registration.showNotification(title, {
        body,
        icon,
        data: { url }
      });
    } catch (e) { /* ignore */ }
  });
} catch (e) {
  // ignore: push will simply be unavailable
}
