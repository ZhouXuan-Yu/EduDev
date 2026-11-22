import {isDeepStrictEqual} from 'node:util';
import {TEACHING_HANDOUT_OFFICE_SCHEMA,type HandoutAudience,type TeachingHandoutOfficeSource} from '../../shared/teaching-handout-export';
import type {TeachingBookVersion} from '../../shared/teaching-book-version';
import {validOfficeDraft,type OfficeDraft,type OfficeSection} from '../../shared/xiaozhi-office-draft';
import {containsOfficeMath,officeMathChunks} from '../../shared/office-math';
import type {TeachingBookContent} from './teaching-book-restore';

export type ConfirmedHandout={version:TeachingBookVersion;content:TeachingBookContent};
export type HandoutOfficeDraft=Extract<OfficeDraft,{handoutSource:TeachingHandoutOfficeSource}>;
export const handoutSourceChanged=(error:unknown)=>error instanceof Error&&
  ['book_unavailable','not_confirmed','version_conflict','source_changed'].includes(error.message);
const studentRoles=new Set(['focus','explanation','example','worked_solution','exercise']);
const plainHeading=(value:string,fallback:string)=>value.length<=120&&!containsOfficeMath(value)?value:fallback;

function contentParagraphs(values:string[]){
  return values.filter(value=>value.trim()).flatMap(value=>officeMathChunks(value.replace(/\r\n?/gu,'\n')));
}

export function compileHandoutOffice({version,content}:ConfirmedHandout,audience:HandoutAudience):HandoutOfficeDraft {
  const {book,chapters,pages,blocks,sources}=content;
  if(version.kind!=='confirmed')throw Error('not_confirmed');
  const role=audience==='student'?'学生版':'教师版';
  const sections:OfficeSection[]=[{heading:'讲义与版本',paragraphs:contentParagraphs([
    book.title,`${role} · 第 ${version.revision} 版`,book.targetLevel,...(audience==='teacher'?[book.description]:[]),
  ])}];
  let included=0;
  for(const [index,chapter] of chapters.entries()){
    const pageIds=new Set(pages.filter(page=>page.chapterId===chapter.id).map(page=>page.id));
    const chapterBlocks=blocks.filter(block=>pageIds.has(block.pageId)&&block.status==='ready');
    const headings=[...chapter.learningObjectives.map(item=>'学习目标：'+item)];
    if(containsOfficeMath(chapter.title)||chapter.title.length>120)headings.unshift(chapter.title);
    for(const block of chapterBlocks){
      const role=block.metadata.handoutRole;
      if(audience==='student'&&(typeof role!=='string'||!studentRoles.has(role)))continue;
      const text=block.payload.text??block.payload.markdown??block.payload.content??block.payload.body;
      if(block.type!=='text'||typeof text!=='string'||!text.trim())throw Error('unsupported_section');
      headings.push(block.title,text);
      included++;
    }
    if(headings.length)sections.push({heading:plainHeading(chapter.title,`第 ${index+1} 章`),paragraphs:contentParagraphs(headings)});
  }
  if(!included)throw Error('draft_incomplete');
  if(audience==='teacher'&&sources.length)sections.push({heading:'参考资料',paragraphs:contentParagraphs(
    sources.flatMap(source=>[source.title,source.snippet]))});
  const draft:HandoutOfficeDraft={
    schemaVersion:TEACHING_HANDOUT_OFFICE_SCHEMA,title:plainHeading(`${book.title} · ${role}`,`教学讲义 · ${role}`),sections,
    handoutSource:{bookId:book.id,versionId:version.id,digest:version.digest,audience},
  };
  if(!validOfficeDraft(draft))throw Error('too_large');
  return draft;
}

export function assertHandoutOffice(item:ConfirmedHandout,draft:HandoutOfficeDraft) {
  if(!isDeepStrictEqual(compileHandoutOffice(item,draft.handoutSource.audience),draft))throw Error('conflict');
}
