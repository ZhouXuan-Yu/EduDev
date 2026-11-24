import { app, net } from "electron";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { noLinks } from "../xiaozhi-agent/managed-skills";
import { unpackFormulaZip, unpackPinnedTarMember } from "./formula-component-archive";
import { verifyOfficeTree as verifyRuntimeTree } from "./word-office-tree";
import recipe from "./formula-component-lock.json";
import type { FormulaComponentStatus } from "../../shared/material-formula-recognition";

const version = "formula-win64-v1";
const modelArchive = {
  url: "https://paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/PP-FormulaNet_plus-S_infer.tar",
  bytes: 259604480, sha256: "31e8659fd5bdbefcc1339ab531e359c58fae6c0971097ca4cc897073e3fd28a6",
};
const modelFiles = [
  ["inference.json", 259091968, 506956, "01238434e33df83588e2627f350559b576e34551d2b2ffea148345032de56c00"],
  ["inference.pdiparams", 1024, 256845006, "e464f94412feaa98f8791eacc84684f887b3569e30e80c52b8112e9cf7d4069b"],
  ["inference.yml", 256846848, 2244564, "96062655d94c21d39274328dbc82c1a487e66addb8425f5a7fd5b7dfb2421ec3"],
] as const;
const modelBytes = modelFiles.reduce((sum, file) => sum + file[2], 0);
const wheelFiles = [recipe.python, ...recipe.wheels];
const totalBytes = wheelFiles.reduce((sum, file) => sum + file.bytes, modelArchive.bytes);
const installedBytes = recipe.tree.installedBytes + modelBytes;
const supported = () => process.platform === "win32" && process.arch === "x64";
const root = () => path.resolve(app.getPath("userData"), "managed-components");
const target = () => path.join(root(), version);

export async function verifyFormulaModel(model: string, signal: AbortSignal) {
  noLinks(model);
  for (const [name, , expectedBytes, expectedSha256] of modelFiles) {
    signal.throwIfAborted();
    const file = path.join(model, name);
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedBytes) return false;
    const hash = createHash("sha256");
    for await (const block of createReadStream(file, { signal })) hash.update(block);
    if (hash.digest("hex") !== expectedSha256) return false;
  }
  return true;
}

type Artifact = { url: string; bytes: number; sha256: string };
async function download(artifact: Artifact, file: string, signal: AbortSignal, increment: (bytes: number) => void) {
  const response = await net.fetch(artifact.url, { credentials: "omit", redirect: "error", signal });
  if (!response.ok || !response.body) throw Error("download_failed");
  const handle = await fs.open(file, "wx");
  const stream = response.body.getReader();
  let size = 0;
  const hash = createHash("sha256");
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) break;
      signal.throwIfAborted();
      size += value.length;
      if (size > artifact.bytes) throw Error("configuration");
      hash.update(value);
      await handle.writeFile(value);
      increment(value.length);
    }
    if (size !== artifact.bytes || hash.digest("hex") !== artifact.sha256) throw Error("configuration");
  } finally {
    await stream.cancel().catch(() => {});
    stream.releaseLock();
    await handle.close();
  }
}

export async function installedFormulaRuntime() {
  if (!supported()) return;
  const folder = target();
  const pythonRoot = path.join(folder, "python");
  const python = path.join(pythonRoot, "python.exe"), model = path.join(folder, "model");
  const stamp = await fs.lstat(python).catch(() => undefined);
  if (!stamp?.isFile() || stamp.isSymbolicLink()) return;
  return { python, pythonRoot, model };
}

export async function verifyFormulaRuntimeTree(folder: string, signal: AbortSignal) {
  await verifyRuntimeTree(folder, recipe.tree, signal, true);
}

let installing: { controller: AbortController; status: FormulaComponentStatus } | undefined;
let failure: FormulaComponentStatus["reason"];

export async function formulaComponentState(): Promise<FormulaComponentStatus> {
  if (installing) return { ...installing.status };
  const phase = !supported() ? "unsupported" : failure ? "failed" : await installedFormulaRuntime() ? "ready" : "missing";
  return { phase, downloadedBytes: phase === "ready" ? totalBytes : 0, totalBytes, installedBytes, ...(failure ? { reason: failure } : {}) };
}

export function cancelFormulaInstallation() {
  installing?.controller.abort();
}

export async function installFormulaComponent(signal: AbortSignal): Promise<FormulaComponentStatus> {
  if (!supported() || installing) return formulaComponentState();
  const controller = new AbortController();
  const owned = AbortSignal.any([signal, controller.signal, AbortSignal.timeout(900_000)]);
  const status: FormulaComponentStatus = { phase: "checking", downloadedBytes: 0, totalBytes, installedBytes };
  installing = { controller, status };
  failure = undefined;
  let stage: string | undefined;
  try {
    noLinks(root(), true);
    await fs.mkdir(root(), { recursive: true });
    const current = await installedFormulaRuntime();
    if (current) {
      try {
        await verifyFormulaRuntimeTree(current.pythonRoot, owned);
        if (await verifyFormulaModel(current.model, owned)) return { ...status, phase: "ready", downloadedBytes: totalBytes };
      } catch { owned.throwIfAborted(); }
    }
    owned.throwIfAborted();
    const disk = await fs.statfs(root());
    if (Number(disk.bavail) * Number(disk.bsize) < installedBytes + modelArchive.bytes + 64 * 1024 ** 2) throw Error("disk_full");
    stage = await fs.mkdtemp(path.join(root(), ".formula-"));
    const python = path.join(stage, "python"), site = path.join(python, "site-packages");
    const model = path.join(stage, "model"), archive = path.join(stage, "archive");
    await fs.mkdir(site, { recursive: true });
    await fs.mkdir(model);
    const increment = (bytes: number) => { status.downloadedBytes += bytes; };
    status.phase = "downloading";
    for (const [i, artifact] of wheelFiles.entries()) {
      await download(artifact, archive, owned, increment);
      status.phase = "installing";
      await unpackFormulaZip(archive, i === 0 ? python : site, i > 0, owned);
      await fs.unlink(archive);
      status.phase = "downloading";
    }
    await fs.writeFile(path.join(python, "python313._pth"), "python313.zip\n.\nsite-packages\nimport site\n", "ascii");
    await download(modelArchive, archive, owned, increment);
    status.phase = "installing";
    for (const [name, offset, bytes] of modelFiles)
      await unpackPinnedTarMember(archive, offset, bytes, path.join(model, name), owned);
    await fs.unlink(archive);
    await verifyFormulaRuntimeTree(python, owned);
    if (!await verifyFormulaModel(model, owned)) throw Error("configuration");
    owned.throwIfAborted();
    let previous: string | undefined;
    if (await fs.lstat(target()).catch(() => undefined)) {
      noLinks(target());
      previous = path.join(root(), `.formula-previous-${Date.now()}`);
      await fs.rename(target(), previous);
    }
    try { await fs.rename(stage, target()); }
    catch (error) {
      if (previous) await fs.rename(previous, target());
      throw error;
    }
    stage = undefined;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    failure = controller.signal.aborted || signal.aborted ? undefined :
      reason === "disk_full" ? "disk_full" : reason === "configuration" ? "verification_failed" : "download_failed";
  } finally {
    try {
      if (stage && path.dirname(path.resolve(stage)) === root() && path.basename(stage).startsWith(".formula-"))
        await fs.rm(stage, { recursive: true, force: true });
    } finally { installing = undefined; }
  }
  return formulaComponentState();
}
