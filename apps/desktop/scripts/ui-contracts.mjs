import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import postcss from 'postcss';
const desktop=path.resolve(import.meta.dirname,'..'),review=path.join(desktop,'src/renderer/design-review');
const server=await createServer({configFile:false,root:desktop,appType:'custom',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}});
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
try{
 const {PAGE_CONTRACTS,COMMON_STATES}=await server.ssrLoadModule('/src/renderer/ui-system/page-contracts.ts');
 const {PRODUCT_PAGES}=await server.ssrLoadModule('/src/renderer/components/product/product-spaces.ts');
 const ids=PAGE_CONTRACTS.map(p=>p.id);
 check('each actual product page has one and only one contract',()=>{
  const actual=['ai','settings','teaching','student_workbench',...Object.values(PRODUCT_PAGES).flat().map(p=>p.view)].sort();
  assert.deepEqual([...ids].sort(),actual);assert.equal(new Set(ids).size,ids.length);
 });
 for(const p of PAGE_CONTRACTS)check('page contract is actionable: '+p.id,()=>{assert(p.primaryAction&&p.purpose&&p.layout);assert(p.constraints.length>=3&&p.acceptance.length>=1);});
 check('shared lifecycle includes recovery and partial results',()=>assert(['running','failed','partial','cancelled','retry'].every(s=>COMMON_STATES.includes(s))));
 const baseline=JSON.parse(fs.readFileSync(path.join(review,'component-baseline.json'),'utf8'));
 check('recorded native sources and CSS have not changed',()=>{for(const f of baseline.files)assert.equal(createHash('sha256').update(fs.readFileSync(path.join(desktop,f.path))).digest('hex'),f.sha256,f.path);});
 check('official Agent Trace Streaming reference configuration is frozen',()=>assert.equal(createHash('sha256').update(fs.readFileSync(path.join(review,'OfficialTraceReference.tsx'))).digest('hex'),baseline.officialReferenceSha256));
 check('new review layout cannot override vendor selectors, tokens or important states',()=>{
  const css=postcss.parse(fs.readFileSync(path.join(review,'review.css'),'utf8'));
  css.walkRules(r=>assert(!/data-slot|\.button\b|chain-of-thought|prompt-input|chat-message/.test(r.selector),r.selector));
  css.walkDecls(d=>{assert(!d.important);assert(!/^--(accent|muted|foreground|background|surface|border|field|text-base)/.test(d.prop));});
 });
 check('review has no business IPC or model requests',()=>{for(const name of fs.readdirSync(review).filter(n=>/\.tsx?$/.test(n)))assert(!/window\.omniEdu|fetch\(|startXiaozhi/.test(fs.readFileSync(path.join(review,name),'utf8')),name);});
 const {nativeComponentBoundary}=await server.ssrLoadModule('/scripts/css-native-boundary.ts');
 const transformed=await postcss([nativeComponentBoundary(path.join(desktop,'src/renderer'))]).process('.work-panel{display:grid;gap:12px;color:red;background:lime;font-size:90px;padding:10px!important}',{from:path.join(desktop,'src/renderer/styles.css')});
 check('temporary domain adapter contains geometry but no inherited cosmetics',()=>{
  const scope=transformed.root.nodes.find(n=>n.name==='scope'&&n.params.startsWith('([data-edu-domain])'));
  const props=[];scope.walkDecls(d=>props.push(d.prop));assert.deepEqual(props,['display','gap']);
 });
 check('scope boundaries survive the Vite 6 CSS Modules parser',()=>{
  for(const scope of transformed.root.nodes.filter(n=>n.name==='scope'))assert.equal(scope.params.split('to').length,2);
 });
 const reviewed=await server.ssrLoadModule('/src/renderer/design-review/page-contracts.ts');
 check('review and production share one page metadata source',()=>assert.strictEqual(reviewed.PAGE_CONTRACTS,PAGE_CONTRACTS));
 check('retired glass theme and rejected demo are absent from formal source',()=>{
  for(const name of ['components/office/pi-workspace-glass.css','components/office/pi-workspace-theme.css','components/office/AgentTraceStreamingDemo.tsx'])assert(!fs.existsSync(path.join(desktop,'src/renderer',name)));
 });
 if(process.argv.includes('--write-docs')){
  const docs=path.resolve(desktop,'../../docs/design/ui-rebuild-2026-10-24/pages');fs.mkdirSync(docs,{recursive:true});
  for(const p of PAGE_CONTRACTS)fs.writeFileSync(path.join(docs,p.id+'.md'),
   '# '+p.title+' UI约束\n\n状态：用户已批准布局与过程基线；逐页真实业务验收另记。\n\n页面ID：'+p.id+'；页面类型：'+p.layout+'。\n\n目的：'+p.purpose+'\n\n默认主要行动：'+p.primaryAction+'\n\n## 布局与行为\n\n'+p.constraints.map(s=>'- '+s).join('\n')+'\n\n## 必须验证\n\n'+p.acceptance.map(s=>'- '+s).join('\n')+'\n\n共享状态：'+COMMON_STATES.join(' / ')+'。\n\n尺寸：亮色1366×768与1920×1080；不覆盖原厂组件尺寸、圆角、颜色或交互态。\n');
 }
 console.log(JSON.stringify({suite:'ui-contracts',passed,pages:ids.length,productionUiRebuilt:true}));
}finally{await server.close();}
