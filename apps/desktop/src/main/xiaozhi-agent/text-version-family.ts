import type {TextVersionRecord} from './text-change-state';

/** Derived from the original text ledger, including compatible pre-parent rows. */
export function textVersionFamilies(records:TextVersionRecord[]) {
  if(records.length>256)throw Error('configuration');
  const result=new Map<string,{familyId:string;currentId:string;versions:TextVersionRecord[]}>();
  const groups=new Map<string,TextVersionRecord[]>(),last=new Map<string,TextVersionRecord>();
  for(const row of records) {
    if(!/\.html$/i.test(row.path)||!['applied','reverted'].includes(row.state))continue;
    const key=row.workspaceHash+':'+row.path;
    const parent=row.parentChangeId?records.find(v=>v.id===row.parentChangeId):row.operation==='edit'?last.get(key):undefined;
    if(row.parentChangeId&&(!parent||parent.workspaceHash!==row.workspaceHash||!result.has(parent.id)))throw Error('configuration');
    const familyId=parent&&result.get(parent.id)?.familyId||row.id,group=groups.get(familyId)||[];
    group.push(row);groups.set(familyId,group);last.set(key,row);
    // An original undo is retained as history, but is never advertised as the current after-bytes.
    const current=group.filter(v=>v.state==='applied').at(-1);
    for(const item of group)result.set(item.id,{familyId,currentId:current?.id||'',versions:group});
  }
  return result;
}
