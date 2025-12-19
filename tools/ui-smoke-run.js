const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const PORT = 5173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts', 'ui-smoke');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function contentType(filePath) {
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
}

function safeNameFromPath(p) {
  return String(p)
    .replace(/^\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'root';
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function startStaticServer() {
  const rootDir = process.cwd();
  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', BASE_URL);
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

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  ensureDir(ARTIFACT_DIR);

  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);

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

  const run = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    results: [],
    consoleMessages: [],
    pageErrors: [],
    requestFailures: []
  };

  page.on('console', (msg) => {
    run.consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 2000) });
  });
  page.on('pageerror', (err) => {
    run.pageErrors.push(String(err?.message || err).slice(0, 2000));
  });
  page.on('requestfailed', (req) => {
    run.requestFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText || 'failed'
    });
  });

  for (const p of targets) {
    const url = `${BASE_URL}${p}`;
    const entry = { url, path: p, status: null, finalUrl: null, title: null, screenshot: null, error: null };
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded' });
      entry.status = resp ? resp.status() : null;
      await sleep(900);
      entry.finalUrl = page.url();
      entry.title = await page.title().catch(() => '');

      const shot = path.join(ARTIFACT_DIR, `${safeNameFromPath(p)}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => null);
      entry.screenshot = shot;
    } catch (e) {
      entry.error = String(e?.message || e);
      try {
        const shot = path.join(ARTIFACT_DIR, `${safeNameFromPath(p)}_error.png`);
        await page.screenshot({ path: shot, fullPage: true }).catch(() => null);
        entry.screenshot = shot;
      } catch (err) {
        // ignore
      }
    }
    run.results.push(entry);
  }

  run.finishedAt = new Date().toISOString();
  const outPath = path.join(ARTIFACT_DIR, 'results.json');
  fs.writeFileSync(outPath, JSON.stringify(run, null, 2));

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const failures = run.results.filter(r => r.status !== 200 || r.error);
  console.log(`UI smoke done. Pages: ${run.results.length}, failures: ${failures.length}`);
  console.log(`Artifacts: ${outPath}`);
  if (failures.length) {
    for (const f of failures) console.log(`FAIL: ${f.path} status=${f.status} error=${f.error || ''} final=${f.finalUrl || ''}`);
    process.exitCode = 2;
  }
  if (run.pageErrors.length) {
    console.log(`JS page errors: ${run.pageErrors.length}`);
    for (const pe of run.pageErrors.slice(0, 10)) console.log(`PAGEERROR: ${pe}`);
    process.exitCode = 3;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

