export const FIGURE_LABEL_SPACING = 'figure-label-spacing.v1' as const;

/** Only compare spaces before whole literal labels in the description. The
 * trailing transcription must agree exactly. Its typography and all original
 * strings remain intact. */
export function equivalentFigureSpacing(first: string, final: string, literal: string): boolean {
  const lineEndings = (text: string) => text.replace(/\r\n/g, '\n');
  const suffix = '\n' + lineEndings(literal);
  const a = lineEndings(first), b = lineEndings(final);
  if (!literal || literal.length > 512 || !a.endsWith(suffix) || !b.endsWith(suffix)) return false;
  const labels = [...new Set(literal.split(/\s+/u).filter(label =>
    /^[A-Za-z][A-Za-z0-9\p{Script=Han}₀-₉ₐ-ₜ]{1,15}$/u.test(label)))];
  if (!labels.length || labels.length > 32) return false;
  const compact = new RegExp(
    '(?<=\\p{Script=Han})[ \\t]+(?=(?:' + labels.join('|') + ')(?:$|[ \\t\\n、，。,；;：:）)]))', 'gu',
  );
  return a.slice(0, -suffix.length).replace(compact, '') === b.slice(0, -suffix.length).replace(compact, '');
}
