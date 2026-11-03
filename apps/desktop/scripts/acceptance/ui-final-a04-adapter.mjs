/**
 * Read-only A04 adapter. ONLY sampling inputs: existing realPage, exact locator,
 * buildIdentity. No app/browser launch, build, network, model, writes, interactions,
 * pseudo-state forcing, runtime stylesheet edits, or dependency installation.
 * Parent holds each real state and calls sampleA04(realPage, locator, buildIdentity).
 * Works on Button/TextField/Disclosure nodes without relabelling TextField as Button.
 * DOM class/slot hints identify only component CANDIDATES, never official provenance.
 *
 * Returns literal cascade evidence + source-selector ownership REVIEW CANDIDATES.
 * reviewedBoundaries is always []; no candidate is silently approved. For review,
 * inspect boundaryCandidates[].sources (source path/line, layer, declarations,
 * byte and LF hashes, provenance), generated selector/URL/layer, and current import
 * closure. Then explicitly construct reviewed entries for judgeCssBoundary from
 * ui-final-css-cascade.mjs. No bundle URL, layer name or class prefix proves owner.
 *
 * Source map scope: local CSS selector-text index, NOT Vite source-map resolution.
 * Exact selector spelling only; nested parents and at-rules retained for review.
 * CSS Modules renaming, nesting/minifier rewrites, and unreadable upstream sources
 * remain unresolved. Matching selector text does NOT prove original-source identity.
 * All local renderer CSS is indexed; not all indexed files are imported/live.
 *
 * var() restriction inherited from resolver: ANY relevant active contender using
 * var/env/attr/currentColor/CSS-wide values blocks that property's winner, even if
 * a later literal declaration exists. No token-origin tracing, fallback evaluation,
 * computed-value matching, or inferred var winner. Candidate selectors still export.
 * Four states are reported per call; states not presently observed are unsupported.
 * TextField :active may mean pointer activity, not semantic pressed activation.
 * Full A04, A32, source/build identity and state-distinguishability stay with parent.
 *
 * Offline only: node apps/desktop/scripts/acceptance/ui-final-a04-adapter.mjs --selftest
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {CASCADE_PROPERTIES, CASCADE_STATES, CASCADE_BASIS, resolveCssCascade,
  checkCascadeState} from './ui-final-css-cascade.mjs';

const desktop = fileURLToPath(new URL('../../',import.meta.url));
const renderer = path.join(desktop,'src/renderer');
const requireDesktop = createRequire(path.join(desktop,'package.json'));
const hash = value => createHash('sha256').update(value).digest('hex');
const lf = value => value.toString('utf8').replace(/\r\n/g,'\n');
const slash = value => value.replaceAll('\\','/');
const readJSON = file => JSON.parse(fs.readFileSync(file,'utf8'));

function cssFiles(root) {
  return fs.readdirSync(root,{withFileTypes:true}).sort((a,b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = path.join(root,entry.name);
    // Never traverse symlinks/junctions or dependencies via source directories.
    return entry.isSymbolicLink() ? [] : entry.isDirectory() ? cssFiles(file) : entry.name.endsWith('.css') ? [file] : [];
  });
}

/** Pure parsing through existing PostCSS; no plugins/build transforms executed. */
export function indexCssText(postcss, text, source) {
  const entries = [];
  const ast = postcss.parse(text,{from:source.file});
  ast.walkRules(rule => {
    const context = [];
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') context.push({kind:'at-rule',name:parent.name,params:parent.params});
      else if (parent.type === 'rule') context.push({kind:'nested-parent',selector:parent.selector});
    }
    for (const selector of rule.selectors) entries.push({
      selector:selector.trim(), file:source.file, line:rule.source.start.line,
      column:rule.source.start.column, context,
      layers:context.filter(item => item.name === 'layer').map(item => item.params),
      declarations:(rule.nodes || []).filter(node => node.type === 'decl').map(node =>
        ({name:node.prop,value:node.value,important:!!node.important,line:node.source.start.line})),
      sourceIdentity:source.identity, provenance:source.provenance,
      suggestedOwner:source.suggestedOwner,
    });
  });
  return entries;
}

