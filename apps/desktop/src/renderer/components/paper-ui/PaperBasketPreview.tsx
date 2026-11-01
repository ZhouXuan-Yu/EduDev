import {useState} from 'react';
import {Button, Tabs} from '@heroui/react';
import type {PaperView} from '../../../shared/paper-blueprint';
import type {PaperBasketEntryView, PaperBasketView} from '../../../shared/paper-basket';
import {PaperExportEntry} from '../PaperExportEntry';
import {PaperQuestionContent} from './PaperQuestionContent';
import {basketReasons, basketSnapshotCurrent, orderedBasketEntries} from './paper-basket-ui';

export function PaperBasketPreview({basket, snapshot, disabled, dirty, onSnapshot, onDecide}: {
  basket: PaperBasketView;
  snapshot?: PaperView;
  disabled: boolean;
  dirty: boolean;
  onSnapshot: () => void;
  onDecide: (action: 'confirm' | 'reject') => void;
}) {
  const [audience, setAudience] = useState('student');
  const entries = orderedBasketEntries(basket);
  const current = !dirty && basketSnapshotCurrent(basket, snapshot);
  const orphaned = entries.filter(entry => !basket.blueprint.sections.some(section => section.id === entry.sectionId));
  function entryCard(entry: PaperBasketEntryView) {
    return <article className="edu-paper-candidate-card" key={entry.entryId}
      data-testid="paper-basket-preview-entry" data-entry-id={entry.entryId}>
      <h4>第 {entries.indexOf(entry) + 1} 题</h4>
      {!entry.availability.available && <p role="alert">{basketReasons[entry.availability.reason]}</p>}
      <PaperQuestionContent question={entry.question} contentVersion={entry.contentVersion} generation={entry.generation} showAnswers={audience === 'teacher'}/>
    </article>;
  }
  return <section data-testid="paper-basket-preview-page">
    <h2>{basket.title}</h2>
    <p>{basket.entries.length} 题 · {basket.blueprint.durationMinutes} 分钟 · {basket.blueprint.totalPoints} 分 · 题篮修订 {basket.revision}</p>
    <p>仅核对手选成员与当前来源；未扫描或自动补选整个题库。预览不等于教师确认，也不等于文件已导出。</p>
    <Tabs selectedKey={audience} onSelectionChange={key => setAudience(String(key))}>
      <Tabs.ListContainer><Tabs.List aria-label="预览版本">
        <Tabs.Tab id="student" data-testid="paper-basket-student">学生版<Tabs.Indicator/></Tabs.Tab>
        <Tabs.Tab id="teacher" data-testid="paper-basket-teacher">教师版<Tabs.Indicator/></Tabs.Tab>
      </Tabs.List></Tabs.ListContainer>
    <Tabs.Panel id={audience}>
    {dirty && <p role="alert">蓝图有未保存修改，下面仍是已保存题篮；请先保存并核对。</p>}
    {!basket.complete && <p role="alert">题篮尚有缺额、超额或失效条目，可继续预览，不能创建正式待确认快照。</p>}
    {basket.blueprint.sections.map(section => <section key={section.id} className="paper-section-preview">
      <h3>{section.label} · 每题 {section.points} 分</h3>
      {entries.filter(entry => entry.sectionId === section.id).map(entryCard)}
    </section>)}
    {!!orphaned.length && <section>
      <h3>原分节已移除的条目</h3>
      <p role="alert">完整条目仍保存在题篮，请返回整理重新安排。</p>
      {orphaned.map(entryCard)}
    </section>}
    </Tabs.Panel>
    </Tabs>
    <Button className="edu-primary-action-contrast" data-testid="paper-basket-snapshot" isDisabled={disabled || dirty || !basket.complete || basket.state !== 'active'} onPress={onSnapshot}>
      创建确切选题的待确认快照
    </Button>
    {snapshot && <section data-testid="paper-basket-snapshot-review">
      <h3>整卷快照</h3>
      <p>{snapshot.title} · {snapshot.count} 题 · {{pending: '待教师确认', confirmed: '已确认保存', rejected: '已拒绝'}[snapshot.state]}</p>
      <p>绑定题篮修订 {snapshot.basket?.basketRevision}。参考答案尚未独立核验正确性。</p>
      {!current && <p role="alert">当前篮、来源或修订与快照不一致，请重新核对后创建新快照；旧记录保留。</p>}
      {snapshot.state === 'pending' && <div className="edu-paper-actions">
        <Button className="edu-primary-action-contrast" data-testid="paper-basket-confirm" isDisabled={disabled || !current} onPress={() => onDecide('confirm')}>确认并保存试卷</Button>
        <Button variant="secondary" isDisabled={disabled || !current} onPress={() => onDecide('reject')}>拒绝此快照</Button>
      </div>}
      {current && snapshot.state === 'confirmed' && snapshot.exportCurrent === true && <PaperExportEntry view={snapshot} disabled={disabled}/>}
    </section>}
  </section>;
}
