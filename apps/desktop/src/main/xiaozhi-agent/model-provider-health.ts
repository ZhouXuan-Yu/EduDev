import {classifyProviderFault, isTemporaryProviderHttpStatus, providerRetryAfterSeconds} from './provider-fault-policy';
import {ProviderHealthBlocked, type ProviderHealth, type ProviderHealthOutcome} from './provider-health';

export type ModelProviderHealth = {health: ProviderHealth; keyForModel: (modelId: string) => string};

function transportLoss(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === 'TimeoutError'
    || error instanceof TypeError && /^(?:fetch failed|terminated|network error)$/iu.test(error.message)
    || /\b(?:net::ERR_(?:CONNECTION_[A-Z_]+|INTERNET_DISCONNECTED|TIMED_OUT|NETWORK_CHANGED)|ECONNRESET|ECONNREFUSED|ETIMEDOUT)\b/u.test(error.message);
}

function rejection(response: Response): ProviderHealthOutcome {
  if (!isTemporaryProviderHttpStatus(response.status)) return {kind: 'ignored'};
  const decision = classifyProviderFault({origin: 'host', signals: ['http_' + response.status],
    stage: 'before_response_body', effect: 'explicit_model_http_rejection'});
  if (!decision.countsDependencyFailure) return {kind: 'ignored'};
  const seconds = providerRetryAfterSeconds(response.headers.get('retry-after'));
  return {kind: 'dependency_failure', retryAfterMs: (seconds ?? 0) * 1000, retryAfterOnly: seconds !== undefined && seconds <= 5};
}

/** One Pi SDK stream owns the transport. Health completes only when its body or abort settles. */
export function createModelHealthScope(configuration: ModelProviderHealth, modelId: string, cancelled: () => boolean,
  onBlocked: (reason: ProviderHealthBlocked['reason']) => void) {
  const key = configuration.keyForModel(modelId);
  let sdkVerified: boolean | undefined;
  let settleAccepted: (() => void | Promise<void>) | undefined;
  return {
    ready: configuration.health.ready,
    begin() {
      let permit;
      try {permit = configuration.health.begin(key, true);}
      catch (error) {if (error instanceof ProviderHealthBlocked) onBlocked(error.reason); throw error;}
      const finish = (outcome: ProviderHealthOutcome) => permit.complete(cancelled() ? {kind: 'ignored'} : outcome);
      const failed = (error: unknown, dispatched: boolean) =>
        finish(dispatched && transportLoss(error) ? {kind: 'dependency_failure'} : {kind: 'ignored'});
      return {
        failed,
        async response(response: Response) {
          const observed = response.ok ? null : rejection(response);
          let settling=false, cancelledByReader=false;
          const drained = async () => {
            if(settling)return;
            settling=true;
            if (observed) await finish(observed);
            else {
              settleAccepted = () => {
                if (sdkVerified !== undefined) return finish({kind: sdkVerified ? 'verified' : 'ignored'});
              };
              await settleAccepted();
            }
          };
          const reader = response.body?.getReader();
          if (!reader) {await drained(); return response;}
          const body = new ReadableStream<Uint8Array>({
            async pull(controller) {
              let result: Awaited<ReturnType<typeof reader.read>>;
              try {
                result = await reader.read();
              } catch (error) {
                if(cancelledByReader)return;
                if (observed?.kind === 'dependency_failure') await finish(observed);
                else await failed(error, true);
                if(!cancelledByReader)controller.error(error);
                return;
              }
              // A normal [DONE] response can make the SDK cancel while a read is pending.
              if(cancelledByReader)return;
              if (result.done) {await drained(); if(!cancelledByReader)controller.close();}
              else controller.enqueue(result.value);
            },
            async cancel(reason) {
              cancelledByReader=true;
              try {await reader.cancel(reason);}
              finally {await drained();}
            }
          });
          return new Response(body, {status: response.status, statusText: response.statusText, headers: response.headers});
        }
      };
    },
    sdkResult(verified: boolean) {
      sdkVerified = verified;
      return settleAccepted?.();
    }
  };
}
