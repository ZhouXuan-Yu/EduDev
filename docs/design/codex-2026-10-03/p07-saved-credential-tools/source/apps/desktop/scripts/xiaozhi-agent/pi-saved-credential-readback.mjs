// Read-only, independent evidence from the completed owned UI run. No new API calls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
const base=fs.realpathSync('test-results/xiaozhi-agent'),output=fs.realpathSync(process.argv[2]);
assert(output.startsWith(base+path.sep)&&path.basename(output).startsWith('pi-saved-credential-tools-'));
const report=JSON.parse(fs.readFileSync(path.join(output,'report.json')));
assert(report.success&&report.checks.length===15&&report.checks.every(c=>c.pass));
assert.equal(sha256(fs.readFileSync('scripts/xiaozhi-agent/pi-saved-credential-tools-ui-smoke.mjs')),report.scriptSha256);
assert.equal(fingerprint(report.build.root).sha256,report.build.sha256);
const db=new DatabaseSync(path.join(output,'data/app.db'),{readOnly:true});let result;
try{
  const raw=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.provider.v1').value_json,settings=JSON.parse(raw);
  assert(settings.sealedKey&&settings.defaultModel==='deepseek-flash');
  const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key&&!raw.includes(key));
  assert.equal(db.prepare('SELECT count(*) AS n FROM app_settings WHERE key=?').get('deepseek').n,0);
  const bindings=db.prepare('SELECT * FROM xiaozhi_pi_session_bindings').all();assert.equal(bindings.length,1);
  const binding=bindings[0],ledger=db.prepare('SELECT current_model,origin_model,revision FROM xiaozhi_pi_model_state WHERE conversation_id=?').get(binding.conversation_id);
  assert.deepEqual({...ledger},{current_model:'deepseek-v4-pro',origin_model:'deepseek-flash',revision:1});
  const rows=fs.readFileSync(path.join(output,'data/xiaozhi-pi',binding.session_file),'utf8').trimEnd().split('\n').map(JSON.parse);
  const currentText=fs.readFileSync(path.join(output,'workspace/03-资料实读.txt'),'utf8'),code=currentText.match(/核验码：(.*)/)[1];assert(report.coldAnswer.includes(code)&&report.coldAnswer.includes('41'));
  assert(rows.some(r=>r.message?.role==='toolResult'&&r.message.toolName==='office_read_text'&&!r.message.isError&&JSON.stringify(r.message.content).includes(code)));
  assert.equal(rows.filter(r=>r.message?.role==='toolResult'&&r.message.toolName==='office_view_public_image').length,1);
  assert(rows.filter(r=>r.message?.role==='toolResult'&&r.message.toolName==='office_view_public_image').every(r=>r.message.isError));
  assert(!rows.some(r=>Array.isArray(r.message?.content)&&r.message.content.some(c=>c.type==='image')));
  const usage=rows.filter(r=>r.message?.role==='assistant'&&r.message.usage).map(r=>{const u=r.message.usage,denominator=u.input+u.cacheRead+u.cacheWrite;assert([u.input,u.output,u.cacheRead,u.cacheWrite].every(v=>Number.isSafeInteger(v)&&v>=0));assert.equal(u.totalTokens,denominator+u.output);return{model:r.message.model,input:u.input,output:u.output,cacheRead:u.cacheRead,cacheWrite:u.cacheWrite,promptTokens:denominator,cacheHitPercent:denominator?u.cacheRead/denominator*100:null};});
  assert.equal(usage.length,report.transports.length);assert(report.transports.every(r=>r.credentialMatchesSaved&&r.status===200&&r.imageParts===0));
  const sums=usage.reduce((a,u)=>({promptTokens:a.promptTokens+u.promptTokens,cacheRead:a.cacheRead+u.cacheRead,output:a.output+u.output}),{promptTokens:0,cacheRead:0,output:0});
  const screenshots=['saved-settings-1366.png','saved-settings-1920.png','invalid-save.png','unsupported-image.png'].map(file=>{const bytes=fs.readFileSync(path.join(output,file));assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));return{file,sha256:sha256(bytes),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};});
  result={success:true,scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),uiReportSha256:sha256(fs.readFileSync(path.join(output,'report.json'))),buildSha256:report.build.sha256,configurationEncrypted:true,legacyCredentialAbsent:true,ledger,actualRequests:usage.length,usage,aggregate:{...sums,cacheHitPercent:sums.cacheRead/sums.promptTokens*100},screenshots,boundary:'Readonly verification of this C run only; SDK input excludes cached tokens. Actual per-request cache hits, not a promised hit rate or zero API cost. No new provider requests or native/model/profile data copied.'};
}finally{db.close();}
fs.writeFileSync(path.join(output,'readback.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(result));
