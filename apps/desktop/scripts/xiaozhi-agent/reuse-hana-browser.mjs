import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import ts from 'typescript';import assert from 'node:assert/strict';
const origin='https://raw.githubusercontent.com/liliMozi/openhanako/v0.450.0/';
const source=path.resolve('test-results/xiaozhi-agent/hana-browser-review'),target=path.resolve('src/main/xiaozhi-agent/vendor/hana/browser');
const hash=v=>createHash('sha256').update(v).digest('hex');
const raw=fs.readFileSync(path.join(source,'main.cjs')),text=raw.toString('utf8'),tree=ts.createSourceFile('main.cjs',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const statement=tree.statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(tree)==='SNAPSHOT_SCRIPT'));assert(statement);
const exact=text.slice(statement.getStart(tree),statement.end);
// Education cloud boundary: remove value fallbacks and password/token values.
// Original ref assignment, compact tree, grouping and truncation are retained.
let adapted=exact.replaceAll("|| node.value || ''","|| ''").replaceAll("|| el.value || ''","|| ''");
const sensitive="if (tag === 'INPUT' && el.value) flags.push('value=\"' + el.value.slice(0,30) + '\"');";
assert(adapted.includes(sensitive));adapted=adapted.replace(sensitive,"// Input values stay local, including credentials and student identities.");
const output=Buffer.from('// @ts-nocheck\n// Hana v0.450.0 Apache-2.0: extracted DOM tree; value redaction adaptation below.\n'+adapted+'\nexport { SNAPSHOT_SCRIPT };\n');
const wait=fs.readFileSync(path.join(source,'browser-wait.cjs'));
const manifest={schemaVersion:1,upstream:'Hana v0.450.0',license:'Apache-2.0',sourceUrl:origin+'desktop/main.cjs',sourceSha256:hash(raw),snapshotOriginalSha256:hash(exact),snapshotSha256:hash(output),waitSourceUrl:origin+'desktop/src/shared/browser-wait.cjs',waitSha256:hash(wait),adaptation:'Original DOM/ref/group/truncation; omit input value fallbacks/flags before cloud. Main policy, transport and authorization outside vendor.'};
if(process.argv.includes('--verify')){assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target,'source-manifest.json'),'utf8')),manifest);assert.equal(hash(fs.readFileSync(path.join(target,'snapshot.ts'))),manifest.snapshotSha256);assert.equal(hash(fs.readFileSync(path.join(target,'browser-wait.cjs'))),manifest.waitSha256);}
else{assert(!fs.existsSync(target),'Do not overwrite vendored source');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'snapshot.ts'),output,{flag:'wx'});fs.writeFileSync(path.join(target,'browser-wait.cjs'),wait,{flag:'wx'});fs.copyFileSync(path.join(source,'LICENSE'),path.join(target,'LICENSE'),fs.constants.COPYFILE_EXCL);fs.writeFileSync(path.join(target,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({success:true,snapshotSha256:manifest.snapshotSha256,waitSha256:manifest.waitSha256,adaptation:manifest.adaptation}));
