import {validAttachmentId} from './xiaozhi-attachments';

export type XiaozhiAttachmentReadInput={id:string;revision:number;startLine?:number;lineCount?:number};
export type XiaozhiAttachmentListInput={offset?:number;limit?:number};
/** Tool boundary: never evaluate getters, accept prototypes, symbols or hidden fields. */
function fields(raw:unknown,allowed:readonly string[],required:readonly string[]){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const proto=Object.getPrototypeOf(raw);if(proto!==Object.prototype&&proto!==null)return null;
  const descriptors=Object.getOwnPropertyDescriptors(raw),keys=Reflect.ownKeys(raw);
  if(keys.some(k=>typeof k!=='string'||!allowed.includes(k))||required.some(k=>!Object.prototype.hasOwnProperty.call(descriptors,k))
    ||Object.values(descriptors).some(d=>!('value'in d)||!d.enumerable))return null;
  return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,d.value])) as Record<string,unknown>;
}
const integer=(value:unknown,min:number,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
export function validAttachmentReadInput(raw:unknown):raw is XiaozhiAttachmentReadInput{
  const value=fields(raw,['id','revision','startLine','lineCount'],['id','revision']);
  return !!value&&validAttachmentId(value.id)&&integer(value.revision,0,Number.MAX_SAFE_INTEGER-1)
    &&(!('startLine'in value)||integer(value.startLine,1,Number.MAX_SAFE_INTEGER))
    &&(!('lineCount'in value)||integer(value.lineCount,1,100));
}
export function validAttachmentListInput(raw:unknown):raw is XiaozhiAttachmentListInput{
  const value=fields(raw,['offset','limit'],[]);
  return !!value&&(!('offset'in value)||integer(value.offset,0,Number.MAX_SAFE_INTEGER))
    &&(!('limit'in value)||integer(value.limit,1,50));
}
