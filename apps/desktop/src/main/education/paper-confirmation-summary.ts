import { createAssistantMessageEventStream, type AssistantMessage } from "@earendil-works/pi-ai";
import type { PaperView } from "../../shared/paper-blueprint";

export function confirmedOriginalPaperSummary(paper: PaperView): string {
  return `你已确认保存这份原题卷。共 ${paper.count} 题、${paper.totalPoints} 分，限时 ${paper.blueprint.durationMinutes} 分钟。`
    + "参考答案保留原样，尚未做学科核验。可从本轮试卷卡查看整卷。";
}

/** Keep the host acknowledgement in Pi's normal assistant history and stream. */
export function streamConfirmedPaperSummary(text: string) {
  const message: AssistantMessage = {
    role: "assistant", api: "edudev-local", provider: "edudev-local", model: "paper-confirmation",
    content: [{ type: "text", text }],
    usage: {
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop", timestamp: Date.now(),
  };
  const stream = createAssistantMessageEventStream();
  stream.push({ type: "start", partial: { ...message, content: [] } });
  stream.push({ type: "text_start", contentIndex: 0, partial: { ...message, content: [{ type: "text", text: "" }] } });
  stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: message });
  stream.push({ type: "text_end", contentIndex: 0, content: text, partial: message });
  stream.push({ type: "done", reason: "stop", message });
  return stream;
}
