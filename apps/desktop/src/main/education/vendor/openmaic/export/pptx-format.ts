import pptxgen from 'pptxgenjs';
import tinycolor from 'tinycolor2';
import type {PPTElementShadow,PPTElementOutline} from '@openmaic/dsl';
import {toAST,type AST} from './html-parser';
import type {SvgPoints} from './svg-path-parser';
const DEFAULT_FONT_SIZE=16;
export function formatColor(_color: string) {
  if (!_color) {
    return { alpha: 0, color: '000000' };
  }
  const c = tinycolor(_color);
  const alpha = c.getAlpha();
  const color = alpha === 0 ? 'ffffff' : c.setAlpha(1).toHex();
  return { alpha, color };
}

type FormatColor = ReturnType<typeof formatColor>;

// ── HTML → pptxgenjs TextProps ──

export function formatHTML(html: string, ratioPx2Pt: number) {
  const ast = toAST(html);
  let bulletFlag = false;
  let indent = 0;

  const slices: pptxgen.TextProps[] = [];

  const parse = (obj: AST[], baseStyleObj: Record<string, string> = {}) => {
    for (const item of obj) {
      const isBlockTag = 'tagName' in item && ['div', 'li', 'p'].includes(item.tagName);

      if (isBlockTag && slices.length) {
        const lastSlice = slices[slices.length - 1];
        if (!lastSlice.options) lastSlice.options = {};
        lastSlice.options.breakLine = true;
      }

      const styleObj = { ...baseStyleObj };
      const styleAttr =
        'attributes' in item ? item.attributes.find((attr) => attr.key === 'style') : null;
      if (styleAttr && styleAttr.value) {
        const styleArr = styleAttr.value.split(';');
        for (const styleItem of styleArr) {
          const match = styleItem.match(/([^:]+):\s*(.+)/);
          if (match) {
            const [key, value] = [match[1].trim(), match[2].trim()];
            if (key && value) styleObj[key] = value;
          }
        }
      }

      if ('tagName' in item) {
        if (item.tagName === 'em') styleObj['font-style'] = 'italic';
        if (item.tagName === 'strong') styleObj['font-weight'] = 'bold';
        if (item.tagName === 'sup') styleObj['vertical-align'] = 'super';
        if (item.tagName === 'sub') styleObj['vertical-align'] = 'sub';
        if (item.tagName === 'a') {
          const attr = item.attributes.find((a) => a.key === 'href');
          styleObj['href'] = attr?.value || '';
        }
        if (item.tagName === 'ul') styleObj['list-type'] = 'ul';
        if (item.tagName === 'ol') styleObj['list-type'] = 'ol';
        if (item.tagName === 'li') bulletFlag = true;
        if (item.tagName === 'p') {
          if ('attributes' in item) {
            const dataIndentAttr = item.attributes.find((a) => a.key === 'data-indent');
            if (dataIndentAttr && dataIndentAttr.value) indent = +dataIndentAttr.value;
          }
        }
      }

      if ('tagName' in item && item.tagName === 'br') {
        slices.push({ text: '', options: { breakLine: true } });
      } else if ('content' in item) {
        const text = item.content
          .replace(/&nbsp;/g, ' ')
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '<')
          .replace(/&amp;/g, '&')
          .replace(/\n/g, '');
        const options: pptxgen.TextPropsOptions = {};

        if (styleObj['font-size']) {
          options.fontSize = parseInt(styleObj['font-size']) / ratioPx2Pt;
        }
        if (styleObj['color']) {
          options.color = formatColor(styleObj['color']).color;
        }
        if (styleObj['background-color']) {
          options.highlight = formatColor(styleObj['background-color']).color;
        }
        if (styleObj['text-decoration-line']) {
          if (styleObj['text-decoration-line'].indexOf('underline') !== -1) {
            options.underline = {
              color: options.color || '000000',
              style: 'sng',
            };
          }
          if (styleObj['text-decoration-line'].indexOf('line-through') !== -1) {
            options.strike = 'sngStrike';
          }
        }
        if (styleObj['text-decoration']) {
          if (styleObj['text-decoration'].indexOf('underline') !== -1) {
            options.underline = {
              color: options.color || '000000',
              style: 'sng',
            };
          }
          if (styleObj['text-decoration'].indexOf('line-through') !== -1) {
            options.strike = 'sngStrike';
          }
        }
        if (styleObj['vertical-align']) {
          if (styleObj['vertical-align'] === 'super') options.superscript = true;
          if (styleObj['vertical-align'] === 'sub') options.subscript = true;
        }
        if (styleObj['text-align']) options.align = styleObj['text-align'] as pptxgen.HAlign;
        if (styleObj['font-weight']) options.bold = styleObj['font-weight'] === 'bold';
        if (styleObj['font-style']) options.italic = styleObj['font-style'] === 'italic';
        if (styleObj['font-family']) options.fontFace = styleObj['font-family'];
        if (styleObj['href']) options.hyperlink = { url: styleObj['href'] };

        if (bulletFlag && styleObj['list-type'] === 'ol') {
          options.bullet = {
            type: 'number',
            indent: (options.fontSize || DEFAULT_FONT_SIZE) * 1.25,
          };
          options.paraSpaceBefore = 0.1;
          bulletFlag = false;
        }
        if (bulletFlag && styleObj['list-type'] === 'ul') {
          options.bullet = {
            indent: (options.fontSize || DEFAULT_FONT_SIZE) * 1.25,
          };
          options.paraSpaceBefore = 0.1;
          bulletFlag = false;
        }
        if (indent) {
          options.indentLevel = indent;
          indent = 0;
        }

        slices.push({ text, options });
      } else if ('children' in item) parse(item.children, styleObj);
    }
  };
  parse(ast);
  return slices;
}

