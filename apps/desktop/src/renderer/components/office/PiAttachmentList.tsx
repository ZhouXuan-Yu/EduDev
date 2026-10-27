import {Button} from '@heroui/react';
import {FileText, X} from 'lucide-react';
import type {XiaozhiAttachment} from '../../../shared/xiaozhi-attachments';
import {OfficeMutationBoundary} from './OfficeSynchronization';

export type PiAttachmentListItem = XiaozhiAttachment & {src?: string};

export function PiAttachmentList({
  items,
  busy = false,
  removeLabel = '移除附件',
  onOpen,
  onRemove,
}: {
  items: readonly PiAttachmentListItem[];
  busy?: boolean;
  removeLabel?: string;
  onOpen?: (item: PiAttachmentListItem) => void;
  onRemove?: (item: PiAttachmentListItem) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="pi-agent-attachment-list" data-testid="pi-agent-attachment-list" aria-label="附件">
      {items.map(item => (
        <div className="pi-agent-attachment-item" data-testid={`pi-agent-attachment-${item.id}`} data-state={item.state} key={item.id}>
          <button
            type="button"
            className="pi-agent-attachment-open"
            aria-label={`预览附件 ${item.name}`}
            onClick={() => onOpen?.(item)}
          >
            {item.src ? (
              <img className="pi-agent-attachment-thumb" src={item.src} alt="" />
            ) : (
              <span className="pi-agent-attachment-icon" aria-hidden="true"><FileText size={16} /></span>
            )}
            <span className="pi-agent-attachment-name" title={item.name}>{item.name}</span>
          </button>
          {onRemove && <OfficeMutationBoundary><Button
            variant="ghost"
            isIconOnly
            size="sm"
            className="pi-agent-attachment-remove"
            aria-label={`${removeLabel} ${item.name}`}
            isDisabled={busy}
            onPress={() => onRemove(item)}
          ><X size={14} /></Button></OfficeMutationBoundary>}
        </div>
      ))}
    </div>
  );
}
