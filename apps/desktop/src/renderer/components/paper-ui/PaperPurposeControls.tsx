import {Input} from '@heroui/react';
import type {PaperBlueprint} from '../../../shared/paper-blueprint';
import type {PaperPurpose} from '../../../shared/paper-purpose';
import {PaperSelect} from './PaperSelect';

export function PaperPurposeControls({purpose,disabled,onPurpose,requirementsMissing=false}:{purpose:PaperPurpose;disabled:boolean;onPurpose:(value:PaperPurpose)=>void;requirementsMissing?:boolean}) {
  return <section data-testid="paper-purpose-controls">
    <PaperSelect label="本题篮用途" value={purpose} disabled={disabled} testId="paper-basket-purpose"
      options={[{id:'practice',label:'练习：按当前已选题核对'},{id:'paper',label:'试卷：按明确考试要求核对'}]} onChange={value=>onPurpose(value as PaperPurpose)}/>
    <p>{purpose==='practice'?'练习按当前已选成员核对，不要求填写考试时长和目标总分；来源、原图与教师审核不放宽。':'试卷按已保存考试要求核对；切换用途不会替换成员、实例、分值或来源。'}</p>
    {requirementsMissing&&purpose==='paper'&&<p role="alert" data-testid="paper-exam-requirements-missing">此篮来自宿主默认练习配置。请展开蓝图，明确核对并保存考试要求后再确认试卷。</p>}
  </section>;
}

/** Practice creation sends these fields only; examination defaults belong to the host. */
export function PaperPracticeSetup({value,disabled,onChange}:{value:PaperBlueprint;disabled:boolean;onChange:(value:PaperBlueprint)=>void}) {
  return <fieldset disabled={disabled} data-testid="paper-practice-setup"><legend>新练习</legend>
    {(['title','subject','grade'] as const).map(key=><label key={key}>{{title:'练习名称',subject:'学科',grade:'年级'}[key]}
      <Input data-testid={'paper-practice-'+key} value={value[key]} maxLength={key==='title'?160:128} onChange={event=>onChange({...value,[key]:event.target.value})}/>
    </label>)}
    <p>保存后由宿主建立常用题型的默认配置，再直接选题；无需先填写考试字段。</p>
  </fieldset>;
}
