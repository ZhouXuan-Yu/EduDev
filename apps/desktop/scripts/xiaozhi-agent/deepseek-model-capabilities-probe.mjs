import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Read-only official metadata probe. Never print credentials or request headers.
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = fs.readFileSync(path.join(appRoot, '.env.local'), 'utf8');
const pick = name => cfg.match(new RegExp(`^${name}\\s*=\\s*["']?([^\\r\\n"']+)`, 'm'))?.[1]?.trim();
const key = pick('DEEPSEEK_API_KEY');
assert(key, 'Local DeepSeek credential is required');
const configuredModel = pick('DEEPSEEK_MODEL') || 'deepseek-flash';
const report = { success: false, observedAt: new Date().toISOString(), endpoint: 'https://api.deepseek.com/v1/models', configuredModel, models: [] };
try {
  const response = await fetch(report.endpoint, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
  report.httpStatus = response.status;
  assert(response.ok, `Model metadata HTTP ${response.status}`);
  const data = await response.json();
  assert(data?.object === 'list' && Array.isArray(data.data));
  report.models = data.data.slice(0, 32).map(model => ({
    id: typeof model.id === 'string' ? model.id.slice(0, 120) : null,
    name: typeof model.name === 'string' ? model.name.slice(0, 160) : null,
    contextWindow: Number.isSafeInteger(model.context_window) && model.context_window > 0 ? model.context_window : null,
    maxOutputTokens: Number.isSafeInteger(model.max_output_tokens) && model.max_output_tokens > 0 ? model.max_output_tokens : null,
    inputModalities: Array.isArray(model.input_modalities) ? model.input_modalities.filter(value => ['text', 'image'].includes(value)) : [],
    outputModalities: Array.isArray(model.output_modalities) ? model.output_modalities.filter(value => value === 'text') : [],
    effortLevels: Array.isArray(model.effort?.supported_levels) ? model.effort.supported_levels.filter(value => ['low', 'high', 'max'].includes(value)) : [],
  }));
  assert(report.models.some(model => model.id === configuredModel), 'Configured model missing from official catalogue');
  report.success = true;
} catch (error) {
  report.error = String(error.message).replaceAll(key, '[credential]').slice(0, 500);
}
const output = path.join(appRoot, 'test-results/xiaozhi-agent/deepseek-model-capabilities-probe.json');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (!report.success) process.exitCode = 1;
