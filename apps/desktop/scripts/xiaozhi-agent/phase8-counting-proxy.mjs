import http from 'node:http';
import https from 'node:https';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {budgetError, validateBudgetContext} from './phase8-budget-ledger.mjs';

function configuration(options) {
  const permitted = new Set(['ledger', 'providerEndpoint', 'fixtureHttp', 'context', 'port', 'routePath',
    'requestTimeoutMs', 'maximumRequestBytes', 'maximumConcurrent']);
  if (!options || Object.keys(options).some(key => !permitted.has(key))) throw budgetError('proxy_invalid_configuration');
  let endpoint;
  try {endpoint = new URL(options.providerEndpoint);} catch {throw budgetError('proxy_invalid_configuration');}
  const fixture = options.fixtureHttp === true && endpoint.protocol === 'http:' && endpoint.hostname === '127.0.0.1';
  if (endpoint.protocol !== 'https:' && !fixture || endpoint.username || endpoint.password || endpoint.search || endpoint.hash
      || options.fixtureHttp !== undefined && typeof options.fixtureHttp !== 'boolean') {
    throw budgetError('proxy_invalid_configuration');
  }
  const routePath = options.routePath ?? '/v1/chat/completions';
  if (typeof routePath !== 'string' || !/^\/[A-Za-z0-9/_-]+$/.test(routePath)
      || !options.ledger || typeof options.ledger.reserve !== 'function') throw budgetError('proxy_invalid_configuration');
  const numeric = {port: options.port ?? 0, requestTimeoutMs: options.requestTimeoutMs ?? 120000,
    maximumRequestBytes: options.maximumRequestBytes ?? 8 * 1024 * 1024,
    maximumConcurrent: options.maximumConcurrent ?? 32};
  if (!Number.isInteger(numeric.port) || numeric.port < 0 || numeric.port > 65535
      || !Number.isInteger(numeric.requestTimeoutMs) || numeric.requestTimeoutMs < 1 || numeric.requestTimeoutMs > 3600000
      || !Number.isInteger(numeric.maximumRequestBytes) || numeric.maximumRequestBytes < 1 || numeric.maximumRequestBytes > 64 * 1024 * 1024
      || !Number.isInteger(numeric.maximumConcurrent) || numeric.maximumConcurrent < 1 || numeric.maximumConcurrent > 128) {
    throw budgetError('proxy_invalid_configuration');
  }
  return {endpoint, routePath, context: validateBudgetContext(options.context), ...numeric};
}

function reply(response, status, code) {
  if (response.destroyed || response.headersSent) return;
  response.writeHead(status, {'content-type': 'application/json', 'cache-control': 'no-store'});
  response.end(JSON.stringify({error: {code}}));
}

async function readBody(request, maximum) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximum) throw budgetError('proxy_body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, length);
}

