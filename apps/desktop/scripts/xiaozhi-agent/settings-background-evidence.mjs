import {measureTextContrast} from './capture-workspace-metrics.mjs';

/** Read painted sRGB through the same canvas/compositing path as contrast checks. */
export async function settingsBackgroundEvidence(locator) {
  const {background: resolvedRGB} = await measureTextContrast(locator);
  const provenance = await locator.evaluate(element => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const layers = [], unreadableStylesheets = [];
    let remaining = 1;
    for (let node = element; node && remaining > 0; node = node.parentElement) {
      const rawComputed = getComputedStyle(node).backgroundColor;
      if (!CSS.supports('color', rawComputed)) throw new Error(`Unsupported computed background: ${rawComputed}`);
      context.clearRect(0, 0, 1, 1); context.fillStyle = rawComputed; context.fillRect(0, 0, 1, 1);
      const rgba = [...context.getImageData(0, 0, 1, 1).data];
      const contribution = remaining * rgba[3] / 255;
      const layer = {tag: node.tagName, id: node.id, className: node.className,
        testId: node.getAttribute('data-testid'), rawComputed, rgba, contribution,
        inlineBackground: node.style.getPropertyValue('background'),
        inlineBackgroundColor: node.style.getPropertyValue('background-color'), matchedBackgroundRules: []};
      // Preserve candidates and cascade context, rather than guessing a winner
      // from source order (layers, specificity and @scope also affect the cascade).
      if (contribution > 0) {
        const walk = (rules, source, contexts = []) => {
          for (const [index, rule] of [...rules].entries()) {
            const location = [...contexts, {index, header: rule.cssText.split('{', 1)[0]}];
            if (rule.media && !matchMedia(rule.conditionText || rule.media.mediaText).matches) continue;
            if (rule.constructor.name === 'CSSSupportsRule' && !CSS.supports(rule.conditionText)) continue;
            if (rule.selectorText && rule.style) {
              const background = rule.style.getPropertyValue('background');
              const backgroundColor = rule.style.getPropertyValue('background-color');
              let matches = false;
              try { matches = node.matches(rule.selectorText); } catch { /* Nested selectors remain in context. */ }
              if (matches && (background || backgroundColor)) layer.matchedBackgroundRules.push({source,
                selector: rule.selectorText, background, backgroundColor,
                priority: rule.style.getPropertyPriority('background-color') || rule.style.getPropertyPriority('background'), contexts: location});
            }
            if (rule.cssRules) walk(rule.cssRules, source, location);
          }
        };
        for (const [index, sheet] of [...document.styleSheets].entries()) {
          if (sheet.disabled || (sheet.media?.mediaText && !matchMedia(sheet.media.mediaText).matches)) continue;
          const source = {index, href: sheet.href, ownerId: sheet.ownerNode?.id || null};
          try { walk(sheet.cssRules, source); } catch (error) { unreadableStylesheets.push({...source, error: error.name}); }
        }
      }
      layers.push(layer); remaining *= 1 - rgba[3] / 255;
    }
    return {layers, whiteCanvasRemainder: remaining, unreadableStylesheets,
      ruleEvidence: 'Matched declarations are candidates; raw computed color identifies the resolved cascade result.'};
  });
  return {resolvedRGB, sum: resolvedRGB.reduce((a, b) => a + b, 0), ...provenance};
}
