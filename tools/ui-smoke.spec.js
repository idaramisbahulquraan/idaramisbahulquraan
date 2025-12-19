const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts', 'ui-smoke');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function waitForHttpOk(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`));
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) return resolve(res.statusCode);
        setTimeout(tick, 300);
      });
      req.on('error', () => setTimeout(tick, 300));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function safeNameFromUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

let server = null;

test.beforeAll(async () => {
  ensureDir(ARTIFACT_DIR);

  const rootDir = process.cwd();
  const contentType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') return 'text/html; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.png') return 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.ico') return 'image/x-icon';
    return 'application/octet-stream';
  };

  server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let pathname = decodeURIComponent(url.pathname || '/');
      if (pathname === '/') pathname = '/index.html';

      const abs = path.resolve(rootDir, `.${pathname}`);
      if (!abs.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType(abs) });
      fs.createReadStream(abs).pipe(res);
    } catch (e) {
      res.writeHead(500);
      res.end('Server Error');
    }
  });

  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

  await waitForHttpOk(`${BASE_URL}/manifest.json`);
});

test.afterAll(async () => {
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
  } catch (e) {
    // ignore
  }
});

test('UI smoke: pages load and render', async ({ page }) => {
  const targets = [
    '/index.html',
    '/dashboard.html',
    '/pages/admin/settings.html',
    '/pages/admin/integrations.html',
    '/pages/admin/support.html',
    '/pages/teacher/portal.html',
    '/pages/student/portal.html',
    '/pages/parent/portal.html',
    '/offline.html',
    '/manifest.json',
    '/manifest.teacher.json',
    '/manifest.student.json',
    '/manifest.parent.json',
    '/sw.js'
  ];

  const results = [];
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text().slice(0, 2000)
    });
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.message || err).slice(0, 2000));
  });
  page.on('requestfailed', (req) => {
    requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'failed'
    });
  });

  for (const p of targets) {
    const url = `${BASE_URL}${p}`;
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const status = resp ? resp.status() : null;

    // Let late JS errors show up.
    await page.waitForTimeout(800);

    const finalUrl = page.url();
    const title = await page.title().catch(() => '');
    const name = safeNameFromUrl(p);
    const shotPath = path.join(ARTIFACT_DIR, `${name}.png`);

    // Some URLs are JS/JSON and will not "render" much; still screenshot for evidence.
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => null);

    results.push({ url, status, finalUrl, title, screenshot: shotPath });
  }

  fs.writeFileSync(path.join(ARTIFACT_DIR, 'results.json'), JSON.stringify({ results, consoleMessages, pageErrors, requestFailures }, null, 2));

  // Basic assertions: all targets return 200 (or redirect to a 200 page).
  for (const r of results) {
    expect(r.status, `Bad HTTP status for ${r.url} (final: ${r.finalUrl})`).toBe(200);
  }

  // We don't fail the run on console errors because Firebase may log warnings in some environments.
  // But we do fail on JS runtime exceptions.
  expect(pageErrors, `Page runtime errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
});
