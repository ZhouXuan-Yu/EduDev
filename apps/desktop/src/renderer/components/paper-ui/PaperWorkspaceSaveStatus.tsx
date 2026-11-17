import {useState} from 'react';
import {Button, Popover} from '@heroui/react';
import styles from '../../ui-system/paper-studio/paper-save-status.module.css';

/** Stable workspace footer. Persistence and recovery remain owned by the original hook. */
export function PaperWorkspaceSaveStatus({loading, busy, retryable, hasBasket, archived, inputDirty, uiDirty, uiSaveBlocked, uiDiscarded, onSave, onDiscard}: {
  loading: boolean;
  busy: boolean;
  retryable: boolean;
  hasBasket: boolean;
  archived: boolean;
  inputDirty: boolean;
  uiDirty: boolean;
  uiSaveBlocked: boolean;
  uiDiscarded: boolean;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
}) {
  const [open, setOpen] = useState(false);
  let message = hasBasket ? '题篮已保存到本机' : '选题后自动保存题篮';
  if (archived) message = '已归档 · 只读';
  if (inputDirty) message = '有未保存输入';
  if (busy) message = '正在核对或保存…';
  if (retryable) message = '操作结果待核实';
  if (uiDirty) message = uiSaveBlocked ? '浏览偏好保存未完成' : '浏览偏好待保存…';
  if (uiDiscarded) message = '本次浏览偏好仅临时生效';
  if (loading) message = '正在恢复题篮与浏览偏好…';

  async function save() {
    if (await onSave()) setOpen(false);
  }

  return <footer className={styles.footer} data-testid="paper-workspace-save-status" data-saving={busy}>
    <span role="status" data-testid={uiDiscarded ? 'paper-basket-ui-local' : uiDirty ? 'paper-basket-ui-pending' : undefined}>
      {message}
    </span>
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" isDisabled={!hasBasket || archived || loading || busy}
        data-testid="paper-basket-save-status-menu">浏览偏好</Button>
      <Popover.Content placement="top">
        <Popover.Dialog aria-label="浏览偏好保存">
          <div className={styles.details}>
            <Popover.Heading>浏览偏好保存</Popover.Heading>
            <p>{uiDiscarded
              ? '已放弃本地浏览偏好。本次浏览仅临时生效，未声明保存成功；题篮成员和蓝图草稿均保留。'
              : '筛选条件、阅读位置和当前步骤会自动保存。题目、分值和教师输入由各自的保存操作管理。'}</p>
            {uiSaveBlocked && <p role="alert">保存结果尚未核实，请重试原请求或明确放弃本次浏览偏好。</p>}
            <div className={styles.actions}>
              {uiDiscarded ? <Button variant="secondary" isDisabled={busy} data-testid="paper-basket-restore-ui"
                onPress={() => {void save();}}>恢复保存浏览偏好</Button> : <>
                <Button variant="secondary" isDisabled={busy || !uiDirty} data-testid="paper-basket-save-ui"
                  onPress={() => {void save();}}>{uiSaveBlocked ? '重试保存浏览偏好' : '立即保存浏览偏好'}</Button>
                <Button variant="ghost" isDisabled={busy || !uiDirty} data-testid="paper-basket-discard-ui"
                  onPress={() => {onDiscard(); setOpen(false);}}>放弃未保存浏览偏好</Button>
              </>}
            </div>
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  </footer>;
}
