/** Teacher navigation only. These keys grant no file, model or business authority. */
export const PRODUCT_SPACES = [
  { id: 'ask', label: '问小智', view: 'ai' },
  { id: 'materials', label: '我的资料', view: 'knowledge' },
  { id: 'teaching', label: '教学内容', view: 'artifacts' },
  { id: 'students', label: '学生', view: 'students' },
  { id: 'settings', label: '设置', view: 'settings' },
] as const;
export type ProductSpace = typeof PRODUCT_SPACES[number]['id'];
export const PRODUCT_PAGES = {
  materials: [
    { view: 'knowledge', label: '资料库' },
  ],
  teaching: [
    { view: 'artifacts', label: '教学文件' },
    { view: 'notebook', label: '备课本' },
    { view: 'book', label: '讲义' },
    { view: 'question_notebook', label: '题本' },
  ],
  students: [
    { view: 'students', label: '学生档案' },
    { view: 'search', label: '查找学生与记录' },
    { view: 'intake', label: '添加学习记录' },
    { view: 'mistakes', label: '错题与练习' },
    { view: 'mastery', label: '学习计划' },
    { view: 'review', label: '学习复盘' },
    { view: 'analytics', label: '学习概览' },
  ],
} as const;
export type ProductPageSpace = keyof typeof PRODUCT_PAGES;
export type ProductView = 'ai' | 'settings' | typeof PRODUCT_PAGES[ProductPageSpace][number]['view'];
export function productSpaceFor(view: string): ProductSpace | undefined {
  if (view === 'ai') return 'ask';
  if (view === 'settings') return 'settings';
  for (const key of Object.keys(PRODUCT_PAGES) as ProductPageSpace[]) {
    if (PRODUCT_PAGES[key].some(page => page.view === view)) return key;
  }
  return undefined;
}
export function isProductView(view: string): view is ProductView { return productSpaceFor(view) !== undefined; }
