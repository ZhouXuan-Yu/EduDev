/** Local display fallback only. Never change the prompt delivered to Pi or persisted in history. */
export function conversationTitle(prompt: string): string {
  let task = prompt.trim();
  let skillCommand = false;
  // Match Pi's literal ASCII-space command boundary, not arbitrary whitespace.
  if (task.startsWith('/skill:')) {
    const space = task.indexOf(' ');
    const name = task.slice(7, space === -1 ? undefined : space);
    if (/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      skillCommand = true;
      task = space === -1 ? '' : task.slice(space + 1).trim();
    }
  }
  const normalized = task.replace(/\s+/gu, ' ').trim();
  return Array.from(normalized || (skillCommand ? '技能任务' : '附件任务')).slice(0, 40).join('');
}
