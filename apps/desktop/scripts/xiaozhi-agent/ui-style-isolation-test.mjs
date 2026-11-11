import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {createServer} from 'vite';

const renderer=path.resolve('src/renderer');
const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true}});
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
try{
 const {nativeComponentBoundary}=await server.ssrLoadModule('/scripts/css-native-boundary.ts');
 const application=await postcss([nativeComponentBoundary(renderer)]).process(':root{--muted:red}button:hover{color:red}@media(prefers-color-scheme:dark){p{color:blue}}@keyframes legacy{to{opacity:0}}',{from:path.join(renderer,'styles.css')});
 check('legacy tokens and hover rules cannot enter protected roots',()=>{assert(application.root.nodes.find(n=>n.name==='scope').params.includes(':root:not([data-edu-modern])'));assert(application.root.nodes.find(n=>n.name==='scope').params.includes('[data-heroui-native]'));assert.equal(application.root.nodes.find(n=>n.name==='scope').nodes.length,3);});
 check('legacy animation registration is not moved into an element scope',()=>assert(application.root.nodes.some(n=>n.name==='keyframes')));
 const official='.button:hover{color:var(--foreground)}';
 for(const name of ['heroui-oss.min.css','heroui-pro.min.css']){
  const result=await postcss([nativeComponentBoundary(renderer)]).process(official,{from:path.join(renderer,'heroui-pro',name)});
  check('official CSS unchanged by transform '+name,()=>assert.equal(result.css,official));
 }
 check('both Electron entries use one canonical import order',()=>{
  for(const file of ['main.tsx','browser-status.tsx']){const text=fs.readFileSync(path.join(renderer,file),'utf8');assert(text.includes("import './heroui-styles'"));assert(!text.includes('heroui-oss.min.css'));assert(!text.includes('heroui-pro.min.css'));}
  const order=fs.readFileSync(path.join(renderer,'heroui-styles.ts'),'utf8');assert(order.indexOf('heroui-oss.min.css')<order.indexOf('heroui-pro.min.css'));
 });
 const layoutFiles=fs.readdirSync(path.join(renderer,'ui-system'),{recursive:true}).filter(name=>name.endsWith('.css'));
 check('production layout never overrides native selectors or important states',()=>{
  for(const name of layoutFiles){
   const text=fs.readFileSync(path.join(renderer,'ui-system',name),'utf8');assert(!text.includes('!important'));
   postcss.parse(text).walkRules(rule=>assert(!/data-slot|\.button\b|\.chain-of-thought|\.chat-tool|\.prompt-input/.test(rule.selector)));
  }
 });
 const preservedLayouts=await Promise.all(layoutFiles.map(async name=>{
  const file=path.join(renderer,'ui-system',name),text=fs.readFileSync(file,'utf8');
  const transformed=await postcss([nativeComponentBoundary(renderer)]).process(text,{from:file});
  return {name,original:text,transformed:transformed.css};
 }));
 check('approved application layout files retain all declarations through the boundary',()=>{
  assert(preservedLayouts.length>0);
  for(const layout of preservedLayouts)assert.equal(layout.transformed,layout.original,layout.name);
 });
 const utilityFile=path.join(renderer,'design-review/reference.utilities.css');
 const utilityText=fs.readFileSync(utilityFile,'utf8');
 const utilityResult=await postcss([nativeComponentBoundary(renderer)]).process(utilityText,{from:utilityFile});
 check('official reference utilities stay isolated in the review artifact',()=>{
  assert.equal(utilityResult.css,utilityText);assert(!utilityText.includes('!important'));
  const parsed=postcss.parse(utilityText);parsed.walkRules(rule=>{
   let node=rule.parent;while(node&&!(node.type==='atrule'&&node.name==='scope'))node=node.parent;
   assert.equal(node?.params,'(.review-root)');
  });
 });
 const promptUtility=path.join(renderer,'components/office/prompt-input.utilities.css');
 const promptText=fs.readFileSync(promptUtility,'utf8');
 const promptResult=await postcss([nativeComponentBoundary(renderer)]).process(promptText,{from:promptUtility});
 check('official stop icon utilities are compiled locally and remain confined to native prompt inputs',()=>{
  assert.equal(promptResult.css,promptText);assert(!promptText.includes('!important'));
  const parsed=postcss.parse(promptText);parsed.walkRules(rule=>{
   let node=rule.parent;while(node&&!(node.type==='atrule'&&node.name==='scope'))node=node.parent;
   assert.equal(node?.params,'([data-heroui-native] [data-slot="prompt-input"])');
  });
  assert(promptText.includes('.bg-current'));assert(promptText.includes('.rounded-xs'));assert(promptText.includes('.size-3'));
 });
 console.log(JSON.stringify({suite:'ui-style-isolation',passed}));
}finally{await server.close();}
