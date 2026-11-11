#!/usr/bin/env node
/* global process, Buffer */
/* eslint-disable no-control-regex */
// Live view of implementer runs.
//   node watch.mjs <run>.jsonl          one run
//   node watch.mjs --branch <name>      every run on a branch in one window: the first run, then each fix
//                                       round as it starts (implement.sh reuses this window)
// Shows the brief, then a timeline (thinking, reads, edits with their diffs, commands with results, replies),
// then a summary (status, time, tokens, changed files, the agent's report).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = (() => {
  try {
    const res = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    return res.status === 0 ? res.stdout.trim() : process.cwd();
  } catch {
    return process.cwd();
  }
})();
const repoName = path.basename(repoRoot || process.cwd());
const defaultBase = path.join(os.homedir(), '.worktrees', repoName);
const logsDir = process.env.WORKTREES_LOGS_DIR || path.join(process.env.WORKTREES_BASE || defaultBase, '_logs');

const branchMode = process.argv[2] === '--branch';
const branchName = branchMode ? process.argv[3] : null;
const runsOfBranch = () => fs.readdirSync(logsDir)
  .filter((f) => f.startsWith(`${branchName}-`) && f.endsWith('.jsonl') && /-\d{8}-\d{6}\.jsonl$/.test(f))
  .sort()
  .map((f) => path.join(logsDir, f));
let file = branchMode ? runsOfBranch()[0] : process.argv[2];
if (!file) {
  console.error('usage: watch.mjs <run>.jsonl | --branch <name>');
  process.exit(2);
}
let base = file.replace(/\.jsonl$/, '');

const esc = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const c = {
  dim: esc('2'), bold: esc('1'), italic: esc('3'),
  red: esc('31'), green: esc('32'), yellow: esc('33'), blue: esc('34'), magenta: esc('35'), cyan: esc('36'),
  gray: esc('90'), bgRed: esc('41;97'), bgGreen: esc('42;30'), bgBlue: esc('44;97'),
};
const width = () => Math.max(60, Math.min(process.stdout.columns || 100, 140));
const visible = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...visible(s)].length));
const out = (s = '') => process.stdout.write(`${s}\n`);
const rule = (label = '') => out(c.gray(`── ${label} ${'─'.repeat(Math.max(0, width() - label.length - 4))}`));
const box = (title, lines, color = c.blue) => {
  const w = width() - 4;
  out(color(`╭─ ${c.bold(title)} ${color('─'.repeat(Math.max(0, w - visible(title).length - 1)))}╮`));
  for (const line of lines) {
    for (const part of wrap(line, w)) out(`${color('│')} ${pad(part, w)}${color('│')}`);
  }
  out(color(`╰${'─'.repeat(w + 2)}╯`));
};
const wrap = (line, w) => {
  if ([...visible(line)].length <= w) return [line];
  const parts = [];
  let rest = visible(line);
  while (rest.length > w) {
    const cut = rest.lastIndexOf(' ', w) > w / 2 ? rest.lastIndexOf(' ', w) : w;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  parts.push(rest);
  return parts;
};
const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const kTokens = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0));
const cleanLinks = (text) => text.replace(/\[([^\]]+)\]\(file:\/\/[^)]+\)/g, '$1');

let cwd = null;
const rel = (p) => (p && cwd && p.startsWith(cwd) ? path.relative(cwd, p) : p) ?? '';
const git = (...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });

