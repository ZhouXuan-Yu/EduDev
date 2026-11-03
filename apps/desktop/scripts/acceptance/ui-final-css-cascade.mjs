/**
 * A04 preparation helper. Import only: never launches Electron, builds, writes files,
 * loads models, changes CSS/attributes, forces pseudo states, or imports Playwright.
 * Parent supplies an existing Electron Playwright Page, an exact Locator, build
 * identity, official component provenance, and reviewed CSS ownership boundaries.
 *
 * Usage (after parent's unified freeze, while the real state is held):
 *   const probe = await captureCssCascade(page, button, {
 *     state: 'pressed', component: 'Button', officialEvidence: 'source path + import',
 *     build: frozenBuildIdentity, boundaries: reviewedBoundaries,
 *   });
 * Each boundary is {owner:'official'|'shell', sourceURL: exactGeneratedCssURL,
 *   selector: exactMatchedSelector, layers: [...], evidence: '...'}.
 * layers uses CDP order (innermost first), with [] for an unlayered rule.
 * Bundle URL alone never establishes ownership. Inline styles and UA rules cannot
 * pass this boundary check. Shell winners on these internal visual properties FAIL.
 *
 * Scope: top document, light DOM; direct normal declarations; literal longhands,
 * or browser-provided longhandProperties of a shorthand. CDP normal cascade order
 * (not computed-value similarity) determines precedence, including normal layers.
 * This is a deliberately restricted implementation of DevTools' normal cascade
 * path, NOT the full DevTools parser and NOT a CDP-reported winner API.
 * Basis checked 2026-11-04: ChromeDevTools CSSMatchedStyles.buildMainCascade and
 * NodeCascade.computeActiveProperties/updatePropertyState (normal, light-DOM path):
 * https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/CSSMatchedStyles.ts
 * Protocol metadata:
 * https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getMatchedStylesForNode
 *
 * Unsupported: inherited/default-only sources, !important (any contender), var/env/
 * attr/currentColor/CSS-wide values, all, logical border aliases, nested selectors,
 * scope/container/support/media/starting-style/navigation conditions, shadow/slot trees, animations including
 * ancestor animations, unstable snapshots, missing source/range/specificity, and
 * shorthand expansion absent from CDP. Pseudo-elements and custom-property origins
 * are not evaluated. Source lines refer to generated stylesheet, not source maps.
 * No overall A04/A32 pass: state distinguishability, global !important/vendor diff,
 * native app identity, and all remaining surfaces belong to the parent's evidence.
 */
