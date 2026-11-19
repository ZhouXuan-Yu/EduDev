import {channel} from 'node:diagnostics_channel';
import {q5Source} from './phase8-real-model-plan.mjs';

const target = new URL(q5Source);

/** Observe the fixed synthetic scenario's original undici transport without changing its requests. */
export function observeQ5WebTiming() {
  const clock = {timeOrigin: performance.timeOrigin};
  const rows = [];
  const requests = new WeakMap();
  let dropped = 0;
  const events = {
    'undici:request:create': ({request}) => {
      if (request?.method !== 'GET' || String(request.origin) !== target.origin || request.path !== target.pathname) return;
      if (rows.length >= 32) {dropped++; return;}
      const row = {createdAt: performance.now(), sendingHeadersAt: null, headersAt: null, responseEndAt: null,
        errorAt: null, status: null};
      rows.push(row);
      requests.set(request, row);
    },
    'undici:client:sendHeaders': ({request}) => {
      const row = requests.get(request);
      if (row) row.sendingHeadersAt ??= performance.now();
    },
    'undici:request:headers': ({request, response}) => {
      const row = requests.get(request);
      if (row && response.statusCode >= 200) {row.headersAt = performance.now(); row.status = response.statusCode;}
    },
    'undici:request:trailers': ({request}) => {
      const row = requests.get(request);
      if (row) row.responseEndAt = performance.now();
    },
    'undici:request:error': ({request}) => {
      const row = requests.get(request);
      if (row) row.errorAt = performance.now();
    },
  };
  for (const [name, listener] of Object.entries(events)) channel(name).subscribe(listener);
  return {
    snapshot: () => structuredClone({clock, rows, dropped}),
    dispose() {
      for (const [name, listener] of Object.entries(events)) channel(name).unsubscribe(listener);
    },
  };
}
