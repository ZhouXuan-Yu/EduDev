import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from './evidence.mjs';

// This traces existing production changes. It never blesses them as an official
// package, rewrites the frozen baseline, or writes third-party source files.
const desktop=path.resolve(import.meta.dirname,'../..');
const output=path.resolve(desktop,'../../acceptance/ux-followup-20261126/prompt-source.json');
const revision='effc6c0109bdc4c8fc892ac7ad7639bfbed99cde';
const baseline=JSON.parse(fs.readFileSync(path.join(desktop,'src/renderer/design-review/component-baseline.json'),'utf8'));
const readGit=(rev,file)=>execFileSync('git',['show',rev+':apps/desktop/'+file],{cwd:desktop});
const lf=value=>Buffer.from(value.toString('utf8').replaceAll('\r\n','\n'));
const crlf=value=>Buffer.from(lf(value).toString('utf8').replaceAll('\n','\r\n'));
const report={status:'PARTIAL',revision,baselineUnchanged:true,files:[],
  boundary:'Historical production provenance and drift detection only. Current official licensed artifact identity is still unverified; the original native-source equality gate remains unchanged.'};
for(const file of baseline.files){
 const actual=fs.readFileSync(path.join(desktop,file.path));
 if(sha256(actual)===file.sha256)continue;
 assert(file.path.includes('/prompt-input/'),'Unexpected change outside historical PromptInput update');
 const old=readGit(revision+'^',file.path),expected=readGit(revision,file.path);
 assert([sha256(old),sha256(crlf(old))].includes(file.sha256),'Historic predecessor must reconstruct original baseline');
 assert(lf(actual).equals(lf(expected)),'Unreviewed drift after the existing production update: '+file.path);
 // Negative control exercises the same validator, without changing the worktree.
 const matches=value=>lf(value).equals(lf(expected));
 assert(!matches(Buffer.concat([actual,Buffer.from('\n/* injected drift */')])));
 report.files.push({path:file.path,original: file.sha256,current:sha256(actual),historicalBlob:execFileSync('git',['rev-parse',revision+':apps/desktop/'+file.path],{cwd:desktop,encoding:'utf8'}).trim(),matchesDeployedRevision:true,negativeDriftRejected:true});
}
assert.equal(report.files.length,5);
report.next='Composer/source owner: map effc6c0 to the authorized HeroUI Pro artifact and approve a versioned compatibility record, then replace the equality contract with source reconstruction plus permitted patch validation. Do not repin hashes alone.';
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({output,status:report.status,historicalFiles:report.files.length,negativeControls:report.files.length}));
