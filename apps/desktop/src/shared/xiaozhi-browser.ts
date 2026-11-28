export type BrowserActivity = 'opening' | 'reading' | 'awaiting-confirmation' | 'acting' | 'verifying';
export type BrowserChromeAction = 'new-tab' | 'navigate' | 'select-tab' | 'close-tab' | 'back' | 'forward' | 'reload' | 'stop';
export type BrowserControlCommand = BrowserChromeAction | 'status' | 'dock' | 'cover' | 'float' | 'leave' | 'teacher' | 'agent' | 'remember' | 'forget' | 'redock';
export type BrowserChromeResult = {ok:boolean;status?:import('./xiaozhi-agent').XiaozhiBrowserStatus;error?:string};

export const BROWSER_CHROME_ERRORS = {
  invalid_input: '网址格式有误，请检查后重试。',
  local_address: '这是本机或局域网地址。教学文件可从右栏的「对话文件」打开。',
  unsupported_address: '地址栏支持 HTTP 和 HTTPS 网页。其他类型的链接请在原应用中打开。',
  unsupported_port: '小智浏览器目前支持常用网页端口 80 和 443。请检查网址的端口。',
  protected_url: '网址含登录凭据或敏感内容。请使用站点主页，再在网页中登录。',
  scope_denied: '当前题目补答限定了访问站点。结束这轮任务后可重新打开网址。',
  site_scope: '此标签保存了本站登录。请在地址栏输入其他站点，或用新标签打开。',
  permission_denied: '当前操作没有获得授权。请检查网页控制权和任务权限。',
  busy: '正在处理浏览器操作，请稍后重试。',
  network: '网页连接失败，请检查网络后重试。',
  dns_blocked: '网页解析受阻。可在联网设置选择「自动」或「阿里公共 DNS」后重试。',
  timeout: '网站响应超时，请重试。',
  cancelled: '网页操作已停止。',
  unavailable: '浏览器操作未完成，请重试。',
} as const;
export type BrowserChromeError = keyof typeof BROWSER_CHROME_ERRORS;
export function browserChromeError(value:unknown):BrowserChromeError|undefined{
  return typeof value==='string'&&Object.hasOwn(BROWSER_CHROME_ERRORS,value)?value as BrowserChromeError:undefined;
}


export const XIAOZHI_BROWSER_ACTIONS=['navigate','snapshot','extract','click','type','select','key','scroll','wait','tabs','show','close','screenshot'] as const;
export type XiaozhiBrowserAction=typeof XIAOZHI_BROWSER_ACTIONS[number];
export const BROWSER_TARGET_ROLES = ['button','link','textbox','searchbox','combobox','option','checkbox','radio','tab','menuitem','switch'] as const;
export type XiaozhiBrowserInput={action:XiaozhiBrowserAction;tabId?:string;url?:string;ref?:number;snapshotId?:string;text?:string;value?:string;key?:string;direction?:'up'|'down';amount?:number;newTab?:boolean;expectText?:string;name?:string;role?:typeof BROWSER_TARGET_ROLES[number]};
export type BrowserExtraction={engine:'mozilla-readability-0.6.0';method:'readability'|'dom_region';sourceChars:number;truncated:boolean;lossy:boolean;figures:number;canvas:number;formulas:number;accessHint:'none'|'login_or_challenge';contentSha:string};
export type XiaozhiBrowserReceipt={tabId:string;title:string;url:string;observedAt:string;snapshotId?:string;text?:string;untrusted:true;matchedRef?:number;extraction?:BrowserExtraction;captured?:boolean;capture?:import('./xiaozhi-browser-capture').BrowserCapture};
/** Values are already snapshotted by the main tool boundary, never arbitrary renderer code. */
export function validBrowserInput(value:unknown):value is XiaozhiBrowserInput {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>,allowed=['action','tabId','url','ref','snapshotId','text','value','key','direction','amount','newTab','role','name','expectText'];
  const descriptors=Object.getOwnPropertyDescriptors(v);if(Reflect.ownKeys(v).some(k=>typeof k!=='string'||!allowed.includes(k)||!('value' in descriptors[k])))return false;
  if(!XIAOZHI_BROWSER_ACTIONS.includes(v.action as XiaozhiBrowserAction))return false;
  const string=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max&&!s.includes('\0');
  if(v.tabId!==undefined&&(!string(v.tabId,64)||!/^pibrowser_[a-f0-9-]{36}$/i.test(String(v.tabId))))return false;
  if(v.snapshotId!==undefined&&(!string(v.snapshotId,64)||!/^pisnapshot_[a-f0-9-]{36}$/i.test(String(v.snapshotId))))return false;
  if(v.url!==undefined&&!string(v.url,2048)||v.text!==undefined&&!string(v.text,4000)||v.value!==undefined&&!string(v.value,1000)||v.key!==undefined&&!['Enter','Escape','Tab','Backspace','Delete','Space','ArrowDown','ArrowUp'].includes(String(v.key)))return false;
  if(v.ref!==undefined&&(!Number.isSafeInteger(v.ref)||Number(v.ref)<1||Number(v.ref)>100000)||v.direction!==undefined&&!['up','down'].includes(String(v.direction))||v.amount!==undefined&&(!Number.isSafeInteger(v.amount)||Number(v.amount)<1||Number(v.amount)>10)||v.newTab!==undefined&&typeof v.newTab!=='boolean')return false;
  const fields:Record<string,string[]>={navigate:['url','newTab'],snapshot:['role','name','snapshotId'],extract:['ref','snapshotId'],click:['ref','snapshotId','expectText','role','name'],type:['ref','snapshotId','text'],select:['ref','snapshotId','value','expectText'],key:['key','snapshotId'],scroll:['direction','amount'],wait:['text','snapshotId'],tabs:[],show:[],close:[],screenshot:[]};
  if(Object.keys(v).some(k=>!['action','tabId'].includes(k)&&!fields[String(v.action)].includes(k)))return false;
  if(v.expectText !== undefined && (!string(v.expectText,500)||!String(v.expectText).trim()||!v.tabId))return false;
  if (v.action === 'click' && (v.name !== undefined || v.role !== undefined)) {
    if (!v.tabId || !string(v.name,200) || !String(v.name).trim() || !BROWSER_TARGET_ROLES.includes(v.role as typeof BROWSER_TARGET_ROLES[number])) return false;
  }
  if (v.action === 'snapshot' && (v.name !== undefined || v.role !== undefined || v.snapshotId !== undefined))
    return !!v.tabId && !!v.snapshotId && string(v.name, 200) && !!String(v.name).trim() && BROWSER_TARGET_ROLES.includes(v.role as typeof BROWSER_TARGET_ROLES[number]);
  if (v.action === 'wait' && (v.text !== undefined || v.snapshotId !== undefined))
    return !!v.tabId && !!v.snapshotId && string(v.text, 500) && !!String(v.text).trim();
  if (v.action === 'extract') {
    if (v.ref !== undefined) return v.snapshotId !== undefined;
    return v.snapshotId === undefined || v.tabId !== undefined;
  }
  return v.action==='navigate'?typeof v.url==='string'&&v.url.trim().length>0:['click','type','select'].includes(String(v.action))?v.ref!==undefined&&v.snapshotId!==undefined&&(v.action!=='type'||typeof v.text==='string')&&(v.action!=='select'||typeof v.value==='string'):v.action==='key'?v.key!==undefined&&v.snapshotId!==undefined:true;
}
