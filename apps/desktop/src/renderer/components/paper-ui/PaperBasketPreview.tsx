import {PaperLayoutPreview} from './PaperLayoutPreview';
import {purposeFulfillmentBlocksConfirmation} from '../../../shared/paper-purpose';
import {useState} from 'react';
import {Button, Tabs} from '@heroui/react';
import type {PaperView} from '../../../shared/paper-blueprint';
import type {PaperBasketEntryView, PaperBasketView} from '../../../shared/paper-basket';
import {PaperExportEntry} from '../PaperExportEntry';
import {PaperQuestionContent} from './PaperQuestionContent';
import {basketReasons, basketSnapshotCurrent, orderedBasketEntries} from './paper-basket-ui';
import type {PaperWorkspaceBasket, PaperWorkspaceEntry} from './paper-basket-client';
import {PaperInstanceContent} from './PaperInstanceContent';

export function PaperBasketPreview({basket, snapshot, disabled, dirty, onSnapshot, onDecide,onConfirmAll}: {
  basket: PaperWorkspaceBasket;
  snapshot?: PaperView;
  disabled: boolean;
  dirty: boolean;
  onSnapshot: () => void;
  onDecide: (action: 'confirm' | 'reject') => void;
  onConfirmAll?:()=>void;
}) {
  const [audience, setAudience] = useState('student');
  const entries = orderedBasketEntries(basket);
  const current = !dirty && basketSnapshotCurrent(basket, snapshot);
  const orphaned = entries.filter(entry => !basket.blueprint.sections.some(section => section.id === entry.sectionId));
  const templateReady=!basket.c2||(basket.templateSourceCurrent!==false&&!basket.c2.retainedSections.some(r=>!r.released)&&!basket.c2.unknownRetainedSections?.some(r=>!r.released)&&entries.every(e=>basket.c2!.entryPoints[e.entryId]===basket.blueprint.sections.find(s=>s.id===e.sectionId)?.points));
  const requirementsReady=!(basket.purpose==='paper'&&basket.paperRequirements==='required')&&!purposeFulfillmentBlocksConfirmation(basket.purpose,basket.fulfillment);
  const bulkReady=requirementsReady&&templateReady&&entries.length>0&&!basket.gaps.length&&!orphaned.length&&entries.every(e=>e.availability.available&&e.instance&&(!e.deliveryBlock||e.deliveryBlock==='needs_review'));
  function entryCard(entry: PaperWorkspaceEntry) {
    return <article className="edu-paper-candidate-card" key={entry.entryId}
      data-testid="paper-basket-preview-entry" data-entry-id={entry.entryId}>
      <h4>第 {entries.indexOf(entry) + 1} 题</h4>
      {!entry.availability.available && <p role="alert">{basketReasons[entry.availability.reason]}</p>}
      <PaperInstanceContent entry={entry} showAnswers={audience === 'teacher'}/>
      {entry.instance && <p>{entry.reviewCurrent ? '当前修订已核对' : '当前修订尚待核对'}</p>}
    </article>;
  }
  return <section data-testid="paper-basket-preview-page">
    <h2>{basket.title}</h2>
    {basket.c2&&<p data-testid="paper-c2-output-status">此卷绑定确切模板版本；确认后使用同一快照准备导出，导出前再次核对来源。</p>}
    <p>{basket.purpose==='practice'?'练习 · ':''}{basket.entries.length} 题 · {basket.purpose==='practice'?'按当前选题核对，无考试时长要求':basket.blueprint.durationMinutes+' 分钟 · '+basket.blueprint.totalPoints+' 分'} · 题篮修订 {basket.revision}</p>
    <p>仅核对手选成员与当前来源；未扫描或自动补选整个题库。预览不等于教师确认，也不等于文件已导出。</p>
    <Tabs selectedKey={audience} onSelectionChange={key => setAudience(String(key))}>
      <Tabs.ListContainer><Tabs.List aria-label="预览版本">
        <Tabs.Tab id="student" data-testid="paper-basket-student">学生版<Tabs.Indicator/></Tabs.Tab>
        <Tabs.Tab id="teacher" data-testid="paper-basket-teacher">教师版<Tabs.Indicator/></Tabs.Tab>
      </Tabs.List></Tabs.ListContainer>
    <Tabs.Panel id={audience}>
    {dirty && <p role="alert">蓝图有未保存修改，下面仍是已保存题篮；请先保存并核对。</p>}
    {basket.state === 'archived' ? <p role="note">此题篮已归档，仅供查看；不能修改或创建新的待确认快照。</p>
      : !basket.complete && <p role="alert">题篮尚有缺额、超额、失效条目或待核对修订，可继续预览，完成核对后才能正式出卷。</p>}
    <PaperLayoutPreview layout={current?snapshot?.c2?.layout:basket.c2?.layout}>
    {basket.blueprint.sections.map(section => <section key={section.id} className="paper-section-preview">
      <h3>{section.label} · 每题 {section.points} 分</h3>
      {entries.filter(entry => entry.sectionId === section.id).map(entryCard)}
    </section>)}
    {!!orphaned.length && <section>
      <h3>原分节已移除的条目</h3>
      <p role="alert">完整条目仍保存在题篮，请返回整理重新安排。</p>
      {orphaned.map(entryCard)}
    </section>}
    </PaperLayoutPreview>
    </Tabs.Panel>
    </Tabs>
    {onConfirmAll&&(basket.schemaVersion==='xiaozhi.paper-basket.v2')&&!(current&&snapshot?.state==='confirmed')&&<section data-testid="paper-basket-whole-confirmation">
      <p>核对上方最终题目、分值与解析后，可一次确认整卷，无需逐题点击核对。确认保存不等于文件已导出。</p>
      <Button className="edu-primary-action-contrast" data-testid="paper-basket-confirm-all" isDisabled={disabled||dirty||!bulkReady||basket.state!=='active'} onPress={onConfirmAll}>确认全部当前修订并保存试卷</Button>
    </section>}
    <Button variant="secondary" data-testid="paper-basket-snapshot" isDisabled={disabled || dirty || !basket.complete || basket.state !== 'active'} onPress={onSnapshot}>
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
