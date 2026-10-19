// Deployment Console: runs the blue-green release steps, watches live traffic, and rolls back when needed.
const express = require('express');
const fs = require('fs');
const path = require('path');

const BLUE = process.env.BLUE_URL || 'http://blue:3000';
const GREEN = process.env.GREEN_URL || 'http://green:3000';
const ROUTER = process.env.ROUTER_URL || 'http://router:80';
const SHARED = process.env.SHARED_DIR || '/shared';
const PORT = process.env.PORT || 9000;
const PROBE_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];   // product pages checked during monitoring
const ROUNDS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toLocaleTimeString('en-GB');
const STEPS = [['health', 'Health check on Green'], ['smoke', 'Smoke tests on Green'], ['switch', 'Switch traffic to Green'],
  ['monitor', 'Monitor live traffic'], ['decision', 'Decision']];

const fresh = () => ({ live: 'blue', busy: false, steps: STEPS.map(([id, name]) => ({ id, name, status: 'pending', detail: '' })),
  logs: [], history: [], seq: 0, alarm: false, rollback: null,
  monitor: { probes: 0, errors: 0, rate: null, failing: [] },
  config: { bug: false, autoRollback: true, threshold: 5 } });
let S = fresh();

const log = (level, msg) => { S.logs.push({ t: now(), level, msg }); if (S.logs.length > 80) S.logs.shift(); console.log(`[${level}] ${msg}`); };
const step = (id, status, detail = '') => { const s = S.steps.find((x) => x.id === id); s.status = status; s.detail = detail; };

async function get(url, ms = 3000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    let json = null; try { json = await r.json(); } catch (e) { /* not json */ }
    return { ok: r.ok, status: r.status, json };
  } catch (e) { return { ok: false, status: 0, json: null, error: e.message }; }
}
async function post(url, body) {
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000) }); return r.ok; }
  catch (e) { return false; }
}

// Writes the Nginx route file. The router container notices the change and reloads Nginx.
async function writeRoute(env) {
  fs.mkdirSync(SHARED, { recursive: true });
  fs.writeFileSync(path.join(SHARED, 'route.conf'), `location / {\n    proxy_pass http://${env}:3000;\n    proxy_set_header Host $host;\n}\n`);
  for (let i = 0; i < 15; i++) {
    const r = await get(ROUTER + '/api/info', 1500);
    if (r.ok && r.json && r.json.data.environment === env) return true;
    await sleep(700);
  }
  return false;
}
const setBug = (enabled) => post(GREEN + '/api/_fault', { enabled });

function blockStep(id, reason, dep) {
  step(id, 'failed', reason);
  let after = false;
  for (const s of S.steps) { if (after && s.status === 'pending') s.status = 'skipped'; if (s.id === id) after = true; }
  dep.result = 'BLOCKED'; dep.reason = reason;
  log('error', `Deployment BLOCKED: ${reason}. Users stay on Blue.`);
}

async function doRollback(reason, auto, evidence) {
  log('warn', auto ? 'AUTO-ROLLBACK: switching users back to Blue...' : 'ROLLBACK: switching users back to Blue...');
  const okRoute = await writeRoute('blue');
  S.live = 'blue'; S.alarm = false;
  const dep = S.history[0];
  if (dep && ['RUNNING', 'SUCCESS', 'DEGRADED'].includes(dep.result)) { dep.result = 'ROLLED BACK'; dep.reason = reason; }
  else S.history.unshift({ id: ++S.seq, time: now(), from: 'GREEN v2.0', to: 'BLUE v1.0', result: 'ROLLED BACK', reason });
  const m = S.monitor, explain = [];
  if (evidence) {
    explain.push(`After traffic moved to Green, the monitor sent ${m.probes} test requests through the router.`);
    explain.push(`${m.errors} of them failed with HTTP 500: an error rate of ${m.rate}% against a limit of ${S.config.threshold}%.`);
    explain.push(`Every failure was a product-detail page (product IDs ${m.failing.join(', ')}). Green v2.0 has a hidden bug in the new discount calculation, which fails for products with a discount of 20% or more.`);
    explain.push('The basic health check and the smoke test passed because they never opened those products. Only real traffic exposed the bug.');
    explain.push(auto ? 'Because the error rate is above the limit, the console rolled back automatically.' : 'The operator started the rollback after seeing the alarm.');
  } else explain.push('The operator chose to send users back to Blue.');
  explain.push('Result: Nginx now sends users to Blue v1.0 again. Green keeps running so developers can investigate.');
  S.rollback = { time: now(), reason, auto, explain };
  step('decision', 'failed', 'Rolled back to Blue');
  log(okRoute ? 'ok' : 'warn', okRoute ? 'Rollback complete. Users are on BLUE v1.0.' : 'Route written, waiting for Nginx to confirm.');
}

