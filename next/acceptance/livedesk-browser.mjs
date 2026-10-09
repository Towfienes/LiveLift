#!/usr/bin/env node
/* global document, window, localStorage, getComputedStyle */
import assert from 'node:assert/strict';
import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { app, startRuntime } from './final-runtime.mjs';

const forbidden = /synced with Shopee|connected to Shopee|confirmed by Shopee|Create LIVE/i;
const viewports = [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 390, height: 844 }];
const surfaces = ['desk-clock', 'desk-products', 'desk-viewers', 'desk-viewers-chart', 'desk-cart-chart', 'desk-comments', 'desk-copilot', 'desk-phone', 'desk-assumptions'];

export function assertHonest(text, size) {
  assert(!forbidden.test(text), 'Forbidden claim or Create LIVE in the new flow');
  assert(size.scroll <= size.client + 1, `Horizontal overflow: ${size.scroll} > ${size.client}`);
}

function selfTest() {
  assertHonest('SIMULATED Shopee Live', { client: 390, scroll: 390 });
  assert.throws(() => assertHonest('connected to Shopee', { client: 390, scroll: 390 }));
  assert.throws(() => assertHonest('Create LIVE', { client: 390, scroll: 390 }));
  assert.throws(() => assertHonest('SIMULATED', { client: 390, scroll: 392 }));
  console.log('LIVE DESK HARNESS SELF-CHECK: PASS');
}

