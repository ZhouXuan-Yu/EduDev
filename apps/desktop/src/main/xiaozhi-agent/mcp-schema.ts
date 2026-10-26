import type { Tool } from '@earendil-works/pi-mcp';

export const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const kinds = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
const keys = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'anyOf', 'oneOf', 'allOf', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'minItems', 'maxItems', 'title', 'description', '$schema']);
/** Deliberately bounded JSON Schema subset. No refs, executable patterns or unknown keywords. */
export function validMcpSchema(schema: unknown): boolean {
  let nodes = 0;
  function visit(v: unknown, depth: number): boolean {
    if (++nodes > 512 || depth > 12 || !record(v) || Object.keys(v).some(k => !keys.has(k))) return false;
    if (v.type !== undefined && !(typeof v.type === 'string' ? kinds.has(v.type) : Array.isArray(v.type) && v.type.length > 0 && v.type.every(t => typeof t === 'string' && kinds.has(t)))) return false;
    for (const key of ['title', 'description', '$schema']) if (v[key] !== undefined && (typeof v[key] !== 'string' || v[key].length > 4000)) return false;
    for (const key of ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum']) if (v[key] !== undefined && (typeof v[key] !== 'number' || !Number.isFinite(v[key]))) return false;
    for (const key of ['minLength', 'maxLength', 'minItems', 'maxItems']) if (v[key] !== undefined && (!Number.isSafeInteger(v[key]) || Number(v[key]) < 0 || Number(v[key]) > 100000)) return false;
    if (v.enum !== undefined && (!Array.isArray(v.enum) || !v.enum.length || v.enum.length > 128 || v.enum.some(x => x !== null && !['string', 'number', 'boolean'].includes(typeof x)))) return false;
    if (v.const !== undefined && v.const !== null && !['string', 'number', 'boolean'].includes(typeof v.const)) return false;
    if (v.properties !== undefined && (!record(v.properties) || Object.keys(v.properties).length > 128 || Object.entries(v.properties).some(([k, x]) => ['__proto__', 'constructor', 'prototype'].includes(k) || k.length > 128 || !visit(x, depth + 1)))) return false;
    if (v.required !== undefined && (!Array.isArray(v.required) || new Set(v.required).size !== v.required.length || v.required.some(k => typeof k !== 'string' || !record(v.properties) || !Object.prototype.hasOwnProperty.call(v.properties, k)))) return false;
    if (v.additionalProperties !== undefined && typeof v.additionalProperties !== 'boolean' && !visit(v.additionalProperties, depth + 1)) return false;
    if (v.items !== undefined && !visit(v.items, depth + 1)) return false;
    for (const key of ['anyOf', 'oneOf', 'allOf']) if (v[key] !== undefined && (!Array.isArray(v[key]) || !v[key].length || v[key].length > 16 || !v[key].every(x => visit(x, depth + 1)))) return false;
    return true;
  }
  try { return JSON.stringify(schema).length <= 65536 && record(schema) && schema.type === 'object' && visit(schema, 0); } catch { return false; }
}
export function validMcpTools(tools: Tool[]): boolean {
  return Array.isArray(tools) && tools.length <= 128 && new Set(tools.map(t => t?.name)).size === tools.length && tools.every(t => record(t) && typeof t.name === 'string' && /^[A-Za-z0-9_.-]{1,96}$/.test(t.name) && validMcpSchema(t.inputSchema)
    && (t.title === undefined || typeof t.title === 'string' && t.title.length <= 4000)
    && (t.description === undefined || typeof t.description === 'string' && t.description.length <= 8000)
    && (t.annotations === undefined || record(t.annotations) && Object.entries(t.annotations).every(([k, v]) => k === 'title' ? typeof v === 'string' && v.length <= 4000 : ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'].includes(k) && typeof v === 'boolean')));
}
/** Key ordering must not revoke an unchanged schema. Array ordering remains semantic. */
export function canonicalMcp(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalMcp).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).filter(k => value[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonicalMcp(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
