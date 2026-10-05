import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {Agent,MockAgent} from 'undici';
const {createPiWebTools}=await import('../../src/main/xiaozhi-agent/web-tools.ts');
const {createHanaRunToolScope}=await import('../../src/main/xiaozhi-agent/hana-tool-scope.ts');
const {createModelSettingsState}=await import('../../src/main/xiaozhi-agent/model-settings-state.ts');
const {createWebApi,validWebSettings}=await import('../../src/main/xiaozhi-agent/web-api.ts');
const {applyXiaozhiEvent}=await import('../../src/shared/xiaozhi-projection.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-web-boundary-')),workspace=path.join(output,'workspace');fs.mkdirSync(workspace);
const report={success:false,checks:[],boundary:'Real adapter/reader/Pi once/state/projection; mocked HTTP transport, not real provider/UI/noVPN proof'};
const check=(name,fn=()=>{})=>{fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
const mock=new MockAgent();mock.disableNetConnect();const native=Agent.prototype.dispatch;Agent.prototype.dispatch=function(opts,handler){
  if(opts.body && typeof opts.body !== 'string') { void (async()=>{let bytes=[];for await(const chunk of opts.body)bytes.push(Buffer.from(chunk));mock.get(opts.origin).dispatch({...opts,body:Buffer.concat(bytes).toString()},handler);})().catch(error=>handler.onError(error));return true; }
  return mock.get(opts.origin).dispatch(opts,handler);
};
const dns=mock.get('https://223.5.5.5');dns.intercept({path:/^\/resolve\?name=/,method:'GET'}).reply(200,{Status:0,Answer:[{type:1,data:'1.1.1.1'}]}).persist();
const api=mock.get('https://api.anysearch.com'),site=mock.get('https://1.1.1.1');let posted='',current=true;
const sanitize=async text=>text.replaceAll('测试学生甲','[学生姓名]').replaceAll('13800138000','[手机号]');
const defs=createPiWebTools({workspace,sessionId:'test',runId:'run',dnsMode:'alidns',sanitize,isCurrent:()=>current});
const scoped=createHanaRunToolScope(defs),search=scoped.find(t=>t.name==='office_web_search'),read=scoped.find(t=>t.name==='office_web_fetch');
let number=0;const invoke=(tool,args,signal,id)=>tool.execute(id||'web-'+ ++number,args,signal);const payload=result=>JSON.parse(result.content[0].text);
try{
 api.intercept({path:'/v1/search',method:'POST'}).reply(options=>{posted=options.body;return{statusCode:200,data:JSON.stringify({code:0,data:{results:[{title:'公开教研 测试学生甲',url:'https://1.1.1.1/lesson',content:'联系13800138000'},{title:'不得公开',url:'https://1.1.1.1/?name='+encodeURIComponent('测试学生甲'),content:'x'}]}})};});
 const result=await invoke(search,{query:'测试学生甲 13800138000 教研',maxResults:2},undefined,'once');
 check('Necessary query sanitization happens before actual fixed anonymous POST; unsafe encoded source removed',()=>{assert(!result.isError,JSON.stringify(result));assert(!posted.includes('测试学生甲')&&!posted.includes('13800138000'));assert.equal(payload(result).results.length,1);assert(!JSON.stringify(result).includes('测试学生甲')&&!JSON.stringify(result).includes('13800138000'));});
 const repeat=await invoke(search,{query:'测试学生甲 13800138000 教研',maxResults:2},undefined,'once');assert.deepEqual(repeat,result);
 check('Original Hana once wrapper preserves result and makes zero duplicate HTTP request');
 const conflict=await invoke(search,{query:'changed'},undefined,'once');assert(conflict.isError);check('Original once rejects same call ID with different arguments');
 let getters=0;const evil=Object.defineProperty({},'query',{enumerable:true,get(){getters++;return 'secret';}});assert((await invoke(search,evil)).isError);assert.equal(getters,0);
 assert((await invoke(search,{query:'x',extra:'secret'})).isError);check('Accessor and unknown-key input rejected without invoking accessors');
 site.intercept({path:'/lesson',method:'GET'}).reply(200,'<html><title>课程方案</title><body><nav>CHROME_PRIVATE</nav><article><h1>2022课程</h1><p>教研内容 测试学生甲 13800138000</p><script>EXEC_PRIVATE</script></article></body></html>',{headers:{'content-type':'text/html; charset=utf-8'}});
 const page=await invoke(read,{url:'https://1.1.1.1/lesson'});assert(!page.isError);assert(payload(page).text.includes('2022课程'));assert(!JSON.stringify(page).includes('EXEC_PRIVATE')&&!JSON.stringify(page).includes('CHROME_PRIVATE')&&!JSON.stringify(page).includes('13800138000'));
 check('Original Hana HTML reader strips script/chrome; bounded sanitized body and actual URL/time have separate receipts',()=>{assert(page.details.data.sources[0].observedAt);assert.equal(page.details.data.sources[0].kind,'read');assert(!JSON.stringify(page.details).includes('教研内容'));});
 for(const [name,queries]of [['matches',['2022课程','TEST','测试学生甲']],['missing',['不存在的公开词']]]){
  site.intercept({path:'/find-'+name,method:'GET'}).reply(200,'<html><title>公开课程</title><article>2022课程 Test 教研 测试学生甲</article></html>',{headers:{'content-type':'text/html'}});
  const result=await invoke(read,{url:'https://1.1.1.1/find-'+name,find:queries}),value=payload(result);assert(!result.isError);assert.equal(value.find.engine,'pi-web-access@0.36.0');assert.equal(value.find.matchCount,name==='matches'?3:0);assert(!JSON.stringify(value).includes('测试学生甲'));assert.equal(result.details.data.sources[0].kind,'read');
 }check('Installed original findContent locates sanitized body case-insensitively and reports no-match scope honestly');
 for(const find of[[],[''],['a'.repeat(101)],Array(5).fill('a'),'a',[1]])assert.equal((await invoke(read,{url:'https://1.1.1.1/unused',find})).details.data.webError,'invalid_input');check('Keyword limits reject invalid find before transport without duplicate tools');
 for(const url of ['http://127.0.0.1/','http://[::ffff:127.0.0.1]/','https://localhost/','https://user:pass@1.1.1.1/','https://1.1.1.1/?api_key=abc','https://1.1.1.1/?name='+encodeURIComponent('测试学生甲')])assert((await invoke(read,{url})).isError,url);
 site.intercept({path:'/redirect',method:'GET'}).reply(302,'',{headers:{location:'http://169.254.169.254/credentials'}});assert.equal((await invoke(read,{url:'https://1.1.1.1/redirect'})).details.data.webError,'permission_denied');
 check('Private/credential/encoded-student URL and private redirect rejected before target transport');
 api.intercept({path:'/v1/search',method:'POST'}).reply(200,{code:0,data:{results:[]}});const empty=await invoke(search,{query:'no-result'});assert.equal(empty.details.data.webEmpty,true);assert.deepEqual(payload(empty).results,[]);check('Successful empty result stays explicitly empty without invented source');
 for(const [status,code] of [[429,'rate_limited'],[503,'service_error']]){api.intercept({path:'/v1/search',method:'POST'}).reply(status,{message:'RAW_REMOTE_PRIVATE'});const failed=await invoke(search,{query:'failure'});assert(failed.isError);assert.equal(failed.details.data.webError,code);assert(!JSON.stringify(failed).includes('RAW_REMOTE_PRIVATE'));}
 check('Real HTTP rate/service classifications preserved without remote error payload');
 site.intercept({path:'/large',method:'GET'}).reply(200,'not-read',{headers:{'content-length':'1048577'}});assert.equal((await invoke(read,{url:'https://1.1.1.1/large'})).details.data.webError,'too_large');
 site.intercept({path:'/binary',method:'GET'}).reply(200,'not-read',{headers:{'content-type':'application/pdf'}});assert.equal((await invoke(read,{url:'https://1.1.1.1/binary'})).details.data.webError,'unsupported');check('1MiB and unsupported binary boundaries fail explicitly');
 const abort=new AbortController();abort.abort();assert((await invoke(read,{url:'https://1.1.1.1/lesson'},abort.signal)).isError);current=false;assert((await invoke(search,{query:'inactive'})).isError);current=true;check('Aborted and stale-run invocations cannot perform network work');
 const sqlDb=new DatabaseSync(path.join(output,'state.db'));sqlDb.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');sqlDb.prepare('INSERT INTO app_settings VALUES(?,?,?)').run('xiaozhi.provider.v1','SAVED_CREDENTIAL_SENTINEL','old');
 const state=createModelSettingsState({all:async(q,v=[])=>sqlDb.prepare(q).all(...v),change:async(q,v=[])=>sqlDb.prepare(q).run(...v).changes,run:async(q,v=[])=>sqlDb.prepare(q).run(...v)});
 assert.deepEqual(await state.web(),{version:0,enabled:true,dnsMode:'auto'});await state.saveWeb({version:0,enabled:false,dnsMode:'alidns'});await assert.rejects(()=>state.saveWeb({version:0,enabled:true,dnsMode:'system'}),/conflict/);assert.equal(sqlDb.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.provider.v1').value_json,'SAVED_CREDENTIAL_SENTINEL');
 check('Independent app_settings CAS preserves prior encrypted-provider row and explicit disabled preference');
 const sid='aisession_'+randomUUID(),source=page.details.data.sources[0];let opened=[];
 const webApi=createWebApi({host:{saveWebSettings:input=>state.saveWeb(input),snapshot:async()=>({projection:{turns:[{items:[{sources:[source]}]}]}})},preferences:()=>state.web(),open:async url=>{opened.push(url);}});
 assert.equal((await webApi.open({sessionId:sid,url:'https://1.1.1.1/unrecorded'})).error,'permission_denied');assert((await webApi.open({sessionId:sid,url:source.url})).ok);assert.deepEqual(opened,[source.url]);
 for(const input of [{},{schemaVersion:'xiaozhi.web.v1',version:0,enabled:true,dnsMode:'cloudflare'},{schemaVersion:'xiaozhi.web.v1',version:0,enabled:true,dnsMode:'system',apiKey:'secret'}])assert(!validWebSettings(input));
 check('Source opener accepts only recorded session URL; settings refuse arbitrary resolver, secrets and schema');
 let turn={id:'run',status:'running',items:[]};turn=applyXiaozhiEvent(turn,{sessionId:sid,runId:'run',sequence:1,kind:'tool_start',callId:'web',tool:'office_web_fetch'});turn=applyXiaozhiEvent(turn,{sessionId:sid,runId:'run',sequence:2,kind:'tool_end',callId:'web',tool:'office_web_fetch',success:true,sources:[source]});assert.deepEqual(turn.items[0].sources,[source]);assert.equal(turn.items[0].label,'读取公开网页');check('Typed public projection retains URL/time/read kind and human label across JSON readback');
 sqlDb.close();report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{Agent.prototype.dispatch=native;await mock.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
