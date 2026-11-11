// Renders every *.html page here to ../<name>.png at 2x. Run: node render.mjs (Playwright needed).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const dir = path.dirname(new URL(import.meta.url).pathname);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.html'))) {
  await p.goto('file://' + path.join(dir, f));
  await p.evaluate(() => document.fonts.ready);
  const el = await p.$('.f');
  await el.screenshot({ path: path.join(dir, '..', f.replace('.html', '.png')) });
  console.log('✓', f);
}
await b.close();
