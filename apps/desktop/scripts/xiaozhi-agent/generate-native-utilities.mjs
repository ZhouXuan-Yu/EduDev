// Optional regeneration only; the generated CSS is checked in, so normal builds need no compiler.
// Existing installed Tailwind v4.3.3, MIT; no new runtime dependency or Windows packaging asset.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
const require = createRequire(import.meta.url);
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const version = require('tailwindcss/package.json').version;
if (version !== '4.3.3') throw Error('Regenerate with the recorded Tailwind 4.3.3 compiler');
const theme = fs
  .readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8')
  .replace('@theme default', '@theme reference');
const stylesheet =
  theme +
  '\n@theme inline {--color-foreground:var(--foreground);--color-muted:var(--muted);}\n@tailwind utilities;';

async function writeUtilities(candidates, scope, filename) {
  const compiler = await compile(stylesheet);
  const root = postcss.parse(compiler.build(candidates));
  // Scoped selectors are descendant-relative. Include :scope explicitly for the demo root itself.
  root.walkRules((rule) => {
    if (rule.selector.startsWith('.')) rule.selector = `:scope${rule.selector}, ${rule.selector}`;
  });
  const scoped = postcss.atRule({ name: 'scope', params: scope });
  const utilities = postcss.atRule({ name: 'layer', params: 'utilities' });
  utilities.append(scoped);
  for (const node of [...root.nodes]) {
    if (node.type === 'comment' || (node.type === 'atrule' && node.name === 'property')) continue;
    if (node.type === 'atrule' && node.name === 'layer' && !node.nodes) {
      node.remove();
      continue;
    }
    scoped.append(node);
  }
  root.append(utilities);
  fs.writeFileSync(
    path.join(desktop, 'src/renderer/components/office', filename),
    '/* Generated native template utilities, restricted to this composition. Do not hand-edit.\n   Regenerate: node scripts/xiaozhi-agent/generate-native-utilities.mjs */\n' +
      root.toString().trimEnd() +
      '\n',
  );
}

await writeUtilities(
  ['rounded-xs', 'size-3', 'bg-current', 'size-4'],
  '([data-heroui-native] [data-slot="prompt-input"])',
  'prompt-input.utilities.css',
);
