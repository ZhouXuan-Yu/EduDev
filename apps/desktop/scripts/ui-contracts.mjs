import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import postcss from 'postcss';
import {verifyFrozenComponentSources} from './acceptance/frozen-component-sources.mjs';
const desktop=path.resolve(import.meta.dirname,'..'),review=path.join(desktop,'src/renderer/design-review');
const docs=path.resolve(desktop,'../../docs/design/ui-rebuild-2026-10-24/pages');
const args=process.argv.slice(2),onlyPages=args.includes('--page-contracts');
const writeIndex=args.indexOf('--write-docs');
const requested=writeIndex>=0&&!args[writeIndex+1]?.startsWith('--')?args[writeIndex+1]?.split(','):undefined;
const server=await createServer({configFile:false,root:desktop,appType:'custom',server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true}});
let passed=0;
const failures=[];
function check(name,verify){
 try{verify();passed++;console.log('PASS '+name);}
 catch(error){failures.push(name);console.error('FAIL '+name+' — '+error.message);}
}
const bullets=items=>items.map(item=>'- '+item).join('\n');
function renderPage(page,states){
 const sections=page.interactionSections?.map(section=>'## '+section.title+'\n\n'+bullets(section.items)+'\n\n').join('')??'';
 return '# '+page.title+' UI约束\n\n状态：用户已批准布局与过程基线；逐页真实业务验收另记。\n\n页面ID：'+page.id+'；页面类型：'+page.layout+'。\n\n目的：'+page.purpose+
  '\n\n默认主要行动：'+page.primaryAction+'\n\n## 布局与行为\n\n'+bullets(page.constraints)+'\n\n'+sections+'## 必须验证\n\n'+bullets(page.acceptance)+
  '\n\n共享状态：'+states.join(' / ')+'。\n\n尺寸：亮色1366×768与1920×1080；不覆盖原厂组件尺寸、圆角、颜色或交互态。\n';
}
try{
 const {PAGE_CONTRACTS,COMMON_STATES}=await server.ssrLoadModule('/src/renderer/ui-system/page-contracts.ts');
 const {PRODUCT_PAGES,PRODUCT_SPACES}=await server.ssrLoadModule('/src/renderer/components/product/product-spaces.ts');
 const ids=PAGE_CONTRACTS.map(p=>p.id);
 check('each actual product page has one and only one contract',()=>{
  const actual=[...new Set([
   ...PRODUCT_SPACES.map(space=>space.view), ...Object.values(PRODUCT_PAGES).flat().map(page=>page.view), 'teaching', 'student_workbench',
  ])].sort();
  assert.deepEqual([...ids].sort(),actual);assert.equal(new Set(ids).size,ids.length);
 });
 for(const p of PAGE_CONTRACTS)check('page contract is actionable: '+p.id,()=>{assert(p.primaryAction&&p.purpose&&p.layout);assert(p.constraints.length>=3&&p.acceptance.length>=1);});
 check('shared lifecycle includes recovery and partial results',()=>assert(['running','failed','partial','cancelled','retry'].every(s=>COMMON_STATES.includes(s))));
 const conversation=PAGE_CONTRACTS.find(page=>page.id==='ai');
 const renderedConversation=renderPage(conversation,COMMON_STATES);
 check('conversation contract keeps the pending panel and restart acceptance when rendered',()=>{
  const section=conversation.interactionSections?.find(section=>section.title==='输入框上方的待处理面板');
  assert(section?.items.some(item=>item.includes('PiComposerPendingPanel')));
  assert(conversation.acceptance.some(item=>item.includes('重启后无模型自动重放')));
  if(writeIndex<0){
   const published=fs.readFileSync(path.join(docs,'ai.md'),'utf8').replaceAll('\r\n','\n');
   assert.equal(published,renderedConversation,'The published conversation contract differs from the shared metadata');
  }
 });
 const reviewed=await server.ssrLoadModule('/src/renderer/design-review/page-contracts.ts');
 check('review and production share one page metadata source',()=>assert.strictEqual(reviewed.PAGE_CONTRACTS,PAGE_CONTRACTS));
 if(!onlyPages){
  const baseline=JSON.parse(fs.readFileSync(path.join(review,'component-baseline.json'),'utf8'));
  check('frozen sources/CSS and reconstructed production PromptInput revision match',()=>{
   const sources=verifyFrozenComponentSources(desktop,baseline);
   assert.equal(sources.filter(file=>file.kind==='original-frozen').length,11);
   assert.equal(sources.filter(file=>file.kind==='historical-production-update').length,5);
  });
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
  check('retired glass theme and rejected demo are absent from formal source',()=>{
   for(const name of ['components/office/pi-workspace-glass.css','components/office/pi-workspace-theme.css','components/office/AgentTraceStreamingDemo.tsx'])assert(!fs.existsSync(path.join(desktop,'src/renderer',name)));
  });
 }
 if(writeIndex>=0&&!failures.length){
  assert(!requested||requested.every(id=>ids.includes(id)),'Unknown page ID in --write-docs');
  fs.mkdirSync(docs,{recursive:true});
  for(const page of PAGE_CONTRACTS.filter(page=>!requested||requested.includes(page.id))){
   const file=path.join(docs,page.id+'.md');
   if(fs.existsSync(file)&&!fs.readFileSync(file,'utf8').includes('\n页面ID：'+page.id+'；页面类型：')){
    console.log('PRESERVED hand-written page contract: '+page.id);
    continue;
   }
   fs.writeFileSync(file,renderPage(page,COMMON_STATES));
  }
 }
 console.log(JSON.stringify({suite:onlyPages?'page-contracts':'ui-contracts',passed,pages:ids.length,failures}));
 if(failures.length)process.exitCode=1;
}finally{await server.close();}
