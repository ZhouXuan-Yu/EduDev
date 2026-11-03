/** Offline preparation ONLY: node --test scripts/acceptance/ui-final-css-cascade-selftest.mjs
 * Synthetic protocol fixtures validate fail-closed parsing and resource cleanup.
 * No Electron/Playwright import, application, build, model, network, or filesystem writes.
 * These tests do NOT certify browser/CDP behavior, component provenance, A04 or A32.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {CASCADE_PROPERTIES, resolveCssCascade, judgeCssBoundary, checkCascadeState,
  captureCssCascade, captureCssCascadeStates} from './ui-final-css-cascade.mjs';

const range = {startLine:12,startColumn:2,endLine:12,endColumn:20};
const sheet = {sourceURL:'file:///frozen/assets/app.css', startLine:0, isInline:false};
const sheets = {s:sheet};
const prop = (value = 'red', more = {}) => ({name:'color',value,range:{...range},...more});
const rule = (selector, declarations, extra = {}) => ({
  matchingSelectors:[0], rule:{origin:'regular',styleSheetId:'s',
    selectorList:{selectors:[{text:selector,specificity:{a:0,b:1,c:0}}]},
    style:{styleSheetId:'s',range:{...range},cssProperties:declarations}, ...extra},
});
const resolve = (rules, more = {}) => resolveCssCascade({
  matched:{matchedCSSRules:rules}, sheets, properties:['color'], ...more,
}).color;
const boundary = (owner, selector = '.official') => ({owner,selector,
  sourceURL:sheet.sourceURL,layers:[],evidence:'reviewed frozen component import and CSS source'});

test('normal CDP order determines winning rule even when values are identical', () => {
  const result = resolve([rule('.shell',[prop()]),rule('.official',[prop()])]);
  assert.equal(result.status,'supported');
  assert.equal(result.winner.selectors[0].text,'.official');
  assert.equal(result.winner.stylesheetLine,13);
  assert.equal(result.winner.stylesheetColumn,3);
  assert.equal(result.winner.ruleIndex,1);
  assert.equal(result.proof,'restricted-devtools-normal-cascade');
  assert.equal(judgeCssBoundary(result,[boundary('official')]).status,'PASS');
});
test('shell visual winner fails; URL alone and mixed/duplicate ownership cannot pass', () => {
  const result = resolve([rule('.official',[prop()]),rule('.shell',[prop('blue')])]);
  assert.equal(judgeCssBoundary(result,[boundary('shell','.shell')]).status,'FAIL');
  assert.equal(judgeCssBoundary(result,[{owner:'official',sourceURL:sheet.sourceURL}]).status,'unsupported');
  assert.equal(judgeCssBoundary(result,[boundary('shell','.shell'),boundary('official','.shell')]).status,'unsupported');
});
test('declaration source order; disabled and invalid declarations excluded', () => {
  const result = resolve([rule('.official',[prop(),prop('blue'),prop('green',{disabled:true}),prop('oops',{parsedOk:false})])]);
  assert.equal(result.winner.value,'blue');
  assert.equal(result.winner.declarationIndex,1);
});
test('CDP layer order retained without inventing layer ranking', () => {
  const result = resolve([rule('.official',[prop()],{layers:[{text:'components',range}]})]);
  assert.deepEqual(result.winner.layers,['components']);
  assert.equal(judgeCssBoundary(result,[{...boundary('official'),layers:['components']}]).status,'PASS');
  assert.equal(judgeCssBoundary(result,[boundary('official')]).status,'unsupported');
});
test('specificity comes from protocol and all equally strongest selectors retained', () => {
  const result = resolve([rule('.unused',[prop()],{
    selectorList:{selectors:[{text:'button',specificity:{a:0,b:0,c:1}},
      {text:'.official',specificity:{a:0,b:1,c:0}}, {text:'.tied',specificity:{a:0,b:1,c:0}}]},
  })].map(r => ({...r,matchingSelectors:[0,1,2]})));
  assert.deepEqual(result.winner.selectors.map(s => s.text),['.official','.tied']);
  assert.equal(judgeCssBoundary(result,[boundary('official')]).status,'unsupported');
  assert.equal(judgeCssBoundary(result,[boundary('official'),boundary('shell','.tied')]).status,'FAIL');
});
for (const [label, declaration] of [
  ['important contender',prop('red',{important:true})],
  ['custom property',prop('var(--official-color)')], ['fallback var',prop('var(--x, red)')],
  ['currentColor',prop('currentColor')], ['revert layer',prop('revert-layer')],
  ['inherit',prop('inherit')], ['all',prop('unset',{name:'all'})],
]) test(`${label} must have no winner even under a later literal declaration`, () => {
  const result = resolve([rule('.first',[declaration]),rule('.official',[prop('blue')])]);
  assert.equal(result.status,'unsupported'); assert.equal(result.winner,null);
});
for (const extra of [{scopes:[{text:'.scope'}]}, {media:[{text:'screen'}]},
  {supports:[{text:'display: grid',active:true}]}, {containerQueries:[{text:'wide'}]},
  {nestingSelectors:['.parent']}, {origin:'injected'}, {layers:[{text:''}]},
  {startingStyles:[{active:false}]}, {navigations:[{active:true}]},
  {ruleTypes:['StartingStyleRule']}, {ruleTypes:['LayerRule']},
  {selectorList:{selectors:[{text:'.official'}]}},
]) test(`unsupported rule metadata ${Object.keys(extra)[0]}`, () => {
  assert.equal(resolve([rule('.official',[prop()],extra)]).status,'unsupported');
});
test('missing source metadata does not fabricate URL, line or specificity', () => {
  assert.equal(resolve([rule('.official',[prop()])],{sheets:{}}).status,'unsupported');
  const noRange = prop(); delete noRange.range;
  assert.equal(resolve([rule('.official',[noRange])]).status,'unsupported');
});
test('inheritance/default-only does not report a local winner', () => {
  assert.equal(resolve([],{matched:{matchedCSSRules:[],inherited:[{matchedCSSRules:[rule('html',[prop()])]}]}}).status,'unsupported');
});
test('browser longhand expansion supported; absent shorthand expansion rejected', () => {
  const matched = {matchedCSSRules:[rule('.official',[
    prop('red',{name:'background',longhandProperties:[{name:'background-color',value:'red'}]}),
  ])]};
  const expanded = resolveCssCascade({matched,sheets,properties:['background-color']});
  assert.equal(expanded['background-color'].winner.declaration,'background');
  delete matched.matchedCSSRules[0].rule.style.cssProperties[0].longhandProperties;
  assert.equal(resolveCssCascade({matched,sheets,properties:['background-color']})['background-color'].status,'unsupported');
});
test('logical border aliases fail closed', () => {
  const matched = {matchedCSSRules:[rule('.official',[prop('red',{name:'border-inline-color'})])]};
  assert.equal(resolveCssCascade({matched,sheets,properties:['border-top-color']})['border-top-color'].status,'unsupported');
});
test('independent physical border longhands do not compete', () => {
  const matched = {matchedCSSRules:[rule('.official',[
    prop('red',{name:'border-top-color'}),prop('solid',{name:'border-top-style'}),
    prop('blue',{name:'border-bottom-color'}),prop('4px',{name:'border-radius'}),
  ])]};
  const result = resolveCssCascade({matched,sheets,properties:['border-top-color']})['border-top-color'];
  assert.equal(result.status,'supported');
  assert.equal(result.candidates.length,1);
  matched.matchedCSSRules[0].rule.style.cssProperties.push(prop('green',{name:'-webkit-border-before-color'}));
  assert.equal(resolveCssCascade({matched,sheets,properties:['border-top-color']})['border-top-color'].status,'unsupported');
});
test('inline winner and presentational attributes cannot masquerade as official rule', () => {
  assert.equal(resolve([],{matched:{matchedCSSRules:[],inlineStyle:{cssProperties:[prop()]}}}).status,'unsupported');
  assert.equal(resolve([rule('.official',[prop()])],{matched:{matchedCSSRules:[rule('.official',[prop()])],attributesStyle:{cssProperties:[prop()]}}}).status,'unsupported');
});
test('hazards and unapproved properties fail closed', () => {
  assert.equal(resolve([rule('.official',[prop()])],{hazards:['unstable-snapshot']}).status,'unsupported');
  assert.equal(resolveCssCascade({matched:{matchedCSSRules:[]},properties:['opacity']}).opacity.status,'unsupported');
});
test('no acceptance-affecting truncation, even beyond previous probe limits', () => {
  const rules = Array.from({length:100},(_,i) => rule(`.r${i}`,[prop('red')]));
  const result = resolve(rules);
  assert.equal(result.candidates.length,100);
  assert.equal(result.winner.selectors[0].text,'.r99');
});
test('focus requires observed focus-visible; labels alone cannot prove states', () => {
  assert.equal(checkCascadeState('focus',{focus:true,focusVisible:false}),false);
  assert.equal(checkCascadeState('focus',{focus:true,focusVisible:true}),true);
  assert.equal(checkCascadeState('pressed',{active:true,disabled:true}),false);
  assert.equal(checkCascadeState('disabled',{disabled:true}),true);
  assert.equal(checkCascadeState('hover',{hover:false}),false);
});
test('missing four-state entries remain unsupported; import/runner does not launch anything', async () => {
  const result = await captureCssCascadeStates(null,[],{});
  assert.equal(result.status,'unsupported');
  assert.equal(result.samples.length,4);
});

// Deliberate protocol fake: exercise only API wiring, stable/unstable guards,
// unsupported protocol handling, and cleanup, never described as live evidence.
function fakeCapture({protocolError = false, changed = false} = {}) {
  const calls = [], handlers = {};
  const observed = {address:[0],shadow:false,animated:false,state:{hover:true}};
  const handle = {evaluate:async (fn) => fn.name === 'inspectElement' ? observed : true,
    dispose:async () => calls.push('dispose')};
  let computedCalls = 0;
  const session = {on:(event, callback) => {handlers[event] = callback;},
    detach:async () => calls.push('detach'), send:async method => {
      calls.push(method);
      if (method === 'CSS.enable') handlers['CSS.styleSheetAdded']({header:{...sheet,styleSheetId:'s'}});
      if (method === 'Runtime.evaluate') return {result:{objectId:'node'}};
      if (method === 'DOM.requestNode') return {nodeId:1};
      if (method === 'CSS.getMatchedStylesForNode') {
        if (protocolError) throw new Error('Unsupported CDP method');
        return {matchedCSSRules:[rule('.official',CASCADE_PROPERTIES.map(name => prop('red',{name})))]};
      }
      if (method === 'CSS.getComputedStyleForNode') {
        const value = changed && computedCalls++ ? 'blue' : 'red';
        return {computedStyle:CASCADE_PROPERTIES.map(name => ({name,value}))};
      }
      return {};
    }};
  return {calls,page:{context:() => ({newCDPSession:async () => session})},
    locator:{count:async () => 1,isVisible:async () => true,elementHandle:async () => handle}};
}
test('CDP capture cleans up and exports actual protocol winner metadata', async () => {
  const fake = fakeCapture();
  const result = await captureCssCascade(fake.page,fake.locator,{state:'hover',component:'Button',
    officialEvidence:'fixture only',boundaries:[boundary('official')]});
  assert.equal(result.status,'PASS');
  assert.equal(result.properties.color.computed,'red');
  assert.equal(result.properties.color.winner.sourceURL,sheet.sourceURL);
  assert.deepEqual(fake.calls.slice(-3),['Runtime.releaseObjectGroup','detach','dispose']);
});
test('CDP errors and instability never return a guessed winner', async () => {
  for (const options of [{protocolError:true},{changed:true}]) {
    const fake = fakeCapture(options);
    const result = await captureCssCascade(fake.page,fake.locator,{state:'hover',component:'Disclosure',officialEvidence:'fixture only'});
    assert.equal(result.status,'unsupported');
    assert(!result.properties.color?.winner);
    assert.deepEqual(fake.calls.slice(-3),['Runtime.releaseObjectGroup','detach','dispose']);
  }
});
