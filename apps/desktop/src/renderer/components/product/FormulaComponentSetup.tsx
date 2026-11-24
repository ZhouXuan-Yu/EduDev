import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { formulaComponentInstalling, type FormulaComponentStatus } from "../../../shared/material-formula-recognition";

const errors = {
  disk_full: "本机空间不足，请释放空间后重试。",
  verification_failed: "组件校验失败，请重新下载安装。",
  download_failed: "下载或安装中断，请重试。",
};
const mib = (bytes: number) => Math.ceil(bytes / 1024 ** 2);

export function FormulaComponentSetup({ onReady }: { onReady: () => void }) {
  const [status, setStatus] = useState<FormulaComponentStatus>();
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState("");
  const installing = formulaComponentInstalling(status);
  useEffect(() => {
    let live = true;
    const refresh = () => void window.omniEdu?.formulaComponent("status").then(value => {
      if (live) {
        setStatus(value);
        if (installing && value.phase === "ready") onReady();
      }
    }).catch(() => { if (live) setNotice("无法查看组件状态，请重开公式窗口。"); });
    refresh();
    const interval = starting || installing ? window.setInterval(refresh, 550) : undefined;
    return () => { live = false; window.clearInterval(interval); };
  }, [installing, onReady, starting]);

  async function install() {
    setStarting(true);
    setNotice("");
    try {
      const next = await window.omniEdu!.formulaComponent("install");
      setStatus(next);
      if (next.phase === "ready") onReady();
    } catch { setNotice("目前无法安装本机公式组件，请重试。"); }
    finally { setStarting(false); }
  }
  if (status?.phase === "unsupported") return <p>当前设备可查看原图。公式识别组件支持 Windows x64。</p>;
  return (
    <div data-testid="structure-local-formula-setup">
      {status && <p>组件需下载约 {mib(status.totalBytes)} MiB，安装后占用约 {mib(status.installedBytes)} MiB。</p>}
      {starting || installing ? <>
        <progress aria-label="公式组件安装进度" max={status?.totalBytes || 1} value={status?.downloadedBytes ?? 0} />
        <p role="status">{status?.phase === "installing" ? "正在解包和校验组件…" : status?.phase === "downloading"
          ? `正在下载公式组件 ${mib(status.downloadedBytes)} / ${mib(status.totalBytes)} MiB…` : "正在检查组件…"}</p>
        <Button variant="secondary" onPress={() => void window.omniEdu?.formulaComponent("cancel").catch(() => {})}>取消安装</Button>
      </> : status && <Button variant="secondary" data-testid="structure-formula-install" onPress={() => void install()}>
        {status.phase === "ready" ? "重新校验公式组件" : status.phase === "failed" ? "重试安装公式组件" : "安装本机公式组件"}
      </Button>}
      {(notice || status?.reason) && <p role="status">{notice || (status?.reason && errors[status.reason])}</p>}
    </div>
  );
}
