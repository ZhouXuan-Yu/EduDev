import http from 'node:http';
import {once} from 'node:events';
import {createHash} from 'node:crypto';

export const streamWorkload = Object.freeze({reasoningChunks: 240, finalChunks: 320, intervalMs: 30,
  reasoningText: '合成流式测量，核对已给条件和来源，保留教师确认与实际结果。'.repeat(8) + '\n',
  finalText: '这是一段合成课堂说明，用于比较同一负载的流式渲染与交互。核对条件、保持清晰，并检查实际输出。'.repeat(5)});

export async function startStreamFixture() {
  const requests = [];
  const sockets = new Set();
  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
        max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
    }
    if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {response.writeHead(404); response.end(); return;}
    const row = {index: requests.length + 1, epochMs: performance.timeOrigin + performance.now(),
      authSynthetic: request.headers.authorization === 'Bearer synthetic-stream-fixture-only',
      reasoningSent: 0, finalSent: 0, closed: false};
    requests.push(row);
    response.once('close', () => {row.closed = true; row.closedEpochMs = performance.timeOrigin + performance.now();});
    let body = ''; for await (const bytes of request) body += bytes;
    row.requestBytes = Buffer.byteLength(body); row.requestSha256 = createHash('sha256').update(body).digest('hex');
    if (!row.authSynthetic) {response.writeHead(401); response.end(); return;}
    response.writeHead(200, {'content-type': 'text/event-stream'});
    const emit = delta => response.write('data: ' + JSON.stringify({id: 'phase8-stream-fixture', object: 'chat.completion.chunk',
      created: 1, model: 'deepseek-flash', choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    try {
      emit({role: 'assistant', content: ''});
      for (let index = 0; index < streamWorkload.reasoningChunks && !response.destroyed; index++) {
        if (!emit({reasoning_content: streamWorkload.reasoningText})) await once(response, 'drain');
        row.reasoningSent++; await new Promise(resolve => setTimeout(resolve, streamWorkload.intervalMs));
      }
      for (let index = 0; index < streamWorkload.finalChunks && !response.destroyed; index++) {
        if (!emit({content: `第${index + 1}段。${streamWorkload.finalText}\n\n`})) await once(response, 'drain');
        row.finalSent++; await new Promise(resolve => setTimeout(resolve, streamWorkload.intervalMs));
      }
      if (!response.destroyed) response.end('data: ' + JSON.stringify({id: 'phase8-stream-fixture', object: 'chat.completion.chunk',
        choices: [{index: 0, delta: {}, finish_reason: 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 100, total_tokens: 200}}) + '\n\ndata: [DONE]\n\n');
    } catch {row.streamClosed = true; response.destroy();}
  });
  server.on('connection', socket => {sockets.add(socket); socket.once('close', () => sockets.delete(socket));});
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {origin: `http://127.0.0.1:${server.address().port}`, requests,
    async close() {for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve));}};
}