async function deploy() {
  if (S.busy) throw new Error('A deployment is already running');
  if (S.live !== 'blue') throw new Error('Green is already live. Roll back or reset first');
  S.busy = true; S.rollback = null; S.alarm = false;
  S.steps = STEPS.map(([id, name]) => ({ id, name, status: 'pending', detail: '' }));
  S.monitor = { probes: 0, errors: 0, rate: null, failing: [] };
  const dep = { id: ++S.seq, time: now(), from: 'BLUE v1.0', to: 'GREEN v2.0', result: 'RUNNING', reason: '' };
  S.history.unshift(dep);
  log('info', `Deployment #${dep.id} started: release Green v2.0 (Blue v1.0 is live)`);
  try {
    step('health', 'running'); await sleep(900);
    const h = await get(GREEN + '/health');
    if (!h.ok) return blockStep('health', 'Green is not healthy (no response from /health)', dep);
    step('health', 'passed', 'GET /health returned 200'); log('ok', 'Green health check passed');

    step('smoke', 'running'); await sleep(1000);
    const info = await get(GREEN + '/api/info'), list = await get(GREEN + '/api/products'), one = await get(GREEN + '/api/products/1');
    const count = info.json && info.json.data.attributeCount;
    if (!info.ok || count !== 9 || !list.ok || !list.json.data.length || !one.ok)
      return blockStep('smoke', 'Smoke test failed (wrong version or API error)', dep);
    step('smoke', 'passed', `v2.0, ${count} attributes, ${list.json.data.length} products, product page OK`); log('ok', `Smoke tests passed (${count} attributes)`);

    step('switch', 'running'); log('info', 'Pointing Nginx at Green...');
    const sw = await writeRoute('green');
    if (!sw) { await writeRoute('blue'); return blockStep('switch', 'Nginx did not switch to Green', dep); }
    S.live = 'green'; step('switch', 'passed', 'Users now reach Green'); log('ok', 'Traffic switched: users are on GREEN v2.0');

    step('monitor', 'running', 'Watching real traffic...'); log('info', `Monitoring: ${PROBE_IDS.length * ROUNDS} test requests through the router`);
    const bad = new Set();
    for (let r = 0; r < ROUNDS; r++) for (const id of PROBE_IDS) {
      const res = await get(`${ROUTER}/api/products/${id}`, 2500);
      S.monitor.probes++;
      if (res.status >= 500 || res.status === 0) { S.monitor.errors++; bad.add(id); }
      S.monitor.rate = Math.round((S.monitor.errors / S.monitor.probes) * 1000) / 10;
      S.monitor.failing = [...bad].sort((a, b) => a - b);
      await sleep(110);
    }
    const m = S.monitor;
    if (m.rate > S.config.threshold) {
      step('monitor', 'failed', `Error rate ${m.rate}% is above ${S.config.threshold}%`);
      log('error', `Error rate ${m.rate}% (${m.errors}/${m.probes}) is above the ${S.config.threshold}% limit`);
      const reason = `Error rate ${m.rate}% exceeded the ${S.config.threshold}% limit (HTTP 500 on product pages ${m.failing.join(', ')})`;
      if (S.config.autoRollback) await doRollback(reason, true, true);
      else { S.alarm = true; dep.result = 'DEGRADED'; dep.reason = reason; step('decision', 'failed', 'Alarm: waiting for operator'); log('error', 'ALARM: auto-rollback is OFF. Click "Rollback to Blue".'); }
    } else {
      step('monitor', 'passed', `Error rate ${m.rate}% (limit ${S.config.threshold}%)`);
      step('decision', 'passed', 'Deployment successful'); dep.result = 'SUCCESS'; dep.reason = `Error rate ${m.rate}% within limit`;
      log('ok', 'Deployment successful: Green v2.0 is live and healthy');
    }
  } catch (e) { log('error', 'Unexpected error: ' + e.message); dep.result = 'FAILED'; dep.reason = e.message; }
  finally { S.busy = false; }
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const ok = (res, data) => res.json({ success: true, data });
const fail = (res, code, message) => res.status(code).json({ success: false, error: { message } });

app.get('/api/state', async (req, res) => {
  const [b, g] = await Promise.all([get(BLUE + '/api/info', 900), get(GREEN + '/api/info', 900)]);
  const env = (r) => r.ok && r.json ? { up: true, ...r.json.data } : { up: false };
  ok(res, { ...S, envs: { blue: env(b), green: env(g) } });
});
app.post('/api/config', async (req, res) => {
  const b = req.body || {};
  if (S.busy) return fail(res, 409, 'Wait until the deployment finishes');
  if (typeof b.autoRollback === 'boolean') S.config.autoRollback = b.autoRollback;
  if (typeof b.bug === 'boolean') {
    S.config.bug = b.bug;
    const done = await setBug(b.bug);
    log(done ? 'info' : 'warn', done ? `Release scenario: ${b.bug ? 'Green contains a hidden bug' : 'Green is a healthy release'}` : 'Could not reach Green to change the scenario');
  }
  ok(res, S.config);
});
app.post('/api/deploy', (req, res) => {
  if (S.busy) return fail(res, 409, 'A deployment is already running');
  if (S.live !== 'blue') return fail(res, 409, 'Green is already live. Roll back or reset first');
  deploy(); ok(res, { started: true });
});
app.post('/api/rollback', async (req, res) => {
  if (S.busy) return fail(res, 409, 'Wait until the deployment finishes');
  if (S.live !== 'green') return fail(res, 409, 'Blue is already live');
  await doRollback(S.alarm && S.history[0] ? S.history[0].reason : 'Manual rollback requested by the operator', false, S.alarm);
  ok(res, { live: S.live });
});
app.post('/api/reset', async (req, res) => {
  if (S.busy) return fail(res, 409, 'Wait until the deployment finishes');
  await setBug(false); await writeRoute('blue'); S = fresh(); log('info', 'Demo reset: Blue v1.0 is live'); ok(res, { live: 'blue' });
});
app.get('/api/compare', (req, res) => ok(res, {
  attributes: ['Product ID', 'Product Name', 'Price', 'Category', 'Stock Quantity', 'Brand', 'Product Rating', 'Discount Percentage', 'Product Description']
    .map((name, i) => ({ no: i + 1, name, blue: i < 5, green: true })),
  options: [['Search by name', 1, 1], ['Category filter', 1, 1], ['Brand filter', 0, 1], ['Sort by price / rating / discount', 0, 1], ['In-stock filter', 0, 1],
    ['Discount pricing', 0, 1], ['Star ratings', 0, 1], ['Quick view', 0, 1], ['Add to cart', 0, 1]].map(([name, b, g]) => ({ name, blue: !!b, green: !!g })),
  layout: { blue: 'Classic table list, simple blue header, 4-input add form', green: 'Modern card grid, hero banner, filter sidebar, cart, 8-input add form' } }));

app.listen(PORT, () => { console.log('Deployment Console on port ' + PORT); log('info', 'Console ready. Blue v1.0 is live.'); setTimeout(() => { setBug(false); writeRoute('blue').catch(() => {}); }, 3000); });
