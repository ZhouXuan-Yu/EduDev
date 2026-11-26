import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {sha256} from './evidence.mjs';

const compatibility=JSON.parse(fs.readFileSync(new URL('./prompt-compatibility.json',import.meta.url),'utf8'));
const lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));
const crlf=value=>Buffer.from(lf(value).toString('utf8').replaceAll('\n','\r\n'));

/** Reconstruct the already deployed update, never derive expected bytes from the checkout. */
export function verifyFrozenComponentSources(desktop,baseline,read=file=>fs.readFileSync(path.join(desktop,file))) {
 assert.equal(compatibility.schemaVersion,1);
 assert.match(compatibility.revision,/^[a-f0-9]{40}$/);
 const files=Object.keys(compatibility.files);
 assert.equal(files.length,5);
 assert(files.every(file=>baseline.files.some(entry=>entry.path===file)));
 const git=(revision,file)=>execFileSync('git',['show',revision+':apps/desktop/'+file],{cwd:desktop});
 return baseline.files.map(file=>{
  const actual=read(file.path);
  if(!files.includes(file.path)){
   assert.equal(sha256(actual),file.sha256,'Frozen source/CSS changed: '+file.path);
   return {path:file.path,kind:'original-frozen'};
  }
  const predecessor=git(compatibility.revision+'^',file.path);
  assert([sha256(predecessor),sha256(crlf(predecessor))].includes(file.sha256),'Compatibility predecessor does not reconstruct original baseline: '+file.path);
  const expected=git(compatibility.revision,file.path);
  assert(lf(actual).equals(lf(expected)),'Drift beyond the recorded production update: '+file.path);
  return {path:file.path,kind:'historical-production-update',revision:compatibility.revision,reason:compatibility.files[file.path]};
 });
}
