import type {HandoutAudience,TeachingHandoutOfficeOutput} from '../../shared/teaching-handout-export';

const audienceName = '(?:学生版|教师版|老师版)';
const audienceList = '((?:一份\\s*)?'+audienceName+'(?:\\s*(?:和|与|及|以及|、|/|，|,)\\s*(?:一份\\s*)?'+audienceName+')?)';
const action = '(?:导出|另存|输出|交付|保存)';
const word = '(?:Word|DOCX)(?:文档|文件)?';
const withOutput = new RegExp('(?:'+action+'|给我|只要|只需要|仅要)\\s*(?:为|成)?\\s*(?:'+word+'\\s*(?:的|[:，,]\\s*)?)?'+audienceList,'giu');
const beforeAction = new RegExp(audienceList+'\\s*(?:的)?\\s*(?:'+word+'\\s*)?(?:都|各|分别|一并)?\\s*'+action,'giu');
const excluded = new RegExp('(?:不要|不用|不需要|无需|不必|不导出|不保存)\\s*(?:'+action+'\\s*(?:为|成)?\\s*)?('+audienceName+')|('+audienceName+')\\s*(?:不要|不用|不需要|不导出|不保存)(?=\\s*(?:[。！？；，,;\\n]|$))','gu');

const beforeTitle = /《([^《》\r\n]{1,160})》\s*(?:这份)?(?:讲义|学案)?\s*(?:单独|直接|再次|重新)?\s*(?:导出|另存)/gu;
const afterTitle = /(?:导出|另存)\s*(?:(?:已确认的|现有的|刚确认的)\s*《([^《》\r\n]{1,160})》|《([^《》\r\n]{1,160})》\s*(?:这份)?(?:讲义|学案))/gu;
const role = (name:string):HandoutAudience => name==='学生版'?'student':'teacher';
const names = (text:string) => Array.from(text.matchAll(/学生版|教师版|老师版/gu),match=>role(match[0]));
export const handoutTitleKey = (title:string) => title.trim().normalize('NFKC').toLowerCase();

/** Read literal output clauses from the teacher's current request. Source titles are not output roles. */
export function handoutOutputScope(prompt:string) {
  const text=prompt.normalize('NFKC');
  const titles=Array.from(text.matchAll(beforeTitle),match=>match[1]);
  titles.push(...Array.from(text.matchAll(afterTitle),match=>match[1]??match[2]));
  const uniqueTitles=new Map(titles.map(title=>[handoutTitleKey(title),title]));
  const denied=new Set<HandoutAudience>();
  const request=text.replace(/《[^《》\n]*》|「[^「」\n]*」|“[^“”\n]*”/gu,quoted=>
    /^(?:学生版|教师版|老师版)$/u.test(quoted.slice(1,-1))?quoted.slice(1,-1):' ')
    .replace(excluded,(_match,first:string|undefined,second:string|undefined)=>{
      denied.add(role(first??second!));
      return ' ';
    });
  const requested=new Set(Array.from(request.matchAll(withOutput),match=>names(match[1])).flat());
  if(!requested.size)for(const match of request.matchAll(beforeAction))for(const audience of names(match[1]))requested.add(audience);
  for(const audience of denied)requested.delete(audience);
  return {title:uniqueTitles.size===1?uniqueTitles.values().next().value:undefined,requested,denied};
}

export function assertHandoutOutputScope(scope:ReturnType<typeof handoutOutputScope>,outputs:readonly TeachingHandoutOfficeOutput[]) {
  if(outputs.some(output=>scope.denied.has(output.audience))||
      scope.requested.size&&(outputs.length!==scope.requested.size||outputs.some(output=>!scope.requested.has(output.audience))))
    throw Error('audience_mismatch');
  for(const output of outputs) {
    const basename=output.path.split(/[\\/]/u).at(-1)!;
    const label=names(basename.normalize('NFKC')).at(-1);
    if(label&&label!==output.audience)throw Error('audience_filename_conflict');
  }
}
