/** Read-only access to the DevTools SDK bundled with the tested Electron binary.
 * The browser's SDK selects Active properties. This module does not rank CSS,
 * force pseudo states, modify declarations, or infer winners from computed values.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCssomCollector, inspectCssomElement, PROPERTIES} from './ui-final-cssom.mjs';
import {mapEmbeddedCss} from './ui-final-css-source.mjs';

// Serialized into the owned DevTools frontend. Only documented/read-only SDK APIs.
export async function readDevtoolsCascade({selector, properties, documentURL}) {
  const SDK = await import(new URL('./core/sdk/sdk.js', location.href).href);
  const target = SDK.TargetManager.TargetManager.instance().primaryPageTarget();
  if (!target) throw Error('DEVTOOLS_PRIMARY_TARGET_MISSING');
  const dom = target.model(SDK.DOMModel.DOMModel);
  const css = target.model(SDK.CSSModel.CSSModel);
  const root = await dom.requestDocument();
  const id = await dom.querySelector(root.id, selector);
  const node = dom.nodeForId(id);
  if (!node || node.ownerDocument.documentURL !== documentURL) throw Error('DEVTOOLS_TARGET_CHANGED');
  // Pointer, focus and React attributes change between samples. Never reuse a
  // previous matched cascade, even when the DOMNode identity is unchanged.
  css.discardCachedMatchedCascade();
  const matched = await css.cachedMatchedCascadeForNode(node);
  if (!matched) throw Error('DEVTOOLS_CASCADE_MISSING');
  const styles = matched.nodeStyles();
  const all = styles.flatMap(style => style.allProperties());
  const describe = property => {
    if (!property) return null;
    const style = property.ownerStyle;
    const shorthand = !property.range && !property.value
      ? style.allProperties().find(p => p.getLonghandProperties().includes(property)) : null;
    const source = shorthand ?? property;
    const rule = style.parentRule;
    return {
      name: property.name, value: property.value, state: matched.propertyState(property),
      inherited: matched.isInherited(style), important: property.important,
      sourceName: source.name, sourceValue: source.value, text: source.text ?? null,
      selector: rule?.selectorText?.() ?? null, nestingSelectors: rule?.nestingSelectors ?? [],
      origin: rule?.origin ?? style.type, url: rule?.resourceURL() ?? null,
      styleSheetId: style.styleSheetId ?? null, range: source.range ?? style.range ?? null,
      layers: (rule?.layers ?? []).map(layer => ({text: layer.text, range: layer.range})),
      overriddenByAnimation: matched.isPropertyOverriddenByAnimation(property),
    };
  };
  const variables = (style, value, seen = new Set()) => {
    const references = [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
    return [...new Set(references)].map(name => {
      if (seen.has(name)) return {name, status: 'cycle'};
      const resolved = matched.computeCSSVariable(style, name);
      if (!resolved) return {name, status: 'unavailable-or-fallback'};
      const source = resolved.declaration;
      const next = new Set(seen).add(name);
      const registeredStyle = source.declaration.ownerStyle ? null : source.style;
      const registeredRule = registeredStyle?.parentRule;
      return {
        name, status: 'resolved', value: resolved.value,
        declaration: source.declaration.ownerStyle ? describe(source.declaration) : {
          name: source.name, value: source.value, kind: 'registered-property',
          sourceName: source.name, sourceValue: source.value,
          origin: registeredRule?.origin ?? null, url: registeredRule?.resourceURL() ?? null,
          range: registeredStyle.range, styleSheetId: registeredStyle.styleSheetId,
        },
        references: variables(source.style, source.value ?? '', next),
      };
    });
  };
  const result = {};
  for (const name of properties) {
    const candidates = all.filter(p => p.name === name);
    const active = candidates.filter(p => matched.propertyState(p) === 'Active');
    const winner = active.length === 1 ? active[0] : null;
    const declared = winner ? describe(winner) : null;
    result[name] = {
      status: active.length > 1 ? 'unresolved' : winner ? 'active-declaration' : 'no-active-declaration',
      // A property with no active declaration has no winning author selector.
      // Its actual initial/currentColor value remains in the CDP computed record.
      winner: declared, candidates: candidates.map(describe),
      variables: winner ? variables(winner.ownerStyle, declared.sourceValue) : [],
    };
  }
  return {
    properties: result, documentURL, nodeId: id,
    method: 'Bundled DevTools CSSMatchedStyles.propertyState',
    sdkFunctions: {
      propertyState: matched.propertyState.toString(),
      discardCachedMatchedCascade: css.discardCachedMatchedCascade.toString(),
      computeCSSVariable: matched.computeCSSVariable.toString(),
    },
  };
}

export function validateDevtoolsSample(sample, evidence) {
  assert.deepEqual(Object.keys(evidence.properties).sort(), [...PROPERTIES].sort());
  for (const name of PROPERTIES) {
    const property = evidence.properties[name];
    assert.notEqual(property.status, 'unresolved', 'Ambiguous SDK active properties: ' + name);
    const active = property.candidates.filter(p => p.state === 'Active');
    assert.equal(active.length, property.winner ? 1 : 0);
    if (property.winner) {
      assert.deepEqual(active[0], property.winner);
      assert.equal(property.winner.overriddenByAnimation, false);
      if (property.winner.origin === 'regular') {
        assert(property.winner.url && property.winner.range, 'Missing actual generated source location');
      }
    }
    assert.equal(typeof sample.before.computed[name], 'string');
  }
  assert.deepEqual(sample.hazards, [], 'Unstable or unsupported native sample');
}

/** Open only this test window's local DevTools. Keep product and tool errors
 * separate while preserving the original early guard's unmodified total.
 */
