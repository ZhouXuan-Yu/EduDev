/** Exact embedded-source attribution. No selector/value-similarity inference. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');

export function cssOffset(text, line, column) {
  assert(Number.isInteger(line) && line >= 0 && Number.isInteger(column) && column >= 0);
  const lines = text.split('\n');
  assert(line < lines.length && column <= lines[line].length, 'CSS location outside stylesheet');
  return lines.slice(0, line).reduce((offset, value) => offset + value.length + 1, 0) + column;
}

export function mapEmbeddedCss(generated, range, sources) {
  const start = cssOffset(generated, range.startLine, range.startColumn);
  const end = cssOffset(generated, range.endLine, range.endColumn);
  assert(end > start, 'Empty or reversed CSS range');
  const matches = [];
  for (const source of sources) {
    const content = source.text.trim();
    if (!content) continue;
    const embedded = generated.indexOf(content);
    if (embedded < 0 || generated.indexOf(content, embedded + 1) !== -1) continue;
    if (start < embedded || end > embedded + content.length) continue;
    const offset = source.text.indexOf(content) + start - embedded;
    const text = generated.slice(start, end);
    assert.equal(source.text.slice(offset, offset + text.length), text);
    const prefix = source.text.slice(0, offset).split('\n');
    matches.push({
      file: source.file, sourceSha256: sha256(source.text), generatedSha256: sha256(generated),
      line: prefix.length, column: prefix.at(-1).length + 1,
      utf16Offset: offset, text, declarationSha256: sha256(text),
      method: 'Unique complete source embedded unchanged; exact UTF-16 range translation',
    });
  }
  // Shared/overlapping sources are deliberately ambiguous until reviewed.
  return matches.length === 1 ? {status: 'exact-source', ...matches[0]} : {
    status: matches.length ? 'ambiguous' : 'not-embedded', candidates: matches,
  };
}
