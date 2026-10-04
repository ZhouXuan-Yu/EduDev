import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import ts from 'typescript';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),root=process.env.OMNI_EDU_HANA_SOURCE||'D:/WorkProject/开源/openhanako';
const target=path.join(desktop,'src/main/xiaozhi-agent/vendor/hana/office-pdf'),hash=b=>createHash('sha256').update(b).digest('hex');
const manifestPath=path.join(target,'source-manifest.json');
if(process.argv.includes('--verify')){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));for(const row of manifest.files)if(hash(fs.readFileSync(path.join(target,row.name)))!==row.outputSha256)throw new Error(`Changed ${row.name}`);
 const current=ts.createSourceFile('render-job.ts',fs.readFileSync(path.join(target,'render-job.ts'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 for(const row of manifest.functions){const name=row.name==='renderJob'?'renderHanaPdfJob':row.name,node=current.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);if(!node?.body||hash(node.body.getText(current))!==row.bodySha256)throw new Error(`Changed original body ${name}`);}
 console.log(JSON.stringify({success:true,files:manifest.files.length,functions:manifest.functions.length,scope:'Original Hana PDF bodies; not product/user-flow proof'}));
}else{
 const source='desktop/src/office-pdf-helper.cjs',bytes=fs.readFileSync(path.join(root,source)),text=bytes.toString('utf8');
 const parsed=ts.createSourceFile(source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),wanted=['delay','withTimeout','waitForPageAssets','renderJob'];
 const functions=wanted.map(name=>{const node=parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);if(!node?.body)throw new Error(`Missing ${name}`);return {name,node,body:node.body.getText(parsed)};});
 const header=`// @ts-nocheck\n// Hana0.449.0/Apache-2.0. Original function bodies preserved; see source-manifest.json.\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport {pathToFileURL} from 'node:url';\n// This project uses installed system fonts; Hana product font resources are not present.\nfunction buildFontInjectionCss(){throw new Error('configuration');}\n`;
 const output=header+functions.map(({name,node})=>{let value=node.getText(parsed);if(name==='renderJob')value=value.replace('async function renderJob(job)', 'export async function renderHanaPdfJob(job, BrowserWindow)');return value;}).join('\n\n')+'\n';
 fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'render-job.ts'),output);const license=fs.readFileSync(path.join(root,'LICENSE'));fs.writeFileSync(path.join(target,'LICENSE'),license);
 fs.writeFileSync(manifestPath,JSON.stringify({version:1,upstream:'Hana0.449.0',license:'Apache-2.0',source,sourceSha256:hash(bytes),
 adaptations:['AST extraction of four original function bodies; renderJob exported as renderHanaPdfJob with injected BrowserWindow parameter','System fonts selected by main-controlled HTML; embedHanaFonts always false, no Hana product font fallback','No helper CLI/secondary application or arbitrary path invocation'],
 functions:functions.map(({name,body})=>({name,bodySha256:hash(body)})),files:[{name:'render-job.ts',outputSha256:hash(output)},{name:'LICENSE',outputSha256:hash(license)}]},null,2)+'\n');
 console.log(JSON.stringify({copied:2,functions:functions.length}));
}
