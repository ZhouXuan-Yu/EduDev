// Hana 0.449.0 Apache-2.0. AST extraction; see model-switch-source-manifest.json.
// Adaptation: stable education error replaces Hana i18n; no coordinator/cache/persona imports.
import { estimateTokens } from "@earendil-works/pi-coding-agent";
const t = (_key: string) => "context_limit";
const MODEL_CONTEXT_TOO_LARGE_CODE = "MODEL_CONTEXT_TOO_LARGE";
function createModelContextTooLargeError(currentTokens: number, effectiveWindow: number) {
  const error: any = new Error(t("error.modelContextTooLarge"));
  error.name = "ModelContextTooLargeError";
  error.code = MODEL_CONTEXT_TOO_LARGE_CODE;
  error.status = 409;
  error.currentTokens = currentTokens;
  error.effectiveWindow = effectiveWindow;
  return error;
}

export function assertHanaModelSwitchContext(session: { agent?: { state?: { messages?: Parameters<typeof estimateTokens>[0][] } }; getContextUsage?: () => any }, newModel: { contextWindow: number }): void {
const msgs = session.agent?.state?.messages || [];
const usage = session.getContextUsage?.();
let currentTokens = usage?.tokens;
if (!Number.isFinite(currentTokens) || currentTokens < 0) {
        // fallback: 逐消息估算
        currentTokens = msgs.reduce((sum, m) => sum + estimateTokens(m), 0);
      }
const effectiveWindow = Math.floor(newModel.contextWindow * 0.9) - 4000;
if (currentTokens > effectiveWindow) {
        throw createModelContextTooLargeError(currentTokens, effectiveWindow);
      }
}
