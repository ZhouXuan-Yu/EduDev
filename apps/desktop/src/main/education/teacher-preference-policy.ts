import {TEACHER_PREFERENCE_SCHEMA,validTeacherPreferenceValues,type TeacherPreferenceValues,type TeacherPreferenceSnapshot} from '../../shared/teacher-preferences';

export type TeacherPreferenceSignal={kind:'none'}|{kind:'rollback'}|{kind:'candidate';patch:TeacherPreferenceValues}|{kind:'rejected';reason:'ambiguous'};
/** Only explicit general future presentation requests. Sources/quotes are never feedback. */
export function teacherPreferenceSignal(text:string):TeacherPreferenceSignal{
 let input=text.trim();
 if(input.length>8000||/[`“”「」『』"<>]|(?:引用|假设|例如|例子|翻译|资料中|题目中|不要记住|别记住|不用记住|如果)/.test(input))return{kind:'none'};
 if(/^(?:请)?撤销(?:上次|上一版|刚才)(?:记住的|的)?(?:教学)?(?:偏好|习惯)[。！!\s]*$/.test(input))return{kind:'rollback'};
 if(!/^(?:请)?(?:以后|今后|后续|下次|从现在起|我习惯|我更喜欢|我偏好)/.test(input))return{kind:'none'};
 // Never learn policies, student facts, temporary/per-student requests or credentials.
 if(/权限|审批|批准|安全|隐私|密钥|凭证|API|token|成绩|分数|正确答案|数据库|源代码|系统提示|忽略规则|绕过|这次|这道|本题|本次|只针对|仅针对|(?:给|对|帮).{0,24}(?:同学|学生|孩子)/i.test(input))return{kind:'none'};
 // Resolve only unambiguous negative alternatives before positive matching.
 // An unsupported negation must never accidentally promote the negated style.
 input=input.replace(/(?:不要|不用|不必|别)(?:再)?(?:用)?表格(?:形式)?/g,'用段落')
  .replace(/(?:不要|不用|不必|别)(?:再)?分步(?:骤)?(?:讲解)?/g,'连贯叙述')
  .replace(/(?:不要|不用|不必|别)(?:再)?详细(?:地)?(?:讲解|说明)?/g,'简洁')
  .replace(/(?:不要|不用|不必|别)(?:再)?简短(?:地)?(?:讲解|说明)?/g,'详细讲解')
  .replace(/(?:不要|不用|不必|别)(?:再)?直接(?:给|给出)?答案/g,'先给提示');
 if(/不要|不用|不必|别|不需要|无需/.test(input))return{kind:'none'};
 const patch:TeacherPreferenceValues={};let ambiguous=false;
 const choose=<K extends keyof TeacherPreferenceValues>(key:K,pairs:ReadonlyArray<readonly[NonNullable<TeacherPreferenceValues[K]>,RegExp]>)=>{
  const matches=pairs.filter(([,pattern])=>pattern.test(input));if(matches.length>1)ambiguous=true;else if(matches.length===1)Object.assign(patch,{[key]:matches[0][0]});
 };
 choose('length',[['concise',/简洁|简短|精简|少说一点/],['detailed',/详细讲解|详细说明|详细一点|讲详细|讲细|展开讲|详细些/]]);
 choose('structure',[['step_by_step',/分步|一步一步/],['continuous',/不要分步|不分步|连贯叙述/]]);
 choose('answerOrder',[['hint_first',/先(?:给)?提示|先引导|不要直接.{0,8}答案/],['answer_first',/先(?:给|说|列|给出)?答案|先结论/]]);
 choose('presentation',[['table',/用表格|表格形式|优先.{0,6}表格/],['paragraph',/用段落|采用段落|不要.{0,5}表格/]]);
 choose('exportFormat',[['docx',/(?:导出|输出|保存).{0,10}(?:word|docx)/i],['pdf',/(?:导出|输出|保存).{0,10}pdf/i],['pptx',/(?:导出|输出|保存).{0,10}(?:pptx|ppt)/i]]);
 if(ambiguous)return{kind:'rejected',reason:'ambiguous'};
 return Object.keys(patch).length?{kind:'candidate',patch}:{kind:'none'};
}

/** Replay is policy conformance only; it does not grade mathematical/teaching quality. */
export function evaluateTeacherPreference(baseline:TeacherPreferenceValues,patch:TeacherPreferenceValues){
 if(!validTeacherPreferenceValues(baseline)||!validTeacherPreferenceValues(patch)||!Object.keys(patch).length)throw Error('invalid_input');
 const candidate={...baseline,...patch},expected=Object.entries(patch),untouched=Object.keys(baseline).filter(key=>!Object.prototype.hasOwnProperty.call(patch,key)) as (keyof TeacherPreferenceValues)[];
 const matched=expected.filter(([key,value])=>candidate[key as keyof TeacherPreferenceValues]===value).length;
 const baselineMatched=expected.filter(([key,value])=>baseline[key as keyof TeacherPreferenceValues]===value).length;
 const preserved=untouched.every(key=>candidate[key]===baseline[key]);
 return{candidate,evaluation:{metric:'teacher_preference_contract.v1',matched,total:expected.length,baselineMatched,preserved,passed:matched===expected.length&&preserved,educationalCorrectness:'not_evaluated'}};
}

const labels:Record<string,string>={concise:'讲解简洁',detailed:'讲解详细',step_by_step:'分步骤讲解',continuous:'连贯叙述',hint_first:'先给提示，再给答案',answer_first:'先给答案或结论',table:'适合比较的信息优先用表格',paragraph:'优先用段落',docx:'未指定时优先导出Word',pdf:'未指定时优先导出PDF',pptx:'未指定时优先导出PPTX'};
function presentationAdvice(values:TeacherPreferenceValues){
 return values.length==='concise'?'\n简洁讲解以约400–600字为宜，含公式和表格尽量控制在800字内。保留关键条件、关系式、单位与结论；步骤正文和表格不要重复同一组计算，不另附无关扩展、变式邀请或重复提醒。不能为满足篇幅删掉解题必需条件，必要内容确实超长时优先保证完整和正确。':'';
}
export function teacherPreferenceContext(snapshot:TeacherPreferenceSnapshot,action:string){
 if(snapshot.schemaVersion!==TEACHER_PREFERENCE_SCHEMA||!validTeacherPreferenceValues(snapshot.values))throw Error('configuration');
 const notice=action==='rejected'?'本条表达存在歧义，偏好没有保存；不能声称已经记住，请简短澄清。':action==='no_previous'?'当前没有可撤销的教师表达偏好；不能声称恢复了一个不存在的版本。':'';
 if(!snapshot.revision)return notice+(action==='observed'?'本次只是当前讲解的修正，尚未保存长期表达习惯；正常修改当前讲解，不称已经学会或记住。':'');
 const preferences=Object.values(snapshot.values).map(value=>labels[value]);
 return'\n[当前教师表达偏好：本机已保存的明确要求；非学生事实、权限或答案依据]\n'+JSON.stringify({version:snapshot.revision,preferences,latestAction:action})+'\n仅在适合任务且教师本次未另行指定时采用；本次明确要求优先。以上明确习惯已经由宿主保存，不要重复询问详细程度、档位或要求教师配置记忆/技能；若本次仅说明习惯，简短确认即可。旧对话中的偏好若与此版本冲突，以此版本为准；空列表表示已撤销，不恢复旧习惯。不改变审批、隐私、来源、题目答案和学生事实。'+presentationAdvice(snapshot.values)+notice;
}
export function teacherPreferenceTrialContext(values:TeacherPreferenceValues){
 if(!validTeacherPreferenceValues(values))throw Error('configuration');
 return '\n[本轮表达方式试用：来自多次实际讲解修正，尚未成为长期习惯]\n'+JSON.stringify(Object.values(values).map(v=>labels[v]))+'\n仅在当前任务未另有要求时采用；本轮正常完成教学讲解，不说明技术评价，不称已永久记住。表达要求不能替代正确解答、证据、权限或审批；步骤保持完整，不为缩短篇幅省掉关键条件。'+presentationAdvice(values);
}
/** A current-turn correction is not a learned preference or a held-out trial. */
export function teacherPreferenceCorrectionContext(values:TeacherPreferenceValues|undefined){
 if(!values)return '';
 if(!validTeacherPreferenceValues(values))throw Error('configuration');
 return '\n[教师本轮明确要求的讲解修正，仅适用于当前回答]\n'+JSON.stringify(Object.values(values).map(v=>labels[v]))+'\n按本轮要求重写当前讲解，不称已保存长期习惯。'+presentationAdvice(values);
}
