import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const postcss=require('postcss');
const properties=['color','background-color','background-image','background-clip','-webkit-text-fill-color','display','font-family','font-size','font-weight','line-height','padding-top','padding-right','padding-bottom','padding-left','border-radius','border-top-width','border-top-color','outline-style','outline-color','outline-width','box-shadow','opacity','gap','min-height','width','animation-name','animation-duration','animation-play-state','transition-duration','transform'];
const tokenNames=['--accent','--accent-hover','--muted','--foreground','--background','--surface','--border','--field-background','--field-foreground','--office-muted','--office-ink','--pi-muted','--pi-ink'];
const normalize=s=>s.replaceAll("'",'"').replace(/\s+/g,'').replace(/::/g,':');

/** Read-only DevTools evidence. Source candidates are labelled, never invented source maps. */
export async function createStyleAuditor(page,rendererRoot){
  const sources=[];
  function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())visit(file);else if(file.endsWith('.css')){try{postcss.parse(fs.readFileSync(file,'utf8'),{from:file}).walkRules(rule=>sources.push({selector:normalize(rule.selector),file:path.relative(rendererRoot,file).replaceAll('\\','/'),line:rule.source.start.line,css:rule.toString().slice(0,1400)}));}catch{}}}}
  visit(rendererRoot);
  const cdp=await page.context().newCDPSession(page),sheets={};
  cdp.on('CSS.styleSheetAdded',({header})=>sheets[header.styleSheetId]=header);
  await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  async function node(selector){const doc=await cdp.send('DOM.getDocument');return(await cdp.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector})).nodeId;}
  async function sample(selector,label){
    const nodeId=await node(selector);if(!nodeId)return{selector,label,missing:true};
    const matched=await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
    const layers=await cdp.send('CSS.getLayersForNode',{nodeId});
    const computed=await cdp.send('CSS.getComputedStyleForNode',{nodeId});
    const layerOrder=new Map();function indexLayer(layer,prefix=''){const name=prefix?prefix+'.'+layer.name:layer.name;layerOrder.set(name,layer.order);layerOrder.set(layer.name,layer.order);for(const child of layer.subLayers||[])indexLayer(child,name==='implicit outer layer'?'':name);}indexLayer(layers.rootLayer);
    function summarize(matches){return matches.map((entry,order)=>{
      const r=entry.rule,selectors=entry.matchingSelectors.map(i=>r.selectorList.selectors[i]);
      const specificity=selectors.map(s=>s.specificity||{a:0,b:0,c:0}).sort((a,b)=>b.a-a.a||b.b-a.b||b.c-a.c)[0];
      const source=sheets[r.style.styleSheetId];
      const sourceCandidates=sources.filter(s=>s.selector===normalize(r.selectorList.text)).map(({file,line})=>({file,line}));
      return{selector:r.selectorList.text,specificity,origin:r.origin,order,layers:(r.layers||[]).map(l=>l.text),scopes:r.scopes?.map(s=>s.text),url:source?.sourceURL,line:(r.style.range?.startLine??0)+1,column:r.style.range?.startColumn,sourceCandidates,declarations:r.style.cssProperties.filter(p=>p.disabled!==true&&p.parsedOk!==false&&(properties.includes(p.name)||tokenNames.includes(p.name))).map(p=>({name:p.name,value:p.value,important:!!p.important}))};
    }).filter(r=>r.declarations.length);}
    const rules=summarize(matched.matchedCSSRules||[]);
    const cascadeRank=(r,p)=>{
      const important=p.important;
      const origin=r.origin==='user-agent'?(important?3:0):r.origin==='injected'?(important?2:1):1;
      const layer=r.layers.length?(layerOrder.get(r.layers.join('.'))??layerOrder.get(r.layers.at(-1))??0):10000;
      return[important?1:0,origin,important?-layer:layer,r.specificity.a,r.specificity.b,r.specificity.c,r.order];
    };
    const compare=(a,b)=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;};
    function winnersOf(rs){const winners={};for(const r of rs)for(const p of r.declarations){const rank=cascadeRank(r,p);if(!winners[p.name]||compare(rank,winners[p.name].rank)>=0)winners[p.name]={selector:r.selector,value:p.value,important:p.important,layers:r.layers,url:r.url,line:r.line,sourceCandidates:r.sourceCandidates,rank};}return winners;}
    const winners=winnersOf(rules);
    const inherited=(matched.inherited||[]).map((entry,depth)=>({depth:depth+1,rules:summarize(entry.matchedCSSRules||[])}));
    // Nearest ancestor with a declaration owns inheritance. Direct declarations always win over inheritance.
    const inheritedProperties=new Set(['color','font-family','font-size','font-weight','line-height',...tokenNames]);
    for(const ancestor of inherited){for(const [name,win]of Object.entries(winnersOf(ancestor.rules)))if(inheritedProperties.has(name)&&!winners[name])winners[name]={...win,inheritedDepth:ancestor.depth};}
    const dom=await page.locator(selector).first().evaluate((e,names)=>{const s=getComputedStyle(e),rect=e.getBoundingClientRect();return{tag:e.tagName,classes:e.className,attributes:Object.fromEntries([...e.attributes].filter(a=>a.name.startsWith('data-')||a.name.startsWith('aria-')).map(a=>[a.name,a.value])),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},tokens:Object.fromEntries(names.map(n=>[n,s.getPropertyValue(n).trim()])),animations:e.getAnimations().map(a=>({name:a.animationName,playState:a.playState,currentTime:a.currentTime})),text:e.textContent?.slice(0,180)};},tokenNames);
    return{selector,label,dom,computed:Object.fromEntries(computed.computedStyle.filter(p=>properties.includes(p.name)).map(p=>[p.name,p.value])),winners,rules,inherited,layerTree:layers.rootLayer};
  }
  return{sample,cdp,node,sheets};
}

