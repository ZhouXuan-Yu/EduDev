import type {OfficeProjectedTurn} from './office-agent';

// Exact provider end tags observed on the text channel. This is not an XML parser,
// tool-call decoder or answer repair. Native SDK messages must never pass through it.
const endTags = [
  '</｜｜DSML｜｜ parameter>',
  '</｜｜DSML｜｜ invoke>',
  '</｜｜DSML｜｜ calls>',
] as const;
const namespace = '</｜｜DSML｜｜ ';
export type PublicSegmentClose = '</xiaozhi_answer>' | '</xiaozhi_progress>';

/** Incremental Markdown literal context; delimiters may themselves cross chunks. */
function literalContext() {
  let fence = '', fenceSize = 0, inlineSize = 0;
  let run = '', runSize = 0, runAtStart = false;
  let indent = 0, lineStart = true, escaped = false, fenceClosePending = false;
  function settle(char: string) {
    if (!run || char === run) return;
    if (fence) {
      if (run === fence && runAtStart && runSize >= fenceSize) fenceClosePending = true;
    } else if (run === '`') {
      if (inlineSize === runSize) inlineSize = 0;
      else if (!inlineSize) {
        if (runAtStart && runSize >= 3) { fence = run; fenceSize = runSize; }
        else inlineSize = runSize;
      }
    } else if (!inlineSize && runAtStart && runSize >= 3) {
      fence = run; fenceSize = runSize;
    }
    run = ''; runSize = 0;
  }
  return {
    literal(char: string) {
      settle(char);
      return !!fence || !!inlineSize || escaped || indent >= 4;
    },
    take(char: string) {
      settle(char);
      // A closing fence is valid only once its entire remainder is whitespace.
      if (fenceClosePending) {
        if (char === '\n' || char === '\r') { fence = ''; fenceClosePending = false; }
        else if (char !== ' ' && char !== '\t') fenceClosePending = false;
      }
      if ((char === '`' || char === '~') && !escaped) {
        if (run === char) runSize++;
        else { run = char; runSize = 1; runAtStart = lineStart && indent <= 3; }
      }
      if (char === '\n' || char === '\r') { lineStart = true; indent = 0; }
      else if (lineStart && (char === ' ' || char === '\t')) indent += char === '\t' ? 4 : 1;
      else lineStart = false;
      escaped = char === '\\' && !escaped;
    },
  };
}

/**
 * Hold only a possible end-tag suffix. If prose follows, release every byte.
 * Code, escaped examples, quoted examples (closing quote is prose) and math survive.
 * No timer, network work, content classification or model/tool execution.
 */
export function createPublicProviderTextFilter(emit: (text: string) => void, segmentClose?: PublicSegmentClose) {
  const endings: readonly string[] = segmentClose ? [...endTags, segmentClose] : endTags;
  const context = literalContext();
  let pending = '', partial = '', between = false;
  let output = '';
  function commit(value: string) {
    output += value;
    for (const char of value) context.take(char);
  }
  function take(char: string) {
    if (!pending) {
      if (char === '<' && !context.literal(char)) { pending = '<'; partial = '<'; between = false; }
      else commit(char);
      return;
    }
    if (between) {
      if (/\s/u.test(char)) { pending += char; return; }
      if (char === '<') { pending += char; partial = '<'; between = false; return; }
    } else {
      const next = partial + char;
      if (endings.some(tag => tag.startsWith(next))) {
        pending += char; partial = next;
        if (endings.some(tag => tag === partial)) { partial = ''; between = true; }
        return;
      }
    }
    const literal = pending;
    pending = ''; partial = ''; between = false;
    commit(literal);
    take(char);
  }
  function flush() { if (output) { emit(output); output = ''; } }
  return {
    delta(value: string) { for (const char of value) take(char); flush(); },
    end() {
      // A bare '<' or unrelated partial remains ordinary text, even on cancellation.
      // Hide a truncated control only after the complete, exact DSML namespace.
      const truncatedSegmentClose = segmentClose && partial.startsWith('</xiaozhi_') && segmentClose.startsWith(partial);
      if (pending && !between && !partial.startsWith(namespace) && !truncatedSegmentClose) commit(pending);
      pending = ''; partial = ''; between = false;
      flush();
    },
  };
}

export function publicProviderText(text: string, segmentClose?: PublicSegmentClose): string {
  if (!text.includes(namespace) && (!segmentClose || !text.includes(segmentClose))) return text;
  const parts: string[] = [];
  const filter = createPublicProviderTextFilter(value => parts.push(value), segmentClose);
  filter.delta(text); filter.end();
  return parts.join('');
}

/** Public snapshot/replay view only; never mutate persisted/native messages. */
export function publicProviderTurn(turn: OfficeProjectedTurn): OfficeProjectedTurn {
  let items: OfficeProjectedTurn['items'] | undefined;
  for (let index = 0; index < turn.items.length; index++) {
    const item = turn.items[index];
    if (item.kind !== 'message' || item.role !== 'assistant' || typeof item.text !== 'string') continue;
    const segmentClose = item.phaseSource === 'explicit'
      ? item.phase === 'commentary' ? '</xiaozhi_progress>' : '</xiaozhi_answer>' : undefined;
    const text = publicProviderText(item.text, item.text.includes(namespace) ? segmentClose : undefined);
    if (text === item.text) continue;
    items ??= turn.items.slice();
    items[index] = {...item, text};
  }
  return items ? {...turn, items} : turn;
}
