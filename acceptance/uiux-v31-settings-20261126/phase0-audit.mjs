import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import ts from '../../apps/desktop/node_modules/typescript/lib/typescript.js';
const root=import.meta.dirname,repo=path.resolve(root,'../..'),desktop=path.join(repo,'apps/desktop');
const supplied='D:/WorkProject/EduProject/docs/第二阶段/UI优化/Xiaozhi_UIUX_V3_1_Settings_First_20261126';
const hash=v=>createHash('sha256').update(v).digest('hex');
const git=(args,cwd=repo)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const contract=path.join(root,'contract');fs.mkdirSync(contract,{recursive:true});
const contractFiles=[];
function snapshot(dir,relative=''){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const rel=path.join(relative,entry.name),source=path.join(dir,entry.name);
  if(entry.isDirectory())snapshot(source,rel);
  else if(/\.(md|csv|json|txt)$/.test(entry.name)){
   const bytes=fs.readFileSync(source),dest=path.join(contract,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});
   if(fs.existsSync(dest)&&hash(fs.readFileSync(dest))!==hash(bytes))throw Error('Contract changed; preserve previous snapshot before updating '+rel);
   fs.writeFileSync(dest,bytes);contractFiles.push({file:rel.replaceAll('\\','/'),sha256:hash(bytes)});
  }
 }
}
snapshot(supplied);
const acText=fs.readFileSync(path.join(contract,'06_ATDD_ACCEPTANCE.md'),'utf8');
const ids=[...acText.matchAll(/^### (AC-\d{3})/gm)].map(m=>m[1]);
if(ids.length!==90||new Set(ids).size!==90)throw Error('Expected90 unique authoritative acceptance items');
const seen=new Set(),uses=[];
function walk(file){
 if(seen.has(file))return;seen.add(file);
 const text=fs.readFileSync(file,'utf8'),ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 const aliases=new Set();
 const isApi=n=>n&&/^window\.omniEdu\??$/.test(n.getText(ast));
 function alias(node){if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&isApi(node.initializer))aliases.add(node.name.text);ts.forEachChild(node,alias);}alias(ast);
 function visit(node){
  if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
   const access=node.expression;
   if(isApi(access.expression)||(ts.isIdentifier(access.expression)&&aliases.has(access.expression.text)))uses.push({file:path.relative(repo,file).replaceAll('\\','/'),line:ast.getLineAndCharacterOfPosition(node.getStart(ast)).line+1,method:access.name.text});
  }
  if(ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly&&ts.isStringLiteral(node.moduleSpecifier)&&node.moduleSpecifier.text.startsWith('.')){
   const target=path.resolve(path.dirname(file),node.moduleSpecifier.text);
   const resolved=[target+'.tsx',target+'.ts',path.join(target,'index.tsx'),path.join(target,'index.ts')].find(p=>fs.existsSync(p));
   if(resolved&&resolved.includes(path.sep+'renderer'+path.sep))walk(resolved);
  }
  ts.forEachChild(node,visit);
 }
 visit(ast);
}
walk(path.join(desktop,'src/renderer/components/office/PiSettingsWorkspace.tsx'));
const trees=git(['worktree','list','--porcelain']).split('\n\n').filter(Boolean).map(block=>{
 const lines=block.split('\n'),directory=lines.find(l=>l.startsWith('worktree '))?.slice(9);
 if(!directory)return null;
 try{return {directory,head:git(['rev-parse','HEAD'],directory),branch:lines.find(l=>l.startsWith('branch '))?.slice(7)||'detached',dirty:git(['status','--short','--untracked-files=no'],directory).split('\n').filter(Boolean),owner:'Existing worktree owner; no writes by this audit'};}catch{return {directory,unavailable:true};}
}).filter(Boolean);
const packageJson=JSON.parse(fs.readFileSync(path.join(desktop,'package.json')));
const tabs=[...fs.readFileSync(path.join(desktop,'src/renderer/components/office/PiSettingsWorkspace.tsx'),'utf8').matchAll(/\{ id: '([^']+)', label:/g)].map(m=>m[1]);
const report={date:'2026-11-26',phase:'0',head:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),originMain:git(['rev-parse','origin/main']),root:repo,worktrees:trees,contractFiles,acCount:90,legacyCount:36,settingsTabs:tabs,settingsApis:uses,
 settingsCriticalGaps:['App activeView settings replaces main work area','PiSettingsWorkspace trusts its own localStorage current-session preference','main settingsSender and Pi fromMain bind only mainWindow','main preload exposes full omniEdu; no settings-specific entry','WorkbenchProvider local state has no cross-window storage subscription'],
 versions:{node:process.version,packageManager:packageJson.packageManager,electron:packageJson.devDependencies.electron,hero:packageJson.devDependencies['@heroui/react'],lucide:packageJson.devDependencies['lucide-react'],lockSha256:hash(fs.readFileSync(path.join(desktop,'package-lock.json')))},scripts:packageJson.scripts,
 ciWorkflows:fs.existsSync(path.join(repo,'.github/workflows'))?fs.readdirSync(path.join(repo,'.github/workflows')):[],
 collaboration:{userDecision:'有ai负责改动部分，你不是git分支吗？改动完合并到一起就行',interpretation:'Continue this isolated branch; current model owns window/IPC adapters only. No claim of signatures by other AI; preserve original business services and re-evaluate integration diff before MG-01.',otherWorktrees:'Read-only inventory; owner-specific dirty changes remain untouched'},
 historicalEvidence:'../ux-followup-20261126/delivery.json; prior pass counts are not V3 acceptance',
 requirements:Array.from({length:26},(_,i)=>({id:'REQ-'+String(i+1).padStart(2,'0'),status:i===16?'MISSING':i===17?'DEFECT':'TO_VERIFY',evidence:i===16?'App.tsx:2878; no independent BrowserWindow':i===17?'PiSettingsWorkspace.tsx:105-109; main/index.ts:304; xiaozhi-agent/ipc.ts:100':'Existing entrypoints require current V3-specific validation'}))};
fs.writeFileSync(path.join(root,'PHASE0.json'),JSON.stringify(report,null,2)+'\n');
if(!fs.existsSync(path.join(root,'acceptance-matrix.json')))fs.writeFileSync(path.join(root,'acceptance-matrix.json'),JSON.stringify({source:'contract/06_ATDD_ACCEPTANCE.md',sourceSha256:hash(acText),ac:ids.map(id=>({id,status:'NOT_RUN'})),legacy:Array.from({length:36},(_,i)=>({id:'LG-A'+String(i+1).padStart(2,'0'),status:'NOT_RUN'})),gates:{'SET-P0':'NOT_RUN','MG-01':'NOT_RUN','FG-01':'NOT_RUN','FG-02':'NOT_RUN'}},null,2)+'\n');
console.log(JSON.stringify({head:report.head,main:report.originMain,worktrees:trees.length,contractFiles:contractFiles.length,ac:90,legacy:36,settingsTabs:tabs,apiMethods:[...new Set(uses.map(u=>u.method))].sort()}));
