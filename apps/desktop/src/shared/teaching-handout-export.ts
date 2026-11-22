export const TEACHING_HANDOUT_OFFICE_SCHEMA='xiaozhi.teaching-handout-office.v1';
export const READ_TEACHING_HANDOUT='education_read_teaching_handout';
export const EXPORT_TEACHING_HANDOUT='education_export_teaching_handout';
export type HandoutAudience='student'|'teacher';
export type TeachingHandoutVersionRef={bookId:string;versionId:string;digest:string};
export type TeachingHandoutOfficeSource=TeachingHandoutVersionRef&{audience:HandoutAudience};
export type TeachingHandoutOfficeOutput={audience:HandoutAudience;path:string};

const uuid='[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}';
export const handoutBookId=(value:unknown):value is string=>typeof value==='string'&&new RegExp('^teaching_book_'+uuid+'$','u').test(value);
export const handoutVersionId=(value:unknown):value is string=>typeof value==='string'&&new RegExp('^teaching_version_'+uuid+'$','u').test(value);
export const handoutDigest=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
export const handoutAudience=(value:unknown):value is HandoutAudience=>value==='student'||value==='teacher';
export function validTeachingHandoutOfficeSource(value:unknown):value is TeachingHandoutOfficeSource{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const row=value as Record<string,unknown>;
  return Object.keys(row).sort().join(',')==='audience,bookId,digest,versionId'&&handoutBookId(row.bookId)
    &&handoutVersionId(row.versionId)&&handoutDigest(row.digest)&&handoutAudience(row.audience);
}
