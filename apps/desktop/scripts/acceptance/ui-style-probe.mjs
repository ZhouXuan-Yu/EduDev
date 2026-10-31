/** Styles only. Caller owns interactions and screenshot capture. No text/DOM export,
 * CSS rewriting, forced pseudo states, or persistent probe attributes.
 * Chromium/Electron CDP; locator must resolve to exactly one visible top-frame element.
 */
const properties = [
  'display','position','visibility','opacity','overflow','overflow-x','overflow-y',
  'width','height','min-width','max-width','min-height','max-height','box-sizing',
  'padding','margin','gap','row-gap','column-gap','align-items','justify-content',
  'color','background-color','border','border-color','border-width','border-style',
  'border-radius','box-shadow','outline','outline-color','outline-width','outline-style','outline-offset',
  'font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align',
  'text-decoration','white-space','word-break','overflow-wrap','cursor','pointer-events',
  'transform','transform-origin','animation-name','animation-duration','animation-delay',
  'animation-timing-function','animation-iteration-count','animation-play-state',
  'transition-property','transition-duration','transition-delay','transition-timing-function',
];
const visualProperty = /^(?:display|position|visibility|opacity|overflow(?:-.+)?|width|height|(?:min|max)-(?:width|height)|box-sizing|padding(?:-.+)?|margin(?:-.+)?|gap|row-gap|column-gap|(?:align|justify|place)-.+|color|background(?:-.+)?|border(?:-.+)?|box-shadow|outline(?:-.+)?|font(?:-.+)?|line-height|letter-spacing|text-align|text-decoration(?:-.+)?|white-space|word-break|overflow-wrap|cursor|pointer-events|transform(?:-.+)?|animation(?:-.+)?|transition(?:-.+)?)$/;
const styleValue = value => String(value ?? '').replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/gi,'url([omitted])');
const declarations = style => (style?.cssProperties || []).filter(p => visualProperty.test(p.name)).map(p => ({
  name:p.name,value:styleValue(p.value),important:!!p.important,disabled:!!p.disabled,
  parsedOk:p.parsedOk,implicit:!!p.implicit,range:p.range,
}));
const sourceURL = value => String(value || '').replace(/[?#].*$/,'');

export async function captureStyleProbe(page, locator, name) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Style probe requires a state label');
  if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('Style probe requires exactly one visible element; scope the locator explicitly');
  const sample = await locator.evaluate((element, names) => {
    if (element.ownerDocument.defaultView !== window.top) throw new Error('Style probe supports top-frame elements only');
    const computed = getComputedStyle(element), rect = element.getBoundingClientRect();
    // Structural address used only to resolve this same node through CDP. Never exported.
    const address=[];
    for(let node=element;node!==document;) {
      if(node.parentNode) {address.unshift({child:Array.prototype.indexOf.call(node.parentNode.children,node)});node=node.parentNode;}
      else if(node instanceof ShadowRoot) {address.unshift({shadow:true});node=node.host;}
      else throw new Error('Style probe target disconnected');
    }
    return {address,tag:element.tagName,rect:rect.toJSON(),
      computed:Object.fromEntries(names.map(key=>[key,computed.getPropertyValue(key)])),
      state:{hover:element.matches(':hover'),focus:element.matches(':focus'),focusVisible:element.matches(':focus-visible'),active:element.matches(':active'),disabled:element.matches(':disabled')||element.getAttribute('aria-disabled')==='true'},
      environment:{cssWidth:innerWidth,cssHeight:innerHeight,dpr:devicePixelRatio,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,osDark:matchMedia('(prefers-color-scheme: dark)').matches},
    };
  }, properties);
  const cdp=await page.context().newCDPSession(page), sheets=new Map();
  const group='edudev-style-probe';
  cdp.on('CSS.styleSheetAdded',({header})=>sheets.set(header.styleSheetId,{
    styleSheetId:header.styleSheetId,sourceURL:sourceURL(header.sourceURL),origin:header.origin,
    startLine:header.startLine,startColumn:header.startColumn,isInline:header.isInline,
  }));
  try {
    await cdp.send('DOM.enable');await cdp.send('CSS.enable');
    // Initialize CDP's node registry; the document response is neither retained nor returned.
    await cdp.send('DOM.getDocument',{depth:0});
    const expression=`(${function(address) {
      let node=document;
      for(const step of address)node=step.shadow?node.shadowRoot:node.children[step.child];
      return node;
    }.toString()})(${JSON.stringify(sample.address)})`;
    const remote=await cdp.send('Runtime.evaluate',{expression,objectGroup:group,returnByValue:false});
    if(remote.exceptionDetails || !remote.result?.objectId)throw new Error('Style probe target could not be resolved through CDP');
    const {nodeId}=await cdp.send('DOM.requestNode',{objectId:remote.result.objectId});
    if(!nodeId)throw new Error('Style probe target has no CDP node');
    const styles=await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
    const mapRule=({rule,matchingSelectors},order)=>({
      order,selectors:matchingSelectors.map(index=>rule.selectorList.selectors[index]?.text).filter(Boolean),
      selectorSpecificities:matchingSelectors.map(index=>rule.selectorList.selectors[index]?.specificity ?? null),
      origin:rule.origin,styleSheetId:rule.styleSheetId||rule.style?.styleSheetId,
      sourceURL:sheets.get(rule.styleSheetId||rule.style?.styleSheetId)?.sourceURL||'',
      layers:rule.layers||[],scopes:rule.scopes||[],media:rule.media||[],range:rule.style?.range,
      declarations:declarations(rule.style),
    });
    const {address,...result}=sample;
    result.computed=Object.fromEntries(Object.entries(result.computed).map(([key,value])=>[key,styleValue(value)]));
    return {name,...result,
      matchedRules:(styles.matchedCSSRules||[]).map(mapRule),
      inlineDeclarations:declarations(styles.inlineStyle),attributeDeclarations:declarations(styles.attributesStyle),
      inherited:(styles.inherited||[]).map((entry,ancestorIndex)=>({ancestorIndex,inlineDeclarations:declarations(entry.inlineStyle),matchedRules:(entry.matchedCSSRules||[]).map(mapRule)})),
      stylesheets:[...sheets.values()],
      boundaries:['Visual CSS declaration allowlist; content, custom properties and URL values omitted',
        'Matched cascade candidates retain CDP order/layers; this helper does not claim a winning selector',
        'No element text, HTML, attributes dump, or stylesheet body collected'],
    };
  } finally {
    await cdp.send('Runtime.releaseObjectGroup',{objectGroup:group}).catch(()=>{});
    await cdp.detach();
  }
}
