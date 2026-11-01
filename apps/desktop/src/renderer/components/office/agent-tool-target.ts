import type { OfficeProjectedItem } from '../../../shared/office-agent';

function publicTarget(value: string | undefined): string | undefined {
  const text = value?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  // These are public DTO fields, not arguments. Still refuse accidental absolute
  // paths, credential-like values and serialized payloads; never inspect raw SDK data.
  if (!text || /(?:[a-z]:[\\/]|\\\\|(?:^|\s)\/\S)|^(?:\{|\[\s*["{])|\b(?:sk-|Bearer\s)/i.test(text)) return;
  const characters = Array.from(text);
  return characters.length > 60 ? characters.slice(0, 59).join('') + '…' : text;
}

/** Reuse recorded public titles, then the recorded query. No inferred/fabricated summary. */
export function agentToolTarget(item: OfficeProjectedItem): string | undefined {
  const titles = [...new Set((item.sources || []).map(source => publicTarget(source.title)).filter((title): title is string => !!title))];
  return publicTarget(titles.slice(0, 2).join('、')) || publicTarget(item.resultSummary?.query);
}
