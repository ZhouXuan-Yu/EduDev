/** Render-only compatibility for model TeX delimiters. The persisted/copy text stays untouched. */
export function normalizeMathDelimiters(source: string): string {
  let result = '', index = 0;
  let fence: {marker: string; length: number} | undefined;
  while (index < source.length) {
    const lineStart = index === 0 || source[index - 1] === '\n';
    if (lineStart) {
      const end = source.indexOf('\n', index);
      const next = end < 0 ? source.length : end + 1;
      const line = source.slice(index, next);
      const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (marker?.[0] === fence.marker && marker.length >= fence.length && /^\s*$/.test(line.slice(line.indexOf(marker) + marker.length))) fence = undefined;
        result += line; index = next; continue;
      }
      if (marker || /^(?: {4}|\t)/.test(line)) {
        if (marker) fence = {marker: marker[0], length: marker.length};
        result += line; index = next; continue;
      }
    }
    if (source[index] === '`') {
      const start = index;
      while (source[index] === '`') index++;
      const ticks = source.slice(start, index);
      let end = source.indexOf(ticks, index);
      while (end >= 0 && (source[end - 1] === '`' || source[end + ticks.length] === '`')) end = source.indexOf(ticks, end + ticks.length);
      // An unfinished streaming code span must not become a formula.
      index = end < 0 ? source.length : end + ticks.length;
      result += source.slice(start, index); continue;
    }
    if (source[index] === '<') {
      const raw = /^<(pre|code)\b[^>]*>(?:[\s\S]*?<\/\1\s*>|[\s\S]*$)/i.exec(source.slice(index));
      const tag = raw?.[0] || /^<[^>\n]*>/.exec(source.slice(index))?.[0];
      if (tag) { result += tag; index += tag.length; continue; }
    }
    if (source[index] === '$') {
      const marker = source[index + 1] === '$' ? '$$' : '$';
      let end = index + marker.length;
      for (; end < source.length; end++) {
        if (source[end] === '\\') { end++; continue; }
        if (source.startsWith(marker, end) || (marker === '$' && source[end] === '\n')) break;
      }
      if (source.startsWith(marker, end)) {
        const next = end + marker.length;
        result += source.slice(index, next); index = next; continue;
      }
    }
    if (source[index] === '\\') {
      const delimiter = source[index + 1];
      if (delimiter === '(' || delimiter === '[') {
        const close = delimiter === '(' ? ')' : ']';
        let end = index + 2;
        for (; end < source.length; end++) {
          if (source[end] === '\\') {
            if (source[end + 1] === close) break;
            end++;
          }
          if (delimiter === '(' && source[end] === '\n') break;
        }
        const body = source.slice(index + 2, end);
        if (source[end] === '\\' && source[end + 1] === close && body.trim() && !body.includes('$') && !body.includes('`')) {
          result += delimiter === '(' ? '$' + body + '$' : '\n\n$$\n' + body.trim() + '\n$$\n\n';
          index = end + 2; continue;
        }
        if (end >= source.length || source[end] === '\n') {
          result += source.slice(index, end); index = end; continue;
        }
      }
      result += source.slice(index, index + 2); index += 2; continue;
    }
    result += source[index++];
  }
  return result;
}
