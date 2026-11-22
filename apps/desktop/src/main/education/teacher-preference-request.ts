import type {TeacherPreferenceSnapshot,TeacherPreferenceValues} from '../../shared/teacher-preferences';
import {teacherPreferenceContext,teacherPreferenceCorrectionContext,teacherPreferenceTrialContext} from './teacher-preference-policy';
import {implicitTeacherCorrection} from './teacher-preference-learning';

import {selectTeacherPreferenceValues} from './teacher-preference-scope';

const actionNotice:Record<string,string>={
 learned:'宿主已保存本次明确的长期表达偏好。仅说明记忆时，简短确认已保存。',
 rolled_back:'宿主已撤销上一次采用的表达偏好。简短确认撤销结果。',
 rejected:'本次表达有歧义，长期偏好未更改。简短澄清具体要求。',
 no_previous:'没有可撤销的表达偏好。简短告知当前结果。',
};

export function teacherPreferenceForRequest(
 preference:{snapshot:TeacherPreferenceSnapshot;action:string;trial?:TeacherPreferenceValues},
 request:string, exportAlreadyChosen=false,
){
 const notice=actionNotice[preference.action];
 if(notice)return {text:'[教师偏好操作结果]\n'+notice,applied:false};
 if(preference.action==='observed'){
  const correction=implicitTeacherCorrection(request);
  return {text:correction?teacherPreferenceCorrectionContext(correction):'',applied:false};
 }
 if(preference.action==='trial'&&preference.trial){
  const values=selectTeacherPreferenceValues(preference.trial,request,exportAlreadyChosen);
  return {text:Object.keys(values).length?teacherPreferenceTrialContext(values):'',applied:false};
 }
 const values=selectTeacherPreferenceValues(preference.snapshot.values,request,exportAlreadyChosen);
 const applied=Object.keys(values).length>0;
 return {text:applied?teacherPreferenceContext({...preference.snapshot,values},'none'):'',applied};
}
