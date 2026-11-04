import {materialBatchId} from './material-import-batch';
import {plainStudentInput} from './student-context';
import type {MaterialBookRole} from './material-book-pair';
export const MATERIAL_FOLDER_BOOKS_SCHEMA='xiaozhi.material-folder-books.v1' as const;
export type MaterialFolderBooksQuery={schemaVersion:typeof MATERIAL_FOLDER_BOOKS_SCHEMA;batchId:string;query:string;offset:number};
export type MaterialFolderBook={resourceId:string;version:string;relativePath:string;role:MaterialBookRole|null};
export type MaterialFolderBooksPage={schemaVersion:typeof MATERIAL_FOLDER_BOOKS_SCHEMA;batchId:string;books:MaterialFolderBook[];total:number;offset:number;hasMore:boolean;archiveComplete:boolean};
export function validMaterialFolderBooksQuery(v:unknown):v is MaterialFolderBooksQuery{
 return plainStudentInput(v,['schemaVersion','batchId','query','offset'])&&Object.keys(v).length===4&&v.schemaVersion===MATERIAL_FOLDER_BOOKS_SCHEMA&&materialBatchId(v.batchId)&&typeof v.query==='string'&&v.query.length<=128&&!/[\x00-\x1f]/.test(v.query)&&Number.isSafeInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=10000000;
}
