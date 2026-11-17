type Host = {all: (sql: string, values?: (string | number | null)[]) => Promise<Record<string, unknown>[]>};

export async function teacherOwnsRuleQuestion(host: Host, id: string) {
  for (const [table, condition] of [
    ['question_notebook_bookmarks', ' AND bookmarked=1'],
    ['question_notebook_category_links', ''],
    ['question_bank_usage', ''],
  ]) {
    if ((await host.all(`SELECT 1 FROM ${table} WHERE question_id=?${condition} LIMIT 1`, [id])).length) return true;
  }
  return false;
}
