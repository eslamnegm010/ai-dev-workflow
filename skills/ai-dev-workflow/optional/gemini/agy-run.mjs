#!/usr/bin/env node
/* global process */
// Runs one Antigravity CLI (`agy`) turn headless and writes a result the main session can trust.
// Streams events to --jsonl (watch.mjs follows that file), kills a run that times out or stalls,
// fingerprints the worktree before and after, and lists the files the run changed.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const duration = (text) => {
  const m = /^(\d+)([hms])$/.exec(text);
  if (!m) throw new Error(`bad duration: ${text}`);
  return Number(m[1]) * { h: 3600_000, m: 60_000, s: 1000 }[m[2]];
};

const cwd = path.resolve(opt('cwd', process.cwd()));
const promptFile = opt('prompt-file');
const jsonlPath = opt('jsonl');
const resultPath = opt('result');
const model = opt('model', 'gemini-3.8-flash-high');
const conversation = opt('conversation');
const readOnly = flag('read-only');
const timeoutMs = duration(opt('timeout', '185m'));
const stallMs = duration(opt('stall', '15m'));
const agy = process.env.AGY || path.join(process.env.HOME, '.local/bin/agy');
if (!promptFile || !jsonlPath || !resultPath) {
  console.error('usage: agy-run.mjs --cwd <dir> --prompt-file <f> --jsonl <f> --result <f> [--model m] ' +
    '[--conversation id] [--read-only] [--print-timeout 180m] [--timeout 185m] [--stall 15m]');
  process.exit(2);
}

const git = (...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 }).stdout ?? '';
const fingerprint = () => createHash('sha256')
  .update(git('status', '--porcelain=v1', '--untracked-files=all'))
  .update(git('diff', 'HEAD', '--no-color'))
  .digest('hex');

const touchedFiles = () => {
  const files = new Map();
  for (const line of git('diff', 'HEAD', '--numstat').split('\n').filter(Boolean)) {
    const [added, removed, file] = line.split('\t');
    files.set(file, { path: file, state: 'modified', added: Number(added) || 0, removed: Number(removed) || 0 });
  }
  for (const line of git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean)) {
    const code = line.slice(0, 2);
    const file = line.slice(3);
    if (code === '??') {
      const text = fs.readFileSync(path.join(cwd, file), 'utf8');
      files.set(file, { path: file, state: 'new', added: text.split('\n').length - (text.endsWith('\n') ? 1 : 0), removed: 0 });
    } else if (code.includes('D')) {
      files.set(file, { ...(files.get(file) ?? { path: file, added: 0 }), state: 'deleted' });
    }
  }
  return [...files.values()];
};

const version = spawnSync(agy, ['--version'], { encoding: 'utf8', timeout: 20_000 });
if (version.error) {
  fs.writeFileSync(resultPath, JSON.stringify({ status: 'agy_unavailable', error: String(version.error) }, null, 2));
  console.error('agy-run: agy not found or not responding');
  process.exit(127);
}

const prompt = fs.readFileSync(promptFile, 'utf8');
const argv = ['-p', prompt, '--model', model, '--output-format', 'stream-json', '--print-timeout', opt('print-timeout', '180m')];
argv.push(...(readOnly ? ['--sandbox', '--dangerously-skip-permissions', '--mode', 'plan'] : ['--dangerously-skip-permissions']));
if (conversation) argv.push('--conversation', conversation);

const before = fingerprint();
const started = Date.now();
fs.writeFileSync(jsonlPath, '');
const out = fs.openSync(jsonlPath, 'a');
const child = spawn(agy, argv, { cwd, env: { ...process.env, PWD: cwd }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });

let lastEvent = Date.now();
let killedBy = null;
let pending = '';
let resultEvent = null;
const stderrTail = [];

child.stdout.on('data', (chunk) => {
  fs.writeSync(out, chunk);
  lastEvent = Date.now();
  const lines = (pending + chunk.toString('utf8')).split('\n');
  pending = lines.pop();
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.event === 'result') resultEvent = e.result;
    } catch { /* partial or non-JSON line */ }
  }
});
child.stderr.on('data', (chunk) => {
  stderrTail.push(...chunk.toString('utf8').split('\n').filter(Boolean));
  stderrTail.splice(0, Math.max(0, stderrTail.length - 20));
});

const kill = (reason) => {
  if (killedBy) return;
  killedBy = reason;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
  setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }, 10_000).unref();
};
const timer = setInterval(() => {
  if (Date.now() - started > timeoutMs) kill('timeout');
  else if (Date.now() - lastEvent > stallMs) kill('stalled');
}, 5_000);

child.on('close', (code, signal) => {
  clearInterval(timer);
  fs.closeSync(out);
  const changed = fingerprint() !== before;
  const files = touchedFiles();
  const agyStatus = resultEvent?.status ?? null;
  let status;
  if (killedBy) status = killedBy;
  else if (agyStatus !== 'SUCCESS') status = 'failed';
  else if (!readOnly && !changed) status = 'noop';
  else if (readOnly && changed) status = 'read_only_violation';
  else status = 'success';
  const result = {
    status,
    agyStatus,
    exitCode: code,
    signal,
    model,
    readOnly,
    durationSeconds: Math.round((Date.now() - started) / 1000),
    conversationId: resultEvent?.conversation_id ?? null,
    usage: resultEvent?.usage ?? null,
    error: resultEvent?.error ?? null,
    touchedFiles: files,
    finalMessage: resultEvent?.response ?? '',
    stderrTail,
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
  const exit = { success: 0, failed: 3, noop: 4, read_only_violation: 5, timeout: 124, stalled: 125 }[status];
  process.exit(exit ?? 1);
});