export const CASCADE_PROPERTIES = Object.freeze([
  'color', 'background-color', 'border-top-color', 'border-top-width',
  'border-top-style', 'outline-color', 'outline-width', 'outline-style',
  'outline-offset', 'font-family', 'font-size', 'font-weight', 'line-height',
]);
export const CASCADE_STATES = Object.freeze(['hover', 'focus', 'pressed', 'disabled']);
export const CASCADE_BASIS = Object.freeze({
  method: 'restricted-devtools-normal-cascade',
  source: 'https://github.com/ChromeDevTools/devtools-frontend/blob/main/front_end/core/sdk/CSSMatchedStyles.ts',
  checked: '2026-11-04',
  order: 'CDP matchedCSSRules low-to-high; inline after rules; declaration source order',
  computedUsedToSelectWinner: false,
});
const uncertainValue = /\b(?:var|env|attr)\s*\(|\b(?:inherit|initial|unset|revert(?:-layer|-rule)?|currentcolor)\b/i;
// Preserve exact protocol identity. Parent owns final-report URL redaction.
const cleanURL = value => String(value || '');
const unsupported = (reason, candidates = []) => ({status:'unsupported', reason, winner:null, candidates});
const active = p => !p.disabled && p.parsedOk !== false;
const overlaps = (name, property) => name === property || name === 'all' ||
  (name === 'background' && property === 'background-color') ||
  (name === 'font' && (property.startsWith('font-') || property === 'line-height')) ||
  (name === 'outline' && /^outline-(?:color|width|style)$/.test(property)) ||
  (property.startsWith('border-top-') && (name === 'border' || name === 'border-top' ||
    name === `border-${property.slice('border-top-'.length)}` || /^border-(?:block|inline)/.test(name) ||
    /^-\w+-border/.test(name)));

function candidatesFor(matched, property, sheets) {
  const result = [];
  const add = (style, rule, matchingSelectors = [], ruleIndex = null) => {
    for (const [declarationIndex, declaration] of (style?.cssProperties || []).entries()) {
      if (!active(declaration)) continue;
      // Match DevTools' exclusion of synthetic computed longhands in ranged styles.
      if (style.range && !declaration.range) continue;
      if (!overlaps(declaration.name, property)) continue;
      // Physical border sides cannot affect each other; logical aliases need context.
      if (/^border-(?:bottom|left|right)-/.test(declaration.name)) continue;
      const expansion = declaration.name === property ? declaration :
        declaration.longhandProperties?.find(item => item.name === property);
      if (declaration.name !== property && declaration.longhandProperties && !expansion &&
          !/^border-(?:block|inline)/.test(declaration.name) && declaration.name !== 'all') continue;
      const id = rule?.styleSheetId || style.styleSheetId;
      const header = sheets[id];
      const selectors = matchingSelectors.map(index => rule.selectorList?.selectors?.[index]);
      const range = declaration.range;
      const candidate = {
        ruleIndex, declarationIndex, declaration:declaration.name,
        value:expansion?.value ?? declaration.value, important:!!declaration.important,
        selectors:rule ? selectors.map(s => ({text:s?.text ?? null, specificity:s?.specificity ?? null})) : [],
        inline:!rule, origin:rule?.origin ?? 'inline', styleSheetId:id ?? null,
        sourceURL:cleanURL(header?.sourceURL), stylesheetLine:range ? range.startLine + 1 : null,
        stylesheetColumn:range ? range.startColumn + 1 : null,
        // For an inline <style> only, header offsets locate its source document.
        documentLine:header?.isInline && range ? header.startLine + range.startLine + 1 : null,
        range:range ?? null, layers:(rule?.layers || []).map(layer => layer.text),
        layerRanges:(rule?.layers || []).map(layer => layer.range ?? null),
        problems:[],
      };
      if (candidate.important) candidate.problems.push('important-cascade-not-implemented');
      if (declaration.name === 'all') candidate.problems.push('all-reset');
      if (/^(?:border-(?:block|inline)|-\w+-border)/.test(declaration.name)) candidate.problems.push('logical-or-prefixed-border-alias');
      if (!expansion) candidate.problems.push('missing-browser-longhand-expansion');
      if (uncertainValue.test(candidate.value) || uncertainValue.test(declaration.value)) candidate.problems.push('dependent-or-css-wide-value');
      if (rule && !['regular', 'user-agent'].includes(rule.origin)) candidate.problems.push('unknown-or-injected-origin');
      if (rule && (['media','supports','containerQueries','scopes','nestingSelectors','startingStyles','navigations'].some(key => rule[key]?.length) ||
          rule.ruleTypes?.some(type => type !== 'LayerRule'))) candidate.problems.push('conditional-or-nested-rule');
      if (rule?.ruleTypes?.includes('LayerRule') && !rule.layers?.length) candidate.problems.push('missing-layer-metadata');
      if (rule && (!selectors.length || selectors.some(s => !s?.text || !s.specificity ||
          !['a','b','c'].every(k => Number.isInteger(s.specificity[k]))))) candidate.problems.push('missing-selector-specificity');
      if (rule && (!header || !candidate.sourceURL || !range)) candidate.problems.push('missing-source-location');
      if ((rule?.layers || []).some(layer => !layer.text)) candidate.problems.push('anonymous-layer');
      result.push(candidate);
    }
  };
  (matched.matchedCSSRules || []).forEach(({rule, matchingSelectors}, index) => add(rule.style, rule, matchingSelectors, index));
  if (matched.inlineStyle) add(matched.inlineStyle);
  return result;
}

/** Pure offline resolver; accepts FULL, untruncated CDP matched payloads only.
 * Never supply captureStyleProbe's bounded candidate summary here.
 */
export function resolveCssCascade({matched, sheets = {}, hazards = [], properties = CASCADE_PROPERTIES}) {
  return Object.fromEntries(properties.map(property => {
    if (!CASCADE_PROPERTIES.includes(property)) return [property, unsupported('property-outside-supported-scope')];
    if (!matched || !Array.isArray(matched.matchedCSSRules)) return [property, unsupported('missing-full-CDP-payload')];
    const candidates = candidatesFor(matched, property, sheets);
    const problems = [...hazards, ...candidates.flatMap(c => c.problems)];
    if (matched.attributesStyle?.cssProperties?.some(p => active(p) && overlaps(p.name, property))) problems.push('presentational-attribute');
    if (problems.length) return [property, unsupported([...new Set(problems)].join(';'), candidates)];
    if (!candidates.length) return [property, unsupported('no-direct-declaration; inheritance/default not resolved', candidates)];
    // Rules arrive low-to-high for normal declarations. Inline is appended last.
    // No value matching, selector regex specificity arithmetic, or source URL order.
    const winning = candidates.at(-1);
    if (winning.inline) return [property, unsupported('inline-source-selector-unavailable', candidates)];
    // Report all equally most-specific matching selectors of the winning rule.
    const compare = (a,b) => a.a-b.a || a.b-b.b || a.c-b.c;
    const highest = winning.selectors.reduce((a,b) => compare(a.specificity,b.specificity) >= 0 ? a : b);
    const winner = {...winning, selectors:winning.selectors.filter(s => compare(s.specificity,highest.specificity) === 0)};
    return [property, {status:'supported', winner, candidates, proof:CASCADE_BASIS.method}];
  }));
}

/** Explicit ownership manifest, not a filename heuristic. Each tied selector must
 * have exactly one reviewed owner. A shell visual winner is a boundary violation.
 */
export function judgeCssBoundary(resolution, boundaries = []) {
  if (resolution.status !== 'supported') return {status:'unsupported', reason:resolution.reason};
  const owners = resolution.winner.selectors.map(selector => boundaries.filter(b =>
    ['official','shell'].includes(b.owner) && b.evidence?.trim() &&
    b.sourceURL === resolution.winner.sourceURL && b.selector === selector.text &&
    JSON.stringify(b.layers) === JSON.stringify(resolution.winner.layers)));
  if (owners.some(items => items.length !== 1)) return {status:'unsupported', reason:'missing-or-ambiguous-reviewed-boundary'};
  const labels = owners.map(items => items[0].owner);
  if (labels.includes('shell')) return {status:'FAIL', reason:'application-shell-wins-component-internal-visual-property'};
  return {status:'PASS', scope:'this literal property declaration only; no token/inheritance or overall A04 claim'};
}

export function checkCascadeState(state, observed) {
  if (!CASCADE_STATES.includes(state)) return false;
  if (state === 'disabled') return observed.disabled;
  if (observed.disabled) return false;
  if (state === 'focus') return observed.focus && observed.focusVisible;
  if (state === 'pressed') return observed.active || observed.pressed;
  return observed.hover;
}

function inspectElement(element) {
  const address = [];
  let shadow = false, animated = false;
  for (let node = element; node instanceof Element; node = node.parentElement) {
    shadow ||= node.getRootNode() !== document || !!node.shadowRoot || !!node.assignedSlot;
    animated ||= node.getAnimations().length > 0;
    if (node.parentElement) address.unshift(Array.prototype.indexOf.call(node.parentElement.children, node));
  }
  if (element.ownerDocument.defaultView !== window.top || element.getRootNode() !== document) shadow = true;
  return {address, shadow, animated, tag:element.tagName,
    slot:element.getAttribute('data-slot'),
    state:{hover:element.matches(':hover'), focus:element.matches(':focus'),
      focusVisible:element.matches(':focus-visible') || element.hasAttribute('data-focus-visible'),
      active:element.matches(':active'), pressed:element.getAttribute('data-pressed') === 'true',
      disabled:element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'},
    environment:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches},
  };
}

export async function captureCssCascade(page, locator, options = {}) {
  const {state, component, officialEvidence, build = null, boundaries = []} = options;
  if (!CASCADE_STATES.includes(state)) throw new Error('state must be hover/focus/pressed/disabled');
  if (!['Button','Disclosure'].includes(component) || !officialEvidence?.trim()) throw new Error('Explicit official Button/Disclosure source provenance required');
  if (await locator.count() !== 1 || !await locator.isVisible()) throw new Error('Exactly one visible target required');
  const handle = await locator.elementHandle();
  let cdp;
  const sheets = {}, group = `ui-final-cascade-${Date.now()}-${Math.random()}`;
  try {
    const before = await handle.evaluate(inspectElement);
    if (before.shadow) return {status:'unsupported', state, component, reason:'only-top-frame-light-DOM-supported', properties:{}};
    cdp = await page.context().newCDPSession(page);
    cdp.on('CSS.styleSheetAdded', ({header}) => {sheets[header.styleSheetId] = header;});
    cdp.on('CSS.styleSheetRemoved', ({styleSheetId}) => {delete sheets[styleSheetId];});
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    await cdp.send('DOM.getDocument', {depth:0});
    const expression = `(${function(address) {
      let node = document.documentElement;
      for (const index of address) node = node?.children[index];
      return node;
    }.toString()})(${JSON.stringify(before.address)})`;
    const remote = await cdp.send('Runtime.evaluate', {expression, objectGroup:group});
    if (remote.exceptionDetails || !remote.result?.objectId) throw new Error('Cannot resolve selected target in CDP');
    const {nodeId} = await cdp.send('DOM.requestNode', {objectId:remote.result.objectId});
    if (!nodeId) throw new Error('Selected node absent from CDP');
    const matched = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
    const computed = await cdp.send('CSS.getComputedStyleForNode', {nodeId});
    const again = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
    const computedAgain = await cdp.send('CSS.getComputedStyleForNode', {nodeId});
    const after = await handle.evaluate(inspectElement);
    const sameNode = await handle.evaluate((element, address) => {
      let node = document.documentElement;
      for (const index of address) node = node?.children[index];
      return node === element && element.isConnected;
    }, before.address);
    const hazards = [];
    if (!sameNode || JSON.stringify(before) !== JSON.stringify(after) ||
        JSON.stringify(matched) !== JSON.stringify(again) || JSON.stringify(computed) !== JSON.stringify(computedAgain)) hazards.push('unstable-snapshot');
    if (before.animated || after.animated) hazards.push('target-or-ancestor-animation/transition');
    if (!checkCascadeState(state, before.state) || !checkCascadeState(state, after.state)) hazards.push('requested-real-state-not-observed');
    const properties = resolveCssCascade({matched, sheets, hazards});
    const values = new Map(computed.computedStyle.map(p => [p.name,p.value]));
    for (const [name, result] of Object.entries(properties)) {
      result.computed = values.get(name) ?? null;
      if (result.computed === null) Object.assign(result, unsupported('missing-computed-property',result.candidates));
      result.boundary = judgeCssBoundary(result, boundaries);
    }
    const statuses = Object.values(properties).map(p => p.boundary.status);
    return {schema:'ui-final-css-cascade/v1', state, component, officialEvidence, build,
      status:statuses.includes('FAIL') ? 'FAIL' : statuses.includes('unsupported') ? 'unsupported' : 'PASS',
      scope:'sampled properties and current real state only; not A04/A32 completion',
      basis:CASCADE_BASIS, observed:after, properties,
      evidence:{fullPayloadUsed:true, candidateListsTruncated:false, sourceMapsResolved:false,
        inheritedEntriesObserved:matched.inherited?.length ?? 0,
        pseudoElementsExcluded:matched.pseudoElements?.length ?? 0},
    };
  } catch (error) {
    // Protocol gaps must never silently downgrade to a guessed winner.
    return {status:'unsupported', state, component, build, reason:'CDP-capture-unavailable',
      error:String(error.message), properties:{}};
  } finally {
    if (cdp) {
      await cdp.send('Runtime.releaseObjectGroup', {objectGroup:group}).catch(() => {});
      await cdp.detach().catch(() => {});
    }
    await handle?.dispose();
  }
}

/** Parent controls actual interactions. enter/leave may hold/release a mouse or
 * Space key, or choose an already disabled official control; helper never clicks.
 * Each entry: {state, locator, enter?: async()=>{}, leave?: async()=>{}}.
 * Missing states are explicit unsupported records, never N/A or PASS.
 */
export async function captureCssCascadeStates(page, entries, options) {
  const samples = [];
  for (const state of CASCADE_STATES) {
    const matches = entries.filter(entry => entry.state === state);
    if (matches.length !== 1) {
      samples.push({state,status:'unsupported',reason:'exactly-one-state-entry-required'}); continue;
    }
    const entry = matches[0];
    try {
      await entry.enter?.();
      samples.push(await captureCssCascade(page, entry.locator, {...options,state}));
    } finally {await entry.leave?.();}
  }
  return {scope:'one official component; four sampled states', samples,
    status:samples.some(p => p.status === 'FAIL') ? 'FAIL' : samples.some(p => p.status !== 'PASS') ? 'unsupported' : 'PASS'};
}
