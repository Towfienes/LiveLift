#!/usr/bin/env node
// V7 LIVE intelligence: browser acceptance. Tooling only; every product interaction uses the real UI and production routes.
// Needs: Node 22.23.3, npm ci, npm run build, an external Playwright (NODE_PATH), Chromium and OpenSSL.
//   node acceptance/live-intelligence-browser.mjs        (LIVELIFT_BROWSER_EVIDENCE=<dir> keeps screenshots, CHROMIUM_PATH picks Chromium)
// The provider-core server routes do not exist in this branch, so REAL-show provider answers are served by this script
// (a test double, labelled as such); the SIMULATED path uses the UI's own deterministic fixtures.
/* global document */
import assert from 'node:assert/strict';
import console from 'node:console';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { app, startRuntime } from './final-runtime.mjs';

const WIDTHS = [[375, 667], [768, 900], [1440, 900]];

/** A small, honest provider snapshot for one ended show: one real zero, holes, no attribution. A test double, never "fixture". */
export function snapshotFor(session, provider = 'tiktok_shop') {
  const start = session.runtime.startedAtMs, end = session.runtime.endedAtMs;
  const g0 = Math.floor(start / 60_000) * 60_000;
  const count = Math.max(1, Math.ceil((end - g0) / 60_000));
  const minuteBuckets = Array.from({ length: count }, (_, i) => ({
    startMs: g0 + i * 60_000, endMs: g0 + (i + 1) * 60_000, viewers: 100 + i, clicks: i === 0 ? 0 : null, orders: 1 + i, gmv: null,
  }));
  return {
    sessionId: session.id, mode: session.environment, perspective: 'later_evidence', provider, providerSessionId: 'ACCEPTANCE-DOUBLE-1',
    fetchedAt: end + 3_600_000, currency: 'VND', minuteBuckets, segmentAttributions: [], productPerformance: [],
    evidenceLimits: [{ text: 'Raw LIVE chat text is not available from the official API.' }], reconciliationVersion: 'acceptance-1',
  };
}

