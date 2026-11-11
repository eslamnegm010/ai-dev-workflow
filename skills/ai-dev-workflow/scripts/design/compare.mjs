// Advisory visual diff between a golden/screenshot and its design reference. Not a CI gate: open the images.
//
// Usage:
//   node compare.mjs <golden.png> <reference.png>
//   node compare.mjs --pairs pairs.json [--md report.md]     pairs.json: [{ "name", "golden", "reference" }]
// Options: --out <dir> (default build/design-compare) · --threshold 0.1 (pixelmatch colour threshold)
// Writes <out>/<name>.png = reference | golden | diff overlay, and prints similarity (Markdown table for --pairs).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [, value] = args.splice(i, 2);
  return value;
};
const repo = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();
const pairsFile = flag('--pairs');
const mdFile = flag('--md');
const outDir = path.resolve(repo, flag('--out', 'build/design-compare'));
const threshold = Number(flag('--threshold', '0.1'));

const readPng = (file) => PNG.sync.read(fs.readFileSync(path.resolve(repo, file)));

// Nearest-neighbour resize: enough for an advisory diff; smoothing would only blur the score.
function resize(png, width, height) {
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    const sy = Math.min(png.height - 1, Math.floor((y * png.height) / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(png.width - 1, Math.floor((x * png.width) / width));
      png.data.copy(out.data, (y * width + x) << 2, (sy * png.width + sx) << 2, ((sy * png.width + sx) << 2) + 4);
    }
  }
  return out;
}

function sideBySide(images) {
  const height = Math.max(...images.map((i) => i.height));
  const width = images.reduce((sum, i) => sum + i.width, 0);
  const out = new PNG({ width, height });
  out.data.fill(255);
  let x0 = 0;
  for (const image of images) {
    for (let y = 0; y < image.height; y++) {
      image.data.copy(out.data, (y * width + x0) << 2, (y * image.width) << 2, (y * image.width + image.width) << 2);
    }
    x0 += image.width;
  }
  return out;
}

function compare({ name, golden, reference }) {
  const ref = readPng(reference);
  const raw = readPng(golden);
  const gold = raw.width === ref.width && raw.height === ref.height ? raw : resize(raw, ref.width, ref.height);
  const diff = new PNG({ width: ref.width, height: ref.height });
  const differing = pixelmatch(ref.data, gold.data, diff.data, ref.width, ref.height, { threshold });
  const total = ref.width * ref.height;
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${(name ?? path.basename(golden, '.png')).replace(/[^\w.-]+/g, '_')}.png`);
  fs.writeFileSync(file, PNG.sync.write(sideBySide([ref, gold, diff])));
  return { name: name ?? path.basename(golden, '.png'), similarity: 1 - differing / total, differing, total, file };
}

const pct = (r) => `${(r.similarity * 100).toFixed(2)} %`;

if (pairsFile) {
  const results = JSON.parse(fs.readFileSync(path.resolve(repo, pairsFile), 'utf8')).map(compare);
  const table = [
    '| Golden | Similarity | Differing px | Side by side |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${pct(r)} | ${r.differing}/${r.total} | \`${path.relative(repo, r.file)}\` |`),
  ].join('\n');
  const values = results.map((r) => r.similarity * 100);
  const summary = `Range ${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)} % over ${results.length} pairs (advisory: open the images).`;
  console.log(`${table}\n\n${summary}`);
  if (mdFile) fs.writeFileSync(path.resolve(repo, mdFile), `${table}\n\n${summary}\n`);
} else {
  const [golden, reference] = args;
  if (!golden || !reference) {
    console.error('Usage: node compare.mjs <golden.png> <reference.png> | --pairs pairs.json [--md out.md]');
    process.exit(2);
  }
  const r = compare({ golden, reference });
  console.log(`${r.name}: similarity ${pct(r)} (${r.differing}/${r.total} px differ)`);
  console.log(`  reference | golden | diff → ${path.relative(repo, r.file)}`);
}