export async function createDevtoolsCascadeCollector(app, page, {buildRoot, sourceRoot}) {
  const cssSources = ['heroui-pro/heroui-oss.min.css', 'heroui-pro/heroui-pro.min.css'].map(file => ({
    file: 'src/renderer/' + file, text: fs.readFileSync(path.join(sourceRoot, file), 'utf8'),
  }));
  const generated = new Map();
  const originalSource = declaration => {
    if (!declaration?.url || !declaration.range) return;
    const file = fs.realpathSync(fileURLToPath(declaration.url));
    const relative = path.relative(buildRoot, file);
    assert(relative && !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
    assert.equal(path.extname(file), '.css');
    if (!generated.has(file)) generated.set(file, fs.readFileSync(file, 'utf8'));
    declaration.originalSource = mapEmbeddedCss(generated.get(file), declaration.range, cssSources);
  };
  const sourceVariables = references => {
    for (const reference of references) {
      originalSource(reference.declaration);
      sourceVariables(reference.references ?? []);
    }
  };
  const collector = await createCssomCollector(page);
  const id = await app.evaluate(async ({BrowserWindow}) => {
    const windows = BrowserWindow.getAllWindows().filter(w => !w.webContents.getURL().startsWith('devtools:'));
    if (windows.length !== 1) throw Error('EXACT_OWNED_WINDOW_REQUIRED');
    const wc = windows[0].webContents;
    globalThis.__uiFinalDevtoolsErrors = [];
    const capture = (contents, scope) => contents.on('console-message', details => {
      if (details.level === 'error') globalThis.__uiFinalDevtoolsErrors.push({
        webContentsId: contents.id, scope,
        source: details.sourceId, message: details.message,
      });
    });
    capture(wc, 'product');
    const opened = new Promise(resolve => wc.once('devtools-opened', resolve));
    wc.once('devtools-opened', () => capture(wc.devToolsWebContents, 'devtools'));
    wc.openDevTools({mode: 'detach', activate: false});
    await opened;
    return wc.id;
  });
  return {
    async capture(locator, state) {
      const sample = await collector.capture(locator, state);
      const selector = 'html' + sample.before.address.map(index => ` > :nth-child(${index + 1})`).join('');
      const expression = `(${readDevtoolsCascade.toString()})(${JSON.stringify({selector, properties: PROPERTIES, documentURL: page.url()})})`;
      const native = await app.evaluate(async ({webContents}, {id, expression}) => {
        const wc = webContents.fromId(id);
        if (!wc?.isDevToolsOpened()) throw Error('OWNED_DEVTOOLS_CLOSED');
        return wc.devToolsWebContents.executeJavaScript(expression);
      }, {id, expression});
      const after = await locator.evaluate(inspectCssomElement);
      assert.deepEqual(after, sample.after, 'State or style changed during native SDK read');
      validateDevtoolsSample(sample, native);
      for (const property of Object.values(native.properties)) {
        originalSource(property.winner);
        sourceVariables(property.variables);
      }
      sample.raw.devtools = native;
      for (const name of PROPERTIES) sample.properties[name] = {
        ...native.properties[name], computed: sample.before.computed[name],
      };
      return sample;
    },
    async diagnostics() {
      return app.evaluate(() => globalThis.__uiFinalDevtoolsErrors);
    },
    async close() {
      await app.evaluate(({webContents}, id) => webContents.fromId(id)?.closeDevTools(), id);
      await collector.close();
    },
  };
}