/** Reads CURRENT checkout, independently of cwd. CRLF equivalence is explicit;
 * it never replaces byte hashes or upgrades Pro's copy metadata to verification.
 */
export function loadA04SourceCandidates() {
  let postcss;
  try {postcss = requireDesktop('postcss');}
  catch {return {status:'unsupported',reason:'existing-postcss-unavailable',entries:[],files:[]};}
  const metadata = {}, errors = [];
  for (const name of ['heroui-oss-source.json','workspace-source.json']) {
    try {metadata[name] = readJSON(path.join(renderer,'heroui-pro',name));}
    catch {errors.push(`unreadable-source-metadata:${name}`);}
  }
  const entries = [], files = [];
  for (const file of cssFiles(renderer)) {
    const bytes = fs.readFileSync(file), relative = slash(path.relative(renderer,file));
    const identity = {bytes:bytes.length,byteSha256:hash(bytes),lfSha256:hash(lf(bytes))};
    let suggestedOwner = relative.startsWith('heroui-pro/') || relative.startsWith('vendor/') ? 'unverified' : 'shell';
    let provenance = {kind:'application-source; import reachability not established'};
    if (relative === 'heroui-pro/heroui-oss.min.css') {
      const manifest = metadata['heroui-oss-source.json'];
      let installed;
      try {
        const packageFile = path.join(desktop,'node_modules/@heroui/styles/package.json');
        const pkg = readJSON(packageFile);
        installed = {version:pkg.version,lfSha256:hash(lf(fs.readFileSync(path.join(desktop,'node_modules/@heroui/styles/dist/heroui.min.css'))))};
      } catch { /* Unavailable is evidence, not permission to install. */ }
      const same = !!manifest && manifest.package === '@heroui/styles' &&
        identity.lfSha256 === manifest.sha256 && installed?.lfSha256 === manifest.sha256 && installed.version === manifest.version;
      suggestedOwner = same ? 'official' : 'unverified';
      provenance = {kind:'OSS manifest + installed package comparison',manifest:'heroui-pro/heroui-oss-source.json',
        package:manifest?.package,version:manifest?.version,expectedByteSha256:manifest?.sha256,
        manifestByteMatch:identity.byteSha256 === manifest?.sha256,
        manifestLfMatch:identity.lfSha256 === manifest?.sha256,installed:installed ?? null,
        officialSourceCandidateVerifiedWithLFNormalization:same};
    } else if (relative === 'heroui-pro/heroui-pro.min.css') {
      provenance = {kind:'Pro copied CSS; upstream CSS hash not verified',
        sourceRoot:metadata['workspace-source.json']?.source ?? null,
        metadata:'heroui-pro/workspace-source.json',
        note:'Workspace manifest lists component TS files, not this CSS; never treat as verified official CSS'};
    }
    const source = {file:slash(file),identity,provenance,suggestedOwner};
    files.push({relative,...source});
    try {entries.push(...indexCssText(postcss,bytes.toString('utf8'),source));}
    catch {errors.push(`css-parse-failed:${relative}`);}
  }
  return {status:errors.length ? 'unsupported' : 'indexed-for-review',entries,files,errors,
    importEvidence:['src/renderer/main.tsx','src/renderer/heroui-styles.ts','electron.vite.config.ts','scripts/css-native-boundary.ts']
      .map(relative => {const bytes = fs.readFileSync(path.join(desktop,relative)); return {file:slash(path.join(desktop,relative)),sha256:hash(bytes)};}),
    componentSourceCandidates:['button/button.js','textfield/textfield.js','input/input.js','disclosure/disclosure.js'].map(relative => {
      const file=path.join(desktop,'node_modules/@heroui/react/dist/components',relative);
      try {return {file:slash(file),sha256:hash(fs.readFileSync(file)),status:'installed-source; mounted-component identity not proven'};}
      catch {return {file:slash(file),status:'unavailable'};}
    }),
    limitation:'Exact source selector text only; candidate matches never prove bundle-to-source mapping or import closure'};
}

