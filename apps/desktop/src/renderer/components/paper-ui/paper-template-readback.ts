import type {PaperTemplateApi, PaperTemplateTarget, PaperTemplateRead, PaperTemplateResult} from '../../../shared/paper-template';

export const TEMPLATE_READ_TIMEOUT_MS = 15000;
type ReadApi = Pick<PaperTemplateApi, 'readPaperTemplate' | 'listPaperTemplates' | 'cancelPaperTemplateOperation'>;

/** A read has its own cancellable request identity. A deadline never repeats a
 * save/apply; late replies cannot overwrite a returned timeout/cancellation.
 */
async function boundedRead<T>(api: ReadApi, scope: PaperTemplateTarget,
  read: (requestId: string) => Promise<PaperTemplateResult<T>>, signal?: AbortSignal,
  timeoutMs = TEMPLATE_READ_TIMEOUT_MS): Promise<PaperTemplateResult<T>> {
  const requestId = scope.requestId ?? 'template_read_' + crypto.randomUUID();
  if (signal?.aborted) return {ok: false, error: 'cancelled'};
  let timer: ReturnType<typeof setTimeout> | undefined;
  let aborted: (() => void) | undefined;
  const stop = (error: string, resolve: (value: PaperTemplateResult<T>) => void) => {
    void api.cancelPaperTemplateOperation({...scope, requestId}).catch(() => {});
    resolve({ok: false, error});
  };
  const deadline = new Promise<PaperTemplateResult<T>>(resolve => {
    timer = setTimeout(() => stop('readback_timeout', resolve), timeoutMs);
    aborted = () => stop('cancelled', resolve);
    signal?.addEventListener('abort', aborted, {once: true});
  });
  try {return await Promise.race([read(requestId), deadline]);}
  finally {clearTimeout(timer); if (aborted) signal?.removeEventListener('abort', aborted);}
}

export function readPaperTemplateBounded(api: ReadApi, input: PaperTemplateRead,
  signal?: AbortSignal, timeoutMs?: number) {
  return boundedRead(api, input, requestId => api.readPaperTemplate({...input, requestId}), signal, timeoutMs);
}

export function listPaperTemplatesBounded(api: ReadApi, input: PaperTemplateTarget,
  signal?: AbortSignal, timeoutMs?: number) {
  return boundedRead(api, input, requestId => api.listPaperTemplates({...input, requestId}), signal, timeoutMs);
}
