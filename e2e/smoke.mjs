// Gradio Pipelines Directory — E2E smoke test
//
// Boots a headless Chrome against the local static server, walks the
// three pages, and verifies the things the user explicitly asked for:
//   1. index.html loads and renders the 24 tool cards
//   2. Filtering by a category shrinks the grid
//   3. Search filters the grid
//   4. Opening a card opens the detail modal with the deploy command
//   5. The deploy command matches the real Gradio CLI contract:
//      clone + cd + HF_TOKEN=… gradio deploy (no --token / --repo flags,
//      which the CLI has never accepted), plus the HF token settings URL
//   6. tester.html loads with the tool picker + command line
//   7. tester.html's #cmd-preview shows the full gradio deploy command
//   8. No JS errors anywhere
//
// Exit 0 on pass, non-zero on fail. Captures pass.png / fail.png.

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Resolve puppeteer from this project first, then fall back to a sibling
// checkout that already has it. A hard-coded absolute path into an unrelated
// repo breaks the moment that repo moves or is deleted.
async function loadPuppeteer() {
  const candidates = [
    'puppeteer',
    'puppeteer-core',
    path.join(ROOT, 'node_modules/puppeteer'),
    path.join(ROOT, '../gradio-hub/node_modules/puppeteer'),
    path.join(ROOT, '../gradio-directory/node_modules/puppeteer'),
  ];
  for (const c of candidates) {
    try {
      const mod = require(c);
      return mod.default ?? mod;
    } catch {}
  }
  throw new Error(
    'puppeteer not found. Run `npm install` in this folder, ' +
      'or install it in ../gradio-hub.'
  );
}
const puppeteer = await loadPuppeteer();