export function proposeA04Boundaries(properties, catalog) {
  const rows = new Map();
  for (const [property,result] of Object.entries(properties)) for (const candidate of result.candidates || []) {
    for (const selector of candidate.selectors || []) {
      const key = JSON.stringify([candidate.styleSheetId,candidate.sourceURL,selector.text,candidate.layers]);
      let row = rows.get(key);
      if (!row) {
        const sources = catalog.entries.filter(entry => entry.selector === selector.text);
        row = {id:hash(key),status:'NEEDS_REVIEW',reviewed:false,selector:selector.text,
          sourceURL:candidate.sourceURL,styleSheetId:candidate.styleSheetId,layers:candidate.layers,
          specificity:selector.specificity,generatedLocations:[],properties:[],sources,
          mapping:sources.length ? 'exact-selector-text-candidates; source identity unproven' : 'unresolved-selector',
          proposedOwners:[...new Set(sources.map(source => source.suggestedOwner))],
          // Template deliberately omits owner/evidence: cannot pass judgeCssBoundary.
          reviewTemplate:{sourceURL:candidate.sourceURL,selector:selector.text,layers:candidate.layers,
            owner:null,evidence:null},
        };
        rows.set(key,row);
      }
      if (!row.properties.includes(property)) row.properties.push(property);
      row.generatedLocations.push({property,ruleIndex:candidate.ruleIndex,declarationIndex:candidate.declarationIndex,
        line:candidate.stylesheetLine,column:candidate.stylesheetColumn,
        declaration:candidate.declaration,value:candidate.value,problems:candidate.problems});
    }
  }
  return [...rows.values()];
}

function inspectTarget(element) {
  let node = element;
  const address = [];
  let unsupportedTree = element.ownerDocument.defaultView !== window.top;
  let animated = false;
  const hints = new Set();
  while (node instanceof Element) {
    unsupportedTree ||= node.getRootNode() !== document || !!node.shadowRoot || !!node.assignedSlot;
    animated ||= node.getAnimations().length > 0;
    if (node.matches('.textfield,[data-slot="textfield"],.text-field,[data-slot="text-field"],.text-field__input')) hints.add('TextField');
    if (node.matches('.disclosure,[data-slot="disclosure"],[data-slot="disclosure-trigger"]')) hints.add('Disclosure');
    if (node.matches('.button,[data-slot="button"]')) hints.add('Button');
    if (node.parentElement) address.unshift(Array.prototype.indexOf.call(node.parentElement.children,node));
    node = node.parentElement;
  }
  return {address,unsupportedTree,animated,componentHints:[...hints],
    state:{hover:element.matches(':hover'),focus:element.matches(':focus'),
      focusVisible:element.matches(':focus-visible') || element.hasAttribute('data-focus-visible'),
      active:element.matches(':active'),pressed:element.getAttribute('data-pressed') === 'true',
      disabled:element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'},
    environment:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}};
}

