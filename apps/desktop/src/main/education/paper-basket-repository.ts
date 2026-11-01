import {randomUUID} from 'node:crypto';
import {
  PAPER_BASKET_SCHEMA, validPaperBasketCandidate, validPaperBasketCreate, validPaperBasketList,
  validPaperBasketMutation, validPaperBasketRead, validPaperBasketSnapshot, validBasketId, validBasketRevision,
  type PaperBasketBinding, type PaperBasketCandidateInput, type PaperBasketCreateInput,
  type PaperBasketGap, type PaperBasketListInput, type PaperBasketMutationInput,
  type PaperBasketReadInput, type PaperBasketSnapshotInput, type PaperBasketView,
  type PaperBasketCandidate, type PaperBasketEntryView, type PaperBasketPage, type PaperBasketSummary,
} from '../../shared/paper-basket';
import {generatedPaperCount, type PaperBlueprint, type PaperSelection, type PaperView} from '../../shared/paper-blueprint';
import {questionContentIdentity} from '../../shared/question-identity';
import {questionVersion} from './question-context-provider';
import {paperSectionMatches} from './paper-selection';
import {
  authorizePaperOwner, basketSummary, canonicalBasketJson, checkBasketCapacity, encodeBasket,
  orderedBasketEntries, previousBasketOperation, readStoredBasket, recordBasketOperation,
  type StoredBasket,
} from './paper-basket-state';
import {basketEntryAvailability, basketGenerations, basketQuestionAvailability, readBasketQuestion} from './paper-basket-source';
import type {PaperSql, PaperStoreHost} from './paper-sql';

type BasketHost = PaperStoreHost & {
  saveSnapshot: (sql: PaperSql, input: PaperBasketSnapshotInput, blueprint: PaperBlueprint, selection: PaperSelection,
    binding: PaperBasketBinding, studentId: string, current: () => boolean) => Promise<PaperView>;
  readSnapshot: (sql: PaperSql, sessionId: string, paperId: string) => Promise<PaperView>;
  afterWrite?: () => Promise<void>;
};

function assertLease(current: () => boolean) {
  if (!current()) throw new Error('cancelled');
}

function basketGaps(basket: StoredBasket): PaperBasketGap[] {
  return basket.data.blueprint.sections.flatMap(section => {
    const entries = basket.data.entries.filter(entry => entry.sectionId === section.id);
    const generated = generatedPaperCount(basket.data.blueprint, section);
    return (['original', 'generated'] as const).map(sourceKind => {
      const required = sourceKind === 'generated' ? generated : section.count - generated;
      const selected = entries.filter(entry => (entry.question.sourceKind === 'generated') === (sourceKind === 'generated')).length;
      return {sectionId: section.id, sourceKind, required, selected, missing: Math.max(0, required - selected), excess: Math.max(0, selected - required)};
    });
  }).filter(gap => gap.missing || gap.excess);
}

export class PaperBasketRepository {
  private readonly host: BasketHost;

  constructor(host: BasketHost) {
    this.host = host;
  }

  private writeTransaction<T>(current: () => boolean, work: (sql: PaperSql) => Promise<T>): Promise<T> {
    return this.host.transaction(async sql => {
      assertLease(current);
      const result = await work(sql);
      assertLease(current);
      return result;
    });
  }

  private async generations(sql: PaperSql, basket: StoredBasket) {
    return basketGenerations(this.host, sql, basket.sessionId, basket.data.blueprint);
  }

  private async view(sql: PaperSql, basket: StoredBasket): Promise<PaperBasketView> {
    const generations = await this.generations(sql, basket);
    const identities = new Set<string>();
    const entries: PaperBasketEntryView[] = [];
    for (const entry of basket.data.entries) {
      let availability = await basketEntryAvailability(sql, entry, basket.data.blueprint, generations);
      const identity = questionContentIdentity(entry.question);
      if (identity.status !== 'available') availability = {available: false, reason: 'unsupported'};
      else if (identities.has(identity.key)) availability = {available: false, reason: 'duplicate'};
      else identities.add(identity.key);
      entries.push({...entry, availability});
    }
    const gaps = basketGaps(basket);
    return {
      ...basketSummary(basket), schemaVersion: PAPER_BASKET_SCHEMA, blueprint: basket.data.blueprint,
      entries, gaps, complete: basket.state === 'active' && !gaps.length && entries.every(entry => entry.availability.available),
      ...(basket.data.uiState ? {uiState: basket.data.uiState} : {}),
    };
  }

