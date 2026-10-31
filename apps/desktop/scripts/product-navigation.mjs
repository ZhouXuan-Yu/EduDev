/** Test entry points follow actual destinations, never disclosure headings. */
export function productEntry(page, space) {
  const ids = { ask: 'nav-ai-workspace', materials: 'nav-knowledge', teaching: 'nav-artifacts', students: 'nav-students', settings: 'nav-settings' };
  const id = ids[space];
  if (!id) throw new Error('Unknown product space: ' + space);
  return page.locator('[data-testid="edu-navigation"]:visible').getByTestId(id);
}
