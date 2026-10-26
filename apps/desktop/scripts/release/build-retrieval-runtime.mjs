import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),repo=path.resolve(desktop,'../..');
const python=process.env.OMNI_EDU_BUILD_PYTHON;
if(process.platform!=='win32'||!python||!path.isAbsolute(python))throw Error('Set approved Windows build interpreter');
const base=path.join(desktop,'.local-retrieval'),deps=path.join(base,'build-deps'),wheel=path.join(base,'wheels/tokenizers-0.21.4-cp39-abi3-win_amd64.whl');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if(sha(wheel)!=='475d807a5c3eb72c59ad9b5fcdb254f6e17f53dfcbb9903233b0dfa9c943b597')throw Error('Wheel integrity');
fs.mkdirSync(deps,{recursive:true});
const extract=spawnSync(python,['-I','-c','import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',wheel,deps],{windowsHide:true,encoding:'utf8'});
if(extract.status!==0)throw Error('Wheel unpack failed');
const probe=spawnSync(python,['-I','-c','import sys,json,platform,numpy,onnxruntime,PyInstaller;sys.path.insert(0,sys.argv[1]);import tokenizers;print(json.dumps(dict(python=platform.python_version(),numpy=numpy.__version__,ort=onnxruntime.__version__,pyinstaller=PyInstaller.__version__,tokenizers=tokenizers.__version__)))',deps],{windowsHide:true,encoding:'utf8'});
if(probe.status!==0)throw Error('Build environment unavailable');const versions=JSON.parse(probe.stdout);
if(JSON.stringify(versions)!==JSON.stringify({python:'3.12.14',numpy:'2.5.3',ort:'1.30.0',pyinstaller:'6.22.3',tokenizers:'0.21.4'}))throw Error('Unapproved toolchain');
const lock=JSON.parse(fs.readFileSync(path.join(base,'model-lock.json')));
for(const file of lock.files)if(sha(path.join(base,'model',file.path))!==file.sha256)throw Error('Model integrity');
const source=path.join(repo,'python/omni_edu_retrieval'),entry=path.join(source,'worker.py');
const notices=spawnSync(python,['-I','-c',`import importlib.metadata as m,pathlib,shutil,sys
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
for name in ['numpy','onnxruntime','pyinstaller']:
 d=m.distribution(name);found=0
 for f in d.files or []:
  if any(t in pathlib.PurePath(str(f)).name.lower() for t in ['license','notice','copying']):
   file=d.locate_file(f)
   if file.is_file():
    target=root/name/pathlib.PurePath(str(f));target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,target);found+=1
 if not found:raise RuntimeError('Missing license: '+name)
license=pathlib.Path(sys.base_prefix)/'LICENSE.txt'
if not license.is_file():raise RuntimeError('Missing Python license')
shutil.copyfile(license,root/'Python.LICENSE.txt')`,path.join(base,'licenses')],{windowsHide:true,encoding:'utf8'});
if(notices.status!==0)throw Error('Runtime notices missing: '+notices.stderr.slice(-1000));
const args=['-m','PyInstaller','--noconfirm','--clean','--onedir','--name','omni-edu-retrieval','--distpath',path.join(base,'dist'),'--workpath',path.join(base,'work'),'--specpath',path.join(base,'spec'),'--paths',deps,
  '--add-data',path.join(base,'model')+';models','--add-data',path.join(base,'licenses')+';licenses',
  '--collect-binaries','onnxruntime','--collect-data','onnxruntime',
  ...['torch','transformers','rapidocr','pypdfium2','cv2','PIL','sympy','scipy','huggingface_hub','requests','tkinter','pytest'].flatMap(m=>['--exclude-module',m]),entry];
const built=spawnSync(python,args,{cwd:desktop,stdio:'inherit',windowsHide:true});if(built.status!==0)throw Error('Freeze failed');
const files=root=>fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{const target=path.join(root,e.name);if(e.isSymbolicLink())throw Error('Linked runtime');return e.isDirectory()?files(target):[target];}).sort();
const root=path.join(base,'dist/omni-edu-retrieval'),records=files(root).map(f=>({path:path.relative(root,f).replaceAll('\\','/'),size:fs.statSync(f).size,sha256:sha(f)}));
fs.mkdirSync(path.join(desktop,'src/main/retrieval'),{recursive:true});
const manifest={schemaVersion:1,platform:'win32-x64',identity:'bge-small-zh-v1.5.q8.cls-l2.window512-stride64.v1',model:lock,toolchain:versions,executable:'omni-edu-retrieval.exe',files:records,
  buildInputs:[entry,fileURLToPath(import.meta.url),path.join(source,'SOURCE.md'),path.join(desktop,'scripts/release/prepare-retrieval-assets.mjs')].map(f=>({path:path.relative(repo,f).replaceAll('\\','/'),sha256:sha(f)}))};
fs.writeFileSync(path.join(desktop,'src/main/retrieval/runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({root,files:records.length,bytes:records.reduce((n,f)=>n+f.size,0),versions}));
