import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';

// Integration check: reuse the original synthetic saved history, never regenerate it.
const desktop=path.resolve(import.meta.dirname,'../..');
assert(process.env.MATH_EQUATION_COLD_ROOT,'MATH_EQUATION_COLD_ROOT required');
const output=path.resolve(process.env.MATH_EQUATION_COLD_ROOT);
const data=path.join(output,'data'),profile=path.join(output,'profile');
const previous=JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8'));
assert.equal(previous.ok,true);
const sha=b=>createHash('sha256').update(b).digest('hex');
function query(sql){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}}
const receiptSql="SELECT run_id,tool,success,native_state,effect_state FROM xiaozhi_tool_receipts WHERE tool='education_verify_equation' ORDER BY rowid";
const receipts=query(receiptSql),binding=query('SELECT session_file FROM xiaozhi_pi_session_bindings');
assert.equal(binding.length,1);assert.equal(receipts.length,4);
const nativeFile=path.join(data,'xiaozhi-pi',binding[0].session_file),nativeHash=sha(fs.readFileSync(nativeFile));
const report={ok:false,boundary:'Merged-source cold history integration only; original synthetic fixture reused; zero provider replay, no new paid requests.',bundleHash:sha(fs.readFileSync(path.join(desktop,'out/main/index.js'))),originalBundleHash:previous.bundleHash,checks:[],errors:[]};
let app;
try{
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
 await app.evaluate(({net})=>{globalThis.equationColdBlocked=[];net.fetch=async url=>{url=typeof url==='string'?url:url.url;if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash'}]}),{headers:{'content-type':'application/json'}});globalThis.equationColdBlocked.push(url);throw Error('No provider replay permitted');};});
 const page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
 await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
 await page.getByText('本次重新核验得到 x=3',{exact:false}).last().waitFor({timeout:30000});
 await page.getByTestId('agent-trace-toggle').last().click();
 await page.locator('[data-tool-name="education_verify_equation"]').last().waitFor();
 for(const [width,height]of [[1366,768],[1920,1080]]){
  await page.setViewportSize({width,height});
  assert((await page.locator('body').innerText()).includes('核验原方程与定义域'));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(output,'integrated-cold-'+width+'.png')});
 }
 assert.equal(sha(fs.readFileSync(nativeFile)),nativeHash);assert.deepEqual(query(receiptSql),receipts);
 assert.deepEqual(await app.evaluate(()=>globalThis.equationColdBlocked),[]);assert.deepEqual(report.errors,[]);
 report.checks.push('Merged build retains original 4 native equation receipts, labels and latest answer in both viewports; no model replay');
 report.receipts=receipts;report.nativeHash=nativeHash;report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'integrated-cold-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error}));}
