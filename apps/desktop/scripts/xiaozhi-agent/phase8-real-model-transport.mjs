import {createHash} from 'node:crypto';

/** Keep only enough of an incomplete SSE line to recognize the provider's final event. */
function observeStreamEnd() {
  const decoder = new TextDecoder();
  const maxLine = 64;
  let tail = '', overflow = false, dataLines = 0, doneLine = false;
  return bytes => {
    const lines = (tail + decoder.decode(bytes, {stream: true})).split('\n');
    const fragment = lines.pop();
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');
      if (!overflow && line === '') {
        if (dataLines === 1 && doneLine) return true;
        dataLines = 0;
        doneLine = false;
      } else if (line.startsWith('data:')) {
        dataLines++;
        doneLine = !overflow && /^data: ?\[DONE\]$/.test(line);
      }
      overflow = false;
    }
    overflow = overflow || fragment.length > maxLine;
    tail = fragment.slice(0, maxLine);
    return false;
  };
}

/** Installed only on an isolated Electron main's existing net object before its app import. */
export function installProviderBridge(net, options) {
  if (!net || typeof net.fetch !== 'function' || !options || Object.keys(options).some(key => key !== 'chatRoutes')) {
    throw Error('phase8_invalid_transport_configuration');
  }
  const routes = options.chatRoutes;
  const allowed = ['/v1/chat/completions', '/chat/completions'];
  if (!routes || Object.keys(routes).length !== 2 || !allowed.every(key => typeof routes[key] === 'string')) {
    throw Error('phase8_invalid_transport_configuration');
  }
  for (const target of Object.values(routes)) {
    const url = new URL(target);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.search || url.hash
        || !['/v1/chat/completions', '/chat/completions'].includes(url.pathname)) throw Error('phase8_invalid_proxy_route');
  }
  const original = net.fetch;
  const clock = {timeOrigin: performance.timeOrigin, dateCalibrationMs: Date.now() - (performance.timeOrigin + performance.now())};
  const chats = [], models = [], rejected = [];
  const boundaries = [];
  let boundary;
  const at = () => performance.now();
  function configuration(bytes) {
    let body;
    try {body = JSON.parse(new TextDecoder().decode(bytes));} catch {return {unavailable: true};}
    if (!body || typeof body !== 'object' || Array.isArray(body)) return {unavailable: true};
    const value = {};
    if (typeof body.model === 'string' && /^[A-Za-z0-9_.:/-]{1,128}$/.test(body.model)
        && !/(?:sk-|bearer|api[_-]?key|password|secret)/i.test(body.model)) value.model = body.model;
    if (typeof body.stream === 'boolean') value.stream = body.stream;
    for (const key of ['temperature', 'top_p', 'max_tokens', 'max_completion_tokens', 'seed']) {
      if (Number.isFinite(body[key])) value[key] = body[key];
    }
    if (['low', 'medium', 'high', 'max', 'minimal', 'none'].includes(body.reasoning_effort)) value.reasoning_effort = body.reasoning_effort;
    if (['enabled', 'disabled', 'auto'].includes(body.thinking?.type)) value.thinking = {type: body.thinking.type};
    if (Array.isArray(body.tools)) {
      value.toolCount = body.tools.length;
      value.toolsSha256 = createHash('sha256').update(JSON.stringify(body.tools)).digest('hex');
    }
    if (['auto', 'none', 'required'].includes(body.tool_choice)) value.tool_choice = body.tool_choice;
    return value;
  }
  async function wrapped(input, init) {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== 'api.deepseek.com') return original.call(net, input, init);
    const method = String(init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    const valid = url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.search && !url.hash;
    if (valid && method === 'GET' && ['/models', '/v1/models'].includes(url.pathname)) {
      const row = {path: url.pathname, at: at(), httpStatus: null}; models.push(row);
      try {const response = await original.call(net, input, {...init, credentials: 'omit', redirect: 'error'}); row.httpStatus = response.status; return response;}
      catch {row.error = 'models_transport_failed'; throw Error('phase8_models_transport_failed');}
    }
    if (!valid || method !== 'POST' || !allowed.includes(url.pathname)) {
      rejected.push({method: ['POST', 'GET', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(method) ? method : 'OTHER',
        at: at(), code: 'provider_route_rejected'});
      throw Error('phase8_provider_route_rejected');
    }
    const owner = boundary;
    if (owner && (!owner.runId || owner.conflict || owner.terminalAt !== null)) {
      rejected.push({at:at(),code:'run_dispatch_boundary_unverified'});throw Error('phase8_run_dispatch_boundary_unverified');
    }
    const row = {index: chats.length + 1, path: url.pathname, method, at: at(), headersAt: null, firstByteAt: null,
      ...(owner ? {dispatchBoundary:owner.id,runId:owner.runId} : {}),
      endAt: null, terminalFrameAt: null, httpStatus: null, responseBytes: 0, state: 'preparing', configuration: {}};
    chats.push(row);
    try {
      const request = new Request(url.href, {...init, ...(typeof input === 'object' && !(input instanceof URL) ? {headers: init?.headers || input.headers,
        body: init?.body ?? input.body, signal: init?.signal || input.signal} : {}), method, duplex: 'half'});
      const bytes = await request.arrayBuffer(); row.configuration = configuration(bytes);
      const headers = new Headers();
      for (const key of ['authorization', 'content-type', 'accept']) if (request.headers.has(key)) headers.set(key, request.headers.get(key));
      row.requestBytes = bytes.byteLength; row.state = 'dispatching'; row.dispatchAt = at();
      if (owner && (owner !== boundary || owner.conflict)) throw Error('phase8_run_dispatch_boundary_unverified');
      const response = await original.call(net, (owner?.chatRoutes || routes)[url.pathname], {method: 'POST', headers, body: bytes,
        signal: request.signal, credentials: 'omit', redirect: 'error'});
      row.headersAt = at(); row.httpStatus = response.status; row.state = 'response';
      if (!response.body) {row.endAt = at(); row.state = 'completed'; return response;}
      const reader = response.body.getReader();
      const observedEnd = /^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '') ? observeStreamEnd() : null;
      const measured = new ReadableStream({
        async pull(controller) {
          try {
            const result = await reader.read();
            if (result.done) {row.endAt = at(); row.state = 'completed'; controller.close(); return;}
            row.firstByteAt ??= at(); row.responseBytes += result.value.byteLength;
            if (row.terminalFrameAt === null && observedEnd?.(result.value)) row.terminalFrameAt = at();
            controller.enqueue(result.value);
          } catch {row.endAt = at(); row.state = 'stream_failed'; controller.error(Error('phase8_response_stream_failed'));}
        },
        async cancel() {row.endAt = at(); row.state = 'client_cancelled'; await reader.cancel().catch(() => {});},
      });
      return new Response(measured, {status: response.status, statusText: response.statusText, headers: response.headers});
    } catch {row.endAt = at(); row.state = 'transport_failed'; throw Error('phase8_provider_transport_failed');}
  }
  net.fetch = wrapped;
  return {
    beginDispatch({id,sessionId,previousRunId,chatRoutes = routes}) {
      if (!['original','continuation'].includes(id) || typeof sessionId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(sessionId)
          || boundaries.some(item=>item.id===id) || id === 'original' && boundaries.length
          || id === 'continuation' && (!boundary || boundary.id !== 'original' || boundary.runId !== previousRunId || boundary.terminalAt === null)
          || chats.some(item=>item.endAt === null) || !allowed.every(key=>{
            try {const url=new URL(chatRoutes[key]);return url.protocol==='http:'&&url.hostname==='127.0.0.1'&&url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&allowed.includes(url.pathname);}catch{return false;}
          })) throw Error('phase8_dispatch_boundary_invalid');
      boundary={id,sessionId,previousRunId:previousRunId || null,runId:null,at:at(),terminalAt:null,conflict:false,chatRoutes};boundaries.push(boundary);
    },
    observeRun(event) {
      if (!boundary || event?.sessionId !== boundary.sessionId || event.kind !== 'status'
          || typeof event.runId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(event.runId)) return;
      if (event.status === 'running') {
        if (event.runId === boundary.previousRunId || boundary.runId && boundary.runId !== event.runId) {boundary.conflict=true;return;}
        boundary.runId ??= event.runId;
      } else if (boundary.runId === event.runId) boundary.terminalAt ??= at();
    },
    snapshot: () => structuredClone({schemaVersion: 1, clock, chats, models, rejected,
      boundaries:boundaries.map(({chatRoutes,...item})=>item)}),
    restore() {if (net.fetch !== wrapped) throw Error('phase8_transport_restore_conflict'); net.fetch = original;},
  };
}
