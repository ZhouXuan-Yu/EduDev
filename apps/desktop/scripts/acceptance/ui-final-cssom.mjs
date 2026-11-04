/** Read-only CDP attribution for literal, normal, top-document declarations.
 * Not a complete cascade engine. Unknown cases have winner:null, never a guessed winner.
 * Order basis: DevTools CSSMatchedStyles.buildMainCascade reverses matchedCSSRules;
 * NodeCascade then processes low-to-high. This includes NORMAL layer precedence.
 * https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/CSSMatchedStyles.ts
 * No stylesheet edits, pseudo-state forcing, DOM mutations or business API calls.
 */
export const PROPERTIES = Object.freeze(['background-color','color','border-top-left-radius',
  'border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius',
  'outline-color','outline-style','outline-width','outline-offset','box-shadow']);

const active = p => !p.disabled && p.parsedOk !== false;
const unresolved = (reason,candidates=[]) => ({status:'unresolved',reason,winner:null,candidates});
const overlaps = (name,property) => name===property || name==='all' ||
  name==='background'&&property==='background-color' ||
  name==='outline'&&['outline-color','outline-style','outline-width'].includes(property) ||
  name==='border-radius'&&property.endsWith('-radius') ||
  /^border-(?:start|end)-(?:start|end)-radius$/.test(name)&&property.endsWith('-radius') ||
  /^-(?:webkit|moz)-/.test(name)&&name.endsWith(property);

/** Pure resolver; full CDP payload, never a bounded candidate summary.
 * Computed values are deliberately NOT inputs to winner selection.
 * Inheritance, var/env/attr/currentColor/CSS-wide values, !important, scope,
 * containers, native nesting and animation are preserved as unresolved evidence.
 */
