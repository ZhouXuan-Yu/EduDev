import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadSkillsFromDir, type LoadSkillsResult, type ToolDefinition } from '@earendil-works/pi-coding-agent';
// Legacy SDK-only adapter preserves v1 native snapshots. Production uses managed-skills and reviewed current versions.
import { LEGACY_EDUCATION_SKILLS as EDUCATION_SKILLS, legacySkillDocument as skillDocument } from './education-skills-legacy-v1';
import { snapshotSkillsForSession, resolveSessionSkillsForRuntime } from './vendor/hana/lib/skills/session-skill-snapshot';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
/** Reviewed application resources only. No default/global/workspace discovery. */
export async function createEducationSkillRuntime(agentDir: string, sessionFile: string) {
  const root = path.join(agentDir, 'education-skills-v1');
  fs.mkdirSync(root, { recursive: true });
  if (fs.realpathSync(root).toLowerCase() !== path.resolve(root).toLowerCase()) throw new Error('skill_source_changed');
  const skillsResult: LoadSkillsResult = { skills: [], diagnostics: [] };
  const expected = new Map<string, { name: string; title: string; sha256: string; filePath: string }>();
  for (const item of EDUCATION_SKILLS) {
    const dir = path.join(root, item.name), filePath = path.join(dir, 'SKILL.md'), document = skillDocument(item);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.realpathSync(dir).toLowerCase() !== path.resolve(dir).toLowerCase()) throw new Error('skill_source_changed');
    // Existing source is never silently overwritten. A mismatch stops this session.
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, document, { flag: 'wx', encoding: 'utf8' });
    if (fs.lstatSync(filePath).isSymbolicLink() || fs.realpathSync(filePath).toLowerCase() !== filePath.toLowerCase()
      || fs.statSync(filePath).size > 32768 || hash(fs.readFileSync(filePath)) !== hash(document)) throw new Error('skill_source_changed');
    const loaded = loadSkillsFromDir({ dir, source: 'builtin' });
    if (loaded.diagnostics.length || loaded.skills.length !== 1 || loaded.skills[0].name !== item.name) throw new Error('configuration');
    skillsResult.skills.push(loaded.skills[0]);
    expected.set(filePath.toLowerCase(), { name: item.name, title: item.title, sha256: hash(document), filePath });
  }
  const snapshot = await snapshotSkillsForSession(skillsResult, sessionFile);
  const result = resolveSessionSkillsForRuntime(snapshot) as LoadSkillsResult;
  if (result.diagnostics.length || result.skills.length !== EDUCATION_SKILLS.length) throw new Error('skill_source_changed');
  function check() {
    try {
      if (fs.realpathSync(root).toLowerCase() !== root.toLowerCase()) throw new Error();
      for (const item of expected.values()) {
        const stat = fs.lstatSync(item.filePath);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 32768
          || fs.realpathSync(item.filePath).toLowerCase() !== item.filePath.toLowerCase()
          || hash(fs.readFileSync(item.filePath)) !== item.sha256) throw new Error();
      }
    } catch { throw new Error('skill_source_changed'); }
  }
  function validateCommand(text: string) {
    if (text.startsWith('/skill:') && !result.skills.some(item => item.name === text.slice(7).split(' ')[0])) throw new Error('invalid_input');
    check();
  }
  // Pi expands queued /skill commands before message_start. Match that pinned
  // native public message to the original offered instruction, without replacing
  // native expansion or changing plain-text instruction identity.
  function matchesCommand(original: string, delivered: string) {
    if (!original.startsWith('/skill:')) return false;
    const split = original.indexOf(' '), name = split < 0 ? original.slice(7) : original.slice(7, split);
    const skill = result.skills.find(item => item.name === name), definition = EDUCATION_SKILLS.find(item => item.name === name);
    if (!skill || !definition) return false;
    const args = split < 0 ? '' : original.slice(split + 1).trim();
    const body = `# ${definition.title}\n\n${definition.instructions}`.trim();
    const native = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
    return delivered === (args ? `${native}\n\n${args}` : native);
  }
  const tool: ToolDefinition = { name: 'read', label: '读取教育技能', description: '仅加载 available_skills 中注册的教育技能 SKILL.md；参数 path 必须是目录列表给出的完整文件路径。不读取其它文件、不执行脚本，不改变资料权限。实际教师资料用 office_read_text 或 search_teacher_knowledge。',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } as ToolDefinition['parameters'],
    execute: async (_callId, args, signal) => {
      if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1
        || typeof (args as { path?: unknown }).path !== 'string') throw new Error('invalid_input');
      const supplied = (args as { path: string }).path;
      if (supplied.length > 4096 || supplied.includes('\0') || !path.isAbsolute(supplied)) throw new Error('invalid_input');
      const item = expected.get(path.resolve(supplied).toLowerCase());
      if (!item) throw new Error('permission_denied');
      signal?.throwIfAborted(); check();
      const text = fs.readFileSync(item.filePath, 'utf8'); check(); signal?.throwIfAborted();
      return { content: [{ type: 'text', text }], details: { success: true, data: { source: `教育技能：${item.title}` } } };
    } };
  return { result, tool, check, validateCommand, matchesCommand,
    identity: [...expected.values()].map(({ name, sha256 }) => ({ name, sha256 })) };
}
