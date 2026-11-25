import { useEffect, useState } from 'react';
import { Button, Modal } from '@heroui/react';
import type { TeacherResource } from '../../../shared/contracts';
import { MATERIAL_PREVIEW_SCHEMA, materialPreviewErrorText, type MaterialPreviewResult } from '../../../shared/material-page-preview';

export function MaterialLocalBookAnswerSource({ resource, page, onClose }: {
  resource: Pick<TeacherResource,'id'|'contentHash'>; page: number; onClose: () => void;
}) {
  const [result, setResult] = useState<MaterialPreviewResult>();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true;
    const requestId = crypto.randomUUID();
    const base = { schemaVersion: MATERIAL_PREVIEW_SCHEMA, requestId } as const;
    void window.omniEdu!.getMaterialPagePreview({ ...base, resourceId: resource.id, version: resource.contentHash,
      page, box: [0, 0, 1, 1] }).then(receipt => {
      if (current) setResult(receipt);
    }).catch(() => {
      if (current) setResult({ schemaVersion: MATERIAL_PREVIEW_SCHEMA, ok: false, error: 'unavailable' });
    });
    return () => {
      current = false;
      void window.omniEdu?.cancelMaterialPagePreview(base).catch(() => undefined);
    };
  }, [resource.id, resource.contentHash, page, revision]);

  return <Modal.Backdrop isOpen onOpenChange={open => { if (!open) onClose(); }}>
    <Modal.Container size="lg" scroll="inside">
      <Modal.Dialog className="pi-themed-surface" data-testid="local-book-answer-source">
        <Modal.Header><Modal.Heading>答案册原图 · 第 {page} 页</Modal.Heading></Modal.Header>
        <Modal.Body>
          {!result ? <p role="status">正在读取答案册原图…</p> : result.ok
            ? <img src={result.dataUrl} alt={`答案册第 ${page} 页原图`} style={{ maxWidth: '100%', height: 'auto' }}/>
            : <p role="alert">{materialPreviewErrorText(result.error)}</p>}
        </Modal.Body>
        <Modal.Footer>
          {result && !result.ok && <Button variant="secondary" onPress={() => {
            setResult(undefined);setRevision(value => value + 1);
          }}>重试</Button>}
          <Button variant="secondary" onPress={onClose}>关闭</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>;
}
