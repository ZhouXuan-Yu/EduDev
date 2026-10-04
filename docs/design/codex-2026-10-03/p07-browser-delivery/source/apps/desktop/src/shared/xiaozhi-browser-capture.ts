export const BROWSER_CAPTURE_SCHEMA='xiaozhi.browser-capture.v1' as const;
export type BrowserCapture={schemaVersion:typeof BROWSER_CAPTURE_SCHEMA;id:string;sha256:string;size:number;width:number;height:number;title:string;url:string;observedAt:string};
export type BrowserCaptureInput={schemaVersion:typeof BROWSER_CAPTURE_SCHEMA;sessionId:string;captureId:string};
export type BrowserCaptureResult={ok:true;image:string}|{ok:false;error:'invalid_input'|'permission_denied'|'not_found'|'changed'|'too_large'|'read_failed'};
export function validBrowserCapture(v:unknown):v is BrowserCapture{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const d=Object.getOwnPropertyDescriptors(v),keys=['schemaVersion','id','sha256','size','width','height','title','url','observedAt'];
 if(Reflect.ownKeys(v).length!==keys.length||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k))||Object.values(d).some(v=>!('value'in v)))return false;
 const x=v as BrowserCapture;
 return x.schemaVersion===BROWSER_CAPTURE_SCHEMA&&/^browser-screenshot-[a-f0-9]{16}\.png$/.test(x.id)&&/^[a-f0-9]{64}$/.test(x.sha256)
 &&Number.isSafeInteger(x.size)&&x.size>0&&x.size<=4*1048576&&Number.isSafeInteger(x.width)&&x.width>0&&Number.isSafeInteger(x.height)&&x.height>0&&x.width*x.height<=16_000_000
 &&typeof x.title==='string'&&x.title.length<=200&&typeof x.url==='string'&&x.url.length<=2048&&/^https?:\/\//.test(x.url)&&typeof x.observedAt==='string'&&Number.isFinite(Date.parse(x.observedAt));
}
export function validBrowserCaptureInput(v:unknown):v is BrowserCaptureInput{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const d=Object.getOwnPropertyDescriptors(v),keys=['schemaVersion','sessionId','captureId'];
 if(Reflect.ownKeys(v).length!==3||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k))||Object.values(d).some(v=>!('value'in v)))return false;
 return d.schemaVersion.value===BROWSER_CAPTURE_SCHEMA&&typeof d.sessionId.value==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(d.sessionId.value)
 &&typeof d.captureId.value==='string'&&/^browser-screenshot-[a-f0-9]{16}\.png$/.test(d.captureId.value);
}
export const BROWSER_CAPTURE_ERRORS={invalid_input:'截图请求无效。',permission_denied:'此截图不属于当前对话或对话已归档。',not_found:'本地截图已不存在。',changed:'截图文件已变化，无法确认原页面。',too_large:'截图超过本地预览限制。',read_failed:'无法读取截图，请重试。'};
