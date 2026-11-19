import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const desktop = 'D:/WorkProject/EduProject-harness/apps/desktop';
const {fingerprint,sha256} = await import(pathToFileURL(path.join(desktop,'scripts/xiaozhi-agent/phase8-real-model-plan.mjs')).href);
const source = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const output = fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-xiaozhi-phase8-migration-'));
const dataRoot=path.join(output,'data'), profile=path.join(output,'profile');
fs.cpSync(source.dataSnapshot,dataRoot,{recursive:true,errorOnExist:true,force:false});
fs.mkdirSync(profile);
assert.equal(fingerprint(dataRoot).sha256,source.dataSha256);
const start=path.join(output,'bootstrap.cjs');
fs.writeFileSync(start,"const {app,net}=require('electron');app.setPath('userData',"+
  JSON.stringify(profile)+");net.fetch=async()=>{throw Error('phase8_seed_network_disabled');};app.whenReady().then(()=>import("+
  JSON.stringify(pathToFileURL(path.join(desktop,'out/main/index.js')).href)+"));");
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)
  && !key.startsWith('OMNI_EDU_') && !['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key)));
Object.assign(env,{OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1'});
const require=createRequire(path.join(desktop,'package.json'));
const app=await require('playwright')._electron.launch({executablePath:require('electron'),cwd:desktop,args:[start],env,timeout:60000});
try {
  const page=await app.firstWindow({timeout:60000});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  await page.waitForFunction(()=>Boolean(window.omniEdu?.getArchivedQuestionVersion));
  const row=await page.evaluate(id=>window.omniEdu.getArchivedQuestionVersion(id),source.questionId);
  assert.equal(row.question.id,source.questionId);
  assert.equal(sha256(row.question.stem),source.stemSha256);
  assert.equal(row.question.sourceKind,source.sourceKind);
  assert.equal(row.version,source.afterVersion);
} finally {await app.close();}
assert.equal(fingerprint(source.dataSnapshot).sha256,source.dataSha256);
const result={success:true,output,sourceDataSha256:source.dataSha256,cloneAfterSha256:fingerprint(dataRoot).sha256,
  questionId:source.questionId,questionVersion:source.afterVersion,builtMainSha256:sha256(fs.readFileSync(path.join(desktop,'out/main/index.js'))),
  paidCalls:0};
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
