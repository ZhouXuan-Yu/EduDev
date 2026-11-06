import {bookSectionKey} from './material-book-answer';

export const BOOK_SECTION_LAYOUT='book-section-layout.v1' as const;
/** Lookup projection only. Raw titles, quote offsets and old section keys stay literal.
 * A closing title ornament immediately after an explicit chapter marker is layout;
 * no body brackets, words, numbers, operators or exam labels are removed. */
export function bookSectionLookupKey(title:string):string{
 return bookSectionKey(title).replace(/^(第[一二三四五六七八九十百零〇\d、，,]+(?:章|单元|课|节))[》〉](?=\p{Script=Han})/u,'$1');
}
