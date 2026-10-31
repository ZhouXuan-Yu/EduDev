import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';

// Opt-in real local files. This phase never configures or calls a cloud provider.
const folder=process.argv[2];
if(!folder||!path.isAbsolute(folder)||!fs.statSync(folder).isDirectory())throw Error('Pass an absolute authorized material folder');
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const resume=process.argv[3];
if(resume&&(!path.isAbsolute(resume)||!fs.existsSync(path.join(resume,'progress.json'))))throw Error('Resume requires an existing journey output');
const output=resume||fs.mkdtempSync(path.join(tmpdir(),'omni-real-material-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const fingerprint=()=>fs.readdirSync(folder,{withFileTypes:true}).filter(f=>f.isFile()).map(f=>{const p=path.join(folder,f.name),b=fs.readFileSync(p);return {name:f.name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};});
const report={output,folder,source:fingerprint(),checks:[],rendererErrors:[],snapshots:[],scope:'Actual local folder, production Electron UI/OCR/index. Isolated data and profile; no cloud requests.'};
let app,page;
const note=s=>{report.checks.push(s);console.log(s);};
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data};
 for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'].includes(key))delete env[key];
 Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'});
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 await app.evaluate(({net})=>{for(const owner of [globalThis,net]){const ordinary=owner.fetch.bind(owner);owner.fetch=async(url,...args)=>{if(/chat\/completions/.test(String(url)))throw Error('Cloud disabled for local material journey');return ordinary(url,...args);};}});
 page=await app.firstWindow();page.on('pageerror',e=>report.rendererErrors.push(e.message));await page.setViewportSize({width:1366,height:768});
 await page.locator('[data-testid="nav-knowledge"]:visible').click();await page.getByTestId('materials-import-folder').waitFor();
}
const materials=()=>page.evaluate(()=>window.omniEdu.listMaterials({schemaVersion:'xiaozhi.materials.v1',query:'',offset:0}));
try{
 console.log('OUTPUT '+output);await launch();
 if(!resume){await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},folder);await page.getByTestId('materials-import-folder').click();}
 const deadline=Date.now()+15*60*1000;let stable=0;
 while(Date.now()<deadline){
  const resources=(await materials()).resources;
  const batches=await page.evaluate(()=>window.omniEdu.listMaterialBatches({schemaVersion:'xiaozhi.material-import-batch.v1',offset:0}));
  const pdf=[];for(const r of resources.filter(r=>r.originalFileName.endsWith('.pdf')))pdf.push({name:r.originalFileName,...await page.evaluate(id=>window.omniEdu.getMaterialPdfStatus(id),r.id)});
  const index=await page.evaluate(()=>window.omniEdu.getMaterialIndexStatus());
  const snapshot={at:new Date().toISOString(),resources:resources.map(r=>({id:r.id,name:r.originalFileName,status:r.parseStatus})),batches,pdf,index};report.snapshots.push(snapshot);
  console.log(JSON.stringify(snapshot));fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(report,null,2));
  const terminal=resources.length===report.source.length&&resources.every(r=>!['pending','running','queued','parsing','needs_parser'].includes(r.parseStatus))&&pdf.length===report.source.filter(f=>/\.pdf$/i.test(f.name)).length&&pdf.every(p=>p.pending===0&&p.total>0)&&index.pending===0;
  if(terminal&&++stable>=2)break;if(!terminal)stable=0;await delay(10000);
 }
 if(stable<2)throw Error('Local processing did not settle within the time budget');
 report.materials=await materials();report.questions=await page.evaluate(()=>window.omniEdu.listQuestionNotebook({limit:30}));
 report.searches={};for(const query of ['洛埃镜','干涉','物理'])report.searches[query]=await page.evaluate(query=>window.omniEdu.searchMaterialText({schemaVersion:'xiaozhi.material-search.v1',query,offset:0,mode:'keyword'}),query);
 await page.getByTestId('materials-text-query').fill('洛埃镜');await page.getByTestId('materials-text-submit').click();await delay(2000);await page.screenshot({path:path.join(output,'local-search-1366.png'),fullPage:true});
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{report.tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE 'material_%' OR name LIKE '%question%' OR name='resource_chunks')").all();report.resources=db.prepare('SELECT * FROM teacher_resources').all();report.chunks=db.prepare('SELECT * FROM resource_chunks').all();report.pdfPages=db.prepare('SELECT * FROM material_pdf_pages').all();}finally{db.close();}
 report.sourceUnchanged=JSON.stringify(fingerprint())===JSON.stringify(report.source);if(!report.sourceUnchanged)throw Error('Source changed');
 note('Local processing and readback captured; original file hashes unchanged');
 await app.close();app=undefined;await launch();report.restart=await materials();await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:path.join(output,'restart-1920.png'),fullPage:true});
 report.success=report.materials.resources.length===report.source.length&&report.rendererErrors.length===0;
}catch(e){report.success=false;report.error=String(e.stack||e);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,error:report.error,checks:report.checks}));}