  private readTransaction<T>(work: (sql: PaperSql) => Promise<T>) {
    return (this.host.readTransaction || this.host.transaction).call(this.host, work) as Promise<T>;
  }

  async list(input: PaperBasketListInput): Promise<PaperBasketPage> {
    if (!validPaperBasketList(input)) throw new Error('invalid_input');
    return this.readTransaction(async sql => {
      await authorizePaperOwner(sql, input.sessionId);
      const offset = input.offset || 0;
      const limit = input.limit || 20;
      const rows = await sql.all(`SELECT id,session_id,student_id,schema_version,revision,state,created_at,updated_at,
        json_extract(data_json,'$.blueprint.title') AS title,
        json_array_length(data_json,'$.entries') AS count
        FROM paper_baskets WHERE session_id=? ORDER BY updated_at DESC,id DESC LIMIT ? OFFSET ?`, [input.sessionId, limit, offset]);
      const items: PaperBasketSummary[] = [];
      for (const row of rows) {
        if (!validBasketId(row.id) || !validBasketRevision(Number(row.revision))
          || row.schema_version !== PAPER_BASKET_SCHEMA || typeof row.student_id !== 'string'
          || typeof row.title !== 'string' || row.title.length > 160
          || !Number.isSafeInteger(row.count) || Number(row.count) < 0 || Number(row.count) > 100
          || !['active', 'archived'].includes(String(row.state))) throw new Error('unavailable');
        await authorizePaperOwner(sql, input.sessionId, row.student_id);
        items.push({
          id: String(row.id), sessionId: input.sessionId, revision: Number(row.revision),
          state: row.state as StoredBasket['state'], title: row.title, count: Number(row.count),
          createdAt: String(row.created_at), updatedAt: String(row.updated_at),
        });
      }
      const total = Number((await sql.all('SELECT COUNT(*) AS count FROM paper_baskets WHERE session_id=?', [input.sessionId]))[0]?.count || 0);
      return {items, total, offset, limit};
    });
  }

  async read(input: PaperBasketReadInput): Promise<PaperBasketView> {
    if (!validPaperBasketRead(input)) throw new Error('invalid_input');
    return this.readTransaction(async sql => this.view(sql, await readStoredBasket(sql, input.sessionId, input.basketId)));
  }

  async candidate(input: PaperBasketCandidateInput): Promise<PaperBasketCandidate> {
    if (!validPaperBasketCandidate(input)) throw new Error('invalid_input');
    return this.readTransaction(async sql => {
      const basket = await readStoredBasket(sql, input.sessionId, input.basketId);
      if (basket.state !== 'active') throw new Error('conflict');
      const question = await readBasketQuestion(sql, input.questionId);
      const generations = await this.generations(sql, basket);
      let eligibility = await basketQuestionAvailability(sql, question, generations);
      const matchingSectionIds = basket.data.blueprint.sections.filter(section =>
        (basket.data.blueprint.mode !== 'ai_original' || question.sourceKind === 'generated')
        && paperSectionMatches(question, basket.data.blueprint, section)).map(section => section.id);
      if (eligibility.available && !matchingSectionIds.length) eligibility = {available: false, reason: 'section_mismatch'};
      const identity = questionContentIdentity(question);
      const duplicate = basket.data.entries.some(entry => {
        const existing = questionContentIdentity(entry.question);
        return entry.questionId === question.id
          || identity.status === 'available' && existing.status === 'available' && existing.key === identity.key;
      });
      if (duplicate) {
        eligibility = {available: false, reason: 'duplicate'};
      }
      return {question, contentVersion: questionVersion(question), eligibility, matchingSectionIds, ...(generations.has(question.id) ? {generation: generations.get(question.id)} : {})};
    });
  }

  async create(input: PaperBasketCreateInput, current: () => boolean = () => true): Promise<PaperBasketView> {
    if (!validPaperBasketCreate(input)) throw new Error('invalid_input');
    return this.writeTransaction(current, async sql => {
      assertLease(current);
      const studentId = await authorizePaperOwner(sql, input.sessionId);
      const prior = await previousBasketOperation(sql, input.sessionId, input.requestId, 'create', input, studentId);
      if (prior) return this.view(sql, await readStoredBasket(sql, input.sessionId, prior.basketId));
      await checkBasketCapacity(sql, input.sessionId);
      const id = 'xibasket_' + randomUUID();
      const at = new Date().toISOString();
      await sql.run(`INSERT INTO paper_baskets(id,session_id,student_id,schema_version,revision,state,data_json,created_at,updated_at)
        VALUES(?,?,?,?,1,'active',?,?,?)`, [id, input.sessionId, studentId, PAPER_BASKET_SCHEMA, encodeBasket({blueprint: input.blueprint, entries: []}), at, at]);
      await recordBasketOperation(sql, input.sessionId, input.requestId, 'create', input, studentId, {basketId: id, revision: 1});
      await this.host.afterWrite?.();
      assertLease(current);
      return this.view(sql, await readStoredBasket(sql, input.sessionId, id));
    });
  }

