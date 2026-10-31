import {officeRelativePath} from './xiaozhi-office-artifacts';
import {validScienceCheck,scienceExpected,type CubeBuoyancyCheck} from './xiaozhi-science-check';

export const DELIVERY_CHECK_SCHEMA='xiaozhi.delivery-checks.v1' as const;
export const CHECK_CLASSES=['structure','content','visual','interaction','numbers','consistency'] as const;
export type CheckClass=typeof CHECK_CLASSES[number];
export type CheckState='passed'|'failed'|'unchecked'|'not_applicable';
export type CheckFinding={kind:CheckClass;state:CheckState;code:string;message:string;page?:number;ruleId?:string};
export type NumberSource=
 |{kind:'label';label:string;page?:number}
 |{kind:'column';column:string|number;sheet?:number;headerRow?:number;startRow?:number;endRow?:number;empty?:'fail'|'ignore'}
 |{kind:'selector';selector:string;attribute?:string;aggregate?:'value'|'sum'};
export type NumberCheck={id:string;source:NumberSource;tolerance?:number;unit?:string}&({expected:number;expectedFrom?:never}|{expected?:never;expectedFrom:CubeBuoyancyCheck});
export type InteractionCheck={id:string;actions:({kind:'set';selector:string;value:string}|{kind:'click';selector:string}|{kind:'key';selector:string;key:string})[];
 observe:string;expectedText?:string;expectedNumber?:number;expectedFrom?:CubeBuoyancyCheck;tolerance?:number;mustChange?:boolean};
export type TextFactCheck={id:string;source:{kind:'label';label:string;page?:number}|{kind:'selector';selector:string}};
export type FileCheckRules={pages?:number;notes?:boolean;contains?:{text:string;page?:number;scope?:'body'|'notes'}[];
 excludes?:{text:string;page?:number;scope?:'body'|'notes'}[];numbers?:NumberCheck[];interactions?:InteractionCheck[];facts?:TextFactCheck[]};
export type CheckFileInput={path:string;version?:string;rules?:FileCheckRules};
export type DeliveryCheckInput={schemaVersion:typeof DELIVERY_CHECK_SCHEMA;sessionId:string;requestId:string;files:CheckFileInput[];
 workspaceVersion?:string;requirementsVersion?:number};
export type CheckedNumber={id:string;value:number;unit?:string};
export type FileCheckReport={path:string;fileVersion:string|null;sha256:string|null;format:string;size:number|null;checks:CheckFinding[];
 pageCount?:number;renderedPages:number[];numbers:CheckedNumber[];state:'passed'|'failed'|'partial'|'stale';
 candidate?:{kind:'text'|'office';id:string;revision:number};facts?:{id:string;value:string}[]};
export type DeliveryCheckReport={schemaVersion:typeof DELIVERY_CHECK_SCHEMA;id:string;sessionId:string;runId:string|null;callId:string|null;
 workspaceVersion:string;requirementsVersion:number|null;policySha256:string;createdAt:string;state:'passed'|'failed'|'partial'|'stale'|'cancelled';
 files:FileCheckReport[];repairAttempts:Partial<Record<CheckClass,number>>;scope:string;candidate?:boolean;repairExhausted?:CheckClass[]};
export type DeliveryCheckResult={ok:true;report:DeliveryCheckReport}|{ok:false;error:'invalid_input'|'permission_denied'|'busy'|'cancelled'|'timeout'|'changed'|'not_found'|'too_large'|'unavailable'};

