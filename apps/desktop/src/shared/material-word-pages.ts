import type {TeacherResource} from './contracts';
import {materialId} from './materials';
import type {WordOfficeProgress} from './material-word-drawing';

export const WORD_PAGES_SCHEMA='xiaozhi.word-pages.v1' as const;
export const WORD_PAGES_ENGINE='libreoffice-writer-pdf-26.8.2.v1' as const;
export type WordPagesQuery={schemaVersion:typeof WORD_PAGES_SCHEMA;resourceId:string;version:string};
export type WordPagesState='idle'|'running'|'complete'|'failed'|'cancelled'|'interrupted';
export type WordPagesView={schemaVersion:typeof WORD_PAGES_SCHEMA;role:'original'|'pages';status:WordPagesState;error:string;
  original:{id:string;version:string;name:string};originalAvailable:boolean;pdf?:TeacherResource;pages?:number;component?:WordOfficeProgress};
export function validWordPagesQuery(value:unknown):value is WordPagesQuery{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const item=value as Record<string,unknown>;
 return Object.keys(item).sort().join(',')==='resourceId,schemaVersion,version'&&item.schemaVersion===WORD_PAGES_SCHEMA&&
  materialId(item.resourceId)&&typeof item.version==='string'&&/^[a-f0-9]{64}$/.test(item.version);
}
