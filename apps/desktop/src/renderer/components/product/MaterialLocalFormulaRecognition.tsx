import { Button, TextArea } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { type DocumentStructureReference } from "../../../shared/material-document-structure";
import { readableFormulaLatex, type FormulaRecognitionQuery, type FormulaRecognitionResult }
  from "../../../shared/material-formula-recognition";
import { QuestionMathText } from "../QuestionMathText";
import { FormulaComponentSetup } from "./FormulaComponentSetup";

const feedback: Partial<Record<FormulaRecognitionResult["state"], string>> = {
  unclear: "本次未得到可预览的公式候选，请对照原图补正。",
  cancelled: "已停止本机识别。",
  timeout: "本机识别超时，可重试或查看原图。",
  busy: "本机正在识别其他内容，请稍后重试。",
  failed: "本机公式识别失败，可重试或查看原图。",
  source_changed: "原页或结构版本有变化，请关闭窗口并刷新资料结构。",
};

export function MaterialLocalFormulaRecognition({ reference, page, regionId, target = "题干" }: {
  reference: DocumentStructureReference; page: number; regionId: string; target?: string;
}) {
  const key = useMemo(() => ({ reference, page, regionId, requestId: crypto.randomUUID() }), [reference, page, regionId]);
  const [result, setResult] = useState<FormulaRecognitionResult>();
  const [running, setRunning] = useState(false);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void window.omniEdu?.recognizeMaterialFormula({ ...key, action: "status" }).then(result => {
      if (active) setResult(result);
    }).catch(() => { if (active) setResult({ state: "unavailable" }); });
    return () => {
      active = false;
      void window.omniEdu?.recognizeMaterialFormula({ ...key, action: "cancel" }).catch(() => {});
    };
  }, [key]);

  const call = (action: FormulaRecognitionQuery["action"]) => window.omniEdu!.recognizeMaterialFormula({ ...key, action });
  async function run() {
    setRunning(true);
    setNotice("");
    try {
      const next = await call("run");
      setResult(next);
      setValue(next.state === "candidate" ? next.copyLatex ?? next.latex : "");
    } catch {
      setResult({ state: "failed" });
    } finally {
      setRunning(false);
    }
  }
  const valid = useMemo(() => readableFormulaLatex(value), [value]);
  return (
    <section aria-label="本机公式识别" data-testid="structure-local-formula">
      <div className="toolbar-row">
        {running ? <Button variant="secondary" onPress={() => void call("cancel").catch(() => {})}>停止识别</Button>
          : <Button variant="secondary" data-testid="structure-formula-local-run" onPress={() => void run()}
            isDisabled={!result || result.state === "unavailable" || result.state === "source_changed"}>本机识别公式</Button>}
      </div>
      {running && <p role="status">正在本机读取当前公式裁片…</p>}
      {!running && result?.state === "unavailable" && <FormulaComponentSetup onReady={() => setResult({ state: "ready" })} />}
      {!running && result && feedback[result.state] && <p role="status">{feedback[result.state]}</p>}
      {!running && result?.state === "candidate" && <>
        <p>请对照原图核对指数、下标和单位，确认后可把候选复制到{target}。</p>
        {result.copyLatex && <p>识别原文 <code>{result.latex}</code></p>}
        <label>公式候选（LaTeX）
          <TextArea value={value} fullWidth rows={2} maxLength={320} data-testid="structure-formula-local-candidate"
            onChange={event => { setValue(event.target.value); setNotice(""); }} />
        </label>
        {valid ? <QuestionMathText text={`$${value}$`} testId="structure-formula-local-preview" />
          : <p role="status">请补正公式格式后预览。</p>}
        <Button variant="secondary" isDisabled={!valid} data-testid="structure-formula-local-copy" onPress={async () => {
          try {
            await navigator.clipboard.writeText(`$${value.trim()}$`);
            setNotice(`已复制公式候选，可粘贴到${target}。`);
          } catch { setNotice("复制失败，请选中候选公式后复制。"); }
        }}>复制公式候选</Button>
        {notice && <p role="status">{notice}</p>}
      </>}
    </section>
  );
}
