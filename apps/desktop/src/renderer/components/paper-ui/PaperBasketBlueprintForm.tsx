import {Button, Input} from '@heroui/react';
import {validPaperBlueprint, type PaperBlueprint, type PaperMode, type PaperSection} from '../../../shared/paper-blueprint';
import {PaperSelect} from './PaperSelect';

export function PaperBasketBlueprintForm({value, disabled, dirty, hasBasket, onChange, onSave, onDiscard}: {
  value: PaperBlueprint;
  disabled: boolean;
  dirty: boolean;
  hasBasket: boolean;
  onChange: (value: PaperBlueprint) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  function section(index: number, patch: Partial<PaperSection>) {
    onChange({...value, sections: value.sections.map((item, i) => i === index ? {...item, ...patch} : item)});
  }
  function mode(mode: PaperMode) {
    onChange({...value, mode, sections: value.sections.map(({generatedCount: _old, ...item}) => ({...item,
      ...(mode === 'hybrid' ? {generatedCount: Math.ceil(item.count / 2)} : {})}))});
  }
  return <section className="edu-paper-basket-blueprint" data-testid="paper-basket-blueprint">
    <h2>选题蓝图</h2>
    <p>调整结构不会删除或替换手选题；不符合新要求的条目保留并提示。生成题须属于所选会话且经教师确认。</p>
    <fieldset disabled={disabled}>
      <div className="paper-fields">
        {(['title', 'subject', 'grade'] as const).map(key => <label key={key}>
          {{title: '名称', subject: '学科', grade: '年级'}[key]}
          <Input value={value[key]} maxLength={key === 'title' ? 160 : 128} data-testid={`paper-basket-${key}`}
            onChange={event => onChange({...value, [key]: event.target.value})}/>
        </label>)}
        <PaperSelect label="来源策略" value={value.mode} disabled={disabled} testId="paper-basket-mode"
          options={[{id: 'source_only', label: '纯题库原题'}, {id: 'hybrid', label: '原题与生成题混合'}, {id: 'ai_original', label: '已确认原创题'}]}
          onChange={next => mode(next as PaperMode)}/>
        <label>时长（分钟）<Input type="number" min={1} max={1440} value={String(value.durationMinutes)}
          onChange={event => onChange({...value, durationMinutes: Number(event.target.value)})}/></label>
        <label>总分<Input type="number" min={1} max={10000} value={String(value.totalPoints)} data-testid="paper-basket-total"
          onChange={event => onChange({...value, totalPoints: Number(event.target.value)})}/></label>
      </div>
      {value.sections.map((item, index) => <fieldset className="paper-section-fields" key={item.id} data-testid="paper-basket-section-editor">
        <legend>第 {index + 1} 部分</legend>
        <div className="paper-fields">
          <label>分节名称<Input maxLength={80} value={item.label} onChange={event => section(index, {label: event.target.value})}/></label>
          <label>题型<Input maxLength={128} value={item.questionType} data-testid="paper-basket-section-type"
            onChange={event => section(index, {questionType: event.target.value})}/></label>
          <label>题数<Input type="number" min={1} max={100} value={String(item.count)} data-testid="paper-basket-section-count"
            onChange={event => section(index, {count: Number(event.target.value)})}/></label>
          <label>每题分值<Input type="number" min={1} max={1000} value={String(item.points)} data-testid="paper-basket-section-points"
            onChange={event => section(index, {points: Number(event.target.value)})}/></label>
          {value.mode === 'hybrid' && <label>其中生成题数<Input type="number" min={0} max={item.count} value={String(item.generatedCount ?? 0)}
            onChange={event => section(index, {generatedCount: Number(event.target.value)})}/></label>}
          <PaperSelect label="难度" value={item.difficulty || ''} disabled={disabled}
            options={[{id: '', label: '不限'}, {id: 'easy', label: '基础'}, {id: 'medium', label: '中等'}, {id: 'hard', label: '困难'}]}
            onChange={next => section(index, {difficulty: next as PaperSection['difficulty'] || undefined})}/>
          <label>知识点<Input maxLength={128} value={item.knowledgePoint || ''}
            onChange={event => section(index, {knowledgePoint: event.target.value || undefined})}/></label>
        </div>
        <Button variant="secondary" isDisabled={disabled || value.sections.length === 1}
          onPress={() => onChange({...value, sections: value.sections.filter((_, i) => i !== index)})}>移除此分节</Button>
      </fieldset>)}
      <Button variant="secondary" isDisabled={disabled || value.sections.length >= 20} onPress={() => onChange({...value,
        sections: [...value.sections, {id: 'section_' + crypto.randomUUID().slice(0, 8), label: '新增部分', questionType: '解答题', count: 1, points: 10,
          ...(value.mode === 'hybrid' ? {generatedCount: 0} : {})}]})}>添加分节</Button>
    </fieldset>
    <p>合计 {value.sections.reduce((sum, item) => sum + item.count * item.points, 0)} / {value.totalPoints} 分</p>
    {!validPaperBlueprint(value) && <p role="alert">请补齐蓝图并使各节分数之和等于总分。</p>}
    {hasBasket && <div className="edu-paper-actions">
      <Button className="edu-primary-action-contrast" data-testid="paper-basket-save-blueprint" isDisabled={disabled || !dirty || !validPaperBlueprint(value)} onPress={onSave}>保存蓝图</Button>
      <Button variant="secondary" isDisabled={disabled || !dirty} onPress={onDiscard}>放弃蓝图修改</Button>
    </div>}
  </section>;
}
