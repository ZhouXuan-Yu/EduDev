import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {TaskView} from '../../../shared/xiaozhi-task';
import type {MethodReviewEvidence} from '../../../shared/xiaozhi-personal-memory';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {SkillGovernance} from './service';
import {unwrapTaskArguments} from '../tasks/tool-envelope';
import {SKILL_GOVERNANCE_ERRORS} from '../../../shared/xiaozhi-skill-governance';

/** A teacher may inspect a workflow without publishing a personal Skill. This can only restrict tools. */
export function methodReviewOnly(request:string) {
  const text=request.normalize('NFKC');
  if (/(?:不要|不能|不得|别|禁止|不必|不需要|暂不|暂缓|不)(?:再|直接|自动|立即|马上|先|进行|将其|把它|把这个流程)*(?:发布|创建|安装|启用|激活|采用|晋升|保存为|转为|转成|建成)[^，。；！？\n]{0,12}(?:技能|流程|方法|skill)/iu.test(text)) return true;
  if (!/(?:技能|流程|方法|skill)/iu.test(text)) return false;
  return /(?:作为|当作|列为|留作|保留为|记为|只做|只是|仅做|仅作为)(?:一个|一项|一条)?候选|候选(?:工作)?(?:方法|流程|技能)|(?:只|仅|先)(?:验证|评估|评审|审阅|试用|检查适用范围)|暂不(?:发布|采用|启用)/u.test(text);
}

export function currentMethodEvidence(task:TaskView,owner:PermissionOwner):MethodReviewEvidence|undefined {
  if (task.state!=='active'||task.sessionId!==owner.sessionId||task.id!==owner.taskId||
      task.binding?.runId!==owner.runId||task.binding.generation!==owner.generation) return;
  const review:MethodReviewEvidence={category:'reusable_method',scope:'current_task',
    requirementsVersion:task.requirementsVersion,teacherAccepted:0,teacherRejected:0,readbackPassed:0,
    independentValidation:'not_established'};
  for (const criterion of task.criteria) {
    const matches=task.checks.filter(check=>check.criterionId===criterion.id && check.criterionVersion===criterion.version);
    const first=matches[0];
    if (!first||!/^[a-f0-9]{64}$/.test(first.digest)||matches.some(check=>check.digest!==first.digest||
      check.state!==first.state||check.authority!==first.authority)) continue;
    if (first.authority==='teacher' && criterion.kind==='human' && first.confirmationId && first.candidate?.runId===first.runId) {
      if(first.state==='passed') review.teacherAccepted++;
      if(first.state==='failed') review.teacherRejected++;
    } else if (first.authority==='readback' && criterion.kind!=='human' && first.callId && first.state==='passed') {
      review.readbackPassed++;
    }
  }
  return review;
}

export function createSkillCreatorTools(service: SkillGovernance, owner: () => PermissionOwner): ToolDefinition[] {
  return [{name: 'skill_create', label: '保存个人工作方法',
    description: '仅在教师要求保存可复用方法或流程已稳定验证时调用。自动验证并发布纯说明型个人技能，下个安全Run激活。只写通用工作流程，不写学生信息、私有原文、秘密、脚本或外链。依赖使用已有稳定Capability ID，权限需求只是说明。',
    parameters: {type: 'object', additionalProperties: false,
      properties: {name: {type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 64},
        description: {type: 'string', minLength: 1, maxLength: 1024}, document: {type: 'string', minLength: 1, maxLength: 30000},
        version: {type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$'},
        dependencies: {type: 'array', maxItems: 32, items: {type: 'object', additionalProperties: false,
          properties: {capabilityId: {type: 'string'}, contractVersion: {type: 'string'}, required: {type: 'boolean'},
            conditions: {type: 'array', maxItems: 32, items: {type: 'string'}}},
          required: ['capabilityId', 'contractVersion', 'required']}},
        permissionRequirements: {type: 'array', maxItems: 32, items: {type: 'string'}}},
      required: ['name', 'description', 'document', 'version', 'dependencies', 'permissionRequirements']} as ToolDefinition['parameters'],
    async execute(_callId, raw, signal) {
      signal?.throwIfAborted();
      const input = unwrapTaskArguments(raw).input;
      let result;
      try { result = await service.publish(input, owner()); }
      catch (error) {
        signal?.throwIfAborted();
        const code = error instanceof Error ? error.message : '';
        if (!Object.hasOwn(SKILL_GOVERNANCE_ERRORS, code)) throw error;
        const message = SKILL_GOVERNANCE_ERRORS[code as keyof typeof SKILL_GOVERNANCE_ERRORS];
        return {content: [{type: 'text', text: JSON.stringify({error: code, message})}],
          isError: true, details: {success: false}};
      }
      signal?.throwIfAborted();
      return {content: [{type: 'text', text: JSON.stringify({skillId: result.skillId, version: result.version.version,
        sha256: result.version.sha256, state: result.version.state, validation: result.version.validation,
        activation: result.version.state === 'published' ? 'next_safe_run' : 'blocked_validation'})}],
      details: {success: result.version.validation.passed}};
    }}];
}
