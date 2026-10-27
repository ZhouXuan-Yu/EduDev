import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const root=path.join(process.env.SystemRoot||'C:/Windows','Fonts'),simsun=fs.readFileSync(path.join(root,'simsun.ttc')),cambria=fs.readFileSync(path.join(root,'cambria.ttc'));
let api;try{api=await import('../../src/main/assets/word-font-coverage.ts');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('word-font-coverage.ts'))throw error;}
assert.equal(typeof api?.fontGlyphCoverage,'function','A successfully loaded page must not publish missing-glyph boxes as a complete teacher question');
const {fontGlyphCoverage,assertWordGlyphs}=api,a=fontGlyphCoverage(simsun),b=fontGlyphCoverage(cambria);
for(const c of '教辅原题答案解析分数运算第行表格数据')assert(a(c.codePointAt(0)),c);
for(const c of 'ABCxyz0123+−=√∫∑αβθπ∞')assert(a(c.codePointAt(0))||b(c.codePointAt(0)),c);
assert.doesNotThrow(()=>assertWordGlyphs('数学：x² + y² = z²，\n答案：三分之一\t∫α',[a,b]));
assert(!a(0x10ffff)&&!b(0x10ffff));assert.throws(()=>assertWordGlyphs('数学'+String.fromCodePoint(0x10ffff),[a,b]),/font_missing_glyph/);
for(const value of [-1,0x110000,1.5,NaN])assert.equal(a(value),false);
for(const value of [Buffer.alloc(0),Buffer.from('not a font'),simsun.subarray(0,30)])assert.throws(()=>fontGlyphCoverage(value),/font_unavailable/);
const bad=Buffer.from(cambria);bad.writeUInt32BE(0xffffffff,12);assert.throws(()=>fontGlyphCoverage(bad),/font_unavailable/);
console.log(JSON.stringify({passed:5,scope:'Installed Windows SimSun/Cambria Unicode cmap coverage and malformed-font bounds; no redistribution or claim that arbitrary mathematical notation is correct'}));
