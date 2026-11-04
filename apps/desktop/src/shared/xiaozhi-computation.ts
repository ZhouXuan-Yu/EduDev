export const TABLE_INPUT_SCHEMA='xiaozhi.table-input.v1' as const;
export type ComputationCell=string|number|null;
export type ComputationColumn={key:string;label:string;type:'text'|'number';nullable?:boolean};
export type ComputationTablePolicy={schemaVersion:typeof TABLE_INPUT_SCHEMA;encoding:'UTF-8';delimiter:','|';';decimal:'.';empty:'explicit_nullable';text:'preserve';quotedNewlines:true;columns:ComputationColumn[]};
export type ComputationProof={inputSha256:string;codeSha256:string;policy?:ComputationTablePolicy};
export type ComputationReference=ComputationProof&{resultId:string;resultSha256:string};
export type ComputationReportInput={resultId:string;title:string;columns:ComputationColumn[];chart?:{category:string;value:string};outputs:{format:'csv'|'html'|'xlsx';path:string}[]};
export const computationRecord=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const computationText=(v:unknown,max=120,empty=false):v is string=>typeof v==='string'&&(empty||!!v.trim())&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff]/u.test(v);
export function computationColumns(v:unknown):v is ComputationColumn[]{
 if(!Array.isArray(v)||!v.length||v.length>8)return false;
 const keys=new Set<string>(),labels=new Set<string>();
 return v.every(c=>computationRecord(c)&&Object.keys(c).every(k=>['key','label','type','nullable'].includes(k))
  &&typeof c.key==='string'&&/^[a-z][a-zA-Z0-9_]{0,47}$/.test(c.key)&&!['constructor','prototype'].includes(c.key)
  &&computationText(c.label)&&['text','number'].includes(String(c.type))&&(c.nullable===undefined||typeof c.nullable==='boolean')
  &&!keys.has(c.key)&&!labels.has(c.label)&&!!keys.add(c.key)&&!!labels.add(c.label));
}
/** Select a file-effect reader from the actual host receipt, never a model claim. */
export function computationEffectTool(tool:string,payload:Record<string,unknown>):string{
 if(tool!=='education_create_report'&&tool!=='education_export_teaching_lesson')return tool;
 return typeof payload.bundleId==='string'?'office_deliver_files':typeof payload.artifactId==='string'?'office_create_document':'office_create_text';
}
