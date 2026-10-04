import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import ts from 'typescript';
const source=path.resolve(process.argv.find(v=>v.startsWith('--source='))?.slice(9)||'test-results/xiaozhi-agent/hana-image-source-1vFP4k');
const target=path.resolve('src/main/xiaozhi-agent/vendor/hana/core'),adapter=path.resolve('src/main/xiaozhi-agent/pi-image-adapter.ts');
const hash=v=>createHash('sha256').update(v).digest('hex');
const raw=fs.readFileSync(path.join(source,'core/model-image-preprocess.ts'));
assert.equal(hash(raw),'e3cb6d0d4376305ffb77d85aff00b20239397388dd3a8063f98370fc0d9a0cb9');
const text=raw.toString(),originalImport='import * as piSdk from "../lib/pi-sdk/index.ts";';assert(text.includes(originalImport));
const module=Buffer.from('// @ts-nocheck\n// Hana v0.450.0 Apache-2.0; only SDK import adapted. Prompt resizing is native in Pi1.0.2.\n'+text.replace(originalImport,'import * as piSdk from "../../../pi-image-adapter";'));
const bridge=fs.readFileSync(path.join(source,'lib/pi-sdk/index.ts'),'utf8'),tree=ts.createSourceFile('index.ts',bridge,ts.ScriptTarget.Latest,true);
const names=['resizeModelImageInput','formatModelImageDimensionNote'];
const bodies=names.map(name=>{const node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert(node);return bridge.slice(node.getStart(tree),node.end);});
const adapted=Buffer.from('// @ts-nocheck\n// Exact Hana v0.450.0 Apache-2.0 adapter bodies; Pi1.0.2 original exports.\nimport {resizeImage as rawResizeImage,formatDimensionNote as rawFormatDimensionNote} from "@earendil-works/pi-coding-agent";\n'+bodies.join('\n')+'\n');
const license=fs.readFileSync(path.join(source,'LICENSE'));assert.equal(hash(license),'6351e35d94278861a1f85498a68664a3df44c57231245fa76c851652a050ce55');
const manifest={version:1,tag:'v0.450.0',license:'Apache-2.0',url:'https://github.com/liliMozi/openhanako/blob/v0.450.0/core/model-image-preprocess.ts',sourceSha256:hash(raw),moduleSha256:hash(module),adapterSourceSha256:hash(bridge),adapterSha256:hash(adapted),licenseSha256:hash(license),adaptation:'Only SDK import/header; original normalization/preprocessing bodies and two adapter bodies. Native Pi1.0.2 prompt already processes images: do not preprocess prompt twice. No authority granted.'};
const files=[[path.join(target,'model-image-preprocess.ts'),module],[adapter,adapted],[path.join(target,'model-image-LICENSE'),license],[path.join(target,'model-image-source-manifest.json'),Buffer.from(JSON.stringify(manifest,null,2)+'\n')]];
if(process.argv.includes('--verify'))for(const [file,bytes]of files)assert.deepEqual(fs.readFileSync(file),bytes);
else for(const[file,bytes]of files){assert(!fs.existsSync(file),'Do not replace existing source');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});}
console.log(JSON.stringify({success:true,manifest}));
