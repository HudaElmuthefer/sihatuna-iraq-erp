// scripts/lighthouse-all.js
//
// Audits every route of the frontend with Lighthouse (desktop preset)
// against a locally served build, and prints/saves a results table.
//
// Protected routes need an authenticated session. This script logs in once
// through the real login form (reusing the browser's cookies/localStorage
// for every subsequent route, exactly like a real logged-in user directly
// opening or refreshing any of those URLs) instead of hitting the login API
// directly, so the measured pages see the exact same app bootstrap a real
// user would.
//
// Credentials are read from environment variables — never hardcode them:
//   LIGHTHOUSE_TEST_USERNAME
//   LIGHTHOUSE_TEST_PASSWORD
//
// Usage:
//   LIGHTHOUSE_TEST_USERNAME=... LIGHTHOUSE_TEST_PASSWORD=... \
//     node scripts/lighthouse-all.js [--out=lighthouse-report-before.json] [--base=http://localhost:3000]
//
// Requires the app already built and served at --base (see README notes in
// the project for `npm run build` + `npx serve -s build -l 3000`).

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const lighthouse = require('lighthouse');

// Every route currently defined in src/App.js (both public and the ones
// nested under the protected <Layout> route). Kept as a plain list here
// rather than parsed from App.js at runtime, so this script has no
// dependency on the router's JSX shape — update this list if routes change.
const ROUTES = [
  { path: '/login', label: 'Login', auth: false },
  { path: '/queue-display', label: 'Queue Display (public)', auth: false },
  { path: '/', label: 'Dashboard', auth: true },
  { path: '/patients', label: 'Patients', auth: true },
  { path: '/medical-codes', label: 'Medical Codes', auth: true },
  { path: '/doctors', label: 'Doctors', auth: true },
  { path: '/appointments', label: 'Appointments', auth: true },
  { path: '/departments', label: 'Departments', auth: true },
  { path: '/services', label: 'Personal Services', auth: true },
  { path: '/ai-diagnosis', label: 'AI Diagnosis', auth: true },
  { path: '/crm', label: 'Patient CRM', auth: true },
  { path: '/vaccinations', label: 'Vaccinations', auth: true },
  { path: '/wards', label: 'Wards', auth: true },
  { path: '/delivery', label: 'Delivery Room', auth: true },
  { path: '/physiotherapy', label: 'Physiotherapy', auth: true },
  { path: '/queue', label: 'Queue Management', auth: true },
  { path: '/drug-interactions', label: 'Drug Interactions', auth: true },
  { path: '/dosage-check', label: 'Dosage Check', auth: true },
  { path: '/allergy-check', label: 'Allergy Check', auth: true },
  { path: '/medical-leave', label: 'Medical Leave', auth: true },
  { path: '/accounts', label: 'Accounts & Finance', auth: true },
  { path: '/inventory', label: 'Inventory', auth: true },
  { path: '/payment-settings', label: 'Payment Settings', auth: true },
  { path: '/billing', label: 'Billing & Payment', auth: true },
  { path: '/procurement', label: 'Procurement', auth: true },
  { path: '/billing-anomaly', label: 'Billing Anomaly Detection', auth: true },
  { path: '/inventory-prediction', label: 'Inventory Prediction', auth: true },
  { path: '/hr', label: 'Human Resources', auth: true },
  { path: '/projects', label: 'Projects', auth: true },
  { path: '/documents', label: 'Document Control', auth: true },
  { path: '/quality', label: 'Quality (ISO)', auth: true },
  { path: '/laboratory', label: 'Laboratory', auth: true },
  { path: '/results', label: 'Lab & Radiology Results', auth: true },
  { path: '/radiology', label: 'Radiology & Imaging', auth: true },
  { path: '/pharmacy', label: 'Pharmacy', auth: true },
  { path: '/ambulance', label: 'Ambulance & Vehicles', auth: true },
  { path: '/assets', label: 'Medical Assets', auth: true },
  { path: '/smart-reports', label: 'Reports & Analytics', auth: true },
  { path: '/settings', label: 'Settings', auth: true },
];

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChromeExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('No Chrome/Edge executable found in the usual install locations. Set CHROME_PATH to override.');
}

function parseArgs(argv) {
  const args = { base: 'http://localhost:3000', out: 'lighthouse-report-before.json' };
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key && value !== undefined) args[key] = value;
  }
  return args;
}

// --only=/path1,/path2 restricts the run to specific routes — useful for a
// quick smoke test, or for re-checking just the pages touched by one fix
// without re-running the entire (slow) full-site sweep.
function filterRoutes(routes, onlyArg) {
  if (!onlyArg) return routes;
  const wanted = new Set(onlyArg.split(',').map(s => s.trim()));
  const filtered = routes.filter(r => wanted.has(r.path));
  if (filtered.length === 0) throw new Error(`--only matched no routes: ${onlyArg}`);
  return filtered;
}