  private async add(sql: PaperSql, basket: StoredBasket, operation: Extract<PaperBasketMutationInput['operation'], {type: 'add'}>) {
    if (basket.data.entries.length >= 100) throw new Error('invalid_input');
    const question = await readBasketQuestion(sql, operation.questionId);
    if (questionVersion(question) !== operation.expectedSourceVersion) throw new Error('source_changed');
    const identity = questionContentIdentity(question);
    if (identity.status !== 'available') throw new Error('source_changed');
    if (basket.data.entries.some(entry => {
      const existing = questionContentIdentity(entry.question);
      return entry.questionId === question.id || existing.status === 'available' && existing.key === identity.key;
    })) throw new Error('conflict');
    const generations = await this.generations(sql, basket);
    const entry = {
      entryId: 'xibasketentry_' + randomUUID(), questionId: question.id, contentVersion: questionVersion(question),
      sectionId: operation.sectionId, position: 0, question,
      ...(generations.has(question.id) ? {generation: generations.get(question.id)} : {}),
    };
    const available = await basketEntryAvailability(sql, entry, basket.data.blueprint, generations);
    if (!available.available) throw new Error(available.reason === 'section_mismatch' ? 'invalid_input' : 'source_changed');
    basket.data.entries.push(entry);
  }

  private async move(sql: PaperSql, basket: StoredBasket, operation: Extract<PaperBasketMutationInput['operation'], {type: 'moveEntry'}>) {
    const entry = basket.data.entries.find(item => item.entryId === operation.entryId);
    const section = basket.data.blueprint.sections.find(item => item.id === operation.sectionId);
    if (!entry || !section) throw new Error('invalid_input');
    const target = basket.data.entries.filter(item => item.sectionId === section.id && item.entryId !== entry.entryId);
    if (operation.index > target.length) throw new Error('invalid_input');
    const available = await basketEntryAvailability(sql, {...entry, sectionId: section.id}, basket.data.blueprint, await this.generations(sql, basket));
    if (!available.available) throw new Error(available.reason === 'section_mismatch' ? 'invalid_input' : 'source_changed');
    const generated = entry.question.sourceKind === 'generated';
    const quota = generatedPaperCount(basket.data.blueprint, section);
    if (target.filter(item => (item.question.sourceKind === 'generated') === generated).length >= (generated ? quota : section.count - quota)) throw new Error('shortage');
    entry.sectionId = section.id;
    target.splice(operation.index, 0, entry);
    basket.data.entries = [...basket.data.entries.filter(item => item.sectionId !== section.id && item.entryId !== entry.entryId), ...target];
  }

  private async apply(sql: PaperSql, basket: StoredBasket, operation: PaperBasketMutationInput['operation']) {
    switch (operation.type) {
      case 'add': await this.add(sql, basket, operation); break;
      case 'moveEntry': await this.move(sql, basket, operation); break;
      case 'remove': {
        if (!basket.data.entries.some(entry => entry.entryId === operation.entryId)) throw new Error('conflict');
        basket.data.entries = basket.data.entries.filter(entry => entry.entryId !== operation.entryId);
        break;
      }
      case 'reorderSection': {
        const entries = basket.data.entries.filter(entry => entry.sectionId === operation.sectionId);
        if (!basket.data.blueprint.sections.some(section => section.id === operation.sectionId) || entries.length !== operation.entryIds.length) throw new Error('invalid_input');
        const byId = new Map(entries.map(entry => [entry.entryId, entry]));
        if (!operation.entryIds.every(id => byId.has(id))) throw new Error('invalid_input');
        basket.data.entries = [...basket.data.entries.filter(entry => entry.sectionId !== operation.sectionId), ...operation.entryIds.map(id => byId.get(id)!)];
        break;
      }
      case 'updateBlueprint': basket.data.blueprint = structuredClone(operation.blueprint); break;
      case 'archive': basket.state = 'archived'; break;
      case 'updateUiState': basket.data.uiState = structuredClone(operation.uiState); break;
    }
    basket.data.entries = orderedBasketEntries(basket.data);
  }