async function journey(browser, runtime, viewport, run, axePath, report, output, stub) {
  const label = `${viewport.width}x${viewport.height}-run${run}`;
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport, reducedMotion: run === 2 ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(10_000);
  const id = name => page.getByTestId(name);
  const shot = name => page.screenshot({ path: path.join(output, `${label}-${name}.png`), fullPage: true });
  const audit = async state => {
    await page.addScriptTag({ path: axePath });
    // Let colour transitions settle: axe would otherwise measure a button halfway between its enabled and disabled colours.
    await page.waitForTimeout(500);
    const axe = await page.evaluate(() => window.axe.run(document));
    const violations = axe.violations.map(({ id, impact, nodes }) => ({ id, impact, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }));
    report.axe.push({ label, state, violations, incomplete: axe.incomplete.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })) });
    assert.deepEqual(violations, [], `${label}/${state}: axe violations`);
    const text = await page.locator('body').innerText();
    const size = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    runtime.assertNoSecrets(text);
    assertHonest(text, size);
    report.layout.push({ label, state, ...size });
    if (await id('live-desk').count()) for (const surface of surfaces) assert.match(await id(surface).innerText(), /SIMULATED/, `${surface} label`);
    const smallTargets = await page.locator('[data-testid="livedesk-frame"] button, [data-testid="livedesk-frame"] select, [data-testid="livedesk-frame"] summary').evaluateAll(elements => elements
      .filter(element => !element.closest('[inert]') && element.getBoundingClientRect().width > 0)
      .map(element => ({ text: element.textContent.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))
      .filter(box => box.width < 44 || box.height < 44));
    assert.deepEqual(smallTargets, [], 'Targets smaller than 44px');
    report.checks.push({ label, state, status: 'PASS' });
  };
  try {
    await page.goto(runtime.origin + '/');
    await id('home-flow').waitFor();
    await audit('home');
    await page.goto(runtime.origin + '/legacy');
    await id('legacy-links').waitFor();
    await audit('legacy');
    await page.goto(runtime.origin + '/start');
    await id('start-flow').waitFor();
    if (await id('start-connect').isEnabled()) {
      await id('start-connect').click();
      await page.waitForFunction(() => document.querySelector('[data-testid="start-connect"]')?.disabled);
    } else if (stub) report.skipped.push({ label, step: 'Connect transition', reason: 'Stub starts connected; Connect is disabled.' });
    await id('start-sample').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="start-products"] [data-testid^="desk-product-"]').length > 0 && !document.querySelector('[data-testid="start-live"]')?.disabled);
    if (stub) report.skipped.push({ label, step: 'Import transition', reason: 'Sample action is a no-op; products were already in the fixture.' });
    await audit('start');
    await shot('start');
    await id('desk-lang-vi').click();
    assert.equal(await id('livedesk-frame').getAttribute('lang'), 'vi');
    assert.equal(await page.evaluate(() => localStorage.getItem('livelift.lab.lang')), 'vi');
    await audit('start-vi');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-testid="livedesk-frame"]')?.getAttribute('lang') === 'vi');
    await id('desk-lang-en').click();
    await id('start-live').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const focus = await id('start-live').evaluate(element => ({ focused: document.activeElement === element, outline: getComputedStyle(element).outlineStyle }));
    assert(focus.focused && focus.outline !== 'none', 'Visible keyboard focus');
    await id('start-live').click();
    if (stub) {
      await page.getByText('Live did not start.', { exact: false }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/start');
      report.skipped.push({ label, step: 'Start → Run → pin/unpin/pin → Accept → End state transitions', reason: 'onStartLive returns null. Desk below is direct fixture rendering; every desk action is a no-op.' });
      await page.goto(runtime.origin + '/desk/fixture');
    } else await page.waitForURL(url => url.pathname.startsWith('/desk/'));
    await id('live-desk').waitFor();
    await audit('desk-suggestion');
    await shot('desk-suggestion');
    await id('desk-lang-vi').click();
    await audit('desk-vi');
    await id('desk-lang-en').click();
    if (!stub) {
      await page.clock.install({ time: new Date('2026-10-09T00:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-09T00:00:01Z'));
    }
    await id('desk-run').click();
    if (!stub) {
      await page.clock.runFor(1000);
      await id('desk-pause').click();
      await page.clock.resume();
    }
    const pins = page.locator('[data-testid^="desk-pin-"]:enabled');
    assert(await pins.count() > 0, 'A synced product must be pinnable');
    const pinId = await pins.first().getAttribute('data-testid');
    const productId = pinId.replace('desk-pin-', 'desk-product-');
    const showing = id(productId).getByText('Showing (SIMULATED)', { exact: false });
    await id(pinId).click();
    if (!stub) await showing.waitFor();
    await id('desk-unpin').click();
    if (!stub) await showing.waitFor({ state: 'hidden' });
    await id(pinId).click();
    if (!stub) await showing.waitFor();
    if (!stub) {
      await id('desk-skip-300').click();
      await page.locator('[data-testid^="desk-accept-"]:enabled').first().waitFor();
    }
    const accept = page.locator('[data-testid^="desk-accept-"]:enabled').first();
    await accept.click();
    if (!stub) await page.waitForFunction(() => [...document.querySelectorAll('[data-testid^="desk-suggestion-"]')].some(element => /Accepted|Performed/.test(element.textContent)));
    await audit('desk-after-actions');
    await id('desk-end').click();
    if (!stub) await page.waitForFunction(() => document.querySelector('[data-testid="live-desk"]')?.getAttribute('data-mode') === 'ended');
    const fingerprint = await id('desk-fingerprint').innerText();
    await audit(stub ? 'desk-end-no-op' : 'desk-ended');
    await shot('final');
    assert.deepEqual(errors, [], 'Browser runtime errors');
    report.runs.push({ label, fingerprint, transitionsVerified: !stub, errors });
    return fingerprint;
  } catch (error) {
    report.failures.push({ label, error: error.message });
    await shot('failure');
    console.error(`FAIL ${label}: ${error.message}`);
    return null;
  } finally { await context.close(); }
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Run npm run build, then node acceptance/livedesk-browser.mjs [--self-test].\nExternal tools: Playwright via NODE_PATH, axe-core 4.13.0 via AXE_PATH or NODE_PATH.\nLocal HTTPS production runtime. Evidence is temporary; set LIVEDESK_EVIDENCE_DIR to retain it.\nFixture hooks produce PARTIAL, never a completed flow. No app dependency is added.');
    return;
  }
  selfTest();
  if (process.argv.includes('--self-test')) return;
  const output = process.env.LIVEDESK_EVIDENCE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'livedesk-browser-'));
  fs.mkdirSync(output, { recursive: true });
  const report = { result: 'FAIL', axe: [], layout: [], checks: [], runs: [], skipped: [], failures: [] };
  let browser, runtime;
  try {
    assert(fs.existsSync(path.join(app, '.next/BUILD_ID')), 'Run npm run build first');
    const dependency = createRequire(import.meta.url);
    const { chromium } = dependency('playwright');
    const axePath = process.env.AXE_PATH || dependency.resolve('axe-core/axe.min.js');
    const version = fs.readFileSync(axePath, 'utf8').match(/axe v([\d.]+)/)?.[1];
    assert.equal(version, '4.13.0', 'Use the brief’s pinned axe-core 4.13.0');
    report.tools = { axe: version, playwright: dependency('playwright/package.json').version };
    const stub = /view: fixture(Start|Desk)View\(\)/.test(fs.readFileSync(path.join(app, 'src/lib/livedesk/hooks.ts'), 'utf8'));
    report.stub = stub;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
    runtime = await startRuntime('not-configured', output);
    for (const viewport of viewports) {
      const first = await journey(browser, runtime, viewport, 1, axePath, report, output, stub);
      const second = await journey(browser, runtime, viewport, 2, axePath, report, output, stub);
      assert(first !== null && first === second, `${viewport.width}x${viewport.height}: fingerprints differ or run failed`);
      console.log(`PASS ${viewport.width}x${viewport.height}: ${first} / ${second}${stub ? ' (fixture only)' : ''}`);
    }
    runtime.verifyPrivateArtifacts();
    report.result = stub ? 'PARTIAL (fixture hooks)' : 'PASS';
  } catch (error) { report.failures.push({ error: error.message }); }
  finally {
    await runtime?.stop();
    await browser?.close();
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`LIVE DESK BROWSER: ${report.result}; ${report.runs.length} runs; ${report.axe.length} axe states; ${report.failures.length} failures\nEvidence: ${output}`);
  if (report.result === 'FAIL') process.exitCode = 1;
}

await main();
