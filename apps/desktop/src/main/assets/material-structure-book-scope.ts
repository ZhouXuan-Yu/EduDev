import type { DocumentStructureReference, StructurePage, StructureQuestion } from '../../shared/material-document-structure';
import { bookSectionAt, bookSectionKey } from './material-book-answer-content';

export type StructureBookScope = {
  schemaVersion: 'xiaozhi.structure-book-scope.v1';
  reference: DocumentStructureReference;
  page: number;
  section: string;
  headingPage?: number;
  pages: string[];
};

/** Use the frozen reading order and the parent marker, including the title of a previous page. */
export function structureBookScope(
  reference: DocumentStructureReference,
  question: StructureQuestion,
  pages: { page: StructurePage; sha: string }[],
): StructureBookScope {
  const firstPage = question.pageRange[0];
  const scope: StructureBookScope = { schemaVersion: 'xiaozhi.structure-book-scope.v1', reference, page: firstPage, section: '', pages: [] };
  if (pages.at(-1)?.page.page !== firstPage || question.kind !== 'question') throw Error('source_changed');
  const heading = { section: '', page: 0 };
  let previousPage = pages[0].page.page - 1;
  let firstMarkerSeen = false;
  const occurrences = new Map<string, number>();
  const marker = question.paragraphIds[0];
  for (const { page, sha } of pages) {
    if (page.page !== ++previousPage) throw Error('source_changed');
    scope.pages.push(sha);
    if (page.issues.includes('ambiguous_columns')) {
      Object.assign(heading, { section: '', page: 0 });
      continue;
    }
    let preceding = '';
    const updateHeading = () => {
      const section = bookSectionAt(preceding);
      if (section !== undefined) Object.assign(heading, { section, page: page.page });
    };
    for (const paragraph of page.paragraphs) {
      if (paragraph.marker?.kind === 'parent' && paragraph.marker.label === question.number) {
        updateHeading();
        const key = bookSectionKey(heading.section);
        occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
        if (page.page === firstPage && paragraph.id === marker) {
          firstMarkerSeen = true;
          scope.section = heading.section;
          if (heading.section) scope.headingPage = heading.page;
        }
      }
      if (paragraph.role === 'heading' || paragraph.role === 'body') preceding += paragraph.rawText + '\n';
      else preceding += '·\n';
    }
    updateHeading();
  }
  if (!firstMarkerSeen || scope.section.length > 200 ||
      occurrences.get(bookSectionKey(scope.section)) !== 1 || question.issues.includes('numbering_conflict')) {
    scope.section = '';
    delete scope.headingPage;
  }
  return scope;
}
