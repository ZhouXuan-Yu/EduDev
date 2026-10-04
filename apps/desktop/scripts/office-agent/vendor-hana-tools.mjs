// Copy independently reusable Hana code; record original bytes and adaptations.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const app = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const primary = 'D:/WorkProject/开源/openhanako';
const supplemental = 'D:/WorkProject/开源/openhanako-0.449.0';
const target = join(app, 'src/main/office-agent/vendor/hana');
const entries = [
  [primary, 'lib/file-ref/resource-io.ts'],
  [primary, 'lib/file-metadata.ts'],
  [supplemental, 'shared/link-aware-fs.ts'],
  [primary, 'lib/tools/web-reader.ts'],
  [primary, 'lib/tools/search-rate-limiter.ts'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = [];
const header = '// @ts-nocheck\n// Vendored from HanaAgent 0.449.0, Apache-2.0. See third_party/openhanako/LICENSE.\n// Upstream implicit types retained; local adapters remain strictly typed.\n';
for (const [root, name] of entries) {
  const original = readFileSync(join(root, name), 'utf8');
  let adapted = original;
  const changes = ['license/typecheck header', 'extensionless relative imports for Electron TypeScript build'];
  adapted = adapted.replace(/(from\s+["'][^"']+)\.ts(["'])/g, '$1$2');
  if (name === 'lib/file-ref/resource-io.ts') {
    adapted = adapted.replace('fs.copyFileSync(resolved.filePath, finalTargetPath);',
      'fs.copyFileSync(resolved.filePath, finalTargetPath, conflictPolicy === "overwrite" ? 0 : fs.constants.COPYFILE_EXCL);');
    changes.push('non-overwrite copy uses COPYFILE_EXCL to refuse a target created after existence check');
  }
  const destination = join(target, name); mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, header + adapted);
  manifest.push({ source: join(root, name), version: '0.449.0', sourceSha256: hash(original),
    destination: name, vendoredSha256: hash(header + adapted), changes });
}
// Preserve AnySearch wire implementation and its helpers without the Pi session,
// BrowserManager, global config or automatic provider fallback dependency tree.
const sourcePath = join(primary, 'lib/tools/web-search.ts');
const original = readFileSync(sourcePath, 'utf8');
const parsed = ts.createSourceFile(sourcePath, original, ts.ScriptTarget.Latest, true);
const names = ['throwIfRateLimited', 'throwIfHttpError', 'clampResultsToRange', 'anySearchLanguage',
  'anySearchResultsFrom', 'anySearchMetadataFrom', 'throwIfAnySearchEnvelopeError', 'searchAnySearch'];
const functions = names.map(name => {
  const node = parsed.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  if (!node) throw new Error(`Missing upstream function: ${name}`);
  let text = node.getText(parsed);
  if (name === 'searchAnySearch') text = text.replace('async function searchAnySearch(query, maxResults, apiKey, provider)',
    'export async function searchAnySearch(query, maxResults, apiKey, provider, { fetchImpl, signal })')
    .replace('await fetch(', 'await fetchImpl(').replace('AbortSignal.timeout(30_000)', 'signal');
  return text;
});
const search = header + `import { SearchRateLimitError, retryAfterMsFromHeaders } from './search-rate-limiter';
const ANYSEARCH_SEARCH_URL = 'https://api.anysearch.com/v1/search';
const getLocale = () => 'zh-CN';
const maxResultsForProvider = (_provider, value) => clampResultsToRange(value, { defaultValue: 10, max: 10 });
async function safeParseResponse(response, fallback) { try { return await response.json(); } catch { return fallback; } }
` + functions.join('\n\n') + '\n';
writeFileSync(join(target, 'lib/tools/anysearch.ts'), search);
manifest.push({ source: sourcePath, version: '0.449.0', sourceSha256: hash(original),
  destination: 'lib/tools/anysearch.ts', vendoredSha256: hash(search), functions: names,
  changes: ['AST extraction; no provider fallback/global config/Pi/browser dependency',
    'injected bounded fetch and task signal', 'zh-CN locale', '1-10 results cap', 'JSON parse without global error bus'] });
writeFileSync(join(target, 'source-manifest.json'), JSON.stringify({ schemaVersion: 'xiaozhi.hana.sources.v1',
  license: 'Apache-2.0', commit: null, provenance: 'Two complementary local source snapshots, not a Git checkout', entries: manifest }, null, 2));
console.log(JSON.stringify({ copiedFiles: manifest.length, sourceManifest: 'src/main/office-agent/vendor/hana/source-manifest.json' }));
