import {validScienceTeaching, sciencePartCategory, type ScienceTeaching} from '../../shared/science-teaching';

/** Recover inert bounded data only. Invalid metadata never silently downgrades. */
export function readScienceTeaching(svg: string): ScienceTeaching | undefined {
  const opening = svg.match(/<metadata\b[^>]*\bid=["']science-teaching["'][^>]*>/g) || [];
  if (!opening.length) return undefined;
  const matches = [...svg.matchAll(/<metadata id="science-teaching">([A-Za-z0-9+/=]+)<\/metadata>/g)];
  if (opening.length !== 1 || matches.length !== 1) throw Error('unsupported');
  const bytes = Buffer.from(matches[0][1], 'base64');
  if (bytes.length > 4096 || bytes.toString('base64') !== matches[0][1]) throw Error('unsupported');
  let value: unknown;
  try { value = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes)); }
  catch { throw Error('unsupported'); }
  if (!validScienceTeaching(value)) throw Error('unsupported');
  const escaped=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
  const labels=[...svg.matchAll(/<g data-science-part="\d+"><title>([^<]*)<\/title>/g)].map(m=>sciencePartCategory(m[1]));
  if(value.steps.some(step=>!labels.includes(escaped(step.part))))throw Error('unsupported');
  return value;
}
