import {Button, Input, TextArea} from '@heroui/react';
import type {PaperInstanceBlock} from '../../../shared/paper-instance';

/** Natural block fields; identifiers and image authorization are never editable inputs. */
export function PaperInstanceBlockEditor({block, disabled, onChange,imageDeliverable=false}: {
  block: PaperInstanceBlock; disabled: boolean; onChange: (block: PaperInstanceBlock) => void;imageDeliverable?:boolean;
}) {
  if (block.type === 'text' || block.type === 'formula') return <label className="edu-paper-instance-field">
    {block.type === 'text' ? '文字' : '公式（LaTeX）'}
    <TextArea data-testid={block.type === 'text' ? 'paper-instance-text' : 'paper-instance-formula'} disabled={disabled}
      rows={block.type === 'text' ? 4 : 2} maxLength={32768} value={block.type === 'text' ? block.text : block.latex}
      onChange={event => onChange(block.type === 'text' ? {...block, text: event.target.value} : {...block, latex: event.target.value})}/>
  </label>;
  if (block.type === 'sourceImage') return <p role="note" data-testid="paper-instance-source-image">
    {imageDeliverable?'已保留独立题面插图。请在保存后的题面中核对位置、标注和清晰度；正式出卷前仍需核对当前修订。':'已保留此处原图引用。原图仅作为对照；配图尚未获得独立交付资格时，修改可保存但不能正式出卷。请对照原题核实图文依赖。'}
  </p>;
  if (block.type === 'options' || block.type === 'subquestions') return <div className="edu-paper-instance-items">
    {block.items.map((item, index) => <fieldset key={index} disabled={disabled}>
      <legend>{block.type === 'options' ? '选项' : '小问'} {index + 1}</legend>
      <label>标号<Input data-testid="paper-instance-item-label" maxLength={24} value={item.label}
        onChange={event => onChange({...block, items: block.items.map((value, i) => i === index ? {...value, label: event.target.value} : value)})}/></label>
      <label>内容<TextArea data-testid="paper-instance-item-text" maxLength={32768} value={item.text}
        onChange={event => onChange({...block, items: block.items.map((value, i) => i === index ? {...value, text: event.target.value} : value)})}/></label>
      <Button variant="ghost" isDisabled={disabled || block.items.length === 1} onPress={() => onChange({...block, items: block.items.filter((_, i) => i !== index)})}>移除此项</Button>
    </fieldset>)}
    <Button variant="secondary" isDisabled={disabled || block.items.length >= 30} onPress={() => onChange({...block,
      items: [...block.items, {label: block.type === 'options' ? String.fromCharCode(65 + block.items.length) : String(block.items.length + 1), text: ''}]})}>添加{block.type === 'options' ? '选项' : '小问'}</Button>
  </div>;
  return <div className="edu-paper-instance-table">
    <table><caption>本卷表格</caption><tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c}>
      <Input aria-label={`第 ${r + 1} 行第 ${c + 1} 列`} maxLength={32768} value={cell} disabled={disabled}
        onChange={event => onChange({...block, rows: block.rows.map((value, ri) => ri === r ? value.map((text, ci) => ci === c ? event.target.value : text) : value)})}/>
    </td>)}</tr>)}</tbody></table>
    <div className="edu-paper-actions">
      <Button variant="secondary" isDisabled={disabled || block.rows.length >= 50} onPress={() => onChange({...block, rows: [...block.rows, block.rows[0].map(() => '')]})}>添加行</Button>
      <Button variant="secondary" isDisabled={disabled || block.rows[0].length >= 20} onPress={() => onChange({...block, rows: block.rows.map(row => [...row, ''])})}>添加列</Button>
      <Button variant="ghost" isDisabled={disabled || block.rows.length === 1} onPress={() => onChange({...block, rows: block.rows.slice(0, -1)})}>移除末行</Button>
      <Button variant="ghost" isDisabled={disabled || block.rows[0].length === 1} onPress={() => onChange({...block, rows: block.rows.map(row => row.slice(0, -1))})}>移除末列</Button>
    </div>
  </div>;
}