export async function sampleA04(realPage, locator, buildIdentity) {
  if (!buildIdentity || typeof buildIdentity !== 'object') throw new Error('Parent frozen build identity object required');
  if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('Exactly one visible real target required');
  const catalog = loadA04SourceCandidates();
  const handle = await locator.elementHandle();
  const sheets = {}, group = `a04-${Date.now()}-${Math.random()}`;
  let cdp;
  try {
    const before = await handle.evaluate(inspectTarget);
    if (before.unsupportedTree) return {status:'unsupported',reason:'top-frame-light-DOM-only',buildIdentity,reviewedBoundaries:[],boundaryCandidates:[]};
    cdp = await realPage.context().newCDPSession(realPage);
    cdp.on('CSS.styleSheetAdded',({header}) => {sheets[header.styleSheetId] = header;});
    cdp.on('CSS.styleSheetRemoved',({styleSheetId}) => {delete sheets[styleSheetId];});
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); await cdp.send('DOM.getDocument',{depth:0});
    const remote = await cdp.send('Runtime.evaluate',{objectGroup:group,expression:
      `(${function(address) {let node=document.documentElement;for(const index of address) node=node?.children[index];return node;}.toString()})(${JSON.stringify(before.address)})`});
    if (remote.exceptionDetails || !remote.result?.objectId) throw new Error('Cannot resolve selected node');
    const {nodeId} = await cdp.send('DOM.requestNode',{objectId:remote.result.objectId});
    if (!nodeId) throw new Error('No CDP node identity');
    const matched = await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
    const computed = await cdp.send('CSS.getComputedStyleForNode',{nodeId});
    const again = await cdp.send('CSS.getMatchedStylesForNode',{nodeId});
    const computedAgain = await cdp.send('CSS.getComputedStyleForNode',{nodeId});
    const after = await handle.evaluate(inspectTarget);
    const sameNode = await handle.evaluate((element,address) => {
      let node=document.documentElement;for(const index of address)node=node?.children[index];return node===element && element.isConnected;
    },before.address);
    const hazards = [];
    if (!sameNode || JSON.stringify(before)!==JSON.stringify(after) || JSON.stringify(matched)!==JSON.stringify(again) ||
        JSON.stringify(computed)!==JSON.stringify(computedAgain)) hazards.push('unstable-snapshot');
    if (before.animated || after.animated) hazards.push('target-or-ancestor-animation/transition');
    const properties = resolveCssCascade({matched,sheets,hazards});
    const values = new Map(computed.computedStyle.map(p => [p.name,p.value]));
    for (const [name,result] of Object.entries(properties)) {
      result.computed = values.get(name) ?? null;
      if (result.computed === null) {result.status='unsupported';result.reason='missing-computed-property';result.winner=null;}
      result.boundary={status:'unsupported',reason:'ownership-candidates-require-explicit-review'};
    }
    const {address,...observed} = after;
    return {schema:'ui-final-a04-adapter/v1',status:'unsupported',reason:'source-ownership-review-required',
      scope:'current real target/state; no A04/A32 pass',buildIdentity,buildIdentityVerified:false,
      observed,basis:CASCADE_BASIS,properties,
      states:Object.fromEntries(CASCADE_STATES.map(state => [state,{
        observed:checkCascadeState(state,after.state),status:'unsupported',
        reason:checkCascadeState(state,after.state) ? 'see-properties; ownership review and cascade limitations remain' : 'real-state-not-observed',
      }])),
      reviewedBoundaries:[],boundaryCandidates:proposeA04Boundaries(properties,catalog),
      sources:{files:catalog.files,errors:catalog.errors,importEvidence:catalog.importEvidence,
        componentSourceCandidates:catalog.componentSourceCandidates,limitation:catalog.limitation},
      limits:['var() blocks relevant property winner, no token-origin proof','No source maps or CSS Modules name reconstruction',
        'Pressed is observable :active/data-pressed, not TextField activation semantics',
        'Source candidates are not reviewed official component identities','No source, stylesheet or candidate truncation before resolution']};
  } catch (error) {
    return {status:'unsupported',reason:'capture-unavailable',error:String(error.message),buildIdentity,
      reviewedBoundaries:[],boundaryCandidates:[]};
  } finally {
    if (cdp) {
      await cdp.send('Runtime.releaseObjectGroup',{objectGroup:group}).catch(() => {});
      await cdp.detach().catch(() => {});
    }
    await handle?.dispose();
  }
}

