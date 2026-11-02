import {Button} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperInstanceBlockEditor} from './PaperInstanceBlockEditor';
import {instanceRoles, instanceRoleLabels} from './paper-instance-content';
import type {PaperWorkspaceBasket} from './paper-basket-client';
import type {PaperInstanceDraftController} from './usePaperInstanceDrafts';

export function PaperInstanceOrphanDrafts({basket, drafts}: {basket: PaperWorkspaceBasket; drafts: PaperInstanceDraftController}) {
  return <>{Object.values(drafts.drafts).filter(draft => basket.state === 'archived' || !basket.entries.some(entry => entry.entryId === draft.entryId)).map((draft, index) =>
    <DisclosureCard key={draft.entryId} data-testid="paper-instance-retained-input" title={`${basket.state === 'archived' ? '已归档题篮' : '已移出题目'}的未保存输入 ${index + 1}`} defaultExpanded>
      <p role="alert">{basket.state === 'archived' ? '题篮已归档，已保存内容保持只读。以下为本机未保存输入，可查看或明确放弃，不会写入归档题篮。'
        : '此题已不在宿主保存的当前题篮中。输入仍保留；不会自动加回题篮或覆盖其他题目。'}</p>
      {instanceRoles.map(role => <section key={role}><h4>{instanceRoleLabels[role]}</h4>
        {draft.content[role].mode === 'edited' ? draft.content[role].blocks.map((block, i) =>
          <PaperInstanceBlockEditor key={i} block={block} disabled onChange={() => {}}/>) : <p>原题内容未修改。</p>}
      </section>)}
      <Button variant="secondary" data-testid="paper-instance-discard-retained-input" isDisabled={!drafts.ready}
        onPress={() => drafts.discard(draft.entryId)}>放弃此题本地输入</Button>
    </DisclosureCard>)}</>;
}
