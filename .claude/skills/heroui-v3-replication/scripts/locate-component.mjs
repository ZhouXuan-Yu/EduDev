#!/usr/bin/env node
/**
 * Locate a herouipro-v3 component in the latest source repo, its demo, and
 * EduProject's local vendored copy. Prints a compact contract map.
 *
 * Usage:
 *   node .claude/skills/heroui-v3-replication/scripts/locate-component.mjs ChatSource
 *   node .../locate-component.mjs chat-source
 *
 * Env:
 *   HEROUI_V3_ROOT   default D:/WorkProject/HeroUIPro/herouipro-v3-latest
 *   EDU_PROJECT_ROOT default: walk up from cwd to the folder containing apps/desktop
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SOURCE_ROOT = process.env.HEROUI_V3_ROOT || 'D:/WorkProject/HeroUIPro/herouipro-v3-latest';
const input = process.argv[2];
if (!input) {
  console.error('Usage: node locate-component.mjs <ComponentName|kebab-name>');
  process.exit(2);
}

const aliases = {
  chatsources: 'chat-source',
  chatsourceroot: 'chat-source',
  chatsourcetrigger: 'chat-source',
  chatsourceicon: 'chat-source',
  chatsourcetitle: 'chat-source',
  chatsourcepreview: 'chat-source',
  chatsourcedocumenticon: 'chat-source',
  chatattachmentinput: 'chat-attachment',
  chatattachmentgroup: 'chat-attachment',
  chatattachmentpreview: 'chat-attachment',
  chatattachmentinfo: 'chat-attachment',
  chatattachmenticon: 'chat-attachment',
  chatattachmentremove: 'chat-attachment',
  chatattachmentsize: 'chat-attachment',
  chatattachmentname: 'chat-attachment',
  promptinputs: 'prompt-input',
  promptinputtextarea: 'prompt-input',
  promptinputsend: 'prompt-input',
  promptinputaction: 'prompt-input',
  promptinputtoolbar: 'prompt-input',
  promptinputcontent: 'prompt-input',
  promptinputattachments: 'prompt-input',
};

function toKebab(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function toPascal(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

const normalized = input.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const kebab = aliases[normalized] || toKebab(input);
const pascal = toPascal(kebab);

function findProjectRoot(start) {
  let current = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(current, 'apps', 'desktop', 'src', 'renderer', 'heroui-pro'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

const projectRoot = process.env.EDU_PROJECT_ROOT || findProjectRoot(process.cwd());
const sourceDir = path.join(SOURCE_ROOT, 'packages', 'ui-pro', 'src', 'components', kebab);
const demoDir = path.join(SOURCE_ROOT, 'packages', 'example', 'src', 'demos');
const localDir = path.join(projectRoot, 'apps', 'desktop', 'src', 'renderer', 'heroui-pro', 'components', kebab);

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function printDiff() {
  const sourceFiles = listFiles(sourceDir);
  const localFiles = listFiles(localDir);
  const all = [...new Set([...sourceFiles, ...localFiles])].sort();
  if (!all.length) return;
  console.log('\nLocal diff:');
  for (const name of all) {
    const a = path.join(sourceDir, name);
    const b = path.join(localDir, name);
    if (!fs.existsSync(a)) {
      console.log(`  only local: ${name}`);
    } else if (!fs.existsSync(b)) {
      console.log(`  only source: ${name}`);
    } else {
      console.log(`  ${hash(a) === hash(b) ? 'same' : 'DIFFERENT'}: ${name}`);
    }
  }
}

function printExports() {
  const index = path.join(sourceDir, 'index.ts');
  if (!fs.existsSync(index)) return;
  const lines = fs.readFileSync(index, 'utf8').split(/\r?\n/);
  const relevant = lines.filter((line) => /Object\.assign|export\s+(const|type|\{)/.test(line));
  if (!relevant.length) return;
  console.log('\nindex.ts exports:');
  for (const line of relevant.slice(0, 60)) console.log(`  ${line.trim()}`);
}

function printDemo() {
  if (!fs.existsSync(demoDir)) return;
  const candidates = fs.readdirSync(demoDir).filter((name) => name.endsWith('.tsx'));
  const exact = path.join(demoDir, `${pascal}.tsx`);
  const demo = fs.existsSync(exact)
    ? exact
    : candidates.find((name) => name.toLowerCase() === `${pascal.toLowerCase()}.tsx`) ||
      candidates.find((name) => name.toLowerCase().replace('.tsx', '') === kebab.replace(/-/g, ''));
  if (!demo) {
    console.log(`\nDemo: not found for ${pascal} in ${demoDir}`);
    return;
  }
  console.log(`\nDemo: ${demo}`);
  const text = fs.readFileSync(demo, 'utf8');
  const functions = [...text.matchAll(/export\s+function\s+([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  if (functions.length) console.log(`  variants: ${functions.join(', ')}`);
}

function printGit() {
  const git = path.join(SOURCE_ROOT, '.git');
  if (!fs.existsSync(git)) {
    console.log('\nRepo: not a git checkout');
    return;
  }
  try {
    const head = fs.readFileSync(path.join(git, 'HEAD'), 'utf8').trim();
    const sha = head.startsWith('ref: ')
      ? fs.readFileSync(path.join(git, head.slice(5)), 'utf8').trim()
      : head;
    console.log(`\nRepo HEAD: ${sha}`);
  } catch {}
}

console.log(`Component: ${input}`);
console.log(`Kebab:     ${kebab}`);
console.log(`Pascal:    ${pascal}`);
console.log(`Project:   ${projectRoot}`);
console.log(`Source:    ${sourceDir}`);
console.log(`Local:     ${localDir}`);

if (!fs.existsSync(sourceDir)) {
  console.error(`\nSource directory not found: ${sourceDir}`);
  const components = path.join(SOURCE_ROOT, 'packages', 'ui-pro', 'src', 'components');
  if (fs.existsSync(components)) {
    const names = fs
      .readdirSync(components, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    console.error(`Available components: ${names.join(', ')}`);
  }
  process.exit(1);
}

console.log(`\nSource files: ${listFiles(sourceDir).join(', ') || '(none)'}`);
console.log(`Local files:  ${listFiles(localDir).join(', ') || '(not vendored)'}`);
printExports();
printDiff();
printDemo();
printGit();
