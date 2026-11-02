import {Button} from '@heroui/react';
import type {PaperInstanceBlock, PaperInstanceRole, PaperInstanceRoleContent} from '../../../shared/paper-instance';
import type {PaperWorkspaceEntry} from './paper-basket-client';
import {blankInstanceBlock, seedInstanceRole} from './paper-instance-content';
import {PaperInstanceBlockEditor} from './PaperInstanceBlockEditor';
import {instanceOptionsRequired} from './paper-instance-options';

const names = {text: '文字', formula: '公式', table: '表格', options: '选项', subquestions: '小问', sourceImage: '原图引用'};
export function PaperInstanceRoleEditor({entry, role, content, disabled, onChange}: {
  entry: PaperWorkspaceEntry; role: PaperInstanceRole; content: PaperInstanceRoleContent;
  disabled: boolean; onChange: (content: PaperInstanceRoleContent) => void;
}) {
  if (content.mode === 'source') return <div>
    <p>沿用加入题篮时的原题内容。</p>
    <Button variant="secondary" data-testid={`paper-instance-edit-${role}`} isDisabled={disabled}
      onPress={() => onChange({mode: 'edited', blocks: seedInstanceRole(entry, role)})}>编辑本卷{role === 'question' ? '题目' : role === 'answer' ? '答案' : '解析'}</Button>
  </div>;
  const edited = content;
  function update(index: number, block: PaperInstanceBlock) {onChange({...edited, blocks: edited.blocks.map((value, i) => i === index ? block : value)});}
  function move(index: number, direction: number) {
    const blocks = [...edited.blocks]; [blocks[index], blocks[index + direction]] = [blocks[index + direction], blocks[index]];
    onChange({...edited, blocks});
  }
  return <section className="edu-paper-instance-role" data-testid={`paper-instance-role-${role}`}>
    <p>仅修改当前卷，原题与其他题篮保持各自版本。</p>
    {role === 'question' && instanceOptionsRequired(entry.question.questionType, content) && <p role="alert" data-testid="paper-instance-options-required">
      尚未建立可核对的选项。请使用“添加选项”逐项填写并核对；可保存当前输入，但补齐至少两个选项前不能正式出卷或生成答题卡。
    </p>}
    {content.blocks.map((block, index) => <fieldset className="edu-paper-instance-block" key={index}>
      <legend>第 {index + 1} 块 · {names[block.type]}</legend>
      <PaperInstanceBlockEditor block={block} disabled={disabled} onChange={value => update(index, value)}/>
      <div className="edu-paper-actions">
        <Button variant="ghost" aria-label={`上移第 ${index + 1} 块`} isDisabled={disabled || index === 0} onPress={() => move(index, -1)}>上移</Button>
        <Button variant="ghost" aria-label={`下移第 ${index + 1} 块`} isDisabled={disabled || index === content.blocks.length - 1} onPress={() => move(index, 1)}>下移</Button>
        <Button variant="ghost" aria-label={`移除第 ${index + 1} 块`} isDisabled={disabled || content.blocks.length === 1}
          onPress={() => onChange({...content, blocks: content.blocks.filter((_, i) => i !== index)})}>移除此块</Button>
      </div>
    </fieldset>)}
    <div className="edu-paper-actions">{(['text', 'options', 'subquestions', 'formula', 'table'] as const).map(type => <Button key={type}
      variant="secondary" data-testid={`paper-instance-add-${type}`} isDisabled={disabled || content.blocks.length >= 200}
      onPress={() => onChange({...content, blocks: [...content.blocks, blankInstanceBlock(type)]})}>添加{names[type]}</Button>)}</div>
    <Button variant="ghost" isDisabled={disabled} onPress={() => onChange({mode: 'source'})}>此部分改回原题内容</Button>
  </section>;
}
