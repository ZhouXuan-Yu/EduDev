export const XIAOZHI_BROWSER_ACTIONS=['navigate','snapshot','extract','click','type','select','key','scroll','wait','tabs','show','close','screenshot'] as const;
export type XiaozhiBrowserAction=typeof XIAOZHI_BROWSER_ACTIONS[number];
export type XiaozhiBrowserInput={action:XiaozhiBrowserAction;tabId?:string;url?:string;ref?:number;snapshotId?:string;text?:string;value?:string;key?:string;direction?:'up'|'down';amount?:number;newTab?:boolean};
export type BrowserExtraction={engine:'mozilla-readability-0.6.0';method:'readability'|'dom_region';sourceChars:number;truncated:boolean;figures:number;canvas:number;formulas:number;accessHint:'none'|'login_or_challenge';contentSha:string};
export type XiaozhiBrowserReceipt={tabId:string;title:string;url:string;observedAt:string;snapshotId?:string;text?:string;untrusted:true;extraction?:BrowserExtraction;captured?:boolean;capture?:import('./xiaozhi-browser-capture').BrowserCapture};
/** Values are already snapshotted by the main tool boundary, never arbitrary renderer code. */
export function validBrowserInput(value:unknown):value is XiaozhiBrowserInput {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>,allowed=['action','tabId','url','ref','snapshotId','text','value','key','direction','amount','newTab'];
  const descriptors=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(v).some(k=>typeof k!=='string'||!allowed.includes(k)||!('value' in descriptors[k])))return false;
  if(!XIAOZHI_BROWSER_ACTIONS.includes(v.action as XiaozhiBrowserAction))return false;
  const string=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max&&!s.includes('\0');
  if(v.tabId!==undefined&&(!string(v.tabId,64)||!/^pibrowser_[a-f0-9-]{36}$/i.test(String(v.tabId))))return false;
  if(v.snapshotId!==undefined&&(!string(v.snapshotId,64)||!/^pisnapshot_[a-f0-9-]{36}$/i.test(String(v.snapshotId))))return false;
  if(v.url!==undefined&&!string(v.url,2048)||v.text!==undefined&&!string(v.text,4000)||v.value!==undefined&&!string(v.value,1000)||v.key!==undefined&&!['Enter','Escape','Tab','Backspace','Delete','Space','ArrowDown','ArrowUp'].includes(String(v.key)))return false;
  if(v.ref!==undefined&&(!Number.isSafeInteger(v.ref)||Number(v.ref)<1||Number(v.ref)>100000)||v.direction!==undefined&&!['up','down'].includes(String(v.direction))||v.amount!==undefined&&(!Number.isSafeInteger(v.amount)||Number(v.amount)<1||Number(v.amount)>10)||v.newTab!==undefined&&typeof v.newTab!=='boolean')return false;
  const fields:Record<string,string[]>={navigate:['url','newTab'],snapshot:[],extract:['ref','snapshotId'],click:['ref','snapshotId'],type:['ref','snapshotId','text'],select:['ref','snapshotId','value'],key:['key','snapshotId'],scroll:['direction','amount'],wait:[],tabs:[],show:[],close:[],screenshot:[]};
  if(Object.keys(v).some(k=>!['action','tabId'].includes(k)&&!fields[String(v.action)].includes(k)))return false;
  return v.action==='navigate'?typeof v.url==='string'&&v.url.trim().length>0:v.action==='extract'?(v.ref===undefined)===(v.snapshotId===undefined):['click','type','select'].includes(String(v.action))?v.ref!==undefined&&v.snapshotId!==undefined&&(v.action!=='type'||typeof v.text==='string')&&(v.action!=='select'||typeof v.value==='string'):v.action==='key'?v.key!==undefined&&v.snapshotId!==undefined:true;
}
