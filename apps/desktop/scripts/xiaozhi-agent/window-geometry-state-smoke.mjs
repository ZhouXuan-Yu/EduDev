import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(import.meta.url),cache=new Map();
function load(name){
  if(cache.has(name))return cache.get(name);
  const file=path.join(desktop,'src/main/desktop-chrome',`${name}.ts`),module={exports:{}};
  const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{module,exports:module.exports,require:id=>id==='electron'?{}:id==='./zcode-window-size'?load('zcode-window-size'):require(id),process,setTimeout,clearTimeout},{filename:file});
  cache.set(name,module.exports);return module.exports;
}
const {parseWindowGeometry:parse,resolveWindowGeometry:resolve}=load('window-geometry');
const valid={version:1,width:1280,height:760,x:-1500,y:10,maximized:false},area={x:-1920,y:0,width:1920,height:1040};
let passed=0;
const check=(name,action)=>{action();passed++;console.log(`PASS ${name}`);};
check('Known finite schema admits normal bounds including negative monitor coordinates',()=>assert.equal(JSON.stringify(parse(valid)),JSON.stringify(valid)));
check('Unknown schema or extra metadata never restores a geometry',()=>{for(const value of [null,[],{...valid,version:2},{...valid,credential:'synthetic'},{...valid,maximized:1}])assert.equal(parse(value),undefined);});
check('Malformed dimensions and coordinates are rejected at the local file boundary',()=>{for(const key of ['x','y','width','height'])for(const value of [NaN,Infinity,2**53,1000001,'1200',1.5])assert.equal(parse({...valid,[key]:value}),undefined);});
check('Dimensions below the established desktop minimum are rejected',()=>{assert.equal(parse({...valid,width:1099}),undefined);assert.equal(parse({...valid,height:719}),undefined);});
check('A connected negative-coordinate monitor keeps a valid saved position and normal size',()=>assert.equal(JSON.stringify(resolve(parse(valid),area)),JSON.stringify({width:1280,height:760,maximized:false,x:-1500,y:10})));
check('Absent state centers original defaults in the chosen work area',()=>assert.equal(JSON.stringify(resolve(undefined,area)),JSON.stringify({width:1360,height:900,maximized:false,x:-1640,y:70})));
check('Missing monitor and oversized saved bounds stay inside the current available work area',()=>{
  const result=resolve(parse({...valid,width:100000,height:100000,x:100000,y:-100000,maximized:true}),area);
  assert.equal(JSON.stringify(result),JSON.stringify({width:1920,height:1040,maximized:true,x:-1920,y:0}));
});
check('Small work area preserves host minimum with the native titlebar reachable',()=>{
  const result=resolve(undefined,{x:20,y:30,width:1024,height:600});assert.equal(result.x,20);assert.equal(result.y,30);assert.equal(result.width,1100);assert.equal(result.height,720);
});
console.log(JSON.stringify({success:true,passed,total:8,boundary:'Pure schema/display arithmetic; actual OS behavior requires the native Electron instance suite'}));
