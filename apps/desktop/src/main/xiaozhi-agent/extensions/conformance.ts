import type {ExtensionHook, ExtensionSession} from './types';

export function validTransformOutput(value: unknown): value is {text: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).join(',') !== 'text') return false;
  const {text} = value as {text?: unknown};
  return typeof text === 'string' && text.length <= 8000;
}

/** Prove each hook in the authorized guest with only public synthetic data. */
export async function verifyExtensionHooks(session: ExtensionSession, signal: AbortSignal) {
  const verified = new Set<ExtensionHook>();
  for (const hook of session.manifest.hooks) {
    try {
      const text = 'EduDev extension conformance check';
      const result = await session.invoke(hook, hook === 'context.transform' ? {text} : {event:'task.notice', text}, signal);
      if (hook === 'context.transform' ? validTransformOutput(result) : result === null) verified.add(hook);
    } catch {
      signal.throwIfAborted();
      // An individual hook result cannot validate another hook. A lost guest also fails closed.
    }
  }
  return verified;
}
