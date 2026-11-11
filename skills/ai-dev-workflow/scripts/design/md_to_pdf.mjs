// Renders a Markdown hand-off document to a print-ready A4 PDF: cover, contents, page numbers, RTL-aware paragraphs.
// Usage: node md_to_pdf.mjs <input.md> <output.pdf> [--brand "Name"] [--footer "text"] [--color "#1E3A5F"]
//                           [--fonts <dir>]   (a folder of .ttf/.otf files; default: system fonts)
// The first `# ` heading is the title; a following `> ` line is the cover subtitle.
// `<!-- include: path -->` embeds another Markdown file (its title dropped, headings one level deeper).
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Marked } from 'marked';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [, value] = args.splice(i, 2);
  return value;
};
const brand = flag('--brand', '');
const footer = flag('--footer', '');
const color = flag('--color', '#1E3A5F');
const fontsDir = flag('--fonts');
const [input, output] = args;
if (!input || !output) {
  console.error('usage: node md_to_pdf.mjs <input.md> <output.pdf> [--brand ..] [--footer ..] [--color ..] [--fonts dir]');
  process.exit(2);
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Every font file in --fonts becomes one family "Doc" (weight guessed from the file name), tried before system fonts.
const fontFaces = fontsDir
  ? readdirSync(fontsDir)
      .filter((f) => /\.(ttf|otf|woff2?)$/i.test(f))
      .map((f) => {
        const n = f.toLowerCase();
        const weight = /bold/.test(n) && !/semibold/.test(n) ? 700 : /semibold/.test(n) ? 600 : /medium/.test(n) ? 500 : 400;
        const family = /mono/.test(n) ? 'DocMono' : 'Doc';
        return `@font-face { font-family: ${family}; src: url('${pathToFileURL(resolve(fontsDir, f)).href}'); font-weight: ${weight}; }`;
      })
      .join('\n')
  : '';

let source = readFileSync(input, 'utf8').replace(/<!-- include: (.+?) -->/g, (_, path) =>
  readFileSync(resolve(dirname(input), path), 'utf8')
    .replace(/^# .*\n/, '')
    .replace(/^(#{2,5}) /gm, '#$1 '),
);
const titleMatch = source.match(/^# (.+)\n+(?:> (.+)\n)?/);
if (!titleMatch) throw new Error('the document must start with a "# " title');
const [, title, subtitle = ''] = titleMatch;
source = source.slice(titleMatch[0].length);

const slugs = new Map();
const slug = (text) => {
  const base = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  const n = slugs.get(base) ?? 0;
  slugs.set(base, n + 1);
  return n ? `${base}-${n}` : base;
};
const toc = [];
const marked = new Marked({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const id = slug(text);
      if (depth <= 3) toc.push({ depth, text, id });
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  },
});
const body = marked
  .parse(source)
  .replace(/<(p|li|td|th|blockquote)>/g, '<$1 dir="auto">')
  .replace(/<a href="(?!https?:|#)[^"]*">(.*?)<\/a>/g, '$1');

const tocHtml = toc
  .filter((h) => h.depth <= 3)
  .map((h) => `<li class="toc-${h.depth}"><a href="#${h.id}">${h.text}</a></li>`)
  .join('\n');

const date = new Date().toLocaleDateString('en-CA');
const sourceName = basename(resolve(input));
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
${fontFaces}
:root { --brand: ${color}; --ink: #1A2230; --muted: #5B6778; --line: #D9DEE6; --tint: #F2F5F9; }
@page { size: A4; margin: 20mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font-family: Doc, system-ui, -apple-system, 'Segoe UI', 'Noto Sans', 'Noto Sans Arabic', sans-serif; color: var(--ink); font-size: 10pt; line-height: 1.55; margin: 0; }
.cover { height: 257mm; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; }
.brand { font-weight: 700; font-size: 15pt; color: var(--brand); letter-spacing: .02em; }
.cover h1 { font-size: 30pt; line-height: 1.15; margin: 0 0 10pt; color: var(--brand); }
.cover .sub { font-size: 13pt; color: var(--muted); max-width: 140mm; }
.cover .band { height: 4mm; background: var(--brand); width: 40mm; margin-bottom: 12mm; }
.cover .meta { font-size: 9.5pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 5mm; }
.toc { page-break-after: always; }
.toc h2 { border: 0; margin-top: 0; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { margin: 3pt 0; }
.toc .toc-3 { padding-inline-start: 14pt; font-size: 9.5pt; }
.toc a { color: var(--ink); text-decoration: none; }
h2 { font-size: 16pt; color: var(--brand); border-bottom: 2px solid var(--brand); padding-bottom: 4pt; margin: 22pt 0 10pt; page-break-before: always; }
h3 { font-size: 12.5pt; color: var(--brand); margin: 16pt 0 6pt; page-break-after: avoid; }
h4 { font-size: 10.5pt; margin: 12pt 0 4pt; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
a { color: var(--brand); }
code { font-family: DocMono, ui-monospace, Menlo, Consolas, monospace; unicode-bidi: plaintext; font-size: 8.8pt; background: var(--tint); padding: 0 3pt; border-radius: 3pt; }
pre { background: var(--tint); border: 1px solid var(--line); border-radius: 5pt; padding: 8pt 10pt; overflow: hidden; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
pre code { background: none; padding: 0; font-size: 8.3pt; line-height: 1.45; }
table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 8.8pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { background: var(--brand); color: #fff; text-align: start; font-weight: 600; }
th, td { border: 1px solid var(--line); padding: 4pt 6pt; vertical-align: top; }
tr:nth-child(even) td { background: #FAFBFC; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; border-inline-start: 3pt solid var(--brand); background: var(--tint); color: var(--ink); }
blockquote p { margin: 3pt 0; }
hr { border: 0; border-top: 1px solid var(--line); margin: 14pt 0; }
</style></head><body>
<section class="cover">
  <div class="brand">${esc(brand)}</div>
  <div>
    <div class="band"></div>
    <h1>${title}</h1>
    <div class="sub">${subtitle}</div>
  </div>
  <div class="meta">Generated ${date} from <code>${esc(sourceName)}</code>${footer ? ` · ${esc(footer)}` : ''}</div>
</section>
<section class="toc"><h2>Contents</h2><ol>${tocHtml}</ol></section>
${body}
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'md-pdf-'));
const htmlPath = join(dir, 'doc.html');
writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: output,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-family: sans-serif; font-size: 7.5pt; color: #5B6778; width: 100%; padding: 0 17mm; display: flex; justify-content: space-between;"><span>${esc([brand, title].filter(Boolean).join(' · '))}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
  margin: { top: '20mm', bottom: '20mm', left: '17mm', right: '17mm' },
});
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log(`wrote ${output}`);
