import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import './office-agent/register-source.mjs';

const desktop=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url);
const root=path.join(desktop,'test-results/ux-followup-dependencies');fs.mkdirSync(root,{recursive:true});
const archive=path.resolve(desktop,'../../acceptance/ux-followup-20261126/minimatch-10.2.6.tgz');
execFileSync('tar',['-xf',archive,'-C',root]);
const old=await import(pathToFileURL(path.join(root,'package/dist/esm/index.js')).href);
const piRequire=createRequire(path.join(desktop,'node_modules/@earendil-works/pi-coding-agent/package.json'));
const current=await import(pathToFileURL(piRequire.resolve('minimatch')).href);
const semver=require('semver');
const rootUndici=JSON.parse(fs.readFileSync(path.join(desktop,'node_modules/undici/package.json'))).version;
const openai=JSON.parse(fs.readFileSync(path.join(desktop,'node_modules/openai/package.json')));
assert(semver.satisfies(rootUndici,openai.peerDependencies.undici),'OpenAI optional HTTP peer must genuinely support the selected root version');
const agentUndici=JSON.parse(fs.readFileSync(piRequire.resolve('undici/package.json'))).version;
assert.equal(agentUndici,'8.12.2','Pi keeps its independently patched HTTP version');
const patterns=['deepseek-*','*','gpt-?','!gpt-*','{gpt,claude}-*','**/*.ts','**/*.{ts,tsx}','!**/node_modules/**','src/**','src/**/!(test).ts','src/**/+(test|index).ts','src/**/[a-z]*.ts','src/.hidden.ts','src\\**\\*.ts'];
const paths=['deepseek-flash','DeepSeek-Flash','gpt-6.1','claude-sonnet','src/index.ts','src/test.ts','src/lib/editor.tsx','src/node_modules/bad.ts','src/.hidden.ts','src\\index.ts'];
let comparisons=0;
for(const pattern of patterns)for(const file of paths)for(const options of [{},{nocase:true},{dot:true},{windowsPathsNoEscape:true}]){
 assert.equal(current.minimatch(file,pattern,options),old.minimatch(file,pattern,options),JSON.stringify({file,pattern,options}));comparisons++;
}
const {officeMathHtml}=await import('../src/shared/office-math.ts');
const formulas=['解：$x=3$。','浮力为 $F_浮=\\rho gV_排$。','$$\\frac{1}{2}+\\sqrt{3}$$','$$\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$$','$$x^2+y^2=z^2$$','概率为 $P(A)=0.5$','$$\\int_0^1 x\\,dx=\\frac12$$'];
for(const formula of formulas){const html=officeMathHtml(formula);assert(html.includes('<math'));assert(!/<script|onclick=|src="https?:/.test(html));}
for(const formula of ['$\\href{javascript:alert(1)}{x}$','$\\includegraphics{https://example.com/x}$','$\\newcommand{\\a}{x}\\a$','$\\frac{$'])assert.throws(()=>officeMathHtml(formula));
for(const name of ['pi-agent-core','pi-ai','pi-coding-agent','pi-tui']){
 const file=path.join(desktop,'node_modules/@earendil-works',name,'package.json');assert.equal(JSON.parse(fs.readFileSync(file)).version,'1.0.2');
}
console.log(JSON.stringify({success:true,globComparisons:comparisons,formulaRenderings:formulas.length,unsafeOrMalformedRejected:4,piDirectVersions:'1.0.2',boundary:'Normal Pi model/package matching parity against 10.2.6 and actual Office MathML rendering; not a natural model or full Office application acceptance.'}));
