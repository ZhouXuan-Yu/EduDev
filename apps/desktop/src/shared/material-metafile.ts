export const METAFILE_SCHEMA = 'xiaozhi.local-metafile.v1' as const;
export const METAFILE_ENGINE = 'windows-gdiplus-pillow-13.0.0-144dpi.v1' as const;
export const METAFILE_READ_ENGINES = [METAFILE_ENGINE,'windows-gdiplus-pillow-12.3.0-144dpi.v1','pillow-12.3.0-gdi-144dpi.v1'] as const;
export type MetafileReadEngine = typeof METAFILE_READ_ENGINES[number];
export const WORD_IMAGE_POLICY = 'word-metafile.v2' as const;
export const WORD_IMAGE_LEGACY_POLICY = 'word-metafile.v1' as const;
export const METAFILE_INPUT = 8 * 1048576;
export const METAFILE_BATCH = 16;
export type MetafileInput = {sha256: string; data: string};
export type MetafileFailure = 'invalid_input' | 'too_large' | 'parse_failed' | 'empty' | 'font_missing';
export type MetafileItem = {inputSha256: string} & (
  {ok: true; sha256: string; width: number; height: number; png: string} |
  {ok: false; error: MetafileFailure}
);
export type MetafileReceipt = {schemaVersion: typeof METAFILE_SCHEMA} & (
  {ok: true; engine: typeof METAFILE_ENGINE; items: MetafileItem[]} |
  {ok: false; error: 'invalid_input' | 'too_large' | 'configuration' | 'parse_failed'}
);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function validMetafileReceipt(value: unknown): value is MetafileReceipt {
  if (!object(value) || value.schemaVersion !== METAFILE_SCHEMA) return false;
  if (value.ok === false) return Object.keys(value).length === 3 && ['invalid_input', 'too_large', 'configuration', 'parse_failed'].includes(String(value.error));
  if (value.ok !== true || Object.keys(value).length !== 4 || value.engine !== METAFILE_ENGINE || !Array.isArray(value.items) || value.items.length < 1 || value.items.length > METAFILE_BATCH) return false;
  const seen = new Set<string>();
  return value.items.every(item => {
    if (!object(item) || !hash(item.inputSha256) || seen.has(item.inputSha256)) return false;
    seen.add(item.inputSha256);
    if (item.ok === false) return Object.keys(item).length === 3 && ['invalid_input', 'too_large', 'parse_failed', 'empty', 'font_missing'].includes(String(item.error));
    return item.ok === true && Object.keys(item).length === 6 && hash(item.sha256) && Number.isSafeInteger(item.width) && Number.isSafeInteger(item.height)
      && Number(item.width) > 0 && Number(item.height) > 0 && Number(item.width) <= 4096 && Number(item.height) <= 4096
      && typeof item.png === 'string' && item.png.length > 0 && item.png.length <= 5592408 && item.png.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(item.png);
  });
}