async function selftest() {
  const assert = (await import('node:assert/strict')).default;
  const postcss = requireDesktop('postcss');
  const source={file:'fixture.css',identity:{byteSha256:'fixture'},suggestedOwner:'official',provenance:{kind:'fixture-only'}};
  const entries=indexCssText(postcss,'@layer components { .button, .text-field { color:var(--fg) } .disclosure { &:hover { outline-color:red } } }',source);
  assert.deepEqual(entries.slice(0,2).map(e=>e.selector),['.button','.text-field']);
  assert.deepEqual(entries[0].layers,['components']);
  assert.equal(entries.at(-1).context[0].kind,'nested-parent');
  const candidate={styleSheetId:'one',sourceURL:'file:///shared.css',selectors:[{text:'.button',specificity:{a:0,b:1,c:0}}],
    layers:['components'],stylesheetLine:1,stylesheetColumn:1,ruleIndex:0,declarationIndex:0,declaration:'color',value:'var(--fg)',problems:['dependent-or-css-wide-value']};
  const proposals=proposeA04Boundaries({color:{candidates:[candidate]}},{entries});
  assert.equal(proposals[0].reviewed,false);
  assert.equal(proposals[0].reviewTemplate.owner,null);
  assert.equal(proposals[0].sources[0].file,'fixture.css');
  assert.equal(proposeA04Boundaries({color:{candidates:[{...candidate,selectors:[{text:'.unknown'}]}]}},{entries})[0].mapping,'unresolved-selector');
  const ambiguous=proposeA04Boundaries({color:{candidates:[candidate]}},{entries:[...entries,{...entries[0],suggestedOwner:'shell'}]});
  assert.deepEqual(ambiguous[0].proposedOwners,['official','shell']);
  const noSource=proposeA04Boundaries({color:{candidates:[candidate]}},{entries:[]});
  assert.equal(noSource[0].sources.length,0); // Same bundle URL never proves official.
  const catalog=loadA04SourceCandidates();
  assert(catalog.entries.length>0);
  const oss=catalog.files.find(f=>f.relative==='heroui-pro/heroui-oss.min.css');
  assert(oss.identity.byteSha256 && oss.identity.lfSha256);
  const pro=catalog.files.find(f=>f.relative==='heroui-pro/heroui-pro.min.css');
  assert.equal(pro.suggestedOwner,'unverified');
  // Fake protocol validates adapter wiring only. No browser/runtime acceptance.
  const calls=[];
  const snapshot={address:[0],unsupportedTree:false,animated:false,componentHints:['TextField'],
    state:{hover:true,focus:false,focusVisible:false,active:false,pressed:false,disabled:false}};
  const h={evaluate:async fn=>fn.name==='inspectTarget'?snapshot:true,dispose:async()=>calls.push('dispose')};
  const handlers={};
  const cdp={on:(event,handler)=>{handlers[event]=handler;},detach:async()=>calls.push('detach'),send:async method=>{
    calls.push(method);
    if(method==='CSS.enable')handlers['CSS.styleSheetAdded']({header:{styleSheetId:'s',sourceURL:'file:///shared.css'}});
    if(method==='Runtime.evaluate')return {result:{objectId:'node'}};
    if(method==='DOM.requestNode')return {nodeId:1};
    if(method==='CSS.getMatchedStylesForNode')return {matchedCSSRules:[{matchingSelectors:[0],rule:{origin:'regular',styleSheetId:'s',
      selectorList:{selectors:[{text:'.input',specificity:{a:0,b:1,c:0}}]},style:{cssProperties:[{
        name:'color',value:'var(--fg)',range:{startLine:0,startColumn:0,endLine:0,endColumn:15}}]}}}]};
    if(method==='CSS.getComputedStyleForNode')return {computedStyle:CASCADE_PROPERTIES.map(name=>({name,value:'red'}))};
    return {};
  }};
  const sample=await sampleA04({context:()=>({newCDPSession:async()=>cdp})},
    {count:async()=>1,isVisible:async()=>true,elementHandle:async()=>h},{fixture:true});
  assert.equal(sample.status,'unsupported');
  assert.deepEqual(sample.observed.componentHints,['TextField']);
  assert.equal(sample.states.pressed.observed,false);
  assert.equal(sample.properties.color.winner,null);
  assert.match(sample.properties.color.reason,/dependent-or-css-wide-value/);
  assert.deepEqual(sample.reviewedBoundaries,[]);
  assert(sample.boundaryCandidates.some(row=>row.selector==='.input'));
  assert.deepEqual(calls.slice(-3),['Runtime.releaseObjectGroup','detach','dispose']);
  console.log(JSON.stringify({offlineOnly:true,passed:20,indexedFiles:catalog.files.length,indexedSelectors:catalog.entries.length,
    catalogErrors:catalog.errors,ossProvenance:oss.provenance,proProvenance:pro.provenance,
    noBrowserOrBuildStarted:true}));
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).join(' ')!=='--selftest') throw new Error('Import sampleA04(page,locator,buildIdentity); CLI supports --selftest only');
  await selftest();
}
