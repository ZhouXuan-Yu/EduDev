import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const desktop=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cache=path.join(desktop,'.local-release','cache');
const target=path.join(desktop,'.local-release','python-embed');
const zip=path.join(cache,'python-3.13.17-embed-amd64.zip');
const url='https://www.python.org/ftp/python/3.13.17/python-3.13.17-embed-amd64.zip';
const expected='9e35319bffedab8b36ad44d8f377cb4f1733bcec257a0b6d04d94f01486ddb38';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

fs.mkdirSync(cache,{recursive:true});
if(!fs.existsSync(zip)){
  const response=await fetch(url);
  if(!response.ok)throw new Error(`Python download failed: HTTP ${response.status}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(zip,bytes);
}
const zipBytes=fs.readFileSync(zip);
if(hash(zipBytes)!==expected)throw new Error('Python embeddable SHA-256 mismatch');

const resolvedTarget=path.resolve(target);
if(!resolvedTarget.startsWith(path.join(desktop,'.local-release')+path.sep))throw new Error('Unsafe Python runtime target');
fs.rmSync(resolvedTarget,{recursive:true,force:true});
fs.mkdirSync(resolvedTarget,{recursive:true});
const expanded=spawnSync('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip.replaceAll("'","''")}' -DestinationPath '${resolvedTarget.replaceAll("'","''")}' -Force`],{encoding:'utf8',windowsHide:true});
if(expanded.status!==0)throw new Error(`Python extraction failed: ${expanded.stderr||expanded.stdout}`);

const python=path.join(resolvedTarget,'python.exe');
if(!fs.existsSync(python))throw new Error('Bundled python.exe missing');
const version=spawnSync(python,['-I','-S','-B','-c','import sys; print("%d.%d" % sys.version_info[:2])'],{encoding:'utf8',windowsHide:true});
if(version.status!==0||version.stdout.trim()!=='3.13')throw new Error(`Unexpected bundled Python: ${version.stdout} ${version.stderr}`);
const files=fs.readdirSync(resolvedTarget,{recursive:true,withFileTypes:true}).filter(item=>item.isFile()).length;
console.log(JSON.stringify({success:true,target:resolvedTarget,python,version:version.stdout.trim(),zipBytes:zipBytes.length,zipSha256:expected,files}));
