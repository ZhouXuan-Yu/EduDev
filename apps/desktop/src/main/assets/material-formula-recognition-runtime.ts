import { app } from "electron";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reserveLocalWorker } from "../xiaozhi-agent/local-utility-host";
import { runWordOfficeProcess } from "./word-office-component";
import { installedFormulaRuntime, verifyFormulaModel, verifyFormulaRuntimeTree } from "./formula-component";
import { FORMULA_RECOGNITION_ENGINE, FORMULA_RECOGNITION_SCHEMA, readableFormulaLatex,
  type FormulaRecognitionResult } from "../../shared/material-formula-recognition";

async function runtime(): Promise<{ python: string; model: string; pythonRoot?: string } | undefined> {
  if (process.platform !== "win32" || process.arch !== "x64") return;
  const python = process.env.OMNI_EDU_FORMULA_PYTHON;
  const model = process.env.OMNI_EDU_FORMULA_MODEL_DIR;
  if (!python || !model || !path.isAbsolute(python) || !path.isAbsolute(model) || path.basename(python).toLowerCase() !== "python.exe")
    return installedFormulaRuntime();
  const [exe, dir] = await Promise.all([fs.lstat(python), fs.lstat(model)]).catch(() => []);
  if (!exe?.isFile() || !dir?.isDirectory() || exe.isSymbolicLink() || dir.isSymbolicLink()) return installedFormulaRuntime();
  return { python, model };
}

export async function localFormulaAvailable() {
  return Boolean(await runtime());
}

export async function recognizeLocalFormula(png: Buffer, signal: AbortSignal): Promise<FormulaRecognitionResult> {
  const config = await runtime();
  if (!config) return { state: "unavailable" };
  const release = reserveLocalWorker();
  if (!release) return { state: "busy" };
  try {
    try {
      if (config.pythonRoot) await verifyFormulaRuntimeTree(config.pythonRoot, signal);
      if (!await verifyFormulaModel(config.model, signal)) return { state: "unavailable" };
    } catch {
      signal.throwIfAborted();
      return { state: "unavailable" };
    }
    const system = process.env.SystemRoot || "C:\\Windows";
    const cache = path.join(app.getPath("userData"), "local-formula-cache");
    await fs.mkdir(cache, { recursive: true });
    const chineseFont = path.join(system, "Fonts", "msyh.ttc");
    const font = await fs.stat(chineseFont).then(() => chineseFont, () => path.join(system, "Fonts", "segoeui.ttf"));
    const env = { SystemRoot: system, WINDIR: system, TEMP: app.getPath("temp"), TMP: app.getPath("temp"),
      PADDLE_PDX_CACHE_HOME: cache, PADDLE_PDX_LOCAL_FONT_FILE_PATH: font };
    const cropSha256 = createHash("sha256").update(png).digest("hex");
    const recipe = { schemaVersion: FORMULA_RECOGNITION_SCHEMA, cropSha256, png: png.toString("base64") };
    const worker = fileURLToPath(new URL("./material-formula-recognition-worker.py", import.meta.url))
      .replace(/([\\/])app\.asar([\\/])/u, "$1app.asar.unpacked$2");
    const output = await runWordOfficeProcess(config.python, ["-I", "-B", worker, config.model],
      { cwd: cache, env, signal, timeout: 45_000, stdoutLimit: 4096, input: JSON.stringify(recipe) + "\n" });
    const reading: unknown = JSON.parse(output);
    if (!reading || typeof reading !== "object" || !("schemaVersion" in reading) || !("cropSha256" in reading) ||
        !("latex" in reading) || reading.schemaVersion !== FORMULA_RECOGNITION_SCHEMA || reading.cropSha256 !== cropSha256)
      return { state: "failed" };
    if (!readableFormulaLatex(reading.latex)) return { state: "unclear" };
    return { state: "candidate", latex: reading.latex, engine: FORMULA_RECOGNITION_ENGINE, cropSha256 };
  } catch (error) {
    if (signal.aborted) return { state: "cancelled" };
    const code = error instanceof Error ? error.message : "";
    return { state: code === "timeout" ? "timeout" : "failed" };
  } finally {
    release();
  }
}
