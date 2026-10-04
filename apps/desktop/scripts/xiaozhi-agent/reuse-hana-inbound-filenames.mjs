import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const source='D:/WorkProject/开源/openhanako/lib/session-files/bridge-inbound-files.ts';
const target=path.resolve('src/main/xiaozhi-agent/vendor/hana/lib/session-files');
const raw=fs.readFileSync(source),text=raw.toString('utf8'),sha=v=>createHash('sha256').update(v).digest('hex');
const tree=ts.createSourceFile(source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const names=['MIME_EXTENSIONS','safeFilename','removeUnsafeFilenameChars','extensionFor'];
const fragments=names.map(name=>{
 const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)?n.name?.text===name:
  ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===name));
 assert(node,'Missing original fragment: '+name);return {name,body:text.slice(node.getStart(tree),node.end)};
});
const output=Buffer.from('// @ts-nocheck\n// Hana0.449.0 Apache-2.0: original inbound filename fragments; storage/authority adapter remains outside vendor.\nimport path from "node:path";\n'+fragments.map(v=>v.body).join('\n\n')+'\nexport { safeFilename };\n');
const manifest={version:1,upstream:'Hana0.449.0',license:'Apache-2.0',source,sourceSha256:sha(raw),outputSha256:sha(output),
 fragments:fragments.map(v=>({name:v.name,sha256:sha(v.body)})),adaptation:'Four original AST fragments; node:path import and safeFilename export only. No base64 input, filesystem writer, native-sidecar registry or upload path.'};
const code=path.join(target,'inbound-filenames.ts'),record=path.join(target,'inbound-filenames.source.json');
if(process.argv.includes('--verify')){assert.deepEqual(JSON.parse(fs.readFileSync(record,'utf8')),manifest);assert.equal(sha(fs.readFileSync(code)),manifest.outputSha256);}
else{assert(!fs.existsSync(code)&&!fs.existsSync(record),'Do not overwrite vendored source');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(code,output,{flag:'wx'});fs.writeFileSync(record,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}
assert(fs.existsSync(path.join(target,'LICENSE')),'Original Hana license must be retained');
console.log(JSON.stringify({success:true,fragments:fragments.length,sourceSha256:manifest.sourceSha256,boundary:'Original fragments/hash only; not full inbound bridge/runtime/Codex proof.'}));