const seen = new Map();
const baseline = (p) => {
  if (seen.has(p)) return seen.get(p);
  const r = git('show', `HEAD:${rel(p)}`);
  return r.status === 0 ? r.stdout : null;
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-watch-'));
const showDiff = (p) => {
  const before = baseline(p);
  const after = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  seen.set(p, after);
  const a = path.join(tmp, 'a');
  const b = path.join(tmp, 'b');
  fs.writeFileSync(a, before ?? '');
  fs.writeFileSync(b, after);
  const d = spawnSync('git', ['diff', '--no-index', '--no-color', '-U1', a, b], { encoding: 'utf8' }).stdout;
  const lines = d.split('\n').slice(4).filter((l) => l !== '\\ No newline at end of file' && l !== '');
  const added = lines.filter((l) => l.startsWith('+')).length;
  const removed = lines.filter((l) => l.startsWith('-')).length;
  const max = 24;
  const shown = lines.slice(0, max).map((l) => {
    const text = l.slice(0, width() - 10);
    if (l.startsWith('@@')) return c.cyan(`      ${text}`);
    if (l.startsWith('+')) return c.green(`      ${text}`);
    if (l.startsWith('-')) return c.red(`      ${text}`);
    return c.gray(`      ${text}`);
  });
  return { added, removed, isNew: before === null, shown, more: Math.max(0, lines.length - max) };
};

let start = Date.now();
const stamp = () => c.gray(`[${clock(Date.now() - start)}]`);
let replyText = '';
let pendingReply = null;
let edits = 0;
let commands = 0;
let failures = 0;
let thinkingTokens = 0;
const flushReply = () => {
  if (!pendingReply) return;
  const lines = cleanLinks(pendingReply).trim().split('\n');
  out(`${stamp()} ${c.magenta('◆')} ${lines[0]}`);
  for (const l of lines.slice(1)) out(`          ${l}`);
  pendingReply = null;
};

let meta = {};
const header = () => {
  const prompt = fs.existsSync(`${base}.prompt.md`) ? fs.readFileSync(`${base}.prompt.md`, 'utf8') : null;
  meta = fs.existsSync(`${base}.meta.json`) ? JSON.parse(fs.readFileSync(`${base}.meta.json`, 'utf8')) : {};
  const round = branchMode ? runsOfBranch().indexOf(file) : 0;
  const title = meta.readOnly ? 'Read-only review' : round > 0 ? `Fix round ${round} · same conversation` : 'Implementer run';
  process.stdout.write(`\x1b]0;Implementer · ${meta.branch ?? path.basename(base)}\x07`);
  out();
  box(title, [
    `${c.bold('Plan')}      ${meta.plan ?? '—'}`,
    `${c.bold('Branch')}    ${meta.branch ?? '—'}`,
    `${c.bold('Model')}     ${meta.model ?? '—'}`,
    `${c.bold('Worktree')}  ${meta.worktree ?? '—'}`,
    `${c.bold('Started')}   ${new Date().toLocaleTimeString()}`,
  ], round > 0 ? c.yellow : c.blue);
  if (prompt) {
    out();
    box(round > 0 ? 'Findings sent back to the agent' : 'Brief sent to the agent',
      prompt.trimEnd().split('\n').map((l) => c.dim(l)), c.gray);
  }
  out();
  rule('Timeline');
};
header();

const toolLine = (icon, verb, detail, color = (s) => s) => out(`${stamp()} ${icon} ${color(c.bold(verb.padEnd(6)))} ${detail}`);

const handle = (e) => {
  if (e.event === 'init') {
    cwd = e.init?.cwd ?? cwd;
    return;
  }
  if (e.event === 'result') return finish(e.result ?? {});
  const s = e.step_update;
  if (!s) return;

  if (s.step_type === 'agent_response') {
    if (s.text_delta) replyText += s.text_delta;
    if (s.state === 'DONE') {
      const t = s.usage?.thinking_tokens ?? 0;
      thinkingTokens += t;
      if (replyText.trim()) {
        pendingReply = replyText;
      } else if (t > 0) {
        out(`${stamp()} ${c.yellow('💭')} ${c.italic(c.gray(`thinking · ${(s.duration_seconds ?? 0).toFixed(1)}s · ${kTokens(t)} tokens`))}`);
      }
      replyText = '';
    }
    return;
  }

  if (s.step_type !== 'tool') return;
  flushReply();
  const info = s.tool_info ?? {};
  const p = info.parameters ?? {};
  const target = p.Path ?? p.TargetFile ?? p.AbsolutePath ?? p.SearchPath ?? p.DirectoryPath;
  const name = s.tool_name ?? info.name ?? '';

  if (s.state === 'ACTIVE') {
    if (name === 'run_command') {
      commands += 1;
      toolLine('▶', 'run', c.cyan(p.CommandLine ?? ''), c.blue);
    } else if (/read|view/.test(name)) {
      toolLine('📖', 'read', c.gray(rel(target)));
    } else if (/search|grep|find|list|glob/.test(name)) {
      toolLine('🔎', 'search', c.gray(p.Query ?? p.Pattern ?? rel(target) ?? ''));
    } else if (!/edit|write|replace|create/.test(name)) {
      toolLine('•', name, c.gray(JSON.stringify(p).slice(0, width() - 30)));
    }
    return;
  }

  if (s.state !== 'DONE') return;
  if (name === 'run_command') {
    const lines = String(info.output ?? '').replace(/\r/g, '').trim().split('\n');
    const code = /exited with code (\d+)/.exec(lines[0] ?? '')?.[1];
    const ok = code === undefined || code === '0';
    if (!ok) failures += 1;
    const body = lines.slice(lines[1] === '' ? 3 : 2).filter((l) => l.trim());
    out(`           ${ok ? c.green('✓') : c.red(`✗ exit ${code}`)} ${c.gray(`${(s.duration_seconds ?? 0).toFixed(1)}s`)}`);
    for (const l of body.slice(ok ? -3 : -8)) out(c.gray(`             ${l.slice(0, width() - 16)}`));
  } else if (/edit|write|replace|create/.test(name) && target && cwd) {
    edits += 1;
    const d = showDiff(target);
    const label = d.isNew ? c.green('new ') : c.yellow('edit');
    out(`${stamp()} ✏️  ${c.bold(label)}   ${rel(target)}  ${c.green(`+${d.added}`)} ${c.red(`−${d.removed}`)}`);
    for (const l of d.shown) out(l);
    if (d.more) out(c.gray(`      … ${d.more} more lines`));
  }
};

const summarizeFiles = () => {
  const rows = [];
  for (const line of git('diff', 'HEAD', '--numstat').stdout.split('\n').filter(Boolean)) {
    const [a, r, f] = line.split('\t');
    rows.push(`  ${c.yellow('M')} ${pad(f, width() - 26)} ${c.green(`+${a}`)} ${c.red(`−${r}`)}`);
  }
  for (const line of git('status', '--porcelain=v1', '--untracked-files=all').stdout.split('\n').filter(Boolean)) {
    if (!line.startsWith('??')) continue;
    const f = line.slice(3);
    const n = fs.readFileSync(path.join(cwd, f), 'utf8').split('\n').length - 1;
    rows.push(`  ${c.green('A')} ${pad(f, width() - 26)} ${c.green(`+${n}`)}`);
  }
  return rows;
};

const finish = (r) => {
  if (pendingReply && cleanLinks(pendingReply).trim() !== cleanLinks(r.response ?? '').trim()) flushReply();
  pendingReply = null;
  out();
  rule('Summary');
  const ok = r.status === 'SUCCESS';
  const files = cwd ? summarizeFiles() : [];
  const usage = r.usage ?? {};
  box(ok ? 'Run finished' : `Run ended: ${r.status ?? 'unknown'}`, [
    `${c.bold('Status')}    ${ok ? c.bgGreen(' SUCCESS ') : c.bgRed(` ${r.status ?? 'unknown'} `)}${r.error ? c.red(`  ${String(r.error).slice(0, 80)}`) : ''}`,
    `${c.bold('Time')}      ${clock(Date.now() - start)}`,
    `${c.bold('Activity')}  ${edits} edits · ${commands} commands${failures ? c.red(` (${failures} failed)`) : ''}`,
    `${c.bold('Tokens')}    ${kTokens(usage.total_tokens ?? 0)} total · ${kTokens(usage.thinking_tokens ?? thinkingTokens)} thinking`,
    '',
    c.bold(`Changed files (${files.length})`),
    ...files,
  ], ok ? c.green : c.red);
  if (r.response) {
    out();
    box('Agent report', cleanLinks(r.response).trimEnd().split('\n'), c.magenta);
  }
  out(c.gray('\nThe main session now reviews the diff and runs the gate itself.'));
  if (!branchMode) {
    fs.rmSync(tmp, { recursive: true, force: true });
    process.exit(0);
  }
  waiting = true;
  out(c.gray('Waiting here for a fix round on this branch (Ctrl+C closes the window).'));
};

let waiting = false;
const nextRun = () => {
  const newer = runsOfBranch().find((f) => f > file);
  if (newer) {
    file = newer;
    base = file.replace(/\.jsonl$/, '');
    offset = 0;
    rest = '';
    start = Date.now();
    edits = 0;
    commands = 0;
    failures = 0;
    thinkingTokens = 0;
    waiting = false;
    out();
    out();
    header();
  } else if (meta.worktree && !fs.existsSync(meta.worktree)) {
    out(c.gray('The worktree was removed (work merged); closing.'));
    process.exit(0);
  }
};

let offset = 0;
let rest = '';
let lastData = Date.now();
let warned = false;
const read = () => {
  if (waiting) return nextRun();
  const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
  if (size < offset) offset = 0;
  if (size > offset) {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size - offset);
    fs.readSync(fd, buf, 0, buf.length, offset);
    fs.closeSync(fd);
    offset = size;
    lastData = Date.now();
    warned = false;
    const lines = (rest + buf.toString('utf8')).split('\n');
    rest = lines.pop();
    for (const l of lines) {
      try {
        handle(JSON.parse(l));
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
      }
    }
  } else if (!warned && Date.now() - lastData > 180_000) {
    warned = true;
    out(`${stamp()} ${c.yellow('⏳')} ${c.gray('no activity for 3 minutes (a long test run, or a stall; the runner stops it after 15)')}`);
  }
};
read();
setInterval(read, 400);
