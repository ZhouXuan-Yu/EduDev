#!/usr/bin/env node
/**
 * HeroUI Pro MCP 直连客户端。
 *
 * 为什么存在：`mcp__heroui-pro__*` 工具只在 Claude Code 会话启动时加载，且需要
 * 项目级 MCP 批准。在工具未加载、未批准或非交互会话里，`docs/17` §7.1 要求的
 * 「先查 HeroUI Pro」就无法执行。本脚本用同样的 HTTP 端点直连，保证该流程随时可跑。
 *
 * 用法：
 *   node scripts/heroui-mcp.mjs list                     列出全部组件（Pro + OSS）
 *   node scripts/heroui-mcp.mjs docs <组件...>            取组件文档（anatomy/props/示例）
 *   node scripts/heroui-mcp.mjs css <组件...>             取 BEM 样式
 *   node scripts/heroui-mcp.mjs guide <主题>              取指南（installation/theming/styling...）
 *   node scripts/heroui-mcp.mjs tokens                    取主题变量与设计令牌
 *
 * 需要环境变量 HEROUI_PRO_TOKEN。缺失时脚本明确报错退出，不会静默发空凭据。
 */

const ENDPOINT = 'https://gateway.shunquan.wang/proxy/heroui-pro-mcp/mcp';
const TOKEN = process.env.HEROUI_PRO_TOKEN;

if (!TOKEN) {
  console.error('[heroui-mcp] 缺少环境变量 HEROUI_PRO_TOKEN。');
  console.error('  设置方式（用户级，一次即可）：');
  console.error('    setx HEROUI_PRO_TOKEN "<你的 Personal Access Token>"');
  console.error('  设置后需重开终端才生效。token 不要写进仓库任何文件。');
  process.exit(2);
}

const HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  'x-heroui-personal-token': TOKEN,
  'x-proxy-key': TOKEN,
};

/** MCP 响应可能是纯 JSON，也可能是 SSE 帧；两种都要解。 */
function parseBody(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const dataLines = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (!dataLines.length) throw new Error(`无法解析响应：${trimmed.slice(0, 200)}`);
  return JSON.parse(dataLines[dataLines.length - 1]);
}

let sessionId = null;
let nextId = 1;

async function rpc(method, params) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: sessionId ? { ...HEADERS, 'mcp-session-id': sessionId } : HEADERS,
    body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const body = parseBody(await res.text());
  if (!body) throw new Error('空响应');
  if (body.error) throw new Error(`${body.error.code ?? ''} ${body.error.message ?? JSON.stringify(body.error)}`);
  return body.result;
}

async function callTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  const text = (result?.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
  if (result?.isError) throw new Error(text || '工具调用失败');
  return text;
}

const [command, ...rest] = process.argv.slice(2);

if (!command) {
  console.error('用法：node scripts/heroui-mcp.mjs <list|docs|css|guide|tokens> [参数...]');
  process.exit(1);
}

try {
  await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'omni-edu-heroui-client', version: '1.0' },
  });

  let out;
  switch (command) {
    case 'list':
      out = await callTool('list_components', {});
      break;
    case 'docs':
    case 'css': {
      if (!rest.length) throw new Error(`${command} 需要至少一个组件名`);
      out = await callTool(command === 'docs' ? 'get_component_docs' : 'get_css', { components: rest });
      break;
    }
    case 'guide': {
      if (!rest.length) throw new Error('guide 需要一个主题，例如 installation / theming / styling');
      const topic = rest.join(' ');
      // 允许短名（installation）或完整 path（/pro/docs/react/getting-started/installation）。
      const path = topic.startsWith('/') ? topic : `/pro/docs/react/getting-started/${topic}`;
      out = await callTool('get_docs', { path });
      break;
    }
    case 'tokens':
      out = await callTool('get_theme_variables', {});
      break;
    default:
      throw new Error(`未知命令：${command}`);
  }

  console.log(out);
} catch (error) {
  console.error(`[heroui-mcp] ${error.message}`);
  process.exit(1);
}
