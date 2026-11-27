import type {TeacherPreferenceSnapshot,TeacherPreferenceValues} from '../../shared/teacher-preferences';
import {teacherPreferenceContext,teacherPreferenceCorrectionContext,teacherPreferenceLookupContext,teacherPreferenceTrialContext} from './teacher-preference-policy';
import {implicitTeacherCorrection} from './teacher-preference-learning';

import {selectTeacherPreferenceValues} from './teacher-preference-scope';
import {teacherMemoryValues} from './teacher-memory-policy';
import type {TeacherMemoryPolicy} from '../../shared/teacher-memory-settings';

const actionNotice:Record<string,string>={
 learned:'宿主已保存本次明确的长期表达偏好。仅说明记忆时，简短确认已保存。',
 rolled_back:'宿主已撤销上一次采用的表达偏好。简短确认撤销结果。',
 rejected:'本次表达有歧义，长期偏好未更改。简短澄清具体要求。',
 no_previous:'没有可撤销的表达偏好。简短告知当前结果。',
};

function requestedConfirmedPreferenceFields(request:string) {
 const text=request.trim().normalize('NFKC');
 if(!/^(?:请(?:问)?[，, ]*)?(?:(?:帮我|给我) ?)?(?:找回|查找|查看|核对|回顾|查一下|列出|告诉我)/u.test(text)
   || !/偏好|习惯|默认规则|(?:讲义|学案)(?:的)?(?:章节顺序|答案位置)/u.test(text) || !/已确认|已保存|记住的|上次|长期|默认/u.test(text)
   || /同事|别的?老师|其他老师|别人|转述|翻译|资料中|示例/u.test(text))return;
 const keys=new Set<string>();
 if(/讲义|学案/u.test(text)){
  const sections=/章节|例题|练习顺序/u.test(text);
  const answers=/答案位置|答案放|参考解答/u.test(text);
  if(answers||!sections)keys.add('handoutAnswerPlacement');
  if(sections||!answers)keys.add('handoutSectionOrder');
 }
 if(/导出|文件格式/u.test(text))keys.add('exportFormat');
 if(/讲解|解题|解答|回答方式|回复方式/u.test(text))
  for(const key of ['length','structure','answerOrder','presentation'])keys.add(key);
 return keys;
}

export function teacherPreferenceForRequest(
 preference:{snapshot:TeacherPreferenceSnapshot;action:string;trial?:TeacherPreferenceValues;policy?:TeacherMemoryPolicy|null},
 request:string, exportAlreadyChosen=false, course?:string,
){
 const notice=actionNotice[preference.action];
 if(notice)return {text:'[教师偏好操作结果]\n'+notice,applied:false};
 const permitted=()=>preference.policy===undefined?preference.snapshot.values:
  teacherMemoryValues(preference.snapshot.values,preference.policy,request,course);
 const lookup=requestedConfirmedPreferenceFields(request);
 if(lookup){
  const values=Object.fromEntries(Object.entries(permitted()).filter(([field])=>!lookup.size||lookup.has(field)));
  return {text:teacherPreferenceLookupContext({...preference.snapshot,values}),applied:false};
 }
 if(preference.action==='observed'){
  const correction=implicitTeacherCorrection(request);
  return {text:correction?teacherPreferenceCorrectionContext(correction):'',applied:false};
 }
 if(preference.action==='trial'&&preference.trial){
  const values=selectTeacherPreferenceValues(preference.trial,request,exportAlreadyChosen);
  return {text:Object.keys(values).length?teacherPreferenceTrialContext(values):'',applied:false};
 }
 const values=selectTeacherPreferenceValues(permitted(),request,exportAlreadyChosen);
 const applied=Object.keys(values).length>0;
 return {text:applied?teacherPreferenceContext({...preference.snapshot,values},'none'):'',applied};
}
