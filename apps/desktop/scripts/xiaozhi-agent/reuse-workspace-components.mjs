import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=path.resolve('D:/WorkProject/HeroUIPro/herouipro-v3/src');
const output=path.join(desktop,'src/renderer/heroui-pro');
const manifestPath=path.join(output,'workspace-source.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const roots=['components/app-layout/index.ts','components/sidebar/index.ts','components/file-tree/index.ts'];
const seen=new Set(),rows=[];
function resolve(parent,specifier){const base=path.resolve(path.dirname(parent),specifier);for(const suffix of ['.ts','.tsx','/index.ts','/index.tsx','']){const file=base+suffix;if(fs.existsSync(file)&&fs.statSync(file).isFile())return file;}throw new Error(`Unresolved source import ${specifier}`);}
function visit(file){
  const relative=path.relative(source,file).replaceAll('\\','/');
  if(relative.startsWith('../')||path.isAbsolute(relative))throw new Error('Source outside closure');
  if(seen.has(relative))return;seen.add(relative);
  const bytes=fs.readFileSync(file),target=path.join(output,relative);
  if(fs.existsSync(target)&&sha(fs.readFileSync(target))!==sha(bytes))throw new Error(`Existing adapted file preserved: ${relative}`);
  if(!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
  rows.push({file:relative,bytes:bytes.length,sourceSha256:sha(bytes),outputSha256:sha(fs.readFileSync(target))});
  const ast=ts.createSourceFile(file,bytes.toString('utf8'),ts.ScriptTarget.Latest,true);
  for(const statement of ast.statements){if((ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement))&&statement.moduleSpecifier&&ts.isStringLiteral(statement.moduleSpecifier)&&statement.moduleSpecifier.text.startsWith('.'))visit(resolve(file,statement.moduleSpecifier.text));}
}
if(process.argv.includes('--verify')){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const row of manifest.files){if(sha(fs.readFileSync(path.join(source,row.file)))!==row.sourceSha256||sha(fs.readFileSync(path.join(output,row.file)))!==row.outputSha256)throw new Error(`Pro provenance changed: ${row.file}`);}
  console.log(JSON.stringify({success:true,files:manifest.files.length,bytes:manifest.bytes,boundary:'Static source audit, not user flow proof'}));
}else{
  for(const root of roots)visit(path.join(source,root));
  const css=fs.readFileSync(path.join(output,'heroui-pro.min.css'),'utf8');
  for(const name of ['app-layout__body','sidebar__provider','file-tree__item','resizable','sheet'])if(!css.includes(name))throw new Error(`Compiled CSS missing ${name}`);
  fs.writeFileSync(manifestPath,JSON.stringify({source,sourcePackage:'@ag-ui/pro 1.0.0-beta.7',license:'SEE LICENSE IN LICENSE; existing README governs',roots,bytes:rows.reduce((sum,row)=>sum+row.bytes,0),files:rows},null,2));
  console.log(JSON.stringify({success:true,files:rows.length,bytes:rows.reduce((sum,row)=>sum+row.bytes,0),manifest:path.relative(desktop,manifestPath)}));
}