export function resolveLiteralCssom({matched,sheets={},conditions=[],hazards=[],layersAvailable=false}) {
  return Object.fromEntries(PROPERTIES.map(property=>{
    const candidates=[];
    const add=(style,rule,index,matchingSelectors=[])=>{
      for(const [declarationIndex,p] of (style?.cssProperties||[]).entries()){
        if(!active(p)||style.range&&!p.range||!overlaps(p.name,property))continue;
        const expanded=p.name===property?p:p.longhandProperties?.find(x=>x.name===property);
        if(p.name!==property&&p.longhandProperties&&!expanded&&p.name!=='all'&&!p.name.startsWith('border-start')&&!p.name.startsWith('border-end'))continue;
        const id=rule?.styleSheetId||style.styleSheetId,header=sheets[id];
        const selectors=matchingSelectors.map(i=>rule?.selectorList?.selectors?.[i]);
        const problems=[];
        if(!rule)problems.push('inline-declaration-has-no-stylesheet-selector');
        if(p.important)problems.push('important-cascade-not-implemented');
        if(p.name==='all')problems.push('all-reset-not-implemented');
        if(!expanded)problems.push('browser-shorthand-expansion-unavailable');
        if(/^(?:border-(?:start|end)|-(?:webkit|moz)-)/.test(p.name))problems.push('logical-or-prefixed-alias');
        const value=expanded?.value??p.value;
        if(/\b(?:var|env|attr|random)\s*\(|\b(?:inherit|initial|unset|revert(?:-layer|-rule)?|currentcolor)\b/i.test(value+' '+p.value))
          problems.push('dependent-value-or-inheritance-not-resolved');
        if(rule&&!['regular','user-agent'].includes(rule.origin))problems.push('unknown-origin');
        if(rule&&['containerQueries','scopes','nestingSelectors','startingStyles','navigations'].some(k=>rule[k]?.length))problems.push('complex-rule-context');
        if(rule?.ruleTypes?.some(t=>!['LayerRule','MediaRule','SupportsRule'].includes(t)))problems.push('unsupported-rule-type');
        if(rule&&(!selectors.length||selectors.some(s=>!s?.text||!s.specificity||!['a','b','c'].every(k=>Number.isInteger(s.specificity[k])))))
          problems.push('selector-specificity-unavailable');
        if(!header?.sourceURL||!p.range)problems.push('generated-source-location-unavailable');
        if(rule?.ruleTypes?.includes('LayerRule')&&!rule.layers?.length)problems.push('missing-layer-metadata');
        if(rule?.layers?.length&&(!layersAvailable||rule.layers.some(l=>!l.text)))problems.push('layer-tree-unavailable-or-anonymous-layer');
        if(conditions[index]?.status==='unresolved')problems.push('unresolved-condition');
        candidates.push({ruleIndex:index,declarationIndex,declaration:p.name,value,authoredValue:p.value,
          origin:rule?.origin??'inline',important:!!p.important,selectors:selectors.map(s=>({text:s?.text,specificity:s?.specificity})),
          sourceURL:header?.sourceURL??null,styleSheetId:id??null,range:p.range??null,
          line:p.range?p.range.startLine+1:null,column:p.range?p.range.startColumn+1:null,
          documentLine:header?.isInline&&p.range?header.startLine+p.range.startLine+1:null,
          layers:(rule?.layers||[]).map(l=>({text:l.text,range:l.range??null,styleSheetId:l.styleSheetId??null})),problems});
      }
    };
    if(!Array.isArray(matched?.matchedCSSRules))return [property,unresolved('missing-matched-rules')];
    matched.matchedCSSRules.forEach((m,i)=>{if(conditions[i]?.status!=='inactive')add(m.rule.style,m.rule,i,m.matchingSelectors);});
    if(matched.inlineStyle)add(matched.inlineStyle,null,-1);
    const problems=[...hazards,...candidates.flatMap(c=>c.problems)];
    if(matched.attributesStyle?.cssProperties?.some(p=>active(p)&&overlaps(p.name,property)))problems.push('presentational-attribute');
    if(problems.length)return [property,unresolved([...new Set(problems)].join(';'),candidates)];
    if(!candidates.length)return [property,unresolved(property==='color'?'inherited-or-default-color-origin-unresolved':'no-direct-declaration-default-unresolved')];
    // No sorting by URL or computed-value equality. Source declaration order is
    // preserved within each low-to-high CDP normal rule; inline was appended last.
    const chosen=candidates.at(-1),compare=(a,b)=>a.a-b.a||a.b-b.b||a.c-b.c;
    const highest=chosen.selectors.reduce((a,b)=>compare(a.specificity,b.specificity)>=0?a:b);
    const winner={...chosen,selectors:chosen.selectors.filter(s=>compare(s.specificity,highest.specificity)===0)};
    return [property,{status:'resolved',winner,candidateCount:candidates.length,
      proof:'CDP normal cascade order + declaration order; literal value; stable real state; generated stylesheet location',candidates}];
  }));
}

export function inspectCssomElement(element) {
  const address=[],animations=[];
  let shadow=false;
  for(let node=element;node instanceof Element;node=node.parentElement){
    shadow ||= node.getRootNode()!==document||!!node.assignedSlot||!!node.shadowRoot;
    for(const animation of node.getAnimations())if(animation.playState==='running'||animation.pending)animations.push(animation.constructor.name);
    if(node.parentElement)address.unshift(Array.prototype.indexOf.call(node.parentElement.children,node));
  }
  const style=getComputedStyle(element),rect=element.getBoundingClientRect();
  return {address,connected:element.isConnected,shadow,animations,tag:element.tagName,
    role:element.getAttribute('role'),testId:element.getAttribute('data-testid'),slot:element.getAttribute('data-slot'),
    className:element.getAttribute('class'),
    state:{hover:element.matches(':hover'),focus:element.matches(':focus'),focusVisible:element.matches(':focus-visible')||element.getAttribute('data-focus-visible')==='true',
      active:element.matches(':active'),pressed:element.getAttribute('data-pressed')==='true',disabled:element.matches(':disabled')||element.getAttribute('aria-disabled')==='true'},
    rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
    computed:Object.fromEntries(['background-color','color','border-radius','border-top-left-radius','border-top-right-radius',
      'border-bottom-left-radius','border-bottom-right-radius','outline','outline-color','outline-style','outline-width','outline-offset','box-shadow'].map(p=>[p,style.getPropertyValue(p)])),
    environment:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,dark:matchMedia('(prefers-color-scheme: dark)').matches,forcedColors:matchMedia('(forced-colors: active)').matches}};
}

