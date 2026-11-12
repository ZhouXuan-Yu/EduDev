import { Button, Modal } from "@heroui/react";
import {useLayoutEffect, useRef} from 'react';
import { validPaperBlueprint } from "../../../shared/paper-blueprint";
import { validPracticeSetup } from "../../../shared/paper-purpose";
import { PaperBasketBlueprintForm } from "./PaperBasketBlueprintForm";
import { PaperBasketSessionControls } from "./PaperBasketSessionControls";
import {
  PaperPracticeSetup,
  PaperPurposeControls,
} from "./PaperPurposeControls";
import type { usePaperBasketWorkspace } from "./usePaperBasketWorkspace";
import type {PaperSourceAction} from './usePaperSourceIntent';
import styles from "../../ui-system/paper-studio/paper-library-browser.module.css";

/** The existing host create/retry contract remains owned by the workspace. */
export function PaperBasketCreateDialog({
  state,
  onOpen,
  onClose,
  onCreate,
  selectingQuestion = false,
  sourceAction,
}: {
  state: ReturnType<typeof usePaperBasketWorkspace>;
  onOpen: (id: string) => Promise<void>;
  onClose: () => void;
  onCreate: () => void;
  selectingQuestion?: boolean;
  sourceAction?: PaperSourceAction;
}) {
  const disabled = state.busy || state.loading || state.retryable;
  const retryButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const control = retryButton.current;
    if (!state.busy && state.retryable && control &&
        !control.closest('[role="dialog"]')?.contains(document.activeElement)) control.focus();
  }, [state.busy, state.retryable]);
  const ready =
    state.draftPurpose === "practice"
      ? validPracticeSetup({
          title: state.blueprint.title,
          subject: state.blueprint.subject,
          grade: state.blueprint.grade,
        })
      : validPaperBlueprint(state.blueprint);
  return (
    <Modal.Backdrop
      isOpen
      isKeyboardDismissDisabled={state.busy}
      onOpenChange={(open) => {
        if (!open && !state.busy) onClose();
      }}
    >
      <Modal.Container size="lg" scroll="inside">
        <Modal.Dialog data-testid="paper-basket-create-dialog">
          <Modal.Header>
            <Modal.Heading>新建题篮</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className={styles.setup}>
              {selectingQuestion && <p role="note" data-testid="paper-library-selection-context">
                保存题篮后，将重新核对刚才选择的题目来源并加入。原题仍保留在题库。
              </p>}
              {sourceAction && <p role="note" data-testid="paper-source-creation-context">
                确认题篮信息后，继续{sourceAction === 'reference' ? '选择参考卷并核对来源' : '编辑出题方案'}。
              </p>}
              <PaperBasketSessionControls
                state={state}
                disabled={disabled}
                inputDirty={state.dirty}
                onOpen={onOpen}
              />
              <PaperPurposeControls
                purpose={state.draftPurpose}
                disabled={disabled}
                onPurpose={state.setPurposeDraft}
              />
              {state.draftPurpose === "practice" ? (
                <PaperPracticeSetup
                  value={state.blueprint}
                  disabled={disabled}
                  onChange={state.setDraft}
                />
              ) : (
                <PaperBasketBlueprintForm
                  value={state.blueprint}
                  disabled={disabled}
                  dirty={state.dirty}
                  hasBasket={false}
                  canDiscard={
                    !state.busy &&
                    !state.loading &&
                    (state.dirty || state.retryable)
                  }
                  onChange={state.setDraft}
                  onSave={() => {}}
                  onDiscard={state.discardDraft}
                />
              )}
              {state.error && (
                <div role="alert" data-testid="paper-basket-create-error">
                  <p>{state.error}</p>
                  {state.retryable && (
                    <Button
                      ref={retryButton}
                      variant="secondary"
                      isDisabled={state.busy}
                      onPress={() => void state.retry()}
                    >
                      重试同一请求
                    </Button>
                  )}
                </div>
              )}
              {state.draftPurpose === "practice" && state.dirty && (
                <Button
                  variant="ghost"
                  isDisabled={disabled}
                  onPress={state.discardDraft}
                >
                  放弃新练习输入
                </Button>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              isDisabled={state.busy}
              onPress={onClose}
            >
              保留输入并关闭
            </Button>
            <Button
              data-testid="paper-basket-create"
              isDisabled={disabled || !ready}
              onPress={onCreate}
            >
              {selectingQuestion ? "保存题篮并加入所选题" : sourceAction ? '保存题篮并继续' : "保存题篮并找题"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