const BASE = process.env.E2E_URL || 'http://127.0.0.1:8765';
const ARTIFACTS = path.dirname(new URL(import.meta.url).pathname) + '/artifacts';
await fs.mkdir(ARTIFACTS, { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];

function pass(msg) { console.log('  ✅', msg); }
function fail(msg) { console.log('  ❌', msg); failures.push(msg); }
function info(msg) { console.log('  ·', msg); }

const failures = [];
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (u.includes('favicon')) return;
    failedRequests.push(`${u} :: ${r.failure()?.errorText}`);
  });

  // ============================================================
  // 1. index.html — directory
  // ============================================================
  console.log('\n[1/3] index.html — directory page');
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.card-grid .card', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 400));

  const cardCount = await page.$$eval('.card-grid .card', (els) => els.length);
  if (cardCount >= 20) pass(`rendered ${cardCount} tool cards`);
  else fail(`expected >=20 tool cards, got ${cardCount}`);

  const resultCount = await page.$eval('#result-count', (n) => n.textContent.trim()).catch(() => '');
  if (resultCount && /\d/.test(resultCount)) pass(`result counter shows: ${resultCount}`);
  else fail(`result counter empty: "${resultCount}"`);

  // Category filters (actual selector: [data-cat])
  const catFilters = await page.$$eval('[data-cat]', (els) => els.length);
  if (catFilters >= 5) pass(`sidebar has ${catFilters} category filters`);
  else fail(`expected >=5 category filters, got ${catFilters}`);

  // Search
  await page.click('#search');
  await page.type('#search', 'whisper', { delay: 20 });
  await new Promise((r) => setTimeout(r, 400));
  const afterSearchCount = await page.$$eval('.card-grid .card', (els) => els.length);
  if (afterSearchCount > 0 && afterSearchCount < cardCount) {
    pass(`search "whisper" → ${afterSearchCount} cards (was ${cardCount})`);
  } else {
    fail(`search "whisper" did not filter (was ${cardCount}, now ${afterSearchCount})`);
  }
  await page.click('#search', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await new Promise((r) => setTimeout(r, 300));

  // Click a category filter
  const firstCat = await page.$('[data-cat]');
  if (firstCat) {
    const catId = await firstCat.evaluate((n) => n.dataset.cat);
    await firstCat.click();
    await new Promise((r) => setTimeout(r, 400));
    const afterCatCount = await page.$$eval('.card-grid .card', (els) => els.length);
    if (afterCatCount > 0 && afterCatCount < cardCount) {
      pass(`category "${catId}" → ${afterCatCount} cards (was ${cardCount})`);
    } else {
      fail(`category "${catId}" did not filter (was ${cardCount}, now ${afterCatCount})`);
    }
    const clearBtn = await page.$('#filter-clear');
    if (clearBtn) await clearBtn.click();
    await new Promise((r) => setTimeout(r, 300));
  } else {
    fail('no clickable category filter found');
  }

  // Open detail modal — click first card
  const firstCard = await page.$('.card-grid .card');
  if (firstCard) {
    await firstCard.click();
    await new Promise((r) => setTimeout(r, 500));
    const modalState = await page.evaluate(() => {
      const m = document.getElementById('modal');
      if (!m) return { found: false };
      const visible = !m.hidden && m.classList.contains('is-open');
      const cmd = document.getElementById('deploy-cmd');
      const cmdText = cmd ? cmd.textContent : '';
      const html = m.innerHTML;
      return {
        found: true,
        visible,
        cmdText,
        hasDeployCmd: cmdText.includes('gradio deploy'),
        hasClone: cmdText.includes('git clone'),
        hasCd: cmdText.includes('cd '),
        hasTokenEnv: cmdText.includes('HF_TOKEN='),
        hasTokenPlaceholder: cmdText.includes('YOUR_HF_TOKEN') || cmdText.includes('$HF_TOKEN'),
        hasSettingsLink: html.includes('huggingface.co/settings/tokens'),
      };
    });
    if (modalState.found && modalState.visible) pass('detail modal opens on card click');
    else fail(`detail modal did not open (found=${modalState.found}, visible=${modalState.visible})`);
    if (modalState.hasDeployCmd) pass(`modal deploy command: "${modalState.cmdText.slice(0, 80)}…"`);
    else fail('modal deploy command missing `gradio deploy`');
    // The Gradio CLI only accepts --title / --app-file / --provider and always
    // deploys the current directory, so the command must clone + cd + pass the
    // token via HF_TOKEN. It must NOT use --token / --repo.
    if (modalState.hasClone) pass('modal deploy command clones the repo first');
    else fail('modal deploy command does not clone the repo');
    if (modalState.hasCd) pass('modal deploy command cds into the cloned repo');
    else fail('modal deploy command does not cd into the cloned repo');
    if (modalState.hasTokenEnv) pass('modal deploy command passes the token via HF_TOKEN');
    else fail('modal deploy command does not pass the token via HF_TOKEN');
    if (!modalState.cmdText.includes('--token') && !modalState.cmdText.includes('--repo')) {
      pass('modal deploy command uses no invalid CLI flags (--token/--repo)');
    } else {
      fail('modal deploy command still uses --token/--repo, which the Gradio CLI does not accept');
    }
    if (modalState.hasTokenPlaceholder) pass('modal contains the HF_TOKEN placeholder');
    else fail('modal missing the HF_TOKEN placeholder');
    if (modalState.hasSettingsLink) pass('modal links to huggingface.co/settings/tokens');
    else fail('modal missing the link to huggingface.co/settings/tokens');

    // Test the copy button
    const copyBtn = await page.$('#deploy-copy');
    if (copyBtn) {
      await page.evaluate(() => {
        // Stub clipboard so we don't get a permission error
        if (!navigator.clipboard) {
          navigator.clipboard = { writeText: async () => {} };
        }
        window.__clipboard = '';
        navigator.clipboard.writeText = async (t) => { window.__clipboard = t; };
      });
      await copyBtn.click();
      await new Promise((r) => setTimeout(r, 200));
      const copied = await page.evaluate(() => window.__clipboard);
      if (copied && copied.includes('gradio deploy') && copied.includes('YOUR_HF_TOKEN')) {
        pass('copy button puts the deploy command (with YOUR_HF_TOKEN) on the clipboard');
      } else {
        fail(`copy button did not put a valid command on clipboard (got: "${copied.slice(0, 80)}")`);
      }
    }

    await page.screenshot({ path: `${ARTIFACTS}/modal.png`, fullPage: false });
    info(`screenshot: ${ARTIFACTS}/modal.png`);

    // Close modal
    await page.click('#modal-close').catch(() => {});
    await new Promise((r) => setTimeout(r, 300));
  } else {
    fail('no tool card to click');
  }

  await page.screenshot({ path: `${ARTIFACTS}/directory.png`, fullPage: false });
  info(`screenshot: ${ARTIFACTS}/directory.png`);

  // ============================================================
  // 2. tester.html — deploy tester
  // ============================================================
  console.log('\n[2/3] tester.html — deploy tester');
  await page.goto(`${BASE}/tester.html`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('.tool-chip', { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 500));

  const toolChips = await page.$$eval('.tool-chip', (els) => els.length);
  if (toolChips >= 5) pass(`tester has ${toolChips} tool chips`);
  else fail(`expected >=5 tool chips, got ${toolChips}`);

  // Pick the first tool
  const firstChip = await page.$('.tool-chip');
  if (firstChip) {
    await firstChip.click();
    await new Promise((r) => setTimeout(r, 400));
    pass('selected first tool');
  } else {
    fail('no tool chip to click');
  }

  // Read the actual command preview
  const cmdPreview = await page.evaluate(() => {
    const el = document.getElementById('cmd-preview');
    return el ? el.textContent : '';
  });
  if (cmdPreview.includes('gradio deploy')) pass('tester #cmd-preview shows the gradio deploy command');
  else fail('tester #cmd-preview missing `gradio deploy`');
  if (cmdPreview.includes('git clone')) pass('tester command clones the repo first');
  else fail('tester command missing `git clone`');
  if (cmdPreview.includes('cd ')) pass('tester command cds into the cloned repo');
  else fail('tester command missing `cd`');
  if (cmdPreview.includes('HF_TOKEN=')) pass('tester command passes the token via HF_TOKEN');
  else fail('tester command missing HF_TOKEN=');
  if (!cmdPreview.includes('--token') && !cmdPreview.includes('--repo')) {
    pass('tester command uses no invalid CLI flags (--token/--repo)');
  } else {
    fail('tester command still uses --token/--repo, which the Gradio CLI does not accept');
  }

  // Token input
  const tokenInput = await page.$('input[type="password"], #token, input[name*="token" i]');
  if (tokenInput) {
    pass('token input found');
    await tokenInput.type('hf_invalidtoken123', { delay: 10 });
  } else {
    fail('no token input found');
  }

  // Make sure the help banner tells the user about the HF settings URL
  const testerHTML = await page.content();
  if (testerHTML.includes('huggingface.co/settings/tokens')) {
    pass('tester page links to huggingface.co/settings/tokens');
  } else {
    fail('tester page missing the HF settings URL');
  }

  await page.screenshot({ path: `${ARTIFACTS}/tester.png`, fullPage: false });
  info(`screenshot: ${ARTIFACTS}/tester.png`);

  // ============================================================
  // 3. Responsive — 390px viewport
  // ============================================================
  console.log('\n[3/3] responsive — 390px viewport');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  const mobileCardCount = await page.$$eval('.card-grid .card', (els) => els.length);
  if (mobileCardCount >= 1) pass(`mobile renders ${mobileCardCount} cards`);
  else fail('mobile rendered 0 cards');
  await page.screenshot({ path: `${ARTIFACTS}/mobile.png`, fullPage: false });

  // ============================================================
  // 4. Error budget
  // ============================================================
  console.log('\n[errors]');
  if (consoleErrors.length === 0) pass('no console errors');
  else fail(`${consoleErrors.length} console errors:\n    ${consoleErrors.slice(0, 5).join('\n    ')}`);
  if (pageErrors.length === 0) pass('no uncaught page errors');
  else fail(`${pageErrors.length} page errors:\n    ${pageErrors.slice(0, 5).join('\n    ')}`);
  if (failedRequests.length === 0) pass('no real network failures');
  else fail(`${failedRequests.length} real network failures:\n    ${failedRequests.slice(0, 5).join('\n    ')}`);

  // ============================================================
  // Result
  // ============================================================
  console.log('');
  if (failures.length === 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  ✅ ALL CHECKS PASSED');
    console.log('═══════════════════════════════════════════════════════');
    await page.screenshot({ path: `${ARTIFACTS}/pass.png`, fullPage: true });
  } else {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  ❌ ${failures.length} CHECK(S) FAILED`);
    console.log('═══════════════════════════════════════════════════════');
    await page.screenshot({ path: `${ARTIFACTS}/fail.png`, fullPage: true });
    process.exit(1);
  }
} catch (e) {
  console.error('FATAL', e);
  process.exit(2);
} finally {
  await browser.close();
}
