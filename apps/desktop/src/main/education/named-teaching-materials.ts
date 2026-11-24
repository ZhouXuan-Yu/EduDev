const title = '《[^《》\\r\\n]+》';
const basis = new RegExp(`(?:依照|依据|根据|基于|参考|使用|结合|从|用)\\s*(?:本地)?(?:资料库|知识库)(?:中|里|内)?的?\\s*(${title}(?:\\s*(?:、|，|,|和|与|以及|及)\\s*${title})*)`, 'gu');

export function namedTeachingMaterialMatches(text: string) {
  return Array.from(text.matchAll(basis)).filter(match =>
    !/(?:不要|无需|不用|不必|不能|不应|别|不|勿)\s*$/u.test(text.slice(0, match.index)));
}

export function namedTeachingMaterialTitles(matches: ReturnType<typeof namedTeachingMaterialMatches>) {
  return [...new Set(matches.flatMap(match => Array.from(match[1].matchAll(/《([^》]+)》/gu), item => item[1].trim())))];
}

export type NamedHandoutSource = {resourceId: string; version: string};

export async function resolveNamedHandoutSources(
  titles: readonly string[],
  find: (title: string) => Promise<NamedHandoutSource[]>,
): Promise<NamedHandoutSource[]> {
  if (titles.length > 3) throw Error('handout_basis_ambiguous');
  const sources = new Map<string, NamedHandoutSource>();
  for (const title of titles) {
    const matches = await find(title);
    if (matches.length > 1) throw Error('handout_basis_ambiguous');
    if (!matches.length) throw Error('handout_basis_unavailable');
    const [source] = matches;
    sources.set(source.resourceId, source);
  }
  return [...sources.values()];
}
