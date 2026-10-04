import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import assert from 'node:assert/strict';
const root=path.resolve('.local-ocr/dist/omni-edu-ocr'),site=path.resolve('test-results/xiaozhi-agent/rapidocr-env/Lib/site-packages');
assert(fs.existsSync(path.join(root,'omni-edu-ocr.exe')));
const notices=path.join(root,'licenses');fs.mkdirSync(notices,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=[];
const commitResponse=await fetch('https://api.github.com/repos/RapidAI/RapidOCR/commits/main',{headers:{'User-Agent':'OmniEdu-source-review'},signal:AbortSignal.timeout(15000)});assert.equal(commitResponse.status,200);
const commit=(await commitResponse.json()).sha;assert.match(commit,/^[a-f0-9]{40}$/);
for(const [name,url] of [['RapidOCR-LICENSE','https://raw.githubusercontent.com/RapidAI/RapidOCR/v3.9.2/LICENSE'],['MODEL_LICENSES.md',`https://raw.githubusercontent.com/RapidAI/RapidOCR/${commit}/python/MODEL_LICENSES.md`]]){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());
 fs.writeFileSync(path.join(notices,name),bytes);original.push({name,url,sha256:sha(bytes)});
}
function walk(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);}
// Exact installed metadata and included upstream copyright/license files, no private app state.
for(const file of walk(site).filter(v=>/(?:\.dist-info[\/].*(?:LICENSE|COPYING|NOTICE|METADATA)$|[\/](?:LICENSE|LICENSE\.txt|LICENSE\.md|COPYING|NOTICE))$/i.test(v))){
 const destination=path.join(notices,path.relative(site,file));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(file,destination);
}
const python=path.resolve('test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe');
const frozen=execFileSync(python,['-m','pip','freeze','--all'],{encoding:'utf8',windowsHide:true});
const sourceRoot=path.resolve('../../python/omni_edu_ocr');fs.writeFileSync(path.join(sourceRoot,'requirements-windows.lock.txt'),frozen.replace(/\r\n/g,'\n'));
const files=walk(root).sort().map(file=>{const bytes=fs.readFileSync(file);return {path:path.relative(root,file).replaceAll('\\','/'),size:bytes.length,sha256:sha(bytes)};});
const workerSha256=sha(fs.readFileSync(path.join(sourceRoot,'worker.py')));
const manifest={schemaVersion:1,engine:'rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1',platform:'win32-x64',workerSha256,original,files,totalBytes:files.reduce((sum,v)=>sum+v.size,0)};
fs.writeFileSync('src/main/xiaozhi-agent/ocr-runtime-manifest.json',JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(sourceRoot,'SOURCE.md'),`# Local OCR runtime sources\n\nRecognition: original RapidOCR 3.9.2 / Apache-2.0, ONNX Runtime 1.30.0 / MIT. Adapter is worker.py. PP-OCRv6 detection/recognition and legacy angle models are bundled original artifacts; see licenses/MODEL_LICENSES.md with matching upstream hashes. Models are checked before use; no runtime download or cloud fallback.\n\nBuild: Python 3.12.14, PyInstaller 6.22.3 (GPL distribution exception). Exact build environment in requirements-windows.lock.txt. Frozen Windows onedir runtime is private .local-ocr/dist/omni-edu-ocr for development and must be shipped as resources/ocr-runtime in a packaged build. No Codex Python is needed by that executable.\n\nModel notice snapshot commit: ${commit}. Original license URLs/hashes and complete output file lock: apps/desktop/src/main/xiaozhi-agent/ocr-runtime-manifest.json. ${files.length} files / ${manifest.totalBytes} bytes. Models total 31,749,509 bytes. This is runtime size, not installer size or installer acceptance.\n\nBuild command (from apps/desktop):\n\n    test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe -m PyInstaller --onedir --name omni-edu-ocr --distpath .local-ocr/dist --workpath .local-ocr/work --specpath .local-ocr/spec --collect-all rapidocr --collect-all onnxruntime --copy-metadata rapidocr --copy-metadata onnxruntime --exclude-module tkinter --exclude-module pytest ../../python/omni_edu_ocr/worker.py\n    node scripts/xiaozhi-agent/lock-ocr-runtime.mjs\n\nDo not regenerate the application lock at runtime or select arbitrary executable paths from renderer/model. Missing or modified runtime fails closed.\n`);
console.log(JSON.stringify({success:true,files:files.length,totalBytes:manifest.totalBytes,workerSha256,original}));
