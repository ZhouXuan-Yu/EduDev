import type {ReactNode} from 'react';
import {Button, Modal} from '@heroui/react';
import styles from '../../ui-system/paper-studio/paper-editor.module.css';

export type PaperEditorRecovery = {
  error: string;
  busy: boolean;
  retryable: boolean;
  onRetry: () => Promise<boolean | undefined>;
};

export function PaperInstanceDialog({open, blocked, entryId, recovery, onClose, onReload, children}: {
  open: boolean;
  blocked: boolean;
  entryId: string;
  recovery?: PaperEditorRecovery;
  onClose: () => void;
  onReload: () => void;
  children: ReactNode;
}) {
  return <Modal.Backdrop isOpen={open} variant="opaque" isDismissable={!blocked} isKeyboardDismissDisabled={blocked}
    onOpenChange={next => {if (!next && !blocked) onClose();}}>
    <Modal.Container className={styles.dialogContainer} scroll="inside" placement="center">
      <Modal.Dialog className={styles.dialog} data-testid="paper-instance-dialog" data-entry-id={entryId}>
        <Modal.Header><Modal.Heading>编辑与核对本卷题目</Modal.Heading></Modal.Header>
        <Modal.Body>
          {recovery?.error && <section role="alert" data-testid="paper-instance-dialog-error">
            <p>{recovery.error}</p>
            <div className={styles.actions}>
              {recovery.retryable && <Button variant="secondary" data-testid="paper-instance-dialog-retry" isDisabled={recovery.busy}
                onPress={() => {void recovery.onRetry();}}>重试同一请求</Button>}
              <Button variant="secondary" isDisabled={recovery.busy} onPress={onReload}>重新读取题篮</Button>
            </div>
          </section>}
          <div className={styles.dialogContent}>{children}</div>
        </Modal.Body>
        <Modal.Footer>
          {blocked && <span className={styles.note}>请先保存、放弃未保存输入，或核实操作结果。</span>}
          <Button variant="secondary" data-testid="paper-instance-dialog-close" isDisabled={blocked} onPress={onClose}>完成</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>;
}
