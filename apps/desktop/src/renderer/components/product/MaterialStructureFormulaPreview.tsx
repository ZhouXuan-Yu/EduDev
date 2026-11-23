import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import type { DocumentStructureReference, StructureFormulaSource } from "../../../shared/material-document-structure";
import { readMaterialStructureCrop } from "./material-structure-source-image";

export function MaterialStructureFormulaPreview({ reference, sources, disabled }: {
  reference: DocumentStructureReference;
  sources: StructureFormulaSource[];
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<number>();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ image: string } | { error: string }>();
  const trigger = useRef<HTMLElement | null>(null);
  const source = selected === undefined ? undefined : sources[selected];
  useEffect(() => {
    if (!source) return;
    let current = true;
    void readMaterialStructureCrop(reference, source).then(image => {
      if (current) setResult({ image });
    }).catch((error: unknown) => {
      if (current) setResult({ error: String(error).includes("source_changed")
        ? "原页已变化。关闭预览并刷新资料结构后再查看。"
        : "公式原图读取失败，请重试。" });
    });
    return () => { current = false; };
  }, [reference.resourceId, reference.version, source, retry]);

  function close() {
    setSelected(undefined);
    setResult(undefined);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <section aria-label="待核对公式">
      <p>公式文字识别不完整，请对照原图补正。</p>
      <div className="toolbar-row">
        {sources.map((item, index) => (
          <Button key={item.lineIds[0]} variant="secondary" isDisabled={disabled}
            data-testid={`structure-review-formula-${index}`}
            onPress={() => {
              trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
              setResult(undefined);
              setSelected(index);
            }}>
            {sources.length === 1 ? "查看公式原图" : `查看公式 ${index + 1} 原图`}
          </Button>
        ))}
      </div>
      {source && (
        <Modal.Backdrop isOpen onOpenChange={open => { if (!open) close(); }}>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog className="pi-themed-surface" data-testid="structure-formula-dialog" data-material-draft-scope="workspace">
              <Modal.Header><Modal.Heading>公式原图 · 第 {source.page} 页</Modal.Heading></Modal.Header>
              <Modal.Body>
                {!result ? <p role="status">正在读取公式原图…</p>
                  : "error" in result ? <p role="alert">{result.error}</p>
                    : <img src={result.image} alt={`原卷第 ${source.page} 页的待核对公式`}
                      style={{ maxWidth: "100%", height: "auto" }} data-testid="structure-formula-image" />}
              </Modal.Body>
              <Modal.Footer>
                {result && "error" in result && <Button variant="secondary" onPress={() => {
                  setResult(undefined);
                  setRetry(value => value + 1);
                }}>重试</Button>}
                <Button variant="secondary" onPress={close}>关闭</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </section>
  );
}
