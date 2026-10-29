import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('src/main/xiaozhi-agent/vendor/hana/quality');
const source=process.argv[2];
const revision='9a6cabf8c513db5edc6cf8179a538c9075885c6e';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['core/tool-catalog.ts','lib/llm/estimate-text-tokens.ts','LICENSE'];
if(source){
  const manifest=[];
  for(const file of files){
    const raw=fs.readFileSync(path.join(source,file));
    const output=file.endsWith('.ts')?Buffer.from(raw.toString().replace('../lib/llm/estimate-text-tokens.ts','../lib/llm/estimate-text-tokens')):raw;
    const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,output);
    manifest.push({file,sourceSha256:hash(raw),outputSha256:hash(output)});
  }
  fs.writeFileSync(path.join(root,'source-manifest.json'),JSON.stringify({schemaVersion:1,repository:'https://github.com/liliMozi/openhanako',revision,license:'Apache-2.0',adaptation:'Only remove .ts extension from local import. Catalog estimates are ranking/display budgets, never provider capacity gates.',files:manifest},null,2)+'\n');
  fs.writeFileSync(path.join(root,'NOTICE'),'OpenHanako ToolCatalog and token estimator, Copyright OpenHanako contributors. Apache-2.0.\nSource revision '+revision+'; see source-manifest.json.\n');
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'source-manifest.json'),'utf8'));
for(const item of manifest.files)if(hash(fs.readFileSync(path.join(root,item.file)))!==item.outputSha256)throw Error('vendor mismatch: '+item.file);
console.log(JSON.stringify({suite:'hana-quality-source',files:manifest.files.length,revision}));
