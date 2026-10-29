import type {XiaozhiPublicSource} from './xiaozhi-web';
export const validCitationId=(value:unknown):value is string=>typeof value==='string'&&/^xz-cite-[a-f0-9]{16}-[1-9]\d{0,2}$/.test(value);
/** Unregistered model links never acquire the appearance of a verified source. */
export function normalizeAnswerCitations(text:string,sources:readonly XiaozhiPublicSource[]) {
  const allowed=new Set(sources.map(s=>s.citationId).filter(validCitationId));
  return text.replace(/\[([^\]\n]{0,120})\]\(#(xz-cite-[^\s)]*)\)/g,(_all,label,id)=>allowed.has(id)?`[${label}](#${id})`:`${label}（引用未核验）`);
}
