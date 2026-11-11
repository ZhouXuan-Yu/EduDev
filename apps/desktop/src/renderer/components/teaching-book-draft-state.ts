import type {TeachingBlockStatus, TeachingBlockType, TeachingBook, TeachingBookDetail, TeachingBookStatus, TeachingContentType} from '../../shared/contracts';

type Block = TeachingBookDetail['blocks'][number];
export const emptyBookDraft = {title: '', description: '', targetLevel: '', language: 'zh-CN', status: 'draft' as TeachingBookStatus};
export const emptyChapterDraft = {title: '', objectives: '', prerequisites: '', summary: '', contentType: 'theory' as TeachingContentType};
export const emptyPageDraft = {title: '', objectives: '', contentType: 'theory' as TeachingContentType};
export const emptyBlockDraft = {title: '', text: '', type: 'text' as TeachingBlockType, status: 'ready' as TeachingBlockStatus, sourceRef: ''};
export const emptySourceDraft = {ref: '', title: '', snippet: ''};
export const emptyPatchDraft = {title: '', text: '', reason: ''};
export const emptySelectionPatchDraft = {start: 0, end: 0, replacement: '', mode: 'react_edit' as 'react_edit' | 'automark', reason: ''};

export function teachingBookDraftBaseline(book?: TeachingBook, block?: Block, text = '') {
  return {
    book: book ? {title: book.title, description: book.description, targetLevel: book.targetLevel, language: book.language, status: book.status} : emptyBookDraft,
    chapter: emptyChapterDraft,
    page: emptyPageDraft,
    block: block ? {title: block.title, text, type: block.type, status: block.status, sourceRef: block.sourceAnchors[0]?.ref ?? ''} : emptyBlockDraft,
    source: emptySourceDraft,
    patch: block ? {title: block.title, text, reason: ''} : emptyPatchDraft,
    selection: emptySelectionPatchDraft,
  };
}

export type TeachingBookDrafts = ReturnType<typeof teachingBookDraftBaseline>;
const changed = (current: object, baseline: object) => JSON.stringify(current) !== JSON.stringify(baseline);

export function teachingBookDirtyScopes(drafts: TeachingBookDrafts, baseline: TeachingBookDrafts, editingBlockId: string) {
  return {
    book: changed(drafts.book, baseline.book),
    chapter: changed(drafts.chapter, baseline.chapter),
    page: changed(drafts.page, baseline.page),
    block: changed(drafts.block, baseline.block),
    source: changed(drafts.source, baseline.source),
    patch: Boolean(editingBlockId) && changed(drafts.patch, baseline.patch),
    selection: Boolean(editingBlockId) && changed(drafts.selection, baseline.selection),
  };
}

/** Readback may advance saved areas while an unrelated local draft keeps its CAS base. */
export function preserveTeachingBookDraftVersions(previous: TeachingBookDetail | null, next: TeachingBookDetail, scopes: ReturnType<typeof teachingBookDirtyScopes>, editingBlockId: string, acceptBookDraft: boolean) {
  if (!previous || previous.book.id !== next.book.id) return next;
  const editedBlock = previous.blocks.find(block => block.id === editingBlockId);
  const keepBlock = editedBlock && (scopes.block || scopes.patch || scopes.selection);
  return {
    ...next,
    book: scopes.book && !acceptBookDraft ? {...next.book, version: previous.book.version} : next.book,
    blocks: keepBlock ? next.blocks.map(block => block.id === editedBlock.id ? {...block, version: editedBlock.version} : block) : next.blocks,
  };
}
