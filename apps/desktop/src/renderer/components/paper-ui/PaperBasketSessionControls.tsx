import {useState} from 'react';
import {Button, Label, SearchField} from '@heroui/react';
import {PaperSelect} from './PaperSelect';
import type {usePaperBasketWorkspace} from './usePaperBasketWorkspace';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

export function PaperBasketSessionControls({state, disabled, inputDirty, onOpen}: {
  state: ReturnType<typeof usePaperBasketWorkspace>;
  disabled: boolean;
  inputDirty: boolean;
  onOpen: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const matching = state.owners.filter(owner => owner.title.includes(query) || owner.id === query);
  const visible = matching.slice(0, limit);
  const selected = state.owners.find(owner => owner.id === state.ownerId);
  if (selected && !visible.some(owner => owner.id === selected.id)) visible.unshift(selected);

  return <section aria-label="会话与已保存题篮">
    <div className={styles.sessionFields}>
      <SearchField value={query} onChange={value => {setQuery(value); setLimit(50);}}>
        <Label>查找所属会话</Label>
        <SearchField.Group><SearchField.Input data-testid="paper-basket-owner-search"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      <PaperSelect label="所属会话" value={state.ownerId} disabled={disabled || inputDirty} testId="paper-basket-owner"
        options={[{id: '', label: '创建新的本地组卷会话'}, ...visible.map(owner => ({id: owner.id, label: owner.title}))]}
        onChange={id => {void state.chooseOwner(id);}}/>
      <PaperSelect label="已保存题篮" value={state.basket?.id || ''} disabled={disabled || inputDirty} testId="paper-basket-saved"
        options={[{id: '', label: '选择题篮'}, ...state.summaries.filter(item => item.sessionId === state.ownerId).map(item => ({
          id: item.id, label: `${item.title} · ${item.count}题 · ${item.state === 'active' ? '继续' : '已归档'}`,
        }))]} onChange={id => {if (id) void onOpen(id);}}/>
    </div>
    {matching.length > limit && <Button variant="ghost" onPress={() => setLimit(value => value + 50)}>再显示 50 个会话</Button>}
    {state.summaryOffset < state.summaryTotal && <Button variant="secondary" isDisabled={disabled}
      data-testid="paper-basket-more" onPress={() => void state.loadMore()}>加载下一页题篮</Button>}
  </section>;
}