export const CHECK_LABELS:Record<CheckClass,string>={structure:'文件结构',content:'内容要求',visual:'页面与排版',interaction:'控件与交互',numbers:'数值复核',consistency:'跨文件一致性'};
export const CHECK_STATE_LABELS:Record<CheckState,string>={passed:'通过',failed:'发现问题',unchecked:'未检查',not_applicable:'不适用'};
export const CHECK_UNITS:Record<string,{dimension:string;factor:number}>={
 m:{dimension:'length',factor:1},cm:{dimension:'length',factor:.01},mm:{dimension:'length',factor:.001},
 'm³':{dimension:'volume',factor:1},'cm³':{dimension:'volume',factor:.000001},N:{dimension:'force',factor:1},
 kg:{dimension:'mass',factor:1},'kg/m³':{dimension:'density',factor:1},Pa:{dimension:'pressure',factor:1},
 'm/s':{dimension:'speed',factor:1},'km/h':{dimension:'speed',factor:1/3.6},元:{dimension:'currency',factor:1},
};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const text=(v:unknown,max=120):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ud800-\udfff]/u.test(v);
const id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,47}$/.test(v);
const integer=(v:unknown,max=10000)=>Number.isInteger(v)&&Number(v)>0&&Number(v)<=max;
const finite=(v:unknown)=>typeof v==='number'&&Number.isFinite(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const tolerance=(v:unknown)=>v===undefined||finite(v)&&Number(v)>=0&&Number(v)<=1e6;
function validNumber(v:unknown):v is NumberCheck{
 if(!obj(v)||!keys(v,['id','source','expected','expectedFrom','tolerance','unit'])||!id(v.id)||!(finite(v.expected)&&v.expectedFrom===undefined||v.expected===undefined&&validScienceCheck(v.expectedFrom))||!tolerance(v.tolerance)
  ||v.unit!==undefined&&(typeof v.unit!=='string'||!Object.hasOwn(CHECK_UNITS,v.unit))||!obj(v.source))return false;
 if(v.expectedFrom!==undefined&&v.unit!==undefined&&scienceExpected(v.expectedFrom as CubeBuoyancyCheck).unit!==v.unit)return false;
 const s=v.source;
 if(s.kind==='label')return keys(s,['kind','label','page'])&&text(s.label)&& (s.page===undefined||integer(s.page,64));
 if(s.kind==='selector')return keys(s,['kind','selector','attribute','aggregate'])&&text(s.selector)&&
  (s.attribute===undefined||typeof s.attribute==='string'&&/^[a-z][a-z0-9_-]{0,47}$/i.test(s.attribute))&&(s.aggregate===undefined||['value','sum'].includes(String(s.aggregate)));
 return s.kind==='column'&&keys(s,['kind','column','sheet','headerRow','startRow','endRow','empty'])&&(text(s.column)||integer(s.column,64))
  &&['sheet','headerRow','startRow','endRow'].every(k=>s[k]===undefined||integer(s[k],k==='sheet'?64:10000))
  &&(s.empty===undefined||['fail','ignore'].includes(String(s.empty)))&&(s.startRow===undefined||s.endRow===undefined||Number(s.startRow)<=Number(s.endRow));
}
function validInteraction(v:unknown):v is InteractionCheck{
 if(!obj(v)||!keys(v,['id','actions','observe','expectedText','expectedNumber','expectedFrom','tolerance','mustChange'])||!id(v.id)||!text(v.observe)||!Array.isArray(v.actions)||!v.actions.length||v.actions.length>8
  ||v.expectedText!==undefined&&!text(v.expectedText,300)||v.expectedNumber!==undefined&&!finite(v.expectedNumber)||v.expectedFrom!==undefined&&(!validScienceCheck(v.expectedFrom)||v.expectedNumber!==undefined)||!tolerance(v.tolerance)||v.mustChange!==undefined&&typeof v.mustChange!=='boolean')return false;
 return v.actions.every(a=>obj(a)&&text(a.selector)&&(a.kind==='click'&&keys(a,['kind','selector'])
  ||a.kind==='set'&&keys(a,['kind','selector','value'])&&typeof a.value==='string'&&a.value.length<=128&&!/[\x00-\x1f]/.test(a.value)
  ||a.kind==='key'&&keys(a,['kind','selector','key'])&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Enter',' ','Tab'].includes(String(a.key))));
}
export function validFileCheckRules(v:unknown):v is FileCheckRules{
 if(!obj(v)||!keys(v,['pages','notes','contains','excludes','numbers','interactions','facts'])||v.pages!==undefined&&!integer(v.pages,64)||v.notes!==undefined&&typeof v.notes!=='boolean')return false;
 if(v.facts!==undefined&&(!Array.isArray(v.facts)||v.facts.length>16||!v.facts.every(f=>obj(f)&&keys(f,['id','source'])&&id(f.id)&&obj(f.source)&&(f.source.kind==='label'&&keys(f.source,['kind','label','page'])&&text(f.source.label)&&(f.source.page===undefined||integer(f.source.page,64))||f.source.kind==='selector'&&keys(f.source,['kind','selector'])&&text(f.source.selector)))||new Set(v.facts.map(f=>f.id)).size!==v.facts.length))return false;
 for(const key of ['contains','excludes'])if(v[key]!==undefined&&(!Array.isArray(v[key])||(v[key] as unknown[]).length>32||!(v[key] as unknown[]).every(r=>obj(r)&&keys(r,['text','page','scope'])&&text(r.text,300)&&(r.page===undefined||integer(r.page,64))&&(r.scope===undefined||['body','notes'].includes(String(r.scope))))))return false;
 for(const [key,validate,max] of [['numbers',validNumber,24],['interactions',validInteraction,12]] as const){const values=v[key];if(values!==undefined&&(!Array.isArray(values)||values.length>max||!values.every(validate)||new Set(values.map(r=>r.id)).size!==values.length))return false;}
 return true;
}
export function validDeliveryCheckInput(v:unknown):v is DeliveryCheckInput{
 return obj(v)&&keys(v,['schemaVersion','sessionId','requestId','files','workspaceVersion','requirementsVersion'])&&v.schemaVersion===DELIVERY_CHECK_SCHEMA
  &&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.requestId==='string'&&/^xicheckreq_[a-f0-9-]{36}$/i.test(v.requestId)
  &&(v.workspaceVersion===undefined||hash(v.workspaceVersion))&&(v.requirementsVersion===undefined||integer(v.requirementsVersion,1000000))
  &&Array.isArray(v.files)&&v.files.length>0&&v.files.length<=8&&v.files.every(f=>obj(f)&&keys(f,['path','version','rules'])&&officeRelativePath(f.path)&&(f.version===undefined||hash(f.version))&&(f.rules===undefined||validFileCheckRules(f.rules)))
  &&new Set(v.files.map(f=>f.path.toLowerCase())).size===v.files.length;
}

/** A worker result is private local data; only bounded findings cross the model boundary. */
export type DocumentMetrics={format:string;engine:string;pageCount?:number;sheetCount?:number;pages:{index:number;text:string;notes:string}[];
 sheets?:{index:number;name:string;cells:{row:number;column:number;value:string|number;formula?:boolean}[]}[];
 geometry?:{page:number;code:string}[];fonts?:string[];externalLinks?:boolean};
export const STRUCTURE_SCHEMA='xiaozhi.delivery-structure.v1';
export type StructureRequest={schemaVersion:typeof STRUCTURE_SCHEMA;requestId:string;name:string;bytes:Uint8Array};
export type StructureResult={schemaVersion:typeof STRUCTURE_SCHEMA;requestId:string;ok:true;data:DocumentMetrics}|{schemaVersion:typeof STRUCTURE_SCHEMA;requestId:string;ok:false;error:string};
export function validStructureRequest(v:unknown):v is StructureRequest{
 return obj(v)&&keys(v,['schemaVersion','requestId','name','bytes'])&&v.schemaVersion===STRUCTURE_SCHEMA&&typeof v.requestId==='string'&&/^xicheckreq_[a-f0-9-]{36}$/i.test(v.requestId)
  &&text(v.name,255)&&!/[\\/]/.test(v.name)&&v.bytes instanceof Uint8Array&&v.bytes.byteLength>0&&v.bytes.byteLength<=16*1048576;
}
export function validStructureResult(v:unknown,requestId:string):v is StructureResult{
 if(!obj(v)||v.schemaVersion!==STRUCTURE_SCHEMA||v.requestId!==requestId||typeof v.ok!=='boolean')return false;
 if(!v.ok)return typeof v.error==='string'&&['unsupported','parse_failed','too_large','empty','cancelled','timeout','unavailable','busy'].includes(v.error);
 const d=v.data;if(!obj(d)||!text(d.format,16)||!text(d.engine,80)||!Array.isArray(d.pages)||d.pages.length>64)return false;
 if(!d.pages.every(p=>obj(p)&&integer(p.index,64)&&typeof p.text==='string'&&p.text.length<=256000&&typeof p.notes==='string'&&p.notes.length<=30000))return false;
 try{return JSON.stringify(d).length<=2000000;}catch{return false;}
}
