import { app } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reserveLocalWorker } from "../xiaozhi-agent/local-utility-host";
import { runWordOfficeProcess } from "./word-office-component";
import { FORMULA_RECOGNITION_ENGINE, FORMULA_RECOGNITION_SCHEMA, readableFormulaLatex,
  type FormulaRecognitionResult } from "../../shared/material-formula-recognition";

const MODEL_FILES = [
  ["inference.json", 506956, "01238434e33df83588e2627f350559b576e34551d2b2ffea148345032de56c00"],
  ["inference.pdiparams", 256845006, "e464f94412feaa98f8791eacc84684f887b3569e30e80c52b8112e9cf7d4069b"],
  ["inference.yml", 2244564, "96062655d94c21d39274328dbc82c1a487e66addb8425f5a7fd5b7dfb2421ec3"],
] as const;

async function runtime() {
  if (process.platform !== "win32" || process.arch !== "x64") return;
  const python = process.env.OMNI_EDU_FORMULA_PYTHON;
  const model = process.env.OMNI_EDU_FORMULA_MODEL_DIR;
  if (!python || !model || !path.isAbsolute(python) || !path.isAbsolute(model) || path.basename(python).toLowerCase() !== "python.exe") return;
  const [exe, dir] = await Promise.all([fs.lstat(python), fs.lstat(model)]).catch(() => []);
  if (!exe?.isFile() || !dir?.isDirectory() || exe.isSymbolicLink() || dir.isSymbolicLink()) return;
  return { python, model };
}

export async function localFormulaAvailable() {
  return Boolean(await runtime());
}

async function verifyModel(model: string, signal: AbortSignal) {
  for (const [name, expectedBytes, expectedSha256] of MODEL_FILES) {
    signal.throwIfAborted();
    const file = path.join(model, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedBytes) return false;
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file, { signal })) hash.update(chunk);
    if (hash.digest("hex") !== expectedSha256) return false;
  }
  return true;
}

export async function recognizeLocalFormula(png: Buffer, signal: AbortSignal): Promise<FormulaRecognitionResult> {
  const config = await runtime();
  if (!config) return { state: "unavailable" };
  const release = reserveLocalWorker();
  if (!release) return { state: "busy" };
  try {
    if (!await verifyModel(config.model, signal)) return { state: "unavailable" };
    const system = process.env.SystemRoot || "C:\\Windows";
    const cache = path.join(app.getPath("userData"), "local-formula-cache");
    await fs.mkdir(cache, { recursive: true });
    const env = { SystemRoot: system, WINDIR: system, TEMP: app.getPath("temp"), TMP: app.getPath("temp"),
      PADDLE_PDX_CACHE_HOME: cache, PADDLE_PDX_LOCAL_FONT_FILE_PATH: path.join(system, "Fonts", "msyh.ttc") };
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
