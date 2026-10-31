/** Conservative derived policy; never edits the source/OCR or infers purpose from page position. */
export const MATERIAL_PAGE_PURPOSE_POLICY='explicit-frontmatter.v2' as const;
export function nonQuestionPagePurpose(text:string):'advertisement'|'promotion'|'contents'|'cover'|null{
 const normalized=text.normalize('NFKC'),prefix=normalized.slice(0,400);
 // A real question can quote a notice, table of contents or promotional paragraph.
 if(/^\s*(?:第\d{1,5}题|\d{1,5}[.、](?!\d))/.test(normalized))return null;
 if(/^\s*(?:【\s*温馨提示\s*】\s*)?本页为广告页[，,、\s]*打印(?:前|时)(?:可以|可)?(?:把这页|将本页)/.test(normalized))return'advertisement';
 if(prefix.includes('图书结构')&&/试卷亮点|好卷特质/.test(prefix)&&['命题思路紧贴考情','试题素材精挑细选','答案单独梳理','重难题目深度解析'].filter(value=>normalized.includes(value)).length>=2)return'promotion';
 const numbered=/^\s{0,3}(?:第\d{1,5}题\s*[:：]?|\d{1,5}[.、](?!\d))\s*\S/m;
 if(/(?:^|\n)\s*目\s*录\s*(?:\n|$)/.test(prefix)&&!numbered.test(normalized)&&(normalized.match(/测试卷|训练卷/g)||[]).length>=6&&(normalized.match(/(?:^|\n)\s*\d{1,3}\s*(?:\n|$)|P\d+\s*T\d+/g)||[]).length>=3)return'contents';
 // Publisher/author/edition metadata together identify a cover; a numbered exercise or task keeps the page.
 if(normalized.length<1800&&!numbered.test(normalized)&&!/[?？]|已知|如图|求出|计算|解方程|下列|正确的是|错误的是|选择题|填空题|判断题|简答题|解答题|试一试|想一想|说明理由/.test(normalized)&&!/(?:^|\n)\s*(?:[（(]\d+[)）]|\d+[)）:：]|第[一二三四五六七八九十百]+题|[一二三四五六七八九十]+[、．.]|[A-D][.、])/m.test(normalized)&&!/[①-⑳]/.test(text)&&/出版社/.test(normalized)&&/主编|编著|编者/.test(normalized)&&/[一二三四五六七八九十]年级/.test(normalized)&&/语文|数学|英语|物理|化学|生物|历史|地理|道德与法治/.test(normalized))return'cover';
 return null;
}
