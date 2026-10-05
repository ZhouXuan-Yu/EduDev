import type { TeacherResource } from '../../../shared/contracts';

const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase().trim();
/** Name/format filtering of the loaded local directory; never a full-text claim. */
export function matchesMaterial(query:string,...values:string[]):boolean {
  const haystack=normalize(values.join(' '));
  return normalize(query).split(/\s+/).filter(Boolean).every(term=>haystack.includes(term));
}
export function materialReadiness(resource:Pick<TeacherResource,'parseStatus'|'chunkCount'>):{label:string;tone:'ready'|'waiting'|'error'} {
  if(resource.parseStatus==='failed')return {label:'读取失败',tone:'error'};
  if(resource.parseStatus==='partial')return {label:'部分内容可用',tone:'waiting'};
  if(resource.chunkCount>0&&['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus))return {label:'可用于查找',tone:'ready'};
  return {label:'已保存，正文待处理',tone:'waiting'};
}
export function libraryFileSize(bytes:number):string {return bytes>=1048576?`${(bytes/1048576).toFixed(1)} MB`:bytes>=1024?`${(bytes/1024).toFixed(1)} KB`:`${bytes} B`;}
export function libraryDate(value:string):string {const date=new Date(value);return Number.isNaN(date.getTime())?'日期未知':date.toLocaleDateString('zh-CN');}