/** A cloned DOM in an offscreen frame compares cosmetics only; it never substitutes a real run. */
export async function compareOfficialAppearance(page,selector,rendererRoot,theme){
  const css=fs.readFileSync(path.join(rendererRoot,'heroui-pro/heroui-oss.min.css'),'utf8')+'\n'+fs.readFileSync(path.join(rendererRoot,'heroui-pro/heroui-pro.min.css'),'utf8');
  const html=await page.locator(selector).first().evaluate(e=>{let branch=e.cloneNode(true);for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const wrapper=p.cloneNode(false);wrapper.append(branch);branch=wrapper;}return branch.outerHTML;});
  await page.evaluate(({css,html,theme})=>{const frame=document.createElement('iframe');frame.id='native-design-reference';frame.style='position:fixed;left:-10000px;top:0;width:1366px;height:768px';frame.srcdoc='<html><head><style>'+css+'</style></head><body data-theme="'+theme+'">'+html+'</body></html>';document.body.append(frame);},{css,html,theme});
  try{
    await page.waitForFunction(()=>document.querySelector('#native-design-reference')?.contentDocument?.body?.children.length>0);
    return await page.evaluate(({selector,names})=>{
      const actualNode=document.querySelector(selector),frame=document.querySelector('#native-design-reference'),other=frame.contentDocument.querySelector(selector);
      const a=getComputedStyle(actualNode),b=frame.contentWindow.getComputedStyle(other);
      return Object.fromEntries(names.map(n=>[n,{actual:a.getPropertyValue(n),official:b.getPropertyValue(n),equal:a.getPropertyValue(n)===b.getPropertyValue(n)}]));
    },{selector,names:['color','font-family','font-size','font-weight','padding-left','padding-top','background-color','border-radius','outline-style','--muted','--accent','--accent-hover','--field-background','--focus']});
  }finally{await page.evaluate(()=>document.querySelector('#native-design-reference')?.remove());}
}