export function observesState(requested,state) {
  if(requested==='disabled')return state.disabled;
  if(state.disabled)return false;
  if(requested==='normal')return !state.hover&&!state.focus&&!state.focusVisible&&!state.active&&!state.pressed;
  if(requested==='hover')return state.hover;
  if(requested==='focus')return state.focus&&state.focusVisible;
  if(requested==='pressed')return state.active||state.pressed;
  return false;
}

/** Collector lifetime is one existing Page/CDP session. No browser launch. */
export async function createCssomCollector(page) {
  const cdp=await page.context().newCDPSession(page),sheets={};
  cdp.on('CSS.styleSheetAdded',({header})=>{sheets[header.styleSheetId]=header;});
  cdp.on('CSS.styleSheetRemoved',({styleSheetId})=>{delete sheets[styleSheetId];});
  await cdp.send('DOM.enable');await cdp.send('CSS.enable');await cdp.send('DOM.getDocument',{depth:0});
  return {close:()=>cdp.detach(),async capture(locator,requested){
    const handle=await locator.elementHandle(),before=await handle.evaluate(inspectCssomElement);
    const group='ui-final-cssom-'+Date.now();
    try{
      const remote=await cdp.send('Runtime.evaluate',{expression:`(${function(address){let n=document.documentElement;for(const i of address)n=n?.children[i];return n;}.toString()})(${JSON.stringify(before.address)})`,objectGroup:group});
      if(remote.exceptionDetails||!remote.result.objectId)throw Error('CSSOM CDP target unavailable');
      const {nodeId}=await cdp.send('DOM.requestNode',{objectId:remote.result.objectId});
      const matched=await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
      const computed=await cdp.send('CSS.getComputedStyleForNode',{nodeId});
      let layerTree=null,layerError=null;
      try{layerTree=await cdp.send('CSS.getLayersForNode',{nodeId});}catch(error){layerError=String(error.message);}
      // Query selectors can match even when a media/supports condition is false.
      const conditions=await page.evaluate(rules=>rules.map(({rule})=>{
        try{
          if((rule.media||[]).some(m=>m.mediaList?.length?!m.mediaList.some(q=>q.active):!matchMedia(m.text).matches))return {status:'inactive'};
          if((rule.supports||[]).some(s=>s.active===false||s.active===undefined&&!CSS.supports(s.text)))return {status:'inactive'};
          return {status:'active'};
        }catch{return {status:'unresolved'};}
      }),matched.matchedCSSRules);
      const again=await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
      const computedAgain=await cdp.send('CSS.getComputedStyleForNode',{nodeId});
      const after=await handle.evaluate(inspectCssomElement);
      const same=await handle.evaluate((element,address)=>{let n=document.documentElement;for(const i of address)n=n?.children[i];return n===element&&element.isConnected;},before.address);
      const hazards=[];
      if(!same||JSON.stringify(before)!==JSON.stringify(after)||JSON.stringify(matched)!==JSON.stringify(again)||JSON.stringify(computed)!==JSON.stringify(computedAgain))hazards.push('unstable-snapshot');
      if(before.shadow||after.shadow)hazards.push('shadow-or-slot-cascade-unresolved');
      if(before.animations.length||after.animations.length)hazards.push('target-or-ancestor-animation');
      if(before.environment.forcedColors)hazards.push('forced-colors');
      if(!observesState(requested,before.state)||!observesState(requested,after.state))hazards.push('requested-state-not-observed');
      const properties=resolveLiteralCssom({matched,sheets,conditions,hazards,layersAvailable:!!layerTree});
      const values=new Map(computed.computedStyle.map(p=>[p.name,p.value]));
      for(const [property,result] of Object.entries(properties)){
        result.computed=values.get(property)??null;
        if(result.computed===null||result.computed!==before.computed[property])Object.assign(result,unresolved('CDP-and-DOM-computed-disagree',result.candidates));
      }
      return {requested,before,after,hazards,properties,
        raw:{nodeId,matched,computed,matchedAgain:again,computedAgain,conditions,layerTree,
          layerMethodAvailable:!!layerTree,layerError:layerError?'CSS.getLayersForNode unavailable (details deliberately omitted)':null,sheets:{...sheets}}};
    }finally{await cdp.send('Runtime.releaseObjectGroup',{objectGroup:group});await handle.dispose();}
  }};
}
