import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const python=process.env.OMNI_EDU_BUILD_PYTHON;
if(process.platform!=='win32'||!python||!path.isAbsolute(python)||!fs.existsSync(python))throw new Error('Set OMNI_EDU_BUILD_PYTHON to the approved Windows build interpreter.');
const probe=spawnSync(python,['-I','-c','import json,platform,struct,PyInstaller;print(json.dumps(dict(python=platform.python_version(),pyinstaller=PyInstaller.__version__,bits=struct.calcsize("P")*8)))'],{encoding:'utf8',windowsHide:true});
if(probe.error||probe.status!==0)throw new Error('Cannot inspect build interpreter');
const toolchain=JSON.parse(probe.stdout);
if(toolchain.python!=='3.12.14'||toolchain.pyinstaller!=='6.22.3'||toolchain.bits!==64)throw new Error('Unapproved education build toolchain');
const base=path.join(desktop,'.local-education'),source=path.join(desktop,'src/main/education');
const entry=path.resolve(desktop,'../../python/omni_edu_education/worker.py');
const buildInputs=[entry];
for(const name of ['reading','learning','question','math'])buildInputs.push(path.join(source,name+'-worker.py'));
function files(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>{
 const file=path.join(root,e.name);if(e.isSymbolicLink())throw new Error('Runtime source may not contain links');return e.isDirectory()?files(file):[file];
}).sort();}
for(const dir of ['deeptutor-reading','deeptutor-learning','deeptutor-question','math'])buildInputs.push(...files(path.join(source,'vendor',dir)));
fs.mkdirSync(base,{recursive:true});
const staged=path.join(fs.mkdtempSync(path.join(base,'source-')),'education');fs.mkdirSync(staged,{recursive:true});
for(const file of buildInputs.slice(1)){const relative=path.relative(source,file),target=path.join(staged,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
const math=path.join(source,'vendor/math');
const args=['-m','PyInstaller','--noconfirm','--clean','--onedir','--name','omni-edu-education',
 '--distpath',path.join(base,'dist'),'--workpath',path.join(base,'work'),'--specpath',path.join(base,'spec'),
 '--add-data',staged+';education','--paths',path.join(math,'sympy-1.14.0-py3-none-any.whl'),
 '--paths',path.join(math,'mpmath-1.3.0-py3-none-any.whl'),'--hidden-import','sympy','--hidden-import','mpmath',
 ...['json','hashlib','re','types','enum','copy','math','time','ast','dataclasses','typing','datetime','difflib','__future__'].flatMap(name=>['--hidden-import',name]),
 '--exclude-module','tkinter','--exclude-module','pytest','--exclude-module','numpy',
 '--exclude-module','PIL','--exclude-module','scipy','--exclude-module','matplotlib',entry];
const result=spawnSync(python,args,{cwd:desktop,stdio:'inherit',windowsHide:true});
if(result.error||result.status!==0)throw result.error||new Error('Education runtime build failed');
const root=path.join(base,'dist/omni-edu-education'),sha=b=>createHash('sha256').update(b).digest('hex');
buildInputs.push(fileURLToPath(import.meta.url),path.resolve(desktop,'../../python/omni_edu_education/SOURCE.md'),...files(path.resolve(desktop,'../../python/omni_edu_education/licenses')));
const records=files(root).map(file=>({path:path.relative(root,file).split(path.sep).join('/'),size:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))}));
const manifest={schemaVersion:1,platform:'win32-x64',toolchain,engine:'education-adapters.v1',executable:'omni-edu-education.exe',
 buildInputs:buildInputs.map(file=>({path:path.relative(path.resolve(desktop,'../..'),file).split(path.sep).join('/'),sha256:sha(fs.readFileSync(file))})),files:records};
fs.writeFileSync(path.join(source,'runtime-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({root,files:records.length,bytes:records.reduce((n,f)=>n+f.size,0)}));
