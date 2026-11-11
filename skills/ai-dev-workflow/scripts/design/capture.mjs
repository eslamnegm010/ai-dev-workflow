// Captures the visual oracle from an HTML prototype board: one PNG per phone frame, plus scroll pages.
//
// Config: design/capture.config.json (or --config <file>), paths relative to the repo root:
//   prototypeDir, page, frameSelector, keyAttribute, keySeparator, screenMap, outDir,
//   frameWidth, minTextLength, settleMs, scrollPages, deviceScaleFactor
// Writes <outDir>/<screen>/viewport.<variant>.png, <outDir>/<screen>/scroll-NN.<variant>.png and <outDir>/manifest.json.
//
// Usage: node capture.mjs [--config file] [screenId ...]   (screen ids limit the run; the manifest is then not rewritten)

import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const configFlag = args.indexOf('--config');
const repo = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();
const configPath = path.resolve(repo, configFlag >= 0 ? args[configFlag + 1] : 'design/capture.config.json');
if (configFlag >= 0) args.splice(configFlag, 2);
const only = new Set(args);

const config = {
  prototypeDir: 'design/prototype',
  page: 'Screens.html',
  frameSelector: '[data-frame-key]',
  keyAttribute: 'data-frame-key',
  keySeparator: '-',
  screenMap: {},
  outDir: 'design/reference',
  frameWidth: null,
  minTextLength: 100,
  settleMs: 500,
  scrollPages: true,
  deviceScaleFactor: 1,
  ...JSON.parse(fs.readFileSync(configPath, 'utf8')),
};
const prototypeDir = path.resolve(repo, config.prototypeDir);
const referenceDir = path.resolve(repo, config.outDir);

const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.jsx': 'text/javascript',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// Prototypes fetch sibling files, so they must be served over HTTP, not file://.
function serve(dir) {
  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(dir)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': mime[path.extname(file)] ?? 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const server = await serve(prototypeDir);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: config.deviceScaleFactor,
});
await page.goto(`http://127.0.0.1:${server.address().port}/${encodeURI(config.page)}`);
await page.waitForSelector(config.frameSelector);
await page.evaluate(() => document.fonts.ready);

const keys = await page.$$eval(
  config.frameSelector,
  (cells, attr) => cells.map((c) => c.getAttribute(attr)),
  config.keyAttribute,
);
const manifest = [];

for (const key of keys) {
  const [screenId, ...variantParts] = key.split(config.keySeparator);
  if (only.size && !only.has(screenId)) continue;
  const screen = config.screenMap[screenId] ?? screenId;
  const variant = variantParts.join('.') || 'default';

  const selector = `[${config.keyAttribute}="${key}"]`;
  const cell = await page.$(selector);
  await cell.scrollIntoViewIfNeeded();
  // Frames often render lazily when they enter the viewport.
  await page.waitForFunction(
    ([sel, min]) => (document.querySelector(sel)?.innerText.length ?? 0) >= min,
    [selector, config.minTextLength],
    { timeout: 15000 },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(config.settleMs);

  const outDir = path.join(referenceDir, screen);
  fs.mkdirSync(outDir, { recursive: true });
  const viewport = path.join(outDir, `viewport.${variant}.png`);
  await cell.screenshot({ path: viewport, animations: 'disabled' });

  // Page through the main scroll body inside the untouched frame, so fixed headers and nav stay as designed.
  const scroll = config.scrollPages
    ? await page.$eval(selector, (c) => {
        const scrollers = [...c.querySelectorAll('*')].filter((e) => {
          const s = getComputedStyle(e);
          return /(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1;
        });
        if (!scrollers.length) return null;
        const main = scrollers.reduce((x, y) => (y.clientHeight > x.clientHeight ? y : x));
        main.dataset.captureScroller = '1';
        return { client: main.clientHeight, height: main.scrollHeight };
      })
    : null;

  const pages = [];
  if (scroll) {
    const step = Math.floor(scroll.client * 0.85);
    const max = scroll.height - scroll.client;
    const offsets = [];
    for (let y = step; y < max; y += step) offsets.push(y);
    offsets.push(max);
    for (const [i, y] of offsets.entries()) {
      await page.$eval(`${selector} [data-capture-scroller]`, (m, top) => { m.scrollTop = top; }, y);
      await page.waitForTimeout(250);
      const file = path.join(outDir, `scroll-${String(i + 1).padStart(2, '0')}.${variant}.png`);
      await cell.screenshot({ path: file, animations: 'disabled' });
      pages.push({ file: path.relative(referenceDir, file), scrollTop: y });
    }
    await page.$eval(`${selector} [data-capture-scroller]`, (m) => {
      m.scrollTop = 0;
      delete m.dataset.captureScroller;
    });
  }

  manifest.push({
    screen,
    prototypeId: screenId,
    variant,
    viewport: path.relative(referenceDir, viewport),
    scrollHeight: scroll?.height ?? null,
    pages,
    width: config.frameWidth,
  });
  console.log(`✓ ${key} → ${screen}/${variant}${pages.length ? ` (+${pages.length} scroll pages)` : ''}`);
}

if (!only.size) {
  fs.writeFileSync(path.join(referenceDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
await browser.close();
server.close();
