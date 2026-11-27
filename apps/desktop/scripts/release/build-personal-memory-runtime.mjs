import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(import.meta.url);
const desktop=path.resolve(path.dirname(script),'../..');
const repo=path.resolve(desktop,'../..');
const workerSource=path.join(repo,'python','omni_edu_personal_memory');
const entry=path.join(workerSource,'worker.py');
const base=path.join(desktop,'.local-personal-memory');
const name='omni-edu-personal-memory';
const root=path.join(base,'dist',name);
const python=process.env.OMNI_EDU_R2_BUILD_PYTHON;
if (process.platform!=='win32' || !python || !path.isAbsolute(python)) {
  throw Error('Set OMNI_EDU_R2_BUILD_PYTHON to the Windows x64 build interpreter.');
}
const readProbe=args=>{
  const result=spawnSync(python,args,{encoding:'utf8',windowsHide:true});
  if (result.status!==0) throw Error('Cannot inspect the approved personal memory build interpreter.');
  return result.stdout.trim();
};
const probe=JSON.parse(readProbe(['-I','-c',
  'import json,platform,struct,sys,PyInstaller;print(json.dumps(dict(python=platform.python_version(),pyinstaller=PyInstaller.__version__,bits=struct.calcsize("P")*8,base=sys.base_prefix)))']));
const {base:pythonBase,...toolchain}=probe;
if (toolchain.python!=='3.12.12'||toolchain.pyinstaller!=='6.22.3'||toolchain.bits!==64) {
  throw Error('Unapproved personal memory build toolchain.');
}
const requirements=[path.join(repo,'python','requirements-personal-memory.txt'),path.join(workerSource,'requirements-build.txt')];
const normalizeDependency=line=>line.replace(/^[A-Za-z0-9_.-]+/u,name=>name.toLowerCase().replace(/[_.-]+/gu,'-'));
const installed=new Set(readProbe(['-I','-m','pip','freeze','--all']).split(/\r?\n/u).map(normalizeDependency));
const langmemRevision='4beb9c36a40953f09357e5b2dd62ecc726f22d13';
const langmemOrigin='https://github.com/langchain-ai/langmem.git';
const langmemPin='langmem @ git+'+langmemOrigin+'@'+langmemRevision;

if (!installed.has(langmemPin)) {
  const localLangMem=JSON.parse(readProbe(['-I','-c',`
import importlib.metadata as metadata, json
d=metadata.distribution("langmem")
print(json.dumps(dict(url=json.loads(d.read_text("direct_url.json"))["url"], installed=str(d.locate_file("langmem")))))
`]));
  const sourcePath=fileURLToPath(localLangMem.url);
  const git=(...args)=>{
    const result=spawnSync('git',['-C',sourcePath,...args],{encoding:'buffer',windowsHide:true});
    if (result.status!==0) throw Error('Cannot verify the reviewed LangMem checkout.');
    return result.stdout;
  };
  if (git('rev-parse','HEAD').toString().trim()!==langmemRevision) throw Error('Unexpected LangMem checkout version.');
  const tracked=git('ls-tree','-r','--name-only','HEAD','src/langmem').toString().trim().split(/\r?\n/u);
  const installedSource=files(localLangMem.installed).filter(file=>file.endsWith('.py'));
  if (tracked.length!==installedSource.length || tracked.some(name=>{
    const expected=git('show','HEAD:'+name).toString('utf8');
    const file=path.join(localLangMem.installed,name.slice('src/langmem/'.length));
    return fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')!==expected;
  })) {
    throw Error('Installed LangMem package differs from the reviewed commit.');
  }
  installed.add(langmemPin);
}
for (const file of requirements) {
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/u)) {
    const dependency=line.trim();
    if (dependency && !dependency.startsWith('#') && !installed.has(normalizeDependency(dependency))) {
      throw Error('Unpinned build dependency: '+dependency);
    }
  }
}
readProbe(['-I','-m','pip','check']);

if (fs.existsSync(root)) throw Error('Existing worker bundle. Build in a clean owned checkout.');
fs.mkdirSync(base,{recursive:true});
const result=spawnSync(python,['-I','-m','PyInstaller','--onedir','--noupx','--name',name,
  '--distpath',path.join(base,'dist'),'--workpath',path.join(base,'build'),'--specpath',base,
  '--recursive-copy-metadata','langmem','--recursive-copy-metadata','langchain-openai',entry],
{cwd:repo,stdio:'inherit',windowsHide:true});
if (result.status!==0) throw Error('Personal memory runtime build failed.');
const executable=name+'.exe';
if (!fs.statSync(path.join(root,executable)).isFile()) throw Error('Personal memory executable is missing.');
const licenseDir=path.join(root,'licenses');
fs.mkdirSync(licenseDir,{recursive:true});
fs.copyFileSync(path.join(pythonBase,'LICENSE.txt'),path.join(licenseDir,'CPython-LICENSE.txt'));
fs.copyFileSync(path.join(workerSource,'SOURCE.md'),path.join(licenseDir,'SOURCE.md'));
const langmemMetadata=path.join(root,'_internal','langmem-0.0.30.dist-info');
if (!fs.statSync(path.join(langmemMetadata,'licenses','LICENSE')).isFile()) throw Error('Bundled LangMem license is missing.');
fs.writeFileSync(path.join(langmemMetadata,'direct_url.json'),JSON.stringify({
  url:langmemOrigin,vcs_info:{vcs:'git',requested_revision:langmemRevision,commit_id:langmemRevision},
}));

function files(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    if (entry.isDirectory()) return files(file);
    if (!entry.isFile()) throw Error('Unsupported entry in personal memory bundle: '+entry.name);
    return [file];
  });
}
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const textSha=file=>createHash('sha256').update(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')).digest('hex');
const slash=file=>file.replaceAll('\\','/');
const inventory=files(root).sort().map(file=>({path:slash(path.relative(root,file)),size:fs.statSync(file).size,sha256:sha(file)}));
const inputs=[script,entry,...requirements,path.join(workerSource,'SOURCE.md')];
const identity={schemaVersion:1,platform:'win32-x64',engine:'langmem@'+langmemRevision,
  executable,toolchain,buildInputs:inputs.map(file=>({path:slash(path.relative(repo,file)),sha256:textSha(file),normalizeEol:true}))};
const manifest=JSON.stringify(identity,null,2).slice(0,-2)+',\n  "files": [\n'+
  inventory.map(item=>'    '+JSON.stringify(item)).join(',\n')+'\n  ]\n}\n';
fs.writeFileSync(path.join(desktop,'src/main/education/personal-memory/runtime-manifest.json'),manifest);
console.log(JSON.stringify({root,files:inventory.length,bytes:inventory.reduce((total,item)=>total+item.size,0)}));
