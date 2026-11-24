import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal } from "@heroui/react";
import type { DocumentStructureReference, StructureFormulaSource } from "../../../shared/material-document-structure";
import { readMaterialStructureCrop } from "./material-structure-source-image";
import { structureFormulaCandidate } from "./material-structure-formula-candidate";

type Candidate = NonNullable<ReturnType<typeof structureFormulaCandidate>>;

function FormulaFragments({ candidate }: { candidate: Candidate }) {
  const { numerator, denominator, copyText } = candidate;
  const [value, setValue] = useState(copyText ?? "");
  const [notice, setNotice] = useState("");
  return (
    <section aria-label="分式识别片段" data-testid="structure-formula-fragments">
      <p>上方识别为 <code>{numerator}</code>，下方识别为 <code>{denominator}</code></p>
      {copyText ? (
        <>
          <label>
            分式候选
            <Input data-testid="structure-formula-candidate" value={value} maxLength={96}
              onChange={event => { setValue(event.target.value); setNotice(""); }} />
          </label>
          <p>请对照原图核对符号和等号旁的其他内容。
            {/\p{Script=Greek}/u.test(copyText) && "OCR 读到了希腊字母，请留意外形相近的英文字母。"}
          </p>
          <Button variant="secondary" data-testid="structure-formula-copy" isDisabled={!value.trim()} onPress={async () => {
            try {
              await navigator.clipboard.writeText(value.trim());
              setNotice("已复制分式候选。可粘贴到题干后补正。");
            } catch {
              setNotice("复制失败，请选中分式候选后复制。");
            }
          }}>复制分式候选</Button>
          {notice && <p role="status">{notice}</p>}
        </>
      ) : <p>这些片段仍有疑义，请按原图补正。</p>}
    </section>
  );
}

export function MaterialStructureFormulaPreview({ reference, sources, disabled }: {
  reference: DocumentStructureReference;
  sources: StructureFormulaSource[];
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<number>();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ image: string; candidate?: Candidate } | { error: string }>();
  const trigger = useRef<HTMLElement | null>(null);
  const source = selected === undefined ? undefined : sources[selected];
  useEffect(() => {
    if (!source) return;
    let current = true;
    const candidate = window.omniEdu!.getMaterialStructure({
      resourceId: reference.resourceId, version: reference.version, page: source.page,
    }).then(view => structureFormulaCandidate(view, reference, source)).catch(() => undefined);
    void readMaterialStructureCrop(reference, source).then(async image => {
      if (!current) return;
      setResult({ image });
      const fragments = await candidate;
      if (current && fragments) setResult({ image, candidate: fragments });
    }).catch((error: unknown) => {
      if (current) setResult({ error: String(error).includes("source_changed")
        ? "原页已变化。关闭预览并刷新资料结构后再查看。"
        : "公式原图读取失败，请重试。" });
    });
    return () => { current = false; };
  }, [reference, source, retry]);

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
                    : <>
                      <img src={result.image} alt={`原卷第 ${source.page} 页的待核对公式`}
                        style={{ maxWidth: "100%", height: "auto" }} data-testid="structure-formula-image" />
                      {result.candidate && <FormulaFragments candidate={result.candidate} />}
                    </>}
              </Modal.Body>
              <Modal.Footer>
                {result && "error" in result && <Button variant="secondary" onPress={() => {
                  setResult(undefined);
                  setRetry(value => value + 1);
                }}>重试</Button>}
                <Button variant="secondary" onPress={close} data-testid="structure-formula-close">关闭</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </section>
  );
}
