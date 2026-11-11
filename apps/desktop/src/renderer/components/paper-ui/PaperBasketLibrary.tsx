import {Button} from '@heroui/react';
import type {usePaperBasketWorkspace} from './usePaperBasketWorkspace';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

export function PaperBasketLibrary({state, disabled, canCreate, onOpen, onContinue, onNew}: {
  state: ReturnType<typeof usePaperBasketWorkspace>;
  disabled: boolean;
  canCreate: boolean;
  onOpen: (id: string) => Promise<void>;
  onContinue: () => void;
  onNew: () => void;
}) {
  const {basket, ownerId, summaries} = state;
  const saved = summaries.filter(item => item.sessionId === ownerId && item.id !== basket?.id);
  return <section className={styles.library} data-testid="paper-basket-library" aria-label="我的练习与试卷">
    <header className={styles.libraryHeading}>
      <div><h2>我的练习与试卷</h2><p>查看所选会话中保存在本机的题篮。</p></div>
      <Button variant="secondary" isDisabled={disabled || !canCreate} onPress={onNew}>新建题组</Button>
    </header>
    {basket && <article className={styles.savedRow} data-testid="paper-library-current">
      <div><p>{basket.state === 'active' ? '当前编辑' : '当前查看 · 已归档'}</p><h3>{basket.title}</h3>
        <p>{basket.entries.length} 题 · 修订 {basket.revision}</p></div>
      <Button variant="secondary" data-testid="paper-library-continue" isDisabled={disabled} onPress={onContinue}>
        {basket.state === 'active' ? '继续编辑' : '查看已归档题篮'}
      </Button>
    </article>}
    {saved.map(item => <article key={item.id} className={styles.savedRow} data-testid="paper-library-saved" data-basket-id={item.id}>
      <div><h3>{item.title}</h3><p>{item.count} 题 · {item.state === 'active' ? '已保存题篮' : '已归档'}</p></div>
      <Button variant="secondary" isDisabled={disabled} onPress={() => void onOpen(item.id)}>
        {item.state === 'active' ? '打开题篮' : '查看归档'}
      </Button>
    </article>)}
    {!basket && !saved.length && !state.loading && <p role="status">此会话暂无已保存题篮，可选择其他会话或新建题组。</p>}
  </section>;
}
