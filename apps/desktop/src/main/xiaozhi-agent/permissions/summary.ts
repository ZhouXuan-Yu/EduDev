/** Display-only redacted text. Authority remains the frozen input digest and scopes. */
export function permissionRequestSummary(action: string, input: unknown) {
  const text = action + '\n' + JSON.stringify(input);
  return text.replace(/\bBearer\s+[^\s"']+/giu, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{12,}/gu, '[redacted]')
    .replace(/((?:api[_-]?key|authorization|password|access[_-]?token|secret)["']?\s*[:=]\s*)["']?[^\s"';,}]+/giu, '$1[redacted]')
    .slice(0, 3072);
}
