const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('../scripts/preview.cjs');

test('MiniSearch browser flows against simulated Spotify', { timeout: 90000 }, async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.MINISEARCH_BROWSER_CHANNEL ? { channel: process.env.MINISEARCH_BROWSER_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 420 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://i.scdn.co/**', route => {
      const variant = route.request().url().slice(-1);
      const palette = { a: ['#47555b', '#da6b41'], b: ['#243658', '#d8b486'], c: ['#582d49', '#d1b1af'], d: ['#34584e', '#d4cc9f'] };
      const [bg, fg] = palette[variant] || palette.a;
      return route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="${bg}"/><circle cx="165" cy="145" r="90" fill="${fg}"/><path d="M0 215 300 85v55L0 270" fill="${bg}"/><path d="M0 240 300 110v8L0 248" fill="${fg}" opacity=".6"/></svg>` });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const query = page.getByRole('textbox', { name: 'Search songs or artists' });
    const rows = page.locator('.result');
    const waitRows = async count => {
      await page.waitForFunction(n => document.querySelectorAll('.result').length === n && document.getElementById('results').getAttribute('aria-busy') === 'false', count);
    };
    const search = async text => { await query.fill(text); await query.press('Enter'); };
    await page.goto(base);

    await t.test('initial state, artwork, pause, next and previous controls', async () => {
      assert.equal(await page.locator('#title').textContent(), 'Midnight Signal');
      assert.equal(await page.locator('#art-placeholder').isVisible(), false);
      assert.equal(await page.locator('#results').isVisible(), false);
      await page.setViewportSize({ width: 320, height: 164 });
      await page.screenshot({ path: path.join(__dirname, '../docs/compact.png') });
      await page.setViewportSize({ width: 320, height: 420 });
      await page.getByRole('button', { name: 'Pause', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Play', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Next track' }).click();
      await page.getByRole('button', { name: 'Previous track' }).click();
      assert.deepEqual(await page.evaluate(() => [mockCalls.next, mockCalls.back]), [1, 1]);
    });
    await t.test('search shows songs and supports play and queue', async () => {
      await search('midnight'); await waitRows(6);
      await page.getByRole('button', { name: 'Add Midnight Signal to queue', exact: true }).click();
      assert.equal(await page.evaluate(() => mockCalls.queued[0].uri), 'spotify:track:0000000000000000000001');
      await page.getByRole('button', { name: 'Play Midnight City Lights by Northbound', exact: true }).click();
      assert.equal(await page.locator('#title').textContent(), 'Midnight City Lights');
      assert.equal(await page.evaluate(() => mockCalls.plays.length), 1);
    });
    await t.test('seek and volume send correctly scaled values', async () => {
      await page.locator('#seek').fill('500'); await page.locator('#seek').dispatchEvent('change');
      await page.getByRole('button', { name: 'Show volume' }).click();
      await page.locator('#volume').fill('30');
      assert.equal(await page.evaluate(() => mockCalls.seek.at(-1)), 111500);
      assert.equal(await page.evaluate(() => mockCalls.volume.at(-1)), .3);
    });
    await t.test('dragging the volume slider changes volume without moving the window', async () => {
      await page.evaluate(() => { window.volumeDragMoves = []; window.moveTo = (...args) => window.volumeDragMoves.push(args); });
      assert.equal(await page.locator('#volume-popup').evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-app-region')), 'no-drag');
      assert.equal(await page.locator('#volume').evaluate(el => getComputedStyle(el).getPropertyValue('-webkit-app-region')), 'no-drag');
      const slider = await page.locator('#volume').boundingBox();
      const before = await page.evaluate(() => mockCalls.volume.length);
      await page.mouse.move(slider.x + slider.width * .2, slider.y + slider.height / 2);
      await page.mouse.down();
      await page.mouse.move(slider.x + slider.width * .8, slider.y + slider.height / 2, { steps: 6 });
      await page.mouse.up();
      assert.ok(await page.evaluate(() => mockCalls.volume.length) > before);
      assert.deepEqual(await page.evaluate(() => window.volumeDragMoves), []);
    });
    await t.test('keyboard navigates results and Ctrl+F returns to search', async () => {
      await query.focus(); await query.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'result-play');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Play Midnight City Lights by Northbound');
      await page.keyboard.press('Control+f'); assert.equal(await query.evaluate(el => el === document.activeElement), true);
    });
    await t.test('compact controls work and results reopen when search regains focus', async () => {
      await page.getByRole('button', { name: 'Shuffle', exact: true }).click();
      assert.equal(await page.locator('#shuffle').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#results').isVisible(), false);
      await query.focus(); assert.equal(await page.locator('#results').isVisible(), true);
      await page.getByRole('button', { name: 'Repeat off', exact: true }).click();
      assert.equal(await page.locator('#repeat').getAttribute('aria-label'), 'Repeat all');
      await page.getByRole('button', { name: 'Save to Liked Songs', exact: true }).click();
      assert.equal(await page.locator('#like').getAttribute('aria-label'), 'Remove from Liked Songs');
      await page.getByRole('button', { name: 'Copy song link', exact: true }).click();
      assert.equal(await page.evaluate(() => mockCalls.clipboard), 'https://open.spotify.com/track/0000000000000000000002');
      await query.focus();
    });
    await t.test('stale searches cannot overwrite a newer query', async () => {
      await search('slow');
      await page.waitForFunction(() => mockCalls.searches.includes('slow'));
      await search('midnight'); await waitRows(6);
      await page.waitForTimeout(1000);
      assert.equal(await page.getByText('Slow stale result', { exact: true }).count(), 0);
      assert.equal(await rows.count(), 6);
    });
    await t.test('debounce makes a single search after rapid typing', async () => {
      await query.fill('');
      const before = await page.evaluate(() => mockCalls.searches.length);
      await query.pressSequentially('midnight', { delay: 10 });
      await waitRows(6);
      assert.equal(await page.evaluate(() => mockCalls.searches.length), before + 1);
    });
    await t.test('clear during an in-flight request remains cleared', async () => {
      await search('slow');
      await page.getByRole('button', { name: 'Clear search' }).click();
      await page.waitForTimeout(1000);
      assert.equal(await query.inputValue(), '');
      assert.equal(await rows.count(), 0);
      assert.equal(await page.locator('#results').isVisible(), false);
      assert.equal(await page.locator('#results').getAttribute('aria-busy'), 'false');
    });
    await t.test('empty and failed searches provide recovery states', async () => {
      await search('empty'); await page.getByText('No songs found. Try another title or artist.', { exact: true }).waitFor();
      assert.equal(await page.locator('#results').isVisible(), false);
      await search('offline'); await page.getByText('Search is unavailable. Press Enter to retry.', { exact: true }).waitFor();
      await search('midnight'); await waitRows(6);
    });
    await t.test('API errors do not produce false playback or queue success', async () => {
      await page.evaluate(() => { window.failPlayback = true; window.failQueue = true; });
      const before = await page.evaluate(() => [mockCalls.plays.length, mockCalls.queued.length]);
      await page.locator('.result-play').first().click();
      await page.waitForFunction(() => document.getElementById('status').dataset.error === 'true');
      await page.locator('.queue').first().click();
      assert.deepEqual(await page.evaluate(() => [mockCalls.plays.length, mockCalls.queued.length]), before);
      await page.evaluate(() => { window.failPlayback = false; window.failQueue = false; });
    });
    await t.test('Spotify metadata is rendered as text, never executable markup', async () => {
      await search('unsafe'); await waitRows(1);
      assert.equal(await page.locator('.result-name').textContent(), '<img src=x onerror="window.injected=true">');
      assert.equal(await page.locator('.result-name img').count(), 0);
      assert.equal(await page.evaluate(() => window.injected), undefined);
    });
    await t.test('small window stays usable without horizontal overflow', async () => {
      await page.setViewportSize({ width: 280, height: 400 });
      await search('midnight'); await waitRows(6);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await query.isVisible(), true);
      assert.ok(await page.locator('#results').evaluate(el => el.clientHeight) > 60);
      await page.setViewportSize({ width: 320, height: 420 });
      await page.screenshot({ path: path.join(__dirname, '../docs/preview.png') });
    });
    await t.test('closing the player removes subscriptions and invalidates searches', async () => {
      await search('slow'); await page.evaluate(() => controller.dispose());
      await page.waitForTimeout(1000);
      assert.deepEqual(await page.evaluate(() => Object.values(mockCalls.listeners)), [0, 0, 0]);
      assert.equal(await page.getByText('Slow stale result', { exact: true }).count(), 0);
    });
    await t.test('initialization is idempotent and missing PiP gives useful feedback', async () => {
      await page.goto(base + '/launcher');
      await page.evaluate(() => { MiniSearch.start(window); MiniSearch.start(window); });
      assert.equal(await page.evaluate(() => mockCalls.launchers), 1);
      await page.evaluate(() => Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }));
      await page.locator('#launcher').click();
      assert.match(await page.evaluate(() => mockCalls.notification), /picture-in-picture support/);
    });
    await t.test('shortcut prevents the native mini-player handler from also running', async () => {
      await page.evaluate(() => {
        window.nativeKeyCount = 0;
        document.addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && e.code === 'KeyK') window.nativeKeyCount++; });
      });
      await page.keyboard.press('Control+Shift+k');
      assert.equal(await page.evaluate(() => window.nativeKeyCount), 0);
      await page.evaluate(() => { const input = document.createElement('input'); document.body.append(input); input.focus(); });
      await page.keyboard.press('Control+Shift+k');
      assert.equal(await page.evaluate(() => window.nativeKeyCount), 0);
      assert.match(await page.evaluate(() => mockCalls.notification), /picture-in-picture support/);
    });
    await t.test('shortcut survives toolbar initialization failures', async () => {
      const pattern = '**/tests/mock-spotify.js';
      const handler = route => route.fulfill({
        contentType: 'text/javascript',
        body: fs.readFileSync(path.join(__dirname, 'mock-spotify.js'), 'utf8') + `
          Spicetify.Playbar.Button = class { constructor() { throw new Error('Toolbar not ready'); } };
          Spicetify.Topbar = { Button: class { constructor() { throw new Error('Toolbar not ready'); } } };
          Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true });`,
      });
      await page.route(pattern, handler);
      await page.goto(base + '/launcher');
      assert.equal(await page.locator('#launcher').count(), 0);
      await page.keyboard.press('Control+Shift+k');
      assert.match(await page.evaluate(() => mockCalls.notification), /picture-in-picture support/);
      await page.unroute(pattern, handler);
    });
    await t.test('real Chromium picture-in-picture window opens and can reopen', async () => {
      // Fixed Playwright viewports are inherited by PiP and hide real native
      // content resizing. Use a normal window for this geometry check.
      const page = await browser.newPage({ viewport: null });
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://i.scdn.co/**', route => route.fulfill({ status: 204 }));
      await page.goto(base + '/launcher');
      const supported = await page.evaluate(() => Boolean(window.documentPictureInPicture?.requestWindow));
      if (!supported) { t.diagnostic('Real PiP unsupported in this browser; mount and lifecycle covered separately.'); return; }
      await page.locator('#launcher').click();
      await page.waitForFunction(() => documentPictureInPicture.window?.document.getElementById('query'));
      assert.equal(await page.evaluate(() => documentPictureInPicture.window.document.getElementById('title').textContent), 'Midnight Signal');
      const compactHeight = await page.evaluate(() => documentPictureInPicture.window.innerHeight);
      const pipPage = page.context().pages().find(p => p !== page && p.url() === 'about:blank');
      assert.ok(pipPage, 'Picture-in-picture page is exposed for real keyboard input');
      await pipPage.getByRole('textbox', { name: 'Search songs or artists' }).pressSequentially('midnight');
      await page.waitForFunction(() => documentPictureInPicture.window.document.querySelectorAll('.result').length === 6);
      await page.waitForFunction(height => documentPictureInPicture.window.innerHeight > height, compactHeight, { timeout: 5000 });
      await pipPage.getByRole('button', { name: 'Clear search' }).click();
      await page.waitForFunction(height => documentPictureInPicture.window.innerHeight <= height + 1, compactHeight, { timeout: 5000 });
      await pipPage.keyboard.press('Control+Shift+k').catch(error => { if (!pipPage.isClosed()) throw error; });
      await page.waitForFunction(() => !documentPictureInPicture.window);
      assert.deepEqual(await page.evaluate(() => Object.values(mockCalls.listeners)), [0, 0, 0]);
      await page.locator('#launcher').click();
      await page.waitForFunction(() => documentPictureInPicture.window?.document.getElementById('query'));
      await page.evaluate(() => documentPictureInPicture.window.close());
      await page.close();
    });
    assert.deepEqual(errors, [], 'No unhandled browser errors');
  } finally {
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
});
