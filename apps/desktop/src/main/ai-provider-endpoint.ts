import type { AiProviderId } from '../shared/contracts';

export function chatCompletionsUrl(provider: AiProviderId): string {
  return provider === 'glm'
    ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
    : 'https://api.deepseek.com/chat/completions';
}
