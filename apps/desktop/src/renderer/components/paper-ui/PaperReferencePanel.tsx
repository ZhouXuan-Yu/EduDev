import {useState} from 'react';
import {Button, Card, Label, SearchField, TextArea} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperReferenceFields} from './PaperReferenceFields';
import type {usePaperReference} from './usePaperReference';

export function PaperReferencePanel({state, onMaterials}: {state: ReturnType<typeof usePaperReference>; onMaterials: () => void}) {
  const [search, setSearch] = useState('');
  if (!state.open) return null;
  return <section className="edu-paper-sidebar" data-testid="paper-reference-panel" aria-label="参考卷提取与核对">
    <Card><Card.Header><Card.Title>参考卷提取与核对</Card.Title>
      <Card.Description>从真实资料检查命题结构与卷面规则。本页修改暂留，不会改变手选题。</Card.Description></Card.Header><Card.Content>
    <p>先选择来源，再对照依据修订候选；在“命题结构与卷面模板”中保存确切版本。离开前请保存或取消核对。</p>
    <Button variant="secondary" data-testid="paper-reference-cancel" onPress={() => state.close()}>取消核对</Button>
    {state.discarding && <div role="alert" data-testid="paper-reference-discard-prompt"><p>本页有未保存的教师修订。放弃后不会修改题篮或原资料。</p>
      <Button variant="secondary" onPress={state.keep}>继续核对</Button>
      <Button variant="secondary" data-testid="paper-reference-discard" onPress={() => state.close(true)}>放弃候选修改并关闭</Button>
    </div>}
    {state.error && <p role="alert" data-testid="paper-reference-error">{state.error}</p>}
    {state.busy && <p role="status">正在读取确切来源版本；可取消，迟到结果不会覆盖输入。</p>}
    {state.sourceInvalid && <p role="alert">来源核实未通过，当前输入仅供对照，不能视为有效模板。</p>}
    </Card.Content></Card>
    {!state.candidate && <DisclosureCard title="选择已导入的参考资料" defaultExpanded data-testid="paper-reference-sources">
      <SearchField value={search} onChange={setSearch} isDisabled={state.busy || state.listing}><Label>查找已导入资料</Label>
        <SearchField.Group><SearchField.Input autoFocus data-testid="paper-reference-search"/><SearchField.ClearButton/></SearchField.Group></SearchField>
      <Button variant="secondary" isDisabled={state.busy || state.listing} data-testid="paper-reference-search-submit" onPress={() => void state.list(search, 0)}>查找资料</Button>
      <Button variant="secondary" isDisabled={state.busy || state.listing} data-testid="paper-reference-import" onPress={() => {if (state.close()) onMaterials();}}>去资料库导入或检查原文</Button>
      {state.listing && <p role="status">正在读取资料列表…</p>}
      {!state.listing && !state.items.length && <p>此页暂无可选资料，可继续翻页或去资料库导入。</p>}
      {state.items.map(item => <Card key={item.resourceId} data-testid="paper-reference-source" data-resource-id={item.resourceId}>
        <Card.Header><Card.Title>{item.title}</Card.Title><Card.Description>{item.filename} · {item.chunkCount}段已收录正文{item.parseStatus === 'partial' ? ' · 部分收录' : ''}</Card.Description></Card.Header><Card.Content>
        <Button variant="secondary" data-testid={'paper-reference-extract-' + item.resourceId}
          isDisabled={state.busy || state.listing || item.chunkCount === 0} onPress={() => void state.extract(item)}>提取并核对</Button>
        </Card.Content></Card>)}
      <Button variant="secondary" data-testid="paper-reference-previous" isDisabled={state.busy || state.listing || !state.offset}
        onPress={() => void state.list(state.query, Math.max(0, state.offset - 50))}>上一页资料</Button>
      <Button variant="secondary" data-testid="paper-reference-next" isDisabled={state.busy || state.listing || !state.hasMore}
        onPress={() => void state.list(state.query, state.offset + 50)}>下一页资料</Button>
    </DisclosureCard>}
    {state.candidate && <>
      <Card data-testid="paper-reference-overview"><Card.Header><Card.Title>本次提取概览</Card.Title></Card.Header><Card.Content>
      <p>参考资料：{state.candidate.source.filename || '所选资料'}</p>
      <p data-testid="paper-reference-coverage">已读取{state.candidate.source.readChunks}/{state.candidate.source.totalChunks}段正文 · {state.candidate.source.complete ? '已读取全部已收录正文' : '部分读取，不能代表整卷'} · 本次不调用模型</p>
      {state.candidate.warnings.map((warning, index) => <p role="note" key={index}>{warning}</p>)}
      <Button variant="secondary" data-testid="paper-reference-recheck" isDisabled={state.busy} onPress={() => void state.extract({resourceId: state.candidate!.source.resourceId,
        version: state.candidate!.source.version, title: '', filename: '', parseStatus: '', chunkCount: 0}, true)}>重新核实来源并保留修改</Button>
      <Button variant="secondary" data-testid="paper-reference-change-source" isDisabled={state.busy} onPress={state.clearCandidate}>重新选择参考资料</Button>
      </Card.Content></Card>
      <DisclosureCard title="来源正文节选" data-testid="paper-reference-context">
        <p>以下为前三段已收录正文的有界节选，不代表原卷全文；具体字段依据另列在各项下。</p>
        {state.candidate.evidence.filter(item => item.id.startsWith('context_')).map(item => <div key={item.id}>
          <p>已收录正文第{(item.source?.offset || 0) + 1}段</p><TextArea aria-label="只读正文节选" readOnly value={item.text}/>
        </div>)}
      </DisclosureCard>
      <PaperReferenceFields candidate={state.candidate} disabled={state.busy} onEdit={state.edit}/>
      <Button variant="secondary" data-testid="paper-reference-add-section" isDisabled={state.busy || state.candidate.sections.length >= 20} onPress={state.addSection}>补充一个待核对分节</Button>
    </>}
  </section>;
}
