// Unit-only DTOs. Actual UI acceptance must use copied, genuinely ingested source data.
export const ownerA = 'aisession_11111111-1111-4111-8111-111111111111';
export const ownerB = 'aisession_22222222-2222-4222-8222-222222222222';
export const inaccessibleOwner = 'aisession_33333333-3333-4333-8333-333333333333';
export const basketId = 'xibasket_44444444-4444-4444-8444-444444444444';
export const otherBasketId = 'xibasket_55555555-5555-4555-8555-555555555555';
export const version = 'a'.repeat(64);
export const question = {id: 'question_77777777-7777-4777-8777-777777777777', subject: '数学', grade: '初二', knowledgePoint: '一次函数',
  questionType: '解答题', difficulty: 'medium', stem: '完整题干：求函数 y = 2x + 1 在 x = 3 时的值，并说明步骤。',
  answer: 'UNIT_REFERENCE_ANSWER_7', analysis: 'UNIT_REFERENCE_ANALYSIS', sourceTitle: 'unit-only source',
  sourceKind: 'local_bank', tags: [], createdAt: '2026-11-01', updatedAt: '2026-11-01'};

export function makeBasket(blueprint, patch = {}) {
  return {schemaVersion: 'xiaozhi.paper-basket.v1', id: basketId, sessionId: ownerA, revision: 1,
    title: blueprint.title, state: 'active', count: 0, createdAt: '2026-11-01', updatedAt: '2026-11-01',
    blueprint, entries: [], gaps: [], complete: false,
    uiState: {stage: 'select', filters: {}, offset: 0, scrollTop: 0}, ...patch};
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

export function fixture(blueprint) {
  const calls = {list: [], read: [], mutate: [], snapshot: [], decide: [], candidate: []};
  const data = new Map([[ownerA, makeBasket(blueprint)], [ownerB, makeBasket(blueprint, {id: otherBasketId, sessionId: ownerB})]]);
  const api = {
    getDesktopChrome: async () => ({enabled: false}), onDesktopCommand: () => () => {},
    listAiConversations: async () => ({sessions: [{id: ownerA, title: '合法 A'}, {id: ownerB, title: '合法 B'},
      {id: inaccessibleOwner, title: '关联失效学生'}], archivedSessions: [], folders: [], archivedFolders: []}),
    listPaperBaskets: async input => {
      calls.list.push(input);
      if (input.sessionId === inaccessibleOwner) return {ok: false, error: 'permission_denied'};
      const value = data.get(input.sessionId);
      return {ok: true, value: {items: value ? [structuredClone(value)] : [], total: 100000,
        offset: input.offset, limit: input.limit}};
    },
    readPaperBasket: async input => {calls.read.push(input); return {ok: true, value: structuredClone(data.get(input.sessionId))};},
    mutatePaperBasket: async input => {
      calls.mutate.push(structuredClone(input));
      const saved = data.get(input.sessionId);
      if (input.expectedRevision !== saved.revision) return {ok: false, error: 'conflict'};
      const next = structuredClone(saved);
      if (input.operation.type === 'updateUiState') next.uiState = input.operation.uiState;
      else {
        next.revision++;
        if (input.operation.type === 'add') next.entries.push({entryId: 'xibasketentry_66666666-6666-4666-8666-666666666666',
          questionId: question.id, contentVersion: version, sectionId: input.operation.sectionId, position: 0,
          question, availability: {available: true}});
        if (input.operation.type === 'updateBlueprint') next.blueprint = input.operation.blueprint;
        next.count = next.entries.length;
      }
      data.set(input.sessionId, next);
      return {ok: true, value: structuredClone(next)};
    },
    listQuestionNotebookCategories: async () => [{id: 'category-real-unit', name: '单元分类', status: 'active'}],
    listQuestionNotebook: async () => ({items: [question], total: 1}),
    readPaperBasketCandidate: async input => {calls.candidate.push(input); return {ok: true,
      value: {question, contentVersion: version, eligibility: {available: true}, matchingSectionIds: [blueprint.sections[0].id]}};},
    createPaperFromBasket: async input => {calls.snapshot.push(input); return {ok: false, error: 'shortage'};},
    decidePaper: async input => {calls.decide.push(input); return {ok: false, error: 'conflict'};},
  };
  return {api, data, calls};
}