  async mutate(input: PaperBasketMutationInput, current: () => boolean = () => true): Promise<PaperBasketView> {
    if (!validPaperBasketMutation(input)) throw new Error('invalid_input');
    return this.writeTransaction(current, async sql => {
      assertLease(current);
      const basket = await readStoredBasket(sql, input.sessionId, input.basketId);
      const kind = input.operation.type === 'updateUiState' ? 'ui_state' : 'mutate';
      const prior = await previousBasketOperation(sql, input.sessionId, input.requestId, kind, input, basket.studentId);
      if (prior) return this.view(sql, basket);
      if (basket.state !== 'active' || basket.revision !== input.expectedRevision) throw new Error('conflict');
      const before = canonicalBasketJson({blueprint: basket.data.blueprint, entries: basket.data.entries, state: basket.state});
      await this.apply(sql, basket, input.operation);
      const changed = before !== canonicalBasketJson({blueprint: basket.data.blueprint, entries: basket.data.entries, state: basket.state});
      const revision = basket.revision + (changed ? 1 : 0);
      if (revision > 1000000) throw new Error('conflict');
      await sql.run('UPDATE paper_baskets SET revision=?,state=?,data_json=?,updated_at=? WHERE id=? AND session_id=? AND revision=?',
        [revision, basket.state, encodeBasket(basket.data), new Date().toISOString(), basket.id, basket.sessionId, basket.revision]);
      await recordBasketOperation(sql, input.sessionId, input.requestId, kind, input, basket.studentId, {basketId: basket.id, revision});
      await this.host.afterWrite?.();
      assertLease(current);
      return this.view(sql, await readStoredBasket(sql, input.sessionId, input.basketId));
    });
  }

  async createSnapshot(input: PaperBasketSnapshotInput, current: () => boolean = () => true): Promise<PaperView> {
    if (!validPaperBasketSnapshot(input)) throw new Error('invalid_input');
    return this.writeTransaction(current, async sql => {
      assertLease(current);
      const basket = await readStoredBasket(sql, input.sessionId, input.basketId);
      const prior = await previousBasketOperation(sql, input.sessionId, input.requestId, 'snapshot', input, basket.studentId);
      if (prior?.paperId) return this.host.readSnapshot(sql, input.sessionId, prior.paperId);
      if (basket.state !== 'active' || basket.revision !== input.expectedRevision) throw new Error('conflict');
      const view = await this.view(sql, basket);
      if (view.entries.some(entry => !entry.availability.available)) throw new Error('source_changed');
      if (!view.complete || !view.entries.length) throw new Error('shortage');
      const generations = await this.generations(sql, basket);
      const items: PaperSelection['items'] = [];
      for (const entry of orderedBasketEntries(basket.data)) {
        assertLease(current);
        const question = await readBasketQuestion(sql, entry.questionId);
        const available = await basketEntryAvailability(sql, entry, basket.data.blueprint, generations);
        if (!available.available || questionVersion(question) !== entry.contentVersion) throw new Error('source_changed');
        const section = basket.data.blueprint.sections.find(item => item.id === entry.sectionId)!;
        items.push({sectionId: entry.sectionId, number: items.length + 1, points: section.points, question,
          source: {schemaVersion: 'xiaozhi.education.question-context.v1', questionId: entry.questionId, version: entry.contentVersion},
          entryId: entry.entryId, ...(entry.generation ? {generation: entry.generation} : {})});
      }
      const binding = {basketId: basket.id, basketRevision: basket.revision, entryIds: items.map(item => item.entryId!)};
      const selection: PaperSelection = {
        items, shortages: [], scanned: items.length, scanComplete: false, method: 'manual',
        excluded: {unsupported: 0, missing_answer: 0, source_unavailable: 0}, duplicateRecords: 0,
      };
      const paper = await this.host.saveSnapshot(sql, input, basket.data.blueprint, selection, binding, basket.studentId, current);
      await recordBasketOperation(sql, input.sessionId, input.requestId, 'snapshot', input, basket.studentId, {basketId: basket.id, revision: basket.revision, paperId: paper.id});
      await this.host.afterWrite?.();
      assertLease(current);
      await authorizePaperOwner(sql, input.sessionId, basket.studentId);
      const result = await this.host.readSnapshot(sql, input.sessionId, paper.id);
      if (!result.sourceCurrent) throw new Error('source_changed');
      return result;
    });
  }
}
