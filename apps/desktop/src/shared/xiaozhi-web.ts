export const XIAOZHI_WEB_SCHEMA = 'xiaozhi.web.v1' as const;
export type XiaozhiWebPreferences = { version: number; enabled: boolean; dnsMode: 'auto' | 'system' | 'alidns' };
export type XiaozhiWebInput = XiaozhiWebPreferences & { schemaVersion: typeof XIAOZHI_WEB_SCHEMA };
export type XiaozhiWebSourceInput = { sessionId: string; url: string };
export type XiaozhiPublicSource = { title: string; url?: string; observedAt?: string; kind?: 'search' | 'read' };
export type XiaozhiWebError = 'permission_denied' | 'dns_blocked' | 'invalid_input' | 'cancelled' | 'timeout' | 'network' | 'rate_limited' | 'service_error' | 'too_large' | 'unsupported';
export const XIAOZHI_WEB_ERRORS: Record<XiaozhiWebError, string> = {
  dns_blocked:'系统解析返回了代理虚拟地址。请在联网设置中选择自动或国内解析后重试。',
  permission_denied: '联网未获授权，或目标地址不是可访问的公开地址。', invalid_input: '联网参数无效，请调整查询或网址。',
  cancelled: '已停止本次联网操作。', timeout: '公开资料读取超时，请稍后重试。', network: '无法连接公开资料来源，请检查网络或在设置中选择国内解析后重试。',
  rate_limited: '公开搜索服务额度不足或请求过于频繁，请稍后重试。', service_error: '公开搜索或网页服务暂时不可用，请稍后重试。',
  too_large: '网页内容超过本次读取上限，请选择较小的公开页面。', unsupported: '此链接不是可读取的网页正文，请使用公开文字页面。',
};
