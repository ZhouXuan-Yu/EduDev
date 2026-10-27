import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.dirname(require.resolve('@mozilla/readability')),pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert.equal(pkg.version,'0.6.0');assert.equal(pkg.license,'Apache-2.0');
const bytes=fs.readFileSync(path.join(root,'Readability.js')),license=fs.readFileSync(path.join(root,'LICENSE.md')),hash=v=>createHash('sha256').update(v).digest('hex');
const generated=Buffer.from('// Mozilla Readability 0.6.0, Apache-2.0. Unmodified source; see LICENSE.md and source-manifest.json.\nexport const READABILITY_SOURCE='+JSON.stringify(bytes.toString('utf8'))+';\n');
const manifest={schemaVersion:1,upstream:'Mozilla Readability',version:pkg.version,license:pkg.license,sourceUrl:'https://github.com/mozilla/readability/blob/0.6.0/Readability.js',sourceBytes:bytes.length,sourceSha256:hash(bytes),moduleSha256:hash(generated),licenseSha256:hash(license),adaptation:'None. Original source is encoded verbatim as a static string for execution against a DOM clone in an isolated world.'};
const target=path.resolve('src/main/xiaozhi-agent/vendor/mozilla-readability');
if(process.argv.includes('--verify')){assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target,'source-manifest.json'),'utf8')),manifest);assert.equal(hash(fs.readFileSync(path.join(target,'readability-source.ts'))),manifest.moduleSha256);assert.equal(hash(fs.readFileSync(path.join(target,'LICENSE.md'))),manifest.licenseSha256);
 if(process.argv.includes('--release')){const emitted=path.resolve('out/main/vendor/mozilla-readability');assert.equal(hash(fs.readFileSync(path.join(emitted,'LICENSE.md'))),manifest.licenseSha256);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(emitted,'source-manifest.json'),'utf8')),manifest);}
}
else{assert(!fs.existsSync(target));fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'readability-source.ts'),generated,{flag:'wx'});fs.writeFileSync(path.join(target,'LICENSE.md'),license,{flag:'wx'});fs.writeFileSync(path.join(target,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({success:true,...manifest}));
