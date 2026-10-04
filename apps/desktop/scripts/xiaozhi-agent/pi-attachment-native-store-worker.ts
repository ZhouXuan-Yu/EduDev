import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {OmniEduStore} from '../../src/main/db';
import {createAttachmentService} from '../../src/main/xiaozhi-agent/attachment-service';
import {workspaceHash} from '../../src/main/xiaozhi-agent/workspace-authority';
const output=process.argv[2],data=path.join(output,'data'),root=path.join(output,'workspace');
const report:{success:boolean;checks:{name:string;pass:boolean}[];boundary:string;error?:string}={success:false,checks:[],boundary:'Actual Electron native sqlite3 and OmniEduStore initialization; synthetic isolated files, source state/service APIs. No renderer/chooser, model delivery or viewed-image receipt proof.'};
const check=(name:string)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
globalThis.fetch=async()=>{throw new Error('Network forbidden in native local attachment foundation');};
let store:OmniEduStore|undefined;
const close=async(value:OmniEduStore)=>{const native=(value as unknown as {db:{close:(cb:(error?:Error)=>void)=>void}}).db;await new Promise<void>((resolve,reject)=>native.close(error=>error?reject(error):resolve()));};
try{
 fs.mkdirSync(root);fs.writeFileSync(path.join(root,'教研.txt'),'真实本地原生SQLite附件');fs.writeFileSync(path.join(root,'颜色.png'),fs.readFileSync('scripts/xiaozhi-agent/fixtures/attachment-rgb.png'));
 store=new OmniEduStore(data);await store.init();const detail=await store.createAiConversationSession({title:'合成附件事实',folderId:null}),id=detail.session.id;
 assert.deepEqual(await store.xiaozhiState.attachments.list(id),[]);check('Actual OmniEduStore initializes the additive attachment schema with original native sqlite3');
 const lease={path:root,label:'合成目录',version:workspaceHash(root)},service=createAttachmentService({state:store.xiaozhiState.attachments,resolve:async()=>lease});
 const text=await service.select(id,'教研.txt',new AbortController().signal),image=await service.select(id,'颜色.png',new AbortController().signal);assert.equal(image.mime,'image/png');assert.equal((await store.xiaozhiState.attachments.list(id)).length,2);check('Real production SQLite callback adapter captures two actual local files with distinct stable source identities');
 const selections=[text,image].map(({id,revision})=>({id,revision}));const draft=await store.xiaozhiState.attachments.list(id);
 await assert.rejects(store.xiaozhiState.attachments.bind(id,[selections[0],{...selections[1],revision:99}],'run_fixture','message_fixture'),error=>error instanceof Error&&error.message==='changed');assert.deepEqual(await store.xiaozhiState.attachments.list(id),draft);
 const result=await store.xiaozhiState.attachments.bind(id,selections,'run_fixture','message_fixture');assert.equal(result.length,2);assert(result.every(row=>row?.state==='submitted'));await assert.rejects(store.xiaozhiState.attachments.remove(id,{id:image.id,revision:1}),error=>error instanceof Error&&error.message==='changed');check('Actual production SQL rejects stale batch without partial mutation, commits materialized multi-file CAS and refuses removing submitted history');
 const before=await store.xiaozhiState.attachments.list(id);await store.init();assert.deepEqual(await store.xiaozhiState.attachments.list(id),before);await close(store);store=undefined;store=new OmniEduStore(data);await store.init();assert.deepEqual(await store.xiaozhiState.attachments.list(id),before);check('Actual store repeat initialization and close/reopen preserve original attachment revisions and message/run references');report.success=true;
}catch(error){process.exitCode=1;report.error=String((error as Error).stack).replace(/\bsk-[A-Za-z0-9]{16,}\b/g,'[credential]').slice(0,2200);}finally{if(store)await close(store).catch(()=>undefined);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error}));}
