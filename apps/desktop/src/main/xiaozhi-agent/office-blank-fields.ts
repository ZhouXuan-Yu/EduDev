/** An explicit current teacher instruction; not model-generated task authority. */
export function officeBlankFieldError(prompt: string, proposal: unknown): string | undefined {
  const text = prompt.replace(/\s+/g, '');
  if (!/负责人(?:一栏|栏|列)?(?:请|要|保持|需要|必须|就)?(?:留空|空着|为空|空白)/.test(text)
    || /负责人.{0,8}(?:不要|不能|不得|不必|无需|不用).{0,4}(?:留空|空着|为空|空白)/.test(text)) return;
  if (!proposal || typeof proposal !== 'object' || !('draft' in proposal)) return;
  const draft = (proposal as { draft?: { sections?: unknown } }).draft;
  if (!draft || !Array.isArray(draft.sections)) return;
  let failed = false;
  for (const raw of draft.sections) {
    if (!raw || typeof raw !== 'object') continue;
    const section = raw as { paragraphs?: unknown; table?: { columns?: unknown; rows?: unknown } };
    if (Array.isArray(section.paragraphs)) for (const paragraph of section.paragraphs) {
      if (typeof paragraph === 'string' && /^负责人\s*[：:]/.test(paragraph.trim()) && !/^负责人\s*[：:]\s*$/.test(paragraph.trim())) failed = true;
    }
    const table = section.table;
    if (!table || !Array.isArray(table.columns) || !Array.isArray(table.rows)) continue;
    for (let column = 0; column < table.columns.length; column++) {
      if (typeof table.columns[column] !== 'string' || !/负责人/.test(table.columns[column])) continue;
      for (const row of table.rows) if (Array.isArray(row) && row[column] !== '') failed = true;
    }
  }
  return failed ? '尚未提出审阅，也没有写入文件。教师明确要求负责人留空：表格负责人单元格必须使用空字符串，不填下划线、标点或人名；负责人段落如保留，只写“负责人：”。请修正草稿后重新提交。' : undefined;
}
