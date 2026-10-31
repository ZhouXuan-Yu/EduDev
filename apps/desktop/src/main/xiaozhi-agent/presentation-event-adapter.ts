import type { XiaozhiAgentEventPayload } from '../../shared/xiaozhi-agent';
import {createPublicProviderTextFilter, publicProviderText, type PublicSegmentClose} from '../../shared/public-provider-text';
export { REPLY_PRESENTATION_PROMPT } from './public-response-prompt';

const markers = { commentary: '<xiaozhi_progress>', final_answer: '<xiaozhi_answer>' } as const;
let lastOrder = 0;
/** One main-process clock shared with host events; reserve before async sanitization. */
export function capturePresentationOrder() {
  return (lastOrder = Math.max(lastOrder + 1, Math.floor(performance.now() * 1000)));
}
/** Parse only an explicit segment prefix. No prose classifier, timer or extra model call. */
export function createPresentationEventAdapter(emit: (event: XiaozhiAgentEventPayload) => void) {
  let segment = 0, prefix = '', decided = false, separator = false;
  const publish = (delta: string) => { if (delta) emit({kind:'text_delta', delta}); };
  let providerText = createPublicProviderTextFilter(publish);
  const write = (value: string) => {
    const delta = separator ? value.trimStart() : value;
    if (!delta) return;
    separator = false;
    providerText.delta(delta);
  };
  function decide(final = false) {
    const value = prefix.trimStart();
    for (const [phase, marker] of Object.entries(markers)) {
      if (value.startsWith(marker)) {
        decided = true;
        separator = true;
        // One suffix buffer handles either ordering of provider/native end tags.
        providerText = createPublicProviderTextFilter(publish, marker.replace('<', '</') as PublicSegmentClose);
        emit({kind:'assistant_phase', segment, phase:phase as keyof typeof markers, since:Date.now()});
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
      providerText = createPublicProviderTextFilter(publish);
    },
    delta(value: string) {
      if (decided) write(value);
      else { prefix += value; decide(); }
    },
    end() {
      if (!decided) decide(true);
      providerText.end();
    },
  };
}

/** Result/export has the same visible text as deltas; native SDK replay stays untouched. */
export function visibleAssistantText(text: string) {
  const value = text.trimStart();
  for (const marker of Object.values(markers))
    if (value.startsWith(marker))
      return publicProviderText(value.slice(marker.length), marker.replace('<', '</') as PublicSegmentClose).trim();
  return publicProviderText(text);
}
