import type { XiaozhiAgentEventPayload } from '../../shared/xiaozhi-agent';

const markers = { commentary: '<xiaozhi_progress>', final_answer: '<xiaozhi_answer>' } as const;
let lastOrder = 0;
/** One main-process clock shared with host events; reserve before async sanitization. */
export function capturePresentationOrder() {
  return (lastOrder = Math.max(lastOrder + 1, Math.floor(performance.now() * 1000)));
}
export const REPLY_PRESENTATION_PROMPT = `
回复展示协议（仅普通 text 通道）：每条 assistant 消息的普通文本必须以一个段首标记开始。工具前给教师的简短进度说明用 <xiaozhi_progress>；已经完成必要检索、工具与核对，开始交付最终答案时用 <xiaozhi_answer>。标记后直接写内容，不加闭合标签，不解释标记。不要在最终答案后继续调用工具；若还有操作先完成操作。没有必要时不额外生成进度说明。此协议只区分公开进度和最终正文，不要求输出隐藏推理，不改变原生 reasoning 通道、工具调用或教师审批规则。
两个段首前缀只用于展示分段。实际操作必须使用已注册的原生工具调用，不得把函数名、工具参数或教师提问包装成 XML/JSON 正文代替调用。没有工具回执时不得声称已执行。需要教师选择时使用原生提问工具并等待回答；普通闲聊和解释可以自然回复，无需强行调用工具。`;

/** Parse only an explicit segment prefix. No prose classifier, timer or extra model call. */
export function createPresentationEventAdapter(emit: (event: XiaozhiAgentEventPayload) => void) {
  let segment = 0,
    prefix = '',
    decided = false,
    separator = false,
    closing = '',
    tail = '';
  const write = (value: string) => {
    const delta = separator ? value.trimStart() : value;
    if (!delta) return;
    separator = false;
    if (!closing) {
      emit({ kind: 'text_delta', delta });
      return;
    }
    tail += delta;
    const at = tail.indexOf(closing);
    if (at >= 0 && /^\s*$/.test(tail.slice(at + closing.length))) {
      if (at) emit({ kind: 'text_delta', delta: tail.slice(0, at) });
      tail = tail.slice(at);
      return;
    }
    let keep = 0;
    for (let size = 1; size < closing.length && size <= tail.length; size++)
      if (closing.startsWith(tail.slice(-size))) keep = size;
    const ready = tail.slice(0, tail.length - keep);
    tail = tail.slice(tail.length - keep);
    if (ready) emit({ kind: 'text_delta', delta: ready });
  };
  function decide(final = false) {
    const value = prefix.trimStart();
    for (const [phase, marker] of Object.entries(markers)) {
      if (value.startsWith(marker)) {
        decided = true;
        separator = true;
        closing = marker.replace('<', '</');
        emit({
          kind: 'assistant_phase',
          segment,
          phase: phase as keyof typeof markers,
          since: Date.now(),
        });
        write(value.slice(marker.length));
        prefix = '';
        return;
      }
    }
    // Hold only a possible control prefix. Ordinary text must not wait for message_end.
    const partial = Object.values(markers).some((marker) => marker.startsWith(value));
    if (final && value.startsWith('<xiaozhi_') && partial) {
      decided = true;
      prefix = '';
      return;
    }
    if (!final && prefix.length < 64 && (!value || partial)) return;
    decided = true;
    write(prefix);
    prefix = '';
  }
  return {
    start(value: number) {
      segment = value;
      prefix = '';
      decided = false;
      separator = false;
      closing = '';
      tail = '';
    },
    delta(value: string) {
      if (decided) write(value);
      else {
        prefix += value;
        decide();
      }
    },
    end() {
      if (!decided) decide(true);
      // Optional provider-added closing tags are protocol only at the segment tail.
      // Literal closing tags in fenced/inline code have following characters and survive.
      if (
        tail &&
        !tail.trimEnd().endsWith(closing) &&
        !(tail.startsWith('</xiaozhi_') && closing.startsWith(tail))
      )
        emit({ kind: 'text_delta', delta: tail });
      tail = '';
    },
  };
}

/** Result/export has the same visible text as deltas; native SDK replay stays untouched. */
export function visibleAssistantText(text: string) {
  const value = text.trimStart();
  for (const marker of Object.values(markers))
    if (value.startsWith(marker)) {
      const body = value.slice(marker.length).trim(),
        closing = marker.replace('<', '</');
      return (body.endsWith(closing) ? body.slice(0, -closing.length) : body).trim();
    }
  return text;
}
