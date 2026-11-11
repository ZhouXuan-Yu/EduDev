import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),python=process.env.OMNI_EDU_BUILD_PYTHON;
if(process.platform!=='win32'||!python||!path.isAbsolute(python)||!fs.existsSync(python))throw Error('Set approved OMNI_EDU_BUILD_PYTHON');
const probe=spawnSync(python,['-I','-c','import json,platform,PyInstaller;from importlib.metadata import version;print(json.dumps([platform.python_version(),PyInstaller.__version__,version("rapidocr"),version("onnxruntime"),version("pypdfium2"),version("pillow")]))'],{encoding:'utf8',windowsHide:true});
if(probe.status!==0||JSON.stringify(JSON.parse(probe.stdout))!==JSON.stringify(['3.12.14','6.22.3','3.9.2','1.30.0','5.14.0','13.0.0']))throw Error('Unapproved PDF runtime toolchain');
const source=path.resolve(desktop,'../../python/omni_edu_ocr'),base=path.join(desktop,'.local-ocr'),published=path.join(base,'file-v3-dist','omni-edu-ocr'),root=path.join(base,'file-v3-next-dist','omni-edu-ocr'),previous=JSON.parse(fs.readFileSync(path.join(desktop,'src/main/xiaozhi-agent/ocr-runtime-manifest.json'),'utf8'));
const dependencyProbe=spawnSync(python,['-I','-c','import json,importlib.metadata as m;print(json.dumps({d.metadata["Name"].lower().replace("_","-"):d.version for d in m.distributions()}))'],{encoding:'utf8',windowsHide:true});
if(dependencyProbe.status!==0)throw Error('OCR dependency inventory unavailable');
const installed=JSON.parse(dependencyProbe.stdout);
for(const line of fs.readFileSync(path.join(source,'requirements-windows.lock.txt'),'utf8').split(/\r?\n/).filter(Boolean)){
 const [name,version]=line.split('==');if(!version||installed[name.toLowerCase().replaceAll('_','-')]!==version)throw Error('OCR dependency lock mismatch: '+name);
}
const args=['-m','PyInstaller','--noconfirm','--clean','--onedir','--name','omni-edu-ocr','--distpath',path.dirname(root),'--workpath',path.join(base,'file-v3-work'),'--specpath',path.join(base,'file-v3-spec'),...['rapidocr','onnxruntime','pypdfium2','pypdfium2_raw'].flatMap(p=>['--collect-all',p]),...['rapidocr','onnxruntime','pypdfium2'].flatMap(p=>['--copy-metadata',p]),'--exclude-module','tkinter','--exclude-module','pytest',path.join(source,'worker.py')];
const build=spawnSync(python,args,{cwd:desktop,windowsHide:true,stdio:'inherit'});if(build.status!==0)process.exit(build.status||1);
const licenses=path.join(published,'licenses');if(!fs.existsSync(licenses))throw Error('Audited old runtime notices missing');fs.cpSync(licenses,path.join(root,'licenses'),{recursive:true});
const noticeProbe=spawnSync(python,['-I','-c','import json,importlib.metadata as m;print(json.dumps([{"name":n,"version":m.version(n),"files":[str(m.distribution(n).locate_file(f)) for f in m.distribution(n).files or [] if any(k in str(f).lower() for k in ("license","copying","notice"))]} for n in ("pillow","certifi","setuptools","pip")]))'],{encoding:'utf8',windowsHide:true});
if(noticeProbe.status!==0)throw Error('Updated dependency notices unavailable');
for(const item of JSON.parse(noticeProbe.stdout)){
 if(!item.files.length)throw Error('Missing dependency notice: '+item.name);
 const destination=path.join(root,'licenses','metafiles',item.name+'-'+item.version);fs.mkdirSync(destination,{recursive:true});
 for(const [i,file]of item.files.entries())if(fs.statSync(file).isFile())fs.copyFileSync(file,path.join(destination,i+'-'+path.basename(file)));
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())throw Error('Links forbidden');const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p];}).sort();}
const files=walk(root).map(p=>{const bytes=fs.readFileSync(p);return{path:path.relative(root,p).replaceAll('\\','/'),size:bytes.length,sha256:sha(bytes)};});
const manifest={...previous,pdfFileEngine:'pdfium-5.14.0-rapidocr-3.9.2-file.v3',metafileEngine:'windows-gdiplus-pillow-13.0.0-144dpi.v1',metafilesSha256:sha(fs.readFileSync(path.join(source,'metafiles.py'))),metafileGdiSha256:sha(fs.readFileSync(path.join(source,'metafile_gdiplus.py'))),workerSha256:sha(fs.readFileSync(path.join(source,'worker.py'))),pdfStreamSha256:sha(fs.readFileSync(path.join(source,'pdf_stream.py'))),files,totalBytes:files.reduce((n,p)=>n+p.size,0)};
// Keep the authenticated prior component for rollback. Never remove a running
// executable before the replacement and its file lock have been built.
const backup=path.join(base,'file-v3-before-'+Date.now());
fs.renameSync(published,backup);
try{fs.renameSync(root,published);}catch(error){fs.renameSync(backup,published);throw error;}
fs.writeFileSync(path.join(desktop,'src/main/xiaozhi-agent/ocr-runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({success:true,root:published,backup,files:files.length,bytes:manifest.totalBytes,workerSha256:manifest.workerSha256,pdfStreamSha256:manifest.pdfStreamSha256,metafilesSha256:manifest.metafilesSha256}));
