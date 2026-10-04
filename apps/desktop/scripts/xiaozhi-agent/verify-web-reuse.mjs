import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex'),root=process.cwd(),checks=[];
const manifest=JSON.parse(fs.readFileSync('src/main/office-agent/vendor/hana/source-manifest.json','utf8'));
for(const file of ['lib/tools/anysearch.ts','lib/tools/web-reader.ts','lib/tools/search-rate-limiter.ts']){
 const row=manifest.entries.find(row=>row.destination===file);assert(row);assert.equal(hash(fs.readFileSync(row.source)),row.sourceSha256);
 assert.equal(hash(fs.readFileSync(path.join('src/main/office-agent/vendor/hana',file))),row.vendoredSha256);checks.push({file,version:row.version,sha:row.vendoredSha256,license:manifest.license});
}
for(const file of ['chat-source/index.ts','chat-source/chat-source.tsx','chat-source/chat-sources.tsx','chat-source/chat-source.styles.ts','chat-tool/chat-tool.tsx']){
 const source=fs.readFileSync(path.join('D:/WorkProject/HeroUIPro/herouipro-v3/src/components',file)),target=fs.readFileSync(path.join(root,'src/renderer/heroui-pro/components',file));assert.equal(hash(source),hash(target));checks.push({file,sha:hash(target),provenance:'Existing local Pro source; README license boundary'});
}
console.log(JSON.stringify({success:true,checks,boundary:'Original source hashes only; does not establish Codex source identity or runtime behavior'},null,2));
