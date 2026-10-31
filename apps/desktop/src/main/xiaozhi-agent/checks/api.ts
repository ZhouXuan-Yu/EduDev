import type {IpcMain} from 'electron';
import {DELIVERY_CHECK_SCHEMA,validDeliveryCheckInput,type DeliveryCheckResult} from '../../../shared/xiaozhi-delivery-checks';
import type {createDeliveryChecks} from './service';
const session=(v:unknown):v is string=>typeof v==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v);
const report=(v:unknown):v is string=>typeof v==='string'&&/^xicheck_[a-f0-9]{64}$/.test(v);
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function registerDeliveryCheckIpc(options:{ipcMain:IpcMain;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;service:ReturnType<typeof createDeliveryChecks>}){
 const requests=new Map<string,{sessionId:string;abort:AbortController}>();
 let visualReads=0;
 options.ipcMain.handle('xiaozhi:delivery-check-visual',async(event,input)=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};
  if(!obj(input)||Object.keys(input).some(k=>!['sessionId','id','sha256'].includes(k))||!session(input.sessionId)||!report(input.id)||typeof input.sha256!=='string'||!/^[a-f0-9]{64}$/.test(input.sha256))return{ok:false,error:'invalid_input'};
  if(visualReads>=2)return{ok:false,error:'unavailable'};visualReads++;
  try{return await options.service.visual(input.sessionId,input.id,input.sha256);}finally{visualReads--;}
 });
 options.ipcMain.handle('xiaozhi:delivery-check',async(event,input):Promise<DeliveryCheckResult>=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(!validDeliveryCheckInput(input))return{ok:false,error:'invalid_input'};
  if(requests.has(input.requestId)||requests.size>=4)return{ok:false,error:'busy'};
  const abort=new AbortController();requests.set(input.requestId,{sessionId:input.sessionId,abort});const timer=setTimeout(()=>abort.abort('timeout'),180000);
  const work=options.service.inspect(input,abort.signal);let onAbort:()=>void=()=>{};
  const stopped=new Promise<DeliveryCheckResult>(resolve=>{onAbort=()=>resolve({ok:false,error:abort.signal.reason==='timeout'?'timeout':'cancelled'});abort.signal.addEventListener('abort',onAbort,{once:true});});
  const cleanup=()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);requests.delete(input.requestId);};void work.then(cleanup,cleanup);
  return Promise.race([work,stopped]);
 });
 options.ipcMain.handle('xiaozhi:delivery-check-get',async(event,input)=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};
  if(!obj(input)||Object.keys(input).some(k=>!['sessionId','id'].includes(k))||!session(input.sessionId)||!report(input.id))return{ok:false,error:'invalid_input'};
  try{const value=await options.service.get(input.sessionId,input.id);return value?{ok:true,report:value}:{ok:false,error:'not_found'};}catch{return{ok:false,error:'unavailable'};}
 });
 options.ipcMain.handle('xiaozhi:delivery-check-list',async(event,input)=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(!obj(input)||Object.keys(input).length!==1||!session(input.sessionId))return{ok:false,error:'invalid_input'};
  try{return{ok:true,items:await options.service.list(input.sessionId)};}catch{return{ok:false,error:'unavailable'};}
 });
 options.ipcMain.handle('xiaozhi:delivery-check-cancel',(event,input)=>{
  if(!options.allowed(event)||!obj(input)||Object.keys(input).some(k=>!['sessionId','requestId'].includes(k))||!session(input.sessionId)||typeof input.requestId!=='string'||!/^xicheckreq_[a-f0-9-]{36}$/i.test(input.requestId))return{ok:false};
  const current=requests.get(input.requestId);if(current?.sessionId===input.sessionId)current.abort.abort('cancelled');return{ok:true};
 });
}
