const privateReads = new Set(['office_read_text', 'office_read_document', 'office_read_attachment', 'office_read_material',
  'education_read_material_page', 'education_read_question', 'search_teacher_knowledge', 'education_search_materials']);
const WINDOW = 24;
const SOURCE_STRIDE = 8;
const BLOOM_BITS = 1 << 28;
const MASK = BLOOM_BITS - 1;
const normalize = (text: string) => text.normalize('NFKC').replace(/\s+/gu, ' ').trim();

/** Rolling fingerprints are conservative rejection evidence. Collisions cannot authorize data. */
function windows(text: string, stride: number, consume: (first: number, second: number) => boolean | void) {
  if (text.length < WINDOW) return false;
  let first = 0, second = 0, firstPower = 1, secondPower = 1;
  for (let index = 0; index < WINDOW; index++) {
    first = (Math.imul(first, 257) + text.charCodeAt(index) + 1) >>> 0;
    second = (Math.imul(second, 263) + text.charCodeAt(index) + 1) >>> 0;
    if (index < WINDOW - 1) {
      firstPower = Math.imul(firstPower, 257) >>> 0;
      secondPower = Math.imul(secondPower, 263) >>> 0;
    }
  }
  for (let start = 0; ; start++) {
    if (start % stride === 0 && consume(first, second) === true) return true;
    if (start + WINDOW >= text.length) return false;
    const outgoing = text.charCodeAt(start) + 1;
    const incoming = text.charCodeAt(start + WINDOW) + 1;
    first = (Math.imul((first - Math.imul(outgoing, firstPower)) >>> 0, 257) + incoming) >>> 0;
    second = (Math.imul((second - Math.imul(outgoing, secondPower)) >>> 0, 263) + incoming) >>> 0;
  }
}
export type SkillPrivateContext = ReturnType<typeof createSkillPrivateContext>;
/** Fixed 32 MiB, allocated on first private read. It retains no source text or persistent data. */
export function createSkillPrivateContext() {
  let bits: Uint32Array | undefined;
  let sourceCharacters = 0;
  let sourceWindows = 0;
  let closed = false;
  return {
    capture(text: string) {
      if (closed) return;
      const normalized = normalize(text);
      sourceCharacters += normalized.length;
      if (normalized.length < WINDOW) return;
      bits ||= new Uint32Array(BLOOM_BITS / 32);
      windows(normalized, SOURCE_STRIDE, (first, second) => {
        sourceWindows++;
        for (let index = 0; index < 4; index++) {
          const position = (first + Math.imul(index, second | 1)) & MASK;
          bits![position >>> 5] |= 1 << (position & 31);
        }
      });
    },
    contains(text: string) {
      if (closed) throw new Error('permission_denied');
      if (!bits) return false;
      return windows(normalize(text), 1, (first, second) => {
        for (let index = 0; index < 4; index++) {
          const position = (first + Math.imul(index, second | 1)) & MASK;
          if (!(bits![position >>> 5] & (1 << (position & 31)))) return false;
        }
        return true;
      });
    },
    clear() {
      closed = true;
      bits = undefined;
      sourceCharacters = 0;
      sourceWindows = 0;
    },
    metrics: () => ({memoryBytes: bits?.byteLength || 0, sourceCharacters, sourceWindows, closed}),
  };
}
/** Index every returned text field across its full range, including text beyond 4096. */
export function captureSkillPrivateContext(target: SkillPrivateContext, tool: string, result: unknown) {
  if (!privateReads.has(tool)) return;
  const pending = [result];
  const seen = new WeakSet<object>();
  while (pending.length) {
    const value = pending.pop();
    if (typeof value === 'string') {
      target.capture(value);
      if (/^\s*(?:\[|\{|")/u.test(value)) {
        try { pending.push(JSON.parse(value)); } catch { /* Ordinary source text. */ }
      }
    } else if (value && typeof value === 'object' && !seen.has(value)) {
      seen.add(value);
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if ('value' in descriptor && !/^(?:path|id|sha256|hash|version|url|sourceId|fileId)$/.test(key)) pending.push(descriptor.value);
      }
    }
  }
}
