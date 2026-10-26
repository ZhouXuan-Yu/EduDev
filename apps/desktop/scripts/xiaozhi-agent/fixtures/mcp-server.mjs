import http from 'node:http';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

export const fixtureTools = () => [
  { name: 'lookup_lesson', title: '查询公开课程', description: 'Read public lesson metadata.', inputSchema: { type: 'object', properties: { topic: { type: 'string', minLength: 1, maxLength: 100 } }, required: ['topic'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'unknown_effect', inputSchema: { type: 'object', properties: {} } },
];
function reply(request, state) {
  if (!('id' in request)) return;
  if (request.method === 'initialize') return state.hangInitialize ? 'hang' : { jsonrpc: '2.0', id: request.id, result: { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'owned-education-mcp', version: '1' } } };
  if (request.method === 'tools/list') return { jsonrpc: '2.0', id: request.id, result: { tools: state.tools, ...(state.endless ? { nextCursor: 'again' } : {}) } };
  if (request.method === 'tools/call') {
    state.calls++;
    if (state.drop) return 'drop';
    if (state.hang) return 'hang';
    if (state.protocolError) return { jsonrpc: '2.0', id: request.id, error: { code: -32603, message: 'Private raw protocol details ' + state.secret } };
    return { jsonrpc: '2.0', id: request.id, result: { content: [{ type: 'text', text: state.toolError ? 'upstream error ' + state.secret : '课程资料：' + request.params.arguments.topic + (state.echoSecret ? ' ' + state.secret : '') }], ...(state.toolError ? { isError: true } : {}) } };
  }
  return { jsonrpc: '2.0', id: request.id, result: {} };
}
export async function startMcpFixture() {
  const state = { tools: fixtureTools(), calls: 0, requests: 0, auth: '', secret: '', hang: false, drop: false, toolError: false, protocolError: false, echoSecret: false, endless: false };
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    state.requests++;
    if (state.auth && req.headers.authorization !== 'Bearer ' + state.auth) { res.writeHead(401).end(); return; }
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 262144) { res.writeHead(413).end(); return; } }
    const response = reply(JSON.parse(body), state);
    if (response === 'drop') { req.socket.destroy(); return; }
    if (response === 'hang') return;
    if (!response) { res.writeHead(202).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(response));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { state, url: `http://127.0.0.1:${server.address().port}/mcp`, close: async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const state = { tools: fixtureTools(), calls: 0, secret: process.env.MCP_API_KEY || '' };
  const reader = readline.createInterface({ input: process.stdin });
  reader.on('line', line => { try { const response = reply(JSON.parse(line), state); if (response && typeof response === 'object') process.stdout.write(JSON.stringify(response) + '\n'); } catch { process.exitCode = 1; } });
}