async function login(page, baseUrl, username, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle2', timeout: 60000 });

  // The username/password fields come pre-filled with demo values
  // ('admin'/'admin'), and a plain click-to-select + type doesn't reliably
  // replace a React-controlled input's existing value — it can end up
  // appending instead. Setting .value through the native input setter and
  // dispatching a real 'input' event is what React's onChange actually
  // listens for, so this reliably replaces the field's content.
  const setReactInputValue = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
  await page.$eval('input[autocomplete="username"]', setReactInputValue, username);
  await page.$eval('input[autocomplete="current-password"]', setReactInputValue, password);

  // This is a client-side (React Router) redirect after login, not a real
  // browser navigation — there's no document load event to wait on, so
  // poll the URL instead of using page.waitForNavigation().
  await page.click('.la-submit');
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 });

  // Confirm the app actually sees us as logged in (not still on /login after
  // a failed attempt) before auditing any protected route.
  const url = page.url();
  if (url.includes('/login')) {
    throw new Error('Login did not redirect away from /login — check LIGHTHOUSE_TEST_USERNAME/LIGHTHOUSE_TEST_PASSWORD.');
  }
}

function extractRow(route, lhr) {
  if (!lhr) return { route: route.path, label: route.label, error: 'no result' };
  const audits = lhr.audits;
  return {
    route: route.path,
    label: route.label,
    performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
    accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((lhr.categories['best-practices']?.score ?? 0) * 100),
    seo: Math.round((lhr.categories.seo?.score ?? 0) * 100),
    tbtMs: Math.round(audits['total-blocking-time']?.numericValue ?? 0),
    lcpMs: Math.round(audits['largest-contentful-paint']?.numericValue ?? 0),
    cls: Number((audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
    totalBytes: Math.round(audits['total-byte-weight']?.numericValue ?? 0),
    domElements: Math.round(audits['dom-size-insight']?.numericValue ?? 0),
  };
}

function printTable(rows) {
  const headers = ['Route', 'Perf', 'A11y', 'BP', 'SEO', 'TBT (ms)', 'LCP (ms)', 'CLS', 'Payload (KiB)', 'DOM'];
  const widths = [28, 5, 5, 5, 5, 9, 9, 6, 14, 6];
  const pad = (s, w) => String(s).padEnd(w);
  console.log(headers.map((h, i) => pad(h, widths[i])).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-|-'));
  for (const r of rows) {
    if (r.error) {
      console.log(pad(r.route, widths[0]) + ' | ERROR: ' + r.error);
      continue;
    }
    console.log([
      pad(r.route, widths[0]),
      pad(r.performance, widths[1]),
      pad(r.accessibility, widths[2]),
      pad(r.bestPractices, widths[3]),
      pad(r.seo, widths[4]),
      pad(r.tbtMs, widths[5]),
      pad(r.lcpMs, widths[6]),
      pad(r.cls, widths[7]),
      pad(Math.round(r.totalBytes / 1024), widths[8]),
      pad(r.domElements, widths[9]),
    ].join(' | '));
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const baseUrl = args.base;
  const outPath = path.resolve(process.cwd(), args.out);

  const routes = filterRoutes(ROUTES, args.only);
  const username = process.env.LIGHTHOUSE_TEST_USERNAME;
  const password = process.env.LIGHTHOUSE_TEST_PASSWORD;
  const needsAuth = routes.some(r => r.auth);
  if (needsAuth && (!username || !password)) {
    console.error('Set LIGHTHOUSE_TEST_USERNAME and LIGHTHOUSE_TEST_PASSWORD to audit protected routes.');
    process.exit(1);
  }

  const executablePath = process.env.CHROME_PATH || findChromeExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1350, height: 940 },
  });

  const results = [];
  try {
    const page = await browser.newPage();

    const auditRoute = async (route) => {
      const url = `${baseUrl}${route.path}`;
      process.stdout.write(`Auditing ${route.path} ... `);
      try {
        const flow = await lighthouse.startFlow(page, {
          config: lighthouse.desktopConfig,
          name: route.label,
        });
        await flow.navigate(url);
        const flowResult = await flow.createFlowResult();
        const lhr = flowResult.steps[0]?.lhr;
        results.push(extractRow(route, lhr));
        console.log('done.');
      } catch (err) {
        console.log('FAILED.');
        results.push({ route: route.path, label: route.label, error: err.message });
      }
    };

    // Public routes are audited first, before logging in — /login
    // specifically redirects straight to "/" once a session exists
    // (see App.js: `user ? <Navigate to="/" /> : <LoginPage />`), so
    // auditing it with an authenticated page would silently measure the
    // dashboard instead of the login page.
    for (const route of routes.filter(r => !r.auth)) {
      await auditRoute(route);
    }

    if (needsAuth) {
      console.log(`Logging in as ${username}...`);
      await login(page, baseUrl, username, password);
      console.log('Logged in.');
    }

    for (const route of routes.filter(r => r.auth)) {
      await auditRoute(route);
    }
  } finally {
    await browser.close();
  }

  console.log('\nResults:\n');
  printTable(results);

  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, results }, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