/** One fixed upstream attempt per accepted local POST. This proxy performs zero retries. */
export async function startCountingProxy(options) {
  const config = configuration(options);
  const {ledger} = options;
  const transport = config.endpoint.protocol === 'https:' ? https : http;
  const operations = new Set();
  let closing = false;
  let persistenceFailed = false;
  let inFlight = 0;

  async function handle(request, response) {
    if (request.url !== config.routePath) {reply(response, 404, 'phase8_route_rejected'); return;}
    if (request.method !== 'POST') {reply(response, 405, 'phase8_method_rejected'); return;}
    if (closing || persistenceFailed || inFlight >= config.maximumConcurrent) {
      reply(response, 503, 'phase8_proxy_unavailable'); return;
    }
    if (Number(request.headers['content-length']) > config.maximumRequestBytes) {
      request.resume(); reply(response, 413, 'phase8_body_too_large'); return;
    }
    inFlight++;
    let reservation;
    let upstream;
    let upstreamResponse;
    let deadline;
    let settled = false;
    let responseBytes = 0;
    const started = performance.now();
    function finish(state, errorCode) {
      if (settled || !reservation) return;
      settled = true;
      clearTimeout(deadline);
      operations.delete(stop);
      try {
        ledger.finish(reservation.reservationId, {state, ...(errorCode ? {errorCode} : {}),
          elapsedMs: performance.now() - started, responseBytes});
      } catch {
        persistenceFailed = true;
      }
    }
    function stop(errorCode = 'proxy_closed') {
      finish(errorCode === 'client_cancelled' ? 'client_cancelled' : 'failed', errorCode);
      upstreamResponse?.destroy(); upstream?.destroy(); response.destroy();
    }
    const clientClosed = () => {
      if (!response.writableFinished && reservation) stop('client_cancelled');
    };
    response.on('close', clientClosed);
    try {
      const body = await readBody(request, config.maximumRequestBytes);
      if (request.aborted || response.destroyed || closing) return;
      reservation = ledger.reserve(config.context);
      // Both SQLite commits precede construction of the outgoing HTTP request.
      ledger.markDispatching(reservation.reservationId, body.length);
      operations.add(stop);
      deadline = setTimeout(() => {
        finish('timed_out', 'upstream_timeout');
        upstreamResponse?.destroy(); upstream?.destroy();
        if (response.headersSent) response.destroy();
        else reply(response, 504, 'phase8_upstream_timeout');
      }, config.requestTimeoutMs);
      const headers = {'content-type': 'application/json', accept: 'text/event-stream', 'content-length': body.length};
      if (typeof request.headers.authorization === 'string') headers.authorization = request.headers.authorization;
      upstreamResponse = await new Promise((resolve, reject) => {
        upstream = transport.request(config.endpoint, {method: 'POST', headers, agent: false}, resolve);
        upstream.once('error', reject);
        upstream.end(body);
      });
      if (settled) {upstreamResponse.destroy(); return;}
      const status = upstreamResponse.statusCode;
      ledger.markResponse(reservation.reservationId, status);
      upstreamResponse.once('aborted', () => finish('failed', 'upstream_error'));
      if (status >= 300 && status <= 399) {
        finish('redirect_rejected', 'redirect_rejected'); upstreamResponse.destroy();
        reply(response, 502, 'phase8_redirect_rejected'); return;
      }
      const responseHeaders = {'cache-control': 'no-store'};
      for (const name of ['content-type', 'content-encoding', 'retry-after']) {
        if (typeof upstreamResponse.headers[name] === 'string') responseHeaders[name] = upstreamResponse.headers[name];
      }
      response.writeHead(status, responseHeaders);
      const countBytes = new Transform({transform(chunk, _encoding, callback) {
        responseBytes += chunk.length; callback(null, chunk);
      }});
      await pipeline(upstreamResponse, countBytes, response);
      finish(status >= 400 ? 'http_error' : 'completed');
    } catch (error) {
      if (reservation) {
        finish('failed', 'upstream_error'); upstreamResponse?.destroy(); upstream?.destroy();
      }
      if (!settled || !response.headersSent) {
        const exhausted = error.code === 'budget_exhausted';
        const oversized = error.code === 'proxy_body_too_large';
        reply(response, exhausted ? 429 : oversized ? 413 : 502,
          exhausted ? 'phase8_budget_exhausted' : oversized ? 'phase8_body_too_large' : 'phase8_upstream_error');
      }
      if (response.headersSent && !response.writableEnded) response.destroy();
    } finally {
      clearTimeout(deadline);
      operations.delete(stop);
      response.removeListener('close', clientClosed);
      inFlight--;
    }
  }

  const server = http.createServer((request, response) => {
    void handle(request, response).catch(() => {persistenceFailed = true; response.destroy();});
  });
  server.requestTimeout = config.requestTimeoutMs;
  server.headersTimeout = Math.min(60000, config.requestTimeoutMs);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, '127.0.0.1', resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}${config.routePath}`,
    baseURL: `http://127.0.0.1:${address.port}` + (config.routePath.endsWith('/chat/completions')
      ? config.routePath.slice(0, -'/chat/completions'.length) : ''),
    async close() {
      if (closing) return;
      closing = true;
      for (const stop of [...operations]) stop();
      await new Promise(resolve => {server.close(resolve); server.closeAllConnections();});
    },
  };
}
