export function normalizeAiConsoleError(message: string | undefined, provider: 'deepseek' | 'glm' = 'deepseek'): string {
  const detail = String(message ?? '').trim();
  if (/fetch failed|ECONNRESET|ENOTFOUND|ETIMEDOUT|TLS handshake/i.test(detail)) {
    return `无法连接 ${provider === 'glm' ? '智谱 GLM' : 'DeepSeek'} API。请检查网络、代理或防火墙后重试；请求尚未到达服务端，不能据此判断密钥是否有效。`;
  }
  return detail || '小智运行失败，请查看运行记录。';
}
