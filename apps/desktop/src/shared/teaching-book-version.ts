export type TeachingBookVersionKind = 'confirmed' | 'before_restore' | 'restored_draft';
export type TeachingBookVersion = {
  id:string; bookId:string; revision:number; digest:string; title:string;
  kind:TeachingBookVersionKind; createdAt:string; restoredFrom?:string;
};
export type TeachingBookVersionHistory = {versions:TeachingBookVersion[]; currentConfirmed?:TeachingBookVersion; total:number};
export type TeachingBookVersionPreview = {
  bookId:string; title:string; digest:string; markdown:string; version?:TeachingBookVersion;
  sourceTitles:string[]; patchCount:number; readOnly:boolean;
};
export type TeachingBookVersionRead = {bookId:string; versionId?:string};
export type TeachingBookConfirm = {bookId:string; digest:string};
export type TeachingBookRestore = {bookId:string; currentDigest:string; versionId:string; versionDigest:string};
export type TeachingBookVersionResult<T> = {ok:true;value:T} | {ok:false;error:string;message:string};
