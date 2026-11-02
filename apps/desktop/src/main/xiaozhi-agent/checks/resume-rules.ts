import {validFileCheckRules,type CheckFileInput} from '../../../shared/xiaozhi-delivery-checks';

type RuleBundle={files:{fileId:string;path:string}[];checks?:CheckFileInput[]};
/** Inherit obligations only. Old task bindings and old pass/fail results are never new authority. */
export function resumedCheckRules(oldestFirst:RuleBundle[],current:{fileId:string;path:string;carried?:boolean}[]):CheckFileInput[]{
 const byId=new Map<string,NonNullable<CheckFileInput['rules']>>();
 for(const bundle of oldestFirst)for(const check of bundle.checks||[]){
  const ref=bundle.files.find(f=>f.path===check.path);if(!ref||!validFileCheckRules(check.rules))throw Error('configuration');
  const {bindings:_,...rules}=structuredClone(check.rules);byId.set(ref.fileId,{...byId.get(ref.fileId),...rules});
 }
 return current.flatMap(file=>{const rules=byId.get(file.fileId);return !file.carried&&rules?[{path:file.path,rules}]:[];});
}
