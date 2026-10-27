import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {pathToFileURL} from 'node:url';
const parent=path.resolve('test-results/education');fs.mkdirSync(parent,{recursive:true});const output=fs.mkdtempSync(path.join(parent,'web-coverage-')),rawRoot=path.join(output,'raw'),hook=path.join(output,'capture.mjs');
// Capture the actual compiled script: TypeScript transform offsets are not source offsets.
fs.writeFileSync(hook,`import inspector from 'node:inspector';import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';const output=${JSON.stringify(output)},s=new inspector.Session();s.connect();s.on('Debugger.scriptParsed',({params})=>{if(!/\\/(question-web-answer-repository|question-web-answer-tools|question-web-answer-readback|question-web-answer)\\.ts$/.test(params.url))return;s.post('Debugger.getScriptSource',{scriptId:params.scriptId},(e,v)=>{if(!e)fs.writeFileSync(path.join(output,createHash('sha256').update(params.url).digest('hex')+'.source.json'),JSON.stringify({url:params.url,text:v.scriptSource}));});});s.post('Debugger.enable');`);
for(const name of ['question-web-answer-boundaries','question-web-send-boundaries','question-web-generic-send','question-web-pi-sdk','question-web-task-plan']){
 const result=spawnSync(process.execPath,['--import',pathToFileURL(hook).href,'--experimental-transform-types',`scripts/education/${name}.mjs`],{env:{...process.env,NODE_V8_COVERAGE:rawRoot},encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});fs.writeFileSync(path.join(output,name+'.log'),String(result.stdout||'')+String(result.stderr||''));if(result.status!==0)throw Error(`${name} failed: ${result.error||result.status}; ${output}`);
}
const raw=fs.readdirSync(rawRoot).flatMap(f=>JSON.parse(fs.readFileSync(path.join(rawRoot,f))).result),report={output,scope:'Actual V8 compiled JS nonblank-line and function coverage for four new domains, source-only probes; not TS branch, Electron/UI, provider or project-wide coverage',files:[]};
for(const file of fs.readdirSync(output).filter(f=>f.endsWith('.source.json'))){
 const {url,text}=JSON.parse(fs.readFileSync(path.join(output,file))),scripts=raw.filter(s=>s.url===url);if(!scripts.length)throw Error('Missing coverage for '+url);
 if(scripts.some(s=>Math.max(...s.functions.flatMap(f=>f.ranges.map(r=>r.endOffset)))!==text.length))throw Error('Compiled offset mismatch: '+url);
 const code=text.split('//# sourceMappingURL=')[0],length=code.length,counts=new Uint8Array(length),functions=new Map();
 for(const s of scripts){
  const all=s.functions.flatMap(f=>f.ranges),boundaries=[...new Set([0,length,...all.flatMap(r=>[Math.min(length,r.startOffset),Math.min(length,r.endOffset)])])].sort((a,b)=>a-b);
  for(let n=0;n<boundaries.length-1;n++){const a=boundaries[n],b=boundaries[n+1],r=all.filter(r=>r.startOffset<=a&&r.endOffset>=b).sort((x,y)=>(x.endOffset-x.startOffset)-(y.endOffset-y.startOffset))[0];if(r?.count>0)counts.fill(1,a,b);}
  for(const fun of s.functions.slice(1)){const r=fun.ranges[0],key=r.startOffset+':'+r.endOffset;functions.set(key,(functions.get(key)||0)+r.count);}
 }
 let offset=0,total=0,covered=0;
 for(const line of code.split('\n')){const trim=line.trim();if(trim&&!trim.startsWith('//')&&!trim.startsWith('/*')&&!trim.startsWith('*')){total++;if([...line].some((c,i)=>!(/\s/.test(c))&&counts[offset+i]))covered++;}offset+=line.length+1;}
 const functionCovered=[...functions.values()].filter(n=>n>0).length;
 report.files.push({name:url.split('/').pop(),compiledSha256:createHash('sha256').update(text).digest('hex'),compiledNonblankLines:{covered,total,percent:Number((100*covered/total).toFixed(2))},functions:{covered:functionCovered,total:functions.size,percent:Number((100*functionCovered/functions.size).toFixed(2))}});
}
report.success=report.files.length===4&&report.files.every(f=>f.compiledNonblankLines.percent>=80&&f.functions.percent>=80);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.success)process.exitCode=1;
