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
 check('legacy tokens and hover rules cannot enter protected roots',()=>{assert.equal(application.root.nodes.find(n=>n.name==='scope').params,'(:root) to ([data-heroui-native])');assert.equal(application.root.nodes.find(n=>n.name==='scope').nodes.length,3);});
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
 check('approved layout sheet has no vendor slot, BEM, state or important overrides',()=>{
  const layout=fs.readFileSync(path.join(renderer,'components/office/native-component-boundary.css'),'utf8');
  assert(!/!important|data-slot|\.button\b|\.chain-of-thought|\.chat-tool|\.prompt-input|:hover|:focus|:active/.test(layout));
  const root=postcss.parse(layout);root.walkRules(rule=>assert(rule.selector.includes('[data-heroui-native]')));
 });
 console.log(JSON.stringify({suite:'ui-style-isolation',passed}));
}finally{await server.close();}
