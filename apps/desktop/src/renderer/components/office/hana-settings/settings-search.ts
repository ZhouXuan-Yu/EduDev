// Hana 0.449.0 Apache-2.0; exact AST extraction. See workspace-source.json.
export interface SettingsSearchNavItem {
  id: string;
  label: string;
}

export interface SettingsSearchEntry {
  id: string;
  tabId: string;
  titleKey?: string;
  title?: string;
  pathKeys?: string[];
  path?: string[];
  aliases?: string[];
}

export interface SettingsSearchResult {
  id: string;
  tabId: string;
  title: string;
  path: string;
  score: number;
}

type Translate = (key: string) => string;

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function translated(entry: SettingsSearchEntry, translate: Translate): { title: string; path: string } {
  const title = entry.titleKey ? translate(entry.titleKey) : entry.title || '';
  const pathParts = entry.pathKeys?.length
    ? entry.pathKeys.map(key => translate(key))
    : entry.path || (title ? [title] : []);
  return {
    title,
    path: pathParts.filter(Boolean).join(' / '),
  };
}

function scoreCandidate(query: string, fields: string[]): number {
  const normalizedFields = fields.map(normalizeSearchText).filter(Boolean);
  if (normalizedFields.length === 0) return 0;

  let best = 0;
  for (const [index, field] of normalizedFields.entries()) {
    if (!field) continue;
    const fieldWeight = index === 0 ? 40 : index === 1 ? 24 : 12;
    if (field === query) best = Math.max(best, 120 + fieldWeight);
    if (field.startsWith(query)) best = Math.max(best, 92 + fieldWeight);
    if (field.includes(query)) best = Math.max(best, 68 + fieldWeight);
  }

  const tokens = query.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    const haystack = normalizedFields.join(' ');
    if (tokens.every(token => haystack.includes(token))) {
      best = Math.max(best, 58 + tokens.length * 4);
    }
  }

  return best;
}

export function searchSettings(
  query: string,
  entries: SettingsSearchEntry[],
  translate: Translate,
  limit = 12,
): SettingsSearchResult[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  return entries
    .map(entry => {
      const { title, path } = translated(entry, translate);
      const fields = [title, path, ...(entry.aliases || [])];
      const score = scoreCandidate(normalizedQuery, fields);
      return { id: entry.id, tabId: entry.tabId, title, path, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);
}
