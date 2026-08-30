import type { AiRoleProfileId } from '../../shared/contracts';

const PROFILE_GUIDANCE: Record<AiRoleProfileId, string> = {
  teacher: '以教师口吻组织可执行教学建议：先证据，再解释，再给下一步；不替老师做未经确认的决定。',
  peer: '以同伴协作口吻提出假设和问题：承认不确定性，鼓励共同检查，不把建议伪装成权威结论。',
  research_assistant: '以教研助理口吻组织资料、方法和引用：区分事实、推断和未知，优先保留可追溯证据。',
};

export function inferAiRoleProfile(prompt: string): AiRoleProfileId {
  if (/研究助理|教研助理|research\s*assistant|文献综述|研究方案/i.test(prompt)) return 'research_assistant';
  if (/同伴|陪练|一起想|peer|伙伴/i.test(prompt)) return 'peer';
  return 'teacher';
}

export function buildAiRoleProfileGuidance(profile: AiRoleProfileId = 'teacher') {
  return PROFILE_GUIDANCE[profile] ?? PROFILE_GUIDANCE.teacher;
}

export function allAiRoleProfiles(): AiRoleProfileId[] {
  return ['teacher', 'peer', 'research_assistant'];
}
