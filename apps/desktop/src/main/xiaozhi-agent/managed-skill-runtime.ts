import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSkillsFromDir, stripFrontmatter, parseFrontmatter, type LoadSkillsResult, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import { noLinks, boundedRead, readPackage, type createManagedEducationSkills } from './managed-skills';
import { SKILL_LIMITS, validSkillName } from './skill-catalog-state';
import { skillAuthority, type SkillAuthorityIdentity } from './native-skill-epoch';
import { snapshotSkillsForSession, resolveSessionSkillsForRuntime } from './vendor/hana/lib/skills/session-skill-snapshot';

export type ManagedSkillSource = { resources: ReturnType<typeof createManagedEducationSkills>['enabledResources']; sanitize: (text: string) => Promise<string> };
const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const key = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const MAX_REFERENCE = 65536;
/** Model resources contain only authorized necessary text; original packages remain local. */
export async function createManagedSkillRuntime(agentDir: string, sessionFile: string, source: ManagedSkillSource) {
  async function capture() {
    const current = await source.resources(), identities: SkillAuthorityIdentity[] = [];
    const prepared: { name: string; title: string; texts: Map<string, string> }[] = [];
    for (const { item, bytes } of current.resources) {
      if (!validSkillName(item.name)) throw new Error('configuration');
      const texts = new Map<string, string>();
      for (const [relative, value] of bytes) {
        if (relative !== 'SKILL.md' && (!/\.(md|txt|json|csv)$/i.test(relative) || value.length > MAX_REFERENCE)) continue;
        let raw: string;
        try { raw = new TextDecoder('utf-8', { fatal: true }).decode(value); } catch { throw new Error('invalid_input'); }
        const clean = await source.sanitize(raw);
        if (typeof clean !== 'string' || clean.includes('\0') || Buffer.byteLength(clean) > (relative === 'SKILL.md' ? SKILL_LIMITS.instructionBytes : MAX_REFERENCE)) throw new Error('invalid_input');
        texts.set(relative, clean);
      }
      const document = texts.get('SKILL.md');
      if (!document) throw new Error('configuration');
      const { frontmatter, body } = parseFrontmatter<{ name: string; description: string }>(document);
      if (frontmatter.name !== item.name || typeof frontmatter.description !== 'string' || !frontmatter.description.trim()
        || frontmatter.description.length > 1024 || !body.trim()) throw new Error('configuration');
      const textIdentity = [...texts].sort(([a], [b]) => a.localeCompare(b)).map(([relative, text]) => ({ relative, sha256: sha(text) }));
      // Preserve the reviewed P05-A identity for unchanged builtin single-document packages.
      const digest = item.origin === 'builtin' && item.files.length === 1 && sha(document) === item.files[0].sha256 ? sha(document)
        : sha(JSON.stringify({ version: item.version, files: item.files, texts: textIdentity }));
      identities.push({ name: item.name, sha256: digest });
      prepared.push({ name: item.name, title: body.match(/^#\s+([^\r\n]+)/m)?.[1]?.trim() || item.name, texts });
    }
    identities.sort((a, b) => a.name.localeCompare(b.name));
    const after = await source.resources();
    if (JSON.stringify(current.resources.map(resource => resource.item)) !== JSON.stringify(after.resources.map(resource => resource.item))) throw new Error('skill_scope_changed');
    return { identity: identities, authority: skillAuthority(identities), prepared };
  }
  const initial = await capture(), root = path.join(agentDir, 'managed-skills-v2', initial.authority);
  noLinks(root, true); fs.mkdirSync(root, { recursive: true }); noLinks(root);
  const expected = new Map<string, { filePath: string; text: string; name: string; title: string; sha256: string }>();
  const loaded: LoadSkillsResult = { skills: [], diagnostics: [] };
  function verifyDirectory(directory: string, texts: Map<string, string>) {
    try {
      const bytes = readPackage(directory);
      if (bytes.size !== texts.size || [...texts].some(([relative, text]) => !bytes.has(relative) || sha(bytes.get(relative)!) !== sha(text))) throw new Error();
    } catch { throw new Error('skill_source_changed'); }
  }
  for (const item of initial.prepared) {
    const directory = path.join(root, item.name); noLinks(directory, true); fs.mkdirSync(directory, { recursive: true });
    for (const [relative, text] of item.texts) {
      const filePath = path.join(directory, relative); noLinks(filePath, true);
      fs.mkdirSync(path.dirname(filePath), { recursive: true }); noLinks(path.dirname(filePath));
      if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, text, { flag: 'wx' });
      expected.set(key(filePath), { filePath, text, name: item.name, title: item.title, sha256: sha(text) });
    }
    // Check the complete cache before the native parser reads files/ignore rules.
    verifyDirectory(directory, item.texts);
    const result = loadSkillsFromDir({ dir: directory, source: 'path' });
    if (result.diagnostics.length || result.skills.length !== 1 || result.skills[0].name !== item.name) throw new Error('configuration');
    loaded.skills.push(result.skills[0]);
  }
  function checkFiles() {
    try {
      noLinks(root);
      for (const item of initial.prepared) verifyDirectory(path.join(root, item.name), item.texts);
      for (const item of expected.values()) {
        noLinks(item.filePath);
        const stat = fs.statSync(item.filePath);
        if (!stat.isFile() || stat.size !== Buffer.byteLength(item.text) || sha(boundedRead(item.filePath, MAX_REFERENCE)) !== item.sha256) throw new Error();
      }
    } catch { throw new Error('skill_source_changed'); }
  }
  checkFiles();
  const result = resolveSessionSkillsForRuntime(await snapshotSkillsForSession(loaded, sessionFile)) as LoadSkillsResult;
  if (result.diagnostics.length || result.skills.length !== initial.identity.length) throw new Error('skill_source_changed');
  async function check() {
    checkFiles();
    const current = await capture();
    if (current.authority !== initial.authority) throw new Error('skill_scope_changed');
    checkFiles();
  }
  async function validateCommand(text: string) {
    if (text.startsWith('/skill:') && !result.skills.some(item => item.name === text.slice(7).split(' ')[0])) throw new Error('invalid_input');
    await check();
  }
  function matchesCommand(original: string, delivered: string) {
    if (!original.startsWith('/skill:')) return false;
    const split = original.indexOf(' '), name = split < 0 ? original.slice(7) : original.slice(7, split);
    const skill = result.skills.find(item => item.name === name), document = skill ? expected.get(key(skill.filePath)) : undefined;
    if (!skill || !document) return false;
    const args = split < 0 ? '' : original.slice(split + 1).trim();
    const native = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${stripFrontmatter(document.text).trim()}\n</skill>`;
    return delivered === (args ? `${native}\n\n${args}` : native);
  }
  const tool: ToolDefinition = { name: 'read', label: '读取教育技能', description: '仅读取当前 available_skills 中的必要脱敏说明及已登记文本引用；path使用完整文件路径。不执行脚本，不读取其它文件或扩大教师资料权限。',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } as ToolDefinition['parameters'],
    execute: async (_id, args, signal) => {
      if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1 || typeof (args as { path?: unknown }).path !== 'string') throw new Error('invalid_input');
      const supplied = (args as { path: string }).path;
      if (supplied.length > 4096 || supplied.includes('\0') || !path.isAbsolute(supplied)) throw new Error('invalid_input');
      const item = expected.get(key(supplied)); if (!item) throw new Error('permission_denied');
      signal?.throwIfAborted(); await check(); signal?.throwIfAborted();
      // Exact validated in-memory text matches the native immutable model resource.
      const text = item.text;
      await check(); signal?.throwIfAborted();
      return { content: [{ type: 'text', text }], details: { success: true, data: { source: `教育技能：${item.title}` } } };
    } };
  await check();
  return { result, identity: initial.identity, authority: initial.authority, check, validateCommand, matchesCommand, tool };
}
