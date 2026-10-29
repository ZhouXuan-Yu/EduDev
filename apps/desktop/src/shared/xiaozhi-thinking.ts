import type { XiaozhiModelCapabilities } from './xiaozhi-agent';

export const THINKING_CHOICES = ['auto', 'off', 'low', 'high', 'max'] as const;
export type ThinkingChoice = typeof THINKING_CHOICES[number];
export const THINKING_LABELS: Record<ThinkingChoice, string> = { auto: '自动', off: '关闭思考', low: '低', high: '高', max: '最高' };
export const validThinkingChoice = (value: unknown): value is ThinkingChoice => THINKING_CHOICES.includes(value as ThinkingChoice);
export type ThinkingSetting = { version: number; choice: ThinkingChoice | null };
export type ThinkingDecision = {
  requested: ThinkingChoice; effective: ThinkingChoice; scope: 'global' | 'session';
  thinkingType: 'enabled' | 'disabled'; effort?: 'low' | 'high' | 'max' | 'none';
  maxOutputTokens: number; mode: 'fast' | 'standard' | 'deep'; reason?: 'capability_unknown' | 'unsupported_choice';
};
export type ThinkingView = { global: ThinkingSetting; session?: ThinkingSetting; lastRun?: ThinkingDecision & { runId: string; model: string } };
export type ThinkingInput = { schemaVersion: 'xiaozhi.settings.v1'; sessionId?: string; version: number; choice: ThinkingChoice | null };
export function supportedThinking(capacity?: XiaozhiModelCapabilities): ThinkingChoice[] {
  return capacity && !capacity.stale && capacity.effort
    ? ['auto', 'off', ...capacity.effort.supportedLevels] : ['auto'];
}