async function journey(browser, runtime, width, height, report, output) {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  const errors = [], httpErrors = [];
  let authenticated = false, mode = 'none', latestSessions = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', response => {
    if (response.status() < 400) return;
    const route = new URL(response.url()).pathname;
    const expected = (!authenticated && route === '/api/v3/auth/session' && response.status() === 401)
      || (route.startsWith('/api/v3/live-intelligence/') && response.status() === 404 && mode === 'none');
    if (!expected) httpErrors.push({ route, status: response.status() });
  });
  await page.route('**/api/v3/room?*', async route => {
    const response = await route.fetch();
    try { const body = await response.json(); if (body.sessions) latestSessions = body.sessions; } catch { /* not JSON */ }
    await route.fulfill({ response });
  });
  await page.route('**/api/v3/live-intelligence/**', async route => {
    const url = route.request().url();
    if (mode === 'none') return route.continue();
    const json = (status, body, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) });
    if (url.endsWith('/capabilities')) return json(200, { capabilities: [{ key: 'shop_analytics', state: 'access_not_granted', note: null }] });
    const session = latestSessions.find(s => url.includes(`/sessions/${s.id}`));
    if (mode === 'access_not_granted') return json(200, { status: 'access_not_granted' });
    if (mode === 'rate_limited') return json(429, { error: { code: 'rate_limited', message: 'slow down' } }, { 'retry-after': '75' });
    return json(200, { status: 'available', snapshot: snapshotFor(session, mode === 'fixture-for-real' ? 'fixture' : 'tiktok_shop') });
  });
  const tid = id => page.getByTestId(id);
  const check = async (name, fn) => {
    try { await fn(); report.checks.push({ width, name, status: 'PASS' }); console.log(`PASS ${width} ${name}`); }
    catch (error) { report.checks.push({ width, name, status: 'FAIL', error: error.message }); console.error(`FAIL ${width} ${name}: ${error.message.split('\n')[0]}`); await page.screenshot({ path: path.join(output, `${width}-FAIL-${name.replace(/\W+/g, '-')}.png`) }).catch(() => {}); }
  };
  const noOverflow = async name => {
    const d = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    assert.equal(d.scroll, d.client, `${name}: horizontal overflow ${d.scroll} > ${d.client}`);
  };
  const ready = () => page.waitForFunction(() => document.querySelector('[data-testid=later-evidence-view]')?.getAttribute('data-state') !== 'fetching', null, { timeout: 15_000 });

  await page.goto(runtime.origin + '/login');
  await page.getByLabel('Username').fill(runtime.credentials.username);
  await page.getByLabel('Password', { exact: true }).fill(runtime.credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await tid('account-name').waitFor({ state: 'attached' });
  authenticated = true;

  // ---- SIMULATED: Review, both perspectives ------------------------------------------------------------------------
  const review = runtime.origin + '/live/sim-buffered-done/review';
  await check('known-then is the default and carries no provider data', async () => {
    await page.goto(review);
    await tid('perspective-switch').waitFor();
    assert.equal(await tid('perspective-known').getAttribute('aria-selected'), 'true');
    assert.equal(await tid('evidence-timeline').count(), 0);
    assert.match(await tid('provider-then-note').textContent(), /none recorded in LiveLift/);
    await tid('known-then-replay').waitFor();
    await noOverflow('review known');
  });
  let historyBefore = 0;
  await check('later evidence leads with the disclosure and is visibly a fixture', async () => {
    historyBefore = await page.locator('[data-testid="review-history"] li').count();
    await tid('perspective-known').focus();
    await page.keyboard.press('ArrowRight'); // keyboard: arrows switch
    await tid('later-evidence-view').waitFor();
    assert.equal(await tid('perspective-later').getAttribute('aria-selected'), 'true');
    assert.match(await tid('later-evidence-disclosure').textContent(), /This data was not available to the operator during the LIVE\./);
    assert.match(await tid('fixture-banner').textContent(), /FIXTURE PROVIDER EVIDENCE/);
    assert.equal(await tid('later-evidence-view').getAttribute('data-origin'), 'fixture');
    await noOverflow('review later');
  });
  await check('missing is not zero, in the chart and the attribution', async () => {
    await tid('fixture-select').selectOption('zero_clicks');
    await tid('metric-clicks').check({ force: true });
    const zero = await page.locator('[data-testid=evidence-chart] [data-minute]').evaluateAll(es => es.map(e => e.getAttribute('data-state')));
    assert(zero.length > 5 && zero.every(s => s === 'zero'), 'zero clicks must be drawn as zero');
    await tid('fixture-select').selectOption('missing_clicks');
    await tid('metric-clicks').check({ force: true });
    assert.match(await tid('metric-missing-note').textContent(), /This is not zero\./);
    assert.equal(await tid('evidence-chart').count(), 0, 'a missing metric must not draw an empty chart');
    const cells = await page.locator('[data-testid^="attribution-"][data-coverage] [data-metric="clicks"] [data-state]').evaluateAll(es => es.map(e => [e.getAttribute('data-state'), e.textContent]));
    assert(cells.length > 0 && cells.every(([s, t]) => s === 'missing' && t === 'Not recorded'));
    await noOverflow('missing clicks');
  });
  await check('an ambiguous boundary minute is shown and assigned to neither segment', async () => {
    await tid('fixture-select').selectOption('ambiguous');
    await tid('key-boundary').waitFor();
    assert((await page.locator('[data-minute][data-boundary="true"]').count()) > 0);
    const row = page.locator('[data-testid^="attribution-"][data-coverage="ambiguous"]').first();
    const id = (await row.getAttribute('data-testid')).replace('attribution-', '');
    await tid(`attribution-toggle-${id}`).click();
    assert.match(await tid(`ambiguous-${id}`).textContent(), /Not assigned to either/);
  });
  await check('every provider state is its own plain statement', async () => {
    for (const [scenario, kind] of [['not_configured', 'not_configured'], ['access_not_granted', 'access_not_granted'], ['auth_expired', 'auth_expired'], ['rate_limited', 'rate_limited'], ['unavailable', 'unavailable']]) {
      await tid('fixture-select').selectOption(scenario);
      assert.equal(await tid('provider-state').getAttribute('data-kind'), kind);
      assert.match(await tid('provider-state').textContent(), /never shown as 0/);
    }
    await noOverflow('provider states');
  });
  await check('switching perspectives never changes the recorded history', async () => {
    await tid('fixture-select').selectOption('rich');
    await tid('perspective-known').click();
    await tid('review-summary').waitFor();
    assert.equal(await page.locator('[data-testid="review-history"] li').count(), historyBefore);
  });

  // ---- SIMULATED: Operate quick report -----------------------------------------------------------------------------
  await check('a quick report is an operator-reported note, keyboard first', async () => {
    await page.goto(runtime.origin + '/live/sim-buffered/prepare');
    await tid('start-live-cta-btn').click();
    if (await tid('start-keep-planned').isVisible().catch(() => false)) await tid('start-keep-planned').click();
    await page.waitForURL(/operate/);
    await tid('quick-report-btn').click();
    await tid('quick-report-panel').waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await tid('command-ack-banner').waitFor();
    assert.match(await tid('command-ack-banner').textContent(), /CTA delivered \(operator-reported quick cue\)/);
    assert.equal(await tid('quick-report-panel').count(), 0, 'the panel closes after a report');
    await noOverflow('operate');
  });

  // ---- SIMULATED: Insights and Integrations ------------------------------------------------------------------------
  await check('Insights keeps operations and platform evidence apart; fixtures need an explicit opt-in', async () => {
    await page.goto(runtime.origin + '/insights');
    await tid('insights').waitFor();
    await page.getByLabel('Environment').selectOption('SIMULATED');
    assert.match(await tid('platform-evidence').textContent(), /Unavailable: no provider-observed/);
    assert.equal(await tid('fixture-banner').count(), 0);
    await tid('platform-evidence-request').click();
    await tid('fixture-banner').waitFor();
    await tid('segment-attribution').waitFor();
    await tid('product-performance').waitFor();
    await noOverflow('insights');
  });
  await check('Integrations states what TikTok does and does not offer', async () => {
    await page.goto(runtime.origin + '/integrations');
    await tid('provider-evidence-access').waitFor();
    assert.equal(await tid('capability-raw_chat').getAttribute('data-state'), 'unsupported');
    assert.equal(await tid('capability-pin_control').getAttribute('data-state'), 'unsupported');
    assert.equal(await tid('capability-creator_realtime').getAttribute('data-state'), 'partner_access_required');
    await noOverflow('integrations');
  });

  // ---- REAL: created and ended through the UI; provider answers come from this script ------------------------------
  await check('REAL show with no provider says so, and shows no fixture or numbers', async () => {
    await page.goto(runtime.origin + '/live/new');
    await tid('start-template').check({ force: true });
    await page.getByLabel(/Session title/).fill('REAL V7 acceptance');
    await tid('submit-create-live-btn').click();
    await page.waitForURL(/\/prepare/);
    await tid('start-live-cta-btn').click();
    if (await tid('start-keep-planned').isVisible().catch(() => false)) await tid('start-keep-planned').click();
    await page.waitForURL(/operate/);
    await tid('quick-report-btn').click();
    await tid('quick-cue-price_questions').click();
    await tid('command-ack-banner').waitFor();
    await page.waitForTimeout(1200);
    await tid('end-live-header-btn').click();
    await page.getByRole('button', { name: 'End tracking' }).click();
    await page.waitForURL(/review/);
    await tid('perspective-later').click();
    await tid('later-evidence-view').waitFor();
    await ready();
    assert.equal(await tid('later-evidence-view').getAttribute('data-state'), 'not_configured');
    assert.equal(await tid('fixture-banner').count() + await tid('fixture-select').count() + await tid('evidence-timeline').count(), 0);
    report.realUrl = page.url().replace(/\?.*$/, '');
    await noOverflow('real not configured');
  });
  await check('REAL provider snapshot is provider-observed, never a fixture; fixture data for a REAL show is refused', async () => {
    mode = 'provider';
    await page.goto(report.realUrl + '?perspective=later');
    await tid('evidence-timeline').waitFor();
    const origin = await tid('later-evidence-view').getAttribute('data-origin');
    assert.equal(origin, 'provider', `data-origin was ${origin}`);
    assert.equal(await tid('fixture-banner').count(), 0);
    assert.match(await tid('later-evidence-disclosure').textContent(), /not available to the operator during the LIVE/);
    await tid('metric-clicks').check({ force: true }); // one recorded 0 and nothing else: the picker does not default to it
    const first = await page.locator('[data-testid=evidence-chart] [data-minute]').first().getAttribute('data-state');
    assert.equal(first, 'zero', `the recorded clicks 0 was drawn as ${first}`);
    await tid('metric-gmv').check({ force: true });
    assert.match(await tid('metric-missing-note').textContent(), /This is not zero\./);
    await noOverflow('real provider');
    await tid('perspective-known').click();
    await tid('review-summary').waitFor();
    assert.equal(await tid('evidence-timeline').count(), 0, 'As known then shows no provider data');
    mode = 'fixture-for-real';
    await page.goto(report.realUrl + '?perspective=later');
    await page.waitForFunction(() => document.querySelector('[data-testid=later-evidence-view]')?.getAttribute('data-state') === 'unavailable');
    assert.match(await tid('provider-state').textContent(), /fixture or SIMULATED evidence for a REAL show/);
    assert.equal(await tid('evidence-timeline').count(), 0);
  });
  await check('REAL access-not-granted and rate-limited answers are their own states', async () => {
    for (const m of ['access_not_granted', 'rate_limited']) {
      mode = m;
      await page.goto(report.realUrl + '?perspective=later');
      // `idle` is the instant before the request starts; wait for the answer itself.
      await page.waitForFunction(want => document.querySelector('[data-testid=later-evidence-view]')?.getAttribute('data-state') === want, m, { timeout: 15_000 });
      assert.equal(await tid('later-evidence-view').getAttribute('data-state'), m);
    }
    mode = 'access_not_granted';
    await page.goto(runtime.origin + '/integrations');
    await page.waitForFunction(() => document.querySelector('[data-testid=capability-shop_analytics]')?.getAttribute('data-state') === 'access_not_granted');
  });
  await check('REAL Insights fetches evidence only when asked, and offers no fixture', async () => {
    mode = 'provider';
    const sessionCalls = [];
    page.on('request', r => { if (/live-intelligence\/sessions\//.test(r.url())) sessionCalls.push(r.url()); });
    await page.goto(runtime.origin + '/insights');
    await tid('insights').waitFor();
    await page.waitForTimeout(600);
    assert.equal(sessionCalls.length, 0, 'nothing is fetched before the operator asks');
    assert.equal(/fixture/i.test(await tid('platform-evidence').textContent()), false);
    await tid('platform-evidence-request').click();
    await tid('evidence-timeline').waitFor();
    assert.equal(await tid('platform-evidence-body').getAttribute('data-state'), 'available');
  });
  // A refused or rate-limited answer is a non-2xx the product handles on purpose: those are the test double's own 429s.
  await check('no runtime exceptions or unexpected HTTP errors', async () => { assert.deepEqual(errors, []); assert.deepEqual(httpErrors.filter(e => !(e.status === 429 && e.route.startsWith('/api/v3/live-intelligence/'))), []); });
  await context.close();
}

export async function main() {
  if (process.argv.includes('--help')) {
    console.log('Node 22.23.3: node acceptance/live-intelligence-browser.mjs\nRequires npm ci, npm run build, external Playwright (NODE_PATH), Chromium and OpenSSL.\nLIVELIFT_BROWSER_EVIDENCE selects the evidence directory; CHROMIUM_PATH selects Chromium.');
    return;
  }
  assert.equal(process.versions.node, '22.23.3', 'Use Node 22.23.3');
  assert(fs.existsSync(path.join(app, '.next/BUILD_ID')), 'Run npm run build first');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const output = process.env.LIVELIFT_BROWSER_EVIDENCE || fs.mkdtempSync(path.join(os.tmpdir(), 'livelift-v7-ui-'));
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const report = { result: 'FAIL', checks: [], output };
  let browser, runtime;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    runtime = await startRuntime('fixture', output);
    for (const [width, height] of WIDTHS) await journey(browser, runtime, width, height, report, output);
    report.result = report.checks.length > 0 && report.checks.every(c => c.status === 'PASS') ? 'PASS' : 'FAIL';
  } finally {
    await runtime?.stop(); await browser?.close();
    fs.writeFileSync(path.join(output, 'v7-results.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  }
  console.log(`V7 LIVE INTELLIGENCE BROWSER ACCEPTANCE: ${report.result} (${report.checks.filter(c => c.status === 'PASS').length}/${report.checks.length})\nEvidence: ${output}`);
  if (report.result !== 'PASS') process.exitCode = 1;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
