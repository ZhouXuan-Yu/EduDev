import {Checkbox, Input, TextArea} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperSelect} from './PaperSelect';
import type {PaperReferenceCandidate, ReferenceField} from '../../../shared/paper-reference';

const status = {known: '已提取', unknown: '原文未识别', ambiguous: '原文存在不同值', unsupported: '原值不能直接转换'};
export function PaperReferenceField({path, label, field, candidate, disabled, onEdit}: {
  path: string; label: string; field: ReferenceField; candidate: PaperReferenceCandidate; disabled: boolean;
  onEdit: (path: string, patch: Partial<Pick<ReferenceField, 'teacherValue' | 'confirmed'>>) => void;
}) {
  const evidence = candidate.evidence.filter(item => field.evidenceIds.includes(item.id));
  const value = field.teacherValue ?? field.value ?? '';
  const choices = path === 'layout.paper' ? [{id: 'A4', label: 'A4'}]
    : path === 'layout.orientation' ? [{id: 'portrait', label: '竖向'}, {id: 'landscape', label: '横向'}]
    : path === 'layout.columns' ? [{id: '1', label: '单栏'}, {id: '2', label: '双栏'}] : undefined;
  return <section data-testid={'paper-reference-field-' + path}>
    {choices ? <PaperSelect label={label} value={value} disabled={disabled} testId={'paper-reference-input-' + path}
      options={[{id: '', label: '待选择'}, ...choices, ...(value && !choices.some(choice => choice.id === value) ? [{id: value, label: '原文值（待修订）：' + value}] : [])]}
      onChange={teacherValue => onEdit(path, {teacherValue, confirmed: false})}/>
      : <label>{label}<Input aria-label={label} value={value} disabled={disabled} maxLength={160}
      data-testid={'paper-reference-input-' + path}
      onChange={event => onEdit(path, {teacherValue: event.target.value, confirmed: false})}/></label>}
    <p>{status[field.status]} · 原文提取：{field.value ?? '未知'} · {field.confirmed ? '本项已核对' : '尚待教师核对'}{field.teacherValue !== undefined && ' · 当前输入为教师修订，尚未保存'}</p>
    <Checkbox isDisabled={disabled} isSelected={field.confirmed} onChange={confirmed => onEdit(path, {confirmed})}>已核对此项</Checkbox>
    {!!evidence.length && <DisclosureCard title={`${label}的原文依据`} data-testid={'paper-reference-evidence-' + path}>
      {evidence.map(item => <div key={item.id}>
        <p>{item.source ? `已收录正文第${item.source.offset + 1}段，第${item.line}行` : `${item.part} · ${item.path}`}</p>
        <TextArea aria-label={`${label}的只读依据`} readOnly value={item.text}/>
      </div>)}
    </DisclosureCard>}
  </section>;
}

export function PaperReferenceFields({candidate, disabled, onEdit}: {
  candidate: PaperReferenceCandidate; disabled: boolean;
  onEdit: (path: string, patch: Partial<Pick<ReferenceField, 'teacherValue' | 'confirmed'>>) => void;
}) {
  const field = (path: string, label: string, value: ReferenceField) => <PaperReferenceField key={path} path={path} label={label}
    field={value} candidate={candidate} disabled={disabled} onEdit={onEdit}/>;
  return <>
    <DisclosureCard title="命题结构候选" defaultExpanded data-testid="paper-reference-structure">
      {(['title', 'subject', 'grade', 'durationMinutes', 'totalPoints'] as const).map((key, i) => field(key, ['试卷名称', '学科', '年级', '时长（分钟）', '总分'][i], candidate[key]))}
      {!candidate.sections.length && <p>尚未可靠识别分节，请对照原文补充；没有套用默认题型或分值。</p>}
      {candidate.sections.map((section, index) => <DisclosureCard key={section.id} title={`第${index + 1}部分`} defaultExpanded>
        {(['label', 'questionType', 'count', 'points', 'difficulty', 'knowledgePoint'] as const).map((key, i) =>
          field(`sections.${index}.${key}`, ['分节名称', '题型', '题数', '每题分值', '难度', '知识点'][i], section[key]))}
      </DisclosureCard>)}
    </DisclosureCard>
    <DisclosureCard title="卷面规则候选" data-testid="paper-reference-layout">
      <p>边距与栏距单位为twip（1440 twip＝1英寸）；未知项未套用A4或Word默认设置。不同节的冲突须明确统一。</p>
      {(['paper', 'orientation', 'columns', 'top', 'right', 'bottom', 'left', 'columnGap'] as const).map((key, i) =>
        field('layout.' + key, ['纸张', '方向', '分栏', '上边距', '右边距', '下边距', '左边距', '栏间距'][i], candidate.layout[key]))}
    </DisclosureCard>
  </>;
}
