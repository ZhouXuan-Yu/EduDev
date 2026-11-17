import {parseFrontmatter} from '@earendil-works/pi-coding-agent';
import {SKILL_LIMITS, exactSkillObject, validSkillName} from '../skill-catalog-state';
import type {SkillDependency, SkillDraftInput, SkillValidation} from '../../../shared/xiaozhi-skill-governance';
import type {SkillPrivateContext} from './private-context';

export const validSemver = (value: unknown): value is string => typeof value === 'string'
  && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value);
export const containsSkillSensitiveText = (text: string) => /(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,}|(?:api[_-]?key|password|secret|token)\s*[:=]\s*\S{4,}|\b1[3-9]\d{9}\b|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:学生姓名|身份证|学号)\s*[:：]\s*\S+)/i.test(text);
export const containsSkillSensitiveMetadata = (text: string) => containsSkillSensitiveText(text) || /1[3-9]\d{9}/.test(text);
export function validDependencies(value: unknown): value is SkillDependency[] {
  return Array.isArray(value) && value.length <= 32 && value.every(item =>
    (exactSkillObject(item, ['capabilityId', 'contractVersion', 'required'])
      || exactSkillObject(item, ['capabilityId', 'contractVersion', 'required', 'conditions']))
    && typeof item.capabilityId === 'string' && /^[a-z][a-z0-9.-]{1,127}$/.test(item.capabilityId)
    && validSemver(item.contractVersion) && typeof item.required === 'boolean'
    && (item.conditions === undefined || Array.isArray(item.conditions) && item.conditions.length <= 32
      && item.conditions.every(condition => typeof condition === 'string' && /^[a-z][a-z0-9_.:-]{0,127}$/.test(condition))))
    && new Set(value.map(item => item.capabilityId)).size === value.length;
}
export function validDraft(value: unknown): value is SkillDraftInput {
  return exactSkillObject(value, ['name', 'description', 'document', 'version', 'dependencies', 'permissionRequirements'])
    && validSkillName(value.name) && typeof value.description === 'string' && Boolean(value.description.trim())
    && value.description.length <= 1024 && typeof value.document === 'string' && Boolean(value.document.trim())
    && Buffer.byteLength(value.document) <= SKILL_LIMITS.instructionBytes - 2048 && !value.document.includes('\0')
    && validSemver(value.version) && validDependencies(value.dependencies)
    && Array.isArray(value.permissionRequirements) && value.permissionRequirements.length <= 32
    && value.permissionRequirements.every(item => typeof item === 'string' && /^[a-z][a-z0-9_.:-]{0,127}$/.test(item));
}
export function draftDocument(draft: SkillDraftInput, name = draft.name) {
  return `---\nname: ${name}\ndescription: ${JSON.stringify(draft.description)}\n---\n${draft.document.trim()}\n`;
}
export type SkillValidator = ReturnType<typeof createSkillValidator>;
export function createSkillValidator(options: {
  sanitize: (text: string) => Promise<string>;
  dependency: (dependency: SkillDependency) => Promise<boolean>;
  permission?: (requirement: string) => Promise<boolean>;
  privateContext?: () => Promise<SkillPrivateContext | undefined>;
}) {
  async function satisfied(check: () => Promise<boolean>) {
    try { return await check(); } catch { return false; }
  }
  return async function validate(bytes: Map<string, Buffer>, dependencies: SkillDependency[], permissions: string[]): Promise<SkillValidation> {
    const checks: SkillValidation['checks'] = [];
    const add = (kind: SkillValidation['checks'][number]['kind'], reasons: string[]) => checks.push({kind, passed: reasons.length === 0, reasons});
    const structural: string[] = [];
    const texts: string[] = [];
    if (!bytes.has('SKILL.md') || bytes.size > SKILL_LIMITS.files) structural.push('missing_or_excess_resources');
    for (const [relative, buffer] of bytes) {
      if (!/\.(md|txt)$/i.test(relative) || buffer.length > SKILL_LIMITS.instructionBytes) structural.push('executable_or_unsupported_resource');
      try { texts.push(new TextDecoder('utf-8', {fatal: true}).decode(buffer)); }
      catch { structural.push('invalid_utf8'); }
    }
    add('structure', [...new Set(structural)]);
    const privacy: string[] = [];
    const instructions: string[] = [];
    const privateContext = await options.privateContext?.();
    const declarations = [...dependencies.flatMap(dependency => [dependency.capabilityId, dependency.contractVersion, ...(dependency.conditions || [])]), ...permissions];
    for (const text of [...texts, ...declarations]) {
      const clean = await options.sanitize(text);
      if (clean !== text || containsSkillSensitiveMetadata(text)) {
        privacy.push('sensitive_content');
      }
      if (privateContext?.contains(text)) privacy.push('private_source_excerpt');
      if (/```|~~~|https?:\/\/|file:\/\/|<\s*(?:script|iframe|style|object|img|!--)|[\u200b-\u200f\u202a-\u202e\u2060-\u206f]/i.test(text)) {
        instructions.push('executable_link_or_hidden_content');
      }
      if (/(?:ignore|override|bypass)\s+(?:all\s+)?(?:previous|system|permission|approval)|(?:忽略|绕过|覆盖).{0,16}(?:系统指令|权限|审批|授权)|(?:无需|不需).{0,8}(?:授权|审批).{0,8}(?:读取|删除|上传)/i.test(text)) {
        instructions.push('authority_override');
      }
    }
    add('privacy', [...new Set(privacy)]);
    add('instructions', [...new Set(instructions)]);
    const missing: string[] = [];
    const optional: string[] = [];
    for (const dependency of dependencies) {
      if (!await satisfied(() => options.dependency(dependency))) {
        if (dependency.required) missing.push(dependency.capabilityId);
        else optional.push(dependency.capabilityId);
      }
    }
    checks.push({kind: 'dependencies', passed: missing.length === 0,
      reasons: [...missing.map(id => `missing:${id}`), ...optional.map(id => `optional_missing:${id}`)]});
    const permissionReasons: string[] = [];
    const deferredPermissions: string[] = [];
    for (const permission of permissions) {
      if (/^(?:grant|admin|official|authorize)(?:[.:_-]|$)/.test(permission)) permissionReasons.push('authority_claim');
      else if (!options.permission) deferredPermissions.push(`runtime_required:${permission}`);
      else if (!await satisfied(() => options.permission!(permission))) permissionReasons.push(`missing_permission:${permission}`);
    }
    checks.push({kind: 'permissions', passed: permissionReasons.length === 0,
      reasons: [...new Set([...permissionReasons, ...deferredPermissions])]});
    let parserFailure = false;
    try {
      const document = bytes.get('SKILL.md')?.toString('utf8') || '';
      const {frontmatter, body} = parseFrontmatter<{name: string; description: string}>(document);
      parserFailure = !validSkillName(frontmatter.name) || !frontmatter.description?.trim() || !body.trim()
        || Object.keys(frontmatter).some(key => key !== 'name' && key !== 'description');
    } catch { parserFailure = true; }
    add('parser', parserFailure ? ['invalid_skill_document'] : []);
    return {version: 1, passed: checks.every(check => check.passed), checks, checkedAt: new Date().toISOString()};
  };
}
