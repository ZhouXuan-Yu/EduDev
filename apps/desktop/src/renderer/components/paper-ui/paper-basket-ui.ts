import type {PaperError, PaperView} from '../../../shared/paper-blueprint';
import type {PaperBasketReason, PaperBasketUiState, PaperBasketView} from '../../../shared/paper-basket';

export const emptyBasketUi = (): PaperBasketUiState => ({stage: 'select', filters: {}, offset: 0, scrollTop: 0});
export const BASKET_PAGE_SIZE = 12;

export function sameBasketUi(a: PaperBasketUiState, b: PaperBasketUiState): boolean {
  return a.stage === b.stage && a.offset === b.offset && a.scrollTop === b.scrollTop &&
    (['query', 'knowledgePoint', 'questionType', 'difficulty', 'sourceKind', 'categoryId'] as const)
      .every(key => a.filters[key] === b.filters[key]);
}

export const basketErrors: Record<PaperError, string> = {
  invalid_input: '请检查蓝图、分节和选题要求，时长、题数与分值须符合原组卷规则。',
  permission_denied: '当前会话或学生已不可用，请选择有效会话重新读取。',
  source_changed: '题目或来源版本已变化。已保留题篮，请重新读取候选并核对，不能直接换成新版本。',
  conflict: '题篮已被其他操作修改。当前输入仍保留，请重新读取后核对，不会自动覆盖。',
  shortage: '题篮尚未满足蓝图或来源配额，请处理缺额、超额和不可用题目。',
  unavailable: '读取或保存未完成，请重试；当前题篮和输入仍保留。',
  cancelled: '操作已取消，请重新读取题篮核对当前保存状态。',
};

export const basketReasons: Record<PaperBasketReason, string> = {
  source_changed: '来源版本已变化，保留加入时的题面供核对',
  source_unavailable: '来源或原件当前不可读取',
  unsupported: '完整题面或内容身份尚不能用于正式组卷',
  missing_answer: '缺少可用答案或解析',
  section_mismatch: '不符合当前分节要求',
  generation_unavailable: '生成题的所属任务或教师确认已失效',
  duplicate: '与当前篮中题目重复',
};

/** Section order belongs to the blueprint; entry identity never depends on its display number. */
export function orderedBasketEntries(basket: PaperBasketView) {
  const sections = [...new Set([...basket.blueprint.sections.map(s => s.id), ...basket.entries.map(e => e.sectionId)])];
  return sections.flatMap(id => basket.entries.filter(e => e.sectionId === id).sort((a, b) => a.position - b.position));
}

export function basketSnapshotCurrent(basket: PaperBasketView, snapshot?: PaperView): boolean {
  if (!snapshot?.basket || basket.state !== 'active' || !basket.complete) return false;
  const ids = orderedBasketEntries(basket).map(e => e.entryId);
  return snapshot.sessionId === basket.sessionId && snapshot.basket.basketId === basket.id &&
    snapshot.basket.basketRevision === basket.revision &&
    JSON.stringify(snapshot.basket.entryIds) === JSON.stringify(ids) && snapshot.sourceCurrent;
}