// ── SVG path → pptxgenjs points ──

type Points = Array<
  | { x: number; y: number; moveTo?: boolean }
  | {
      x: number;
      y: number;
      curve: {
        type: 'arc';
        hR: number;
        wR: number;
        stAng: number;
        swAng: number;
      };
    }
  | {
      x: number;
      y: number;
      curve: { type: 'quadratic'; x1: number; y1: number };
    }
  | {
      x: number;
      y: number;
      curve: { type: 'cubic'; x1: number; y1: number; x2: number; y2: number };
    }
  | { close: true }
>;

export function formatPoints(
  points: SvgPoints,
  ratioPx2Inch: number,
  scale = { x: 1, y: 1 },
  origin = { x: 0, y: 0 },
): Points {
  return points.map((point) => {
    if (point.close !== undefined) {
      return { close: true };
    } else if (point.type === 'M') {
      return {
        x: (((point.x as number) - origin.x) / ratioPx2Inch) * scale.x,
        y: (((point.y as number) - origin.y) / ratioPx2Inch) * scale.y,
        moveTo: true,
      };
    } else if (point.curve) {
      if (point.curve.type === 'cubic') {
        return {
          x: (((point.x as number) - origin.x) / ratioPx2Inch) * scale.x,
          y: (((point.y as number) - origin.y) / ratioPx2Inch) * scale.y,
          curve: {
            type: 'cubic' as const,
            x1: (((point.curve.x1 as number) - origin.x) / ratioPx2Inch) * scale.x,
            y1: (((point.curve.y1 as number) - origin.y) / ratioPx2Inch) * scale.y,
            x2: (((point.curve.x2 as number) - origin.x) / ratioPx2Inch) * scale.x,
            y2: (((point.curve.y2 as number) - origin.y) / ratioPx2Inch) * scale.y,
          },
        };
      } else if (point.curve.type === 'quadratic') {
        return {
          x: (((point.x as number) - origin.x) / ratioPx2Inch) * scale.x,
          y: (((point.y as number) - origin.y) / ratioPx2Inch) * scale.y,
          curve: {
            type: 'quadratic' as const,
            x1: (((point.curve.x1 as number) - origin.x) / ratioPx2Inch) * scale.x,
            y1: (((point.curve.y1 as number) - origin.y) / ratioPx2Inch) * scale.y,
          },
        };
      }
    }
    return {
      x: (((point.x as number) - origin.x) / ratioPx2Inch) * scale.x,
      y: (((point.y as number) - origin.y) / ratioPx2Inch) * scale.y,
    };
  });
}

// ── Shadow config ──

export function getShadowOption(shadow: PPTElementShadow, ratioPx2Pt: number): pptxgen.ShadowProps {
  const c = formatColor(shadow.color);
  const { h, v } = shadow;

  let offset = 4;
  let angle = 45;

  if (h === 0 && v === 0) {
    offset = 4;
    angle = 45;
  } else if (h === 0) {
    if (v > 0) {
      offset = v;
      angle = 90;
    } else {
      offset = -v;
      angle = 270;
    }
  } else if (v === 0) {
    if (h > 0) {
      offset = h;
      angle = 1;
    } else {
      offset = -h;
      angle = 180;
    }
  } else if (h > 0 && v > 0) {
    offset = Math.max(h, v);
    angle = 45;
  } else if (h > 0 && v < 0) {
    offset = Math.max(h, -v);
    angle = 315;
  } else if (h < 0 && v > 0) {
    offset = Math.max(-h, v);
    angle = 135;
  } else if (h < 0 && v < 0) {
    offset = Math.max(-h, -v);
    angle = 225;
  }

  return {
    type: 'outer',
    color: c.color.replace('#', ''),
    opacity: c.alpha,
    // pptxgenjs shadow blur AND offset are in points; the source model is in
    // pixels. blur was converted but offset was not, so shadows exported ~33%
    // too far at the default viewport (ratioPx2Pt = 96/72 × viewportSize/960).
    blur: shadow.blur / ratioPx2Pt,
    offset: offset / ratioPx2Pt,
    angle,
  };
}

// ── Outline config ──

const dashTypeMap: Record<string, string> = {
  solid: 'solid',
  dashed: 'dash',
  dotted: 'sysDot',
};

export function getOutlineOption(outline: PPTElementOutline, ratioPx2Pt: number): pptxgen.ShapeLineProps {
  const c = formatColor(outline?.color || '#000000');
  return {
    color: c.color,
    transparency: (1 - c.alpha) * 100,
    width: (outline.width || 1) / ratioPx2Pt,
    dashType: outline.style ? (dashTypeMap[outline.style] as 'solid' | 'dash' | 'sysDot') : 'solid',
  };
}

