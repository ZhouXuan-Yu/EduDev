import { dialog, nativeImage, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { PageBox } from "../../shared/material-page-preview";
import { neutralizePaleOverprint, overprintFocus, tableVisionPlan, validTableVisionQuery, type TableVisionCell, type TableVisionResult } from "../../shared/material-table-vision";
import type { OmniEduStore } from "../db";
import { recognizeLocalImage } from "../xiaozhi-agent/ocr-host";
import { createStudentContextSanitizer } from "../students/context-sanitizer";
import { readTableWithDeepSeek, contrastReadingConflict } from "./material-table-vision-provider";

type Context = {
  store: OmniEduStore;
  window: () => BrowserWindow | undefined;
  ipcMain: Pick<Electron.IpcMain, "handle">;
  check: (event: IpcMainInvokeEvent) => void;
  account: () => Promise<{ apiKey?: string }>;
};
const exposedErrors = new Set(["source_changed", "source_incomplete", "privacy_blocked", "busy",
  "configuration", "invalid_response", "unit_too_large", "timeout", "authentication", "rate_limit"]);

function overprintContrast(bytes: Buffer) {
  const crop = nativeImage.createFromBuffer(bytes);
  const pixels = crop.toBitmap({ scaleFactor: 1 });
  neutralizePaleOverprint(pixels);
  const size = crop.getSize();
  return nativeImage.createFromBitmap(pixels, size)
    .crop(overprintFocus(pixels, size.width, size.height)).toPNG({ scaleFactor: 1 });
}

function renderCrop(image: Electron.NativeImage, box: PageBox) {
  const {width, height} = image.getSize();
  const x = Math.floor(box[0] * width), y = Math.floor(box[1] * height);
  const cropWidth = Math.ceil(box[2] * width) - x, cropHeight = Math.ceil(box[3] * height) - y;
  if (!cropWidth || !cropHeight || cropWidth * cropHeight > 1_200_000) throw Error("unit_too_large");
  return image.crop({x, y, width: cropWidth, height: cropHeight}).toPNG({scaleFactor: 1});
}

export function registerTableVisionIpc({ store, window, ipcMain, check, account }: Context) {
  let active: { key: string; controller: AbortController } | undefined;
  ipcMain.handle("materials:table-vision", async (event, input: unknown): Promise<TableVisionResult> => {
    check(event);
    if (!validTableVisionQuery(input)) throw Error("invalid_input");
    const query: TableVisionCell = { reference: input.reference, page: input.page, regionId: input.regionId,
      row: input.row, column: input.column };
    const repository = store.materialStructures;
    const { reference, page, regionId, row, column } = query;
    const key = JSON.stringify([reference.resourceId, reference.version, reference.generation, reference.sha256, page, regionId, row, column]);
    if (input.action === "cancel") {
      if (active?.key === key) active.controller.abort();
      return { status: "cancelled" };
    }
    if (input.action === "read") {
      const candidate = await repository.readTableVision(query);
      check(event);
      return candidate ? {status:"candidate", candidate} : {status:"empty"};
    }
    if (active) throw Error("busy");
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(85_000)]);
    const closed = () => controller.abort();
    active = { key, controller };
    event.sender.once("destroyed", closed);
    try {
      const prior = await repository.readTableVision(query);
      if (prior) return {status:"candidate", candidate:prior};
      const { resourceId, version } = query.reference;
      const stamp = await store.materials.originalStamp(resourceId, version);
      const { table, image } = await repository.tableVisionSource(query, signal);
      const plan = tableVisionPlan(table, query.row, query.column);
      const { apiKey } = await account();
      if (!apiKey) throw Error("configuration");
      const { response } = await dialog.showMessageBox(window()!, {
        type: "question", title: "视觉回查", message: "将所选格和关联表格局部发送到 DeepSeek？",
        detail: "请先对照原图，仅在资料可外发且这些区域不含学生姓名、作答或其他个人信息时继续。返回内容会作为待核候选。",
        buttons: ["取消", "确认发送"], defaultId: 0, cancelId: 0, noLink: true, signal,
      });
      if (response !== 1 || controller.signal.aborted) return {status:"cancelled"};
      const source = nativeImage.createFromDataURL(await store.readStructureImage(image, signal));
      if (source.isEmpty() || source.getSize().width !== image.width || source.getSize().height !== image.height) throw Error("source_changed");
      const target = renderCrop(source, plan.target);
      const images = { target, context: renderCrop(source, plan.context),
        ...(plan.suspectedOverprint ? { contrast: overprintContrast(target) } : {}),
        ...(plan.header ? { header: renderCrop(source, plan.header) } : {}),
        ...(plan.rowLabel ? { rowLabel: renderCrop(source, plan.rowLabel) } : {}) };
      const clean = await createStudentContextSanitizer(store);
      let contrastReading: { text: string; confidence: number } | undefined;
      for (const [role, bytes] of Object.entries(images)) {
        signal.throwIfAborted();
        try {
          const { text, scores } = await recognizeLocalImage(bytes, signal);
          if (await clean(text) !== text) throw Error("privacy_blocked");
          if (role === "contrast") contrastReading = { text, confidence: Math.min(...scores) };
        } catch (error) {
          if (!(error instanceof Error) || error.message !== "empty") throw error;
        }
      }
      const guard = async () => {
        signal.throwIfAborted();
        check(event);
        await repository.assertTableVisionCurrent(query);
        if (await store.materials.originalStamp(resourceId, version) !== stamp) throw Error("source_changed");
        if ((await account()).apiKey !== apiKey) throw Error("configuration");
      };
      let candidate = await readTableWithDeepSeek({ images, relativeColumn: plan.relativeColumn,
        relativeRow: plan.relativeRow, apiKey, signal, beforeSend: guard });
      if (contrastReading && candidate.text && contrastReadingConflict(candidate.text, contrastReading)) {
        candidate = { ...candidate, state: "conflict", text: null };
      }
      for (const field of [candidate.text, candidate.columnLabel, candidate.unit]) {
        if (field && await clean(field) !== field) throw Error("privacy_blocked");
      }
      await guard();
      const published = await repository.saveTableVision(query, candidate, signal);
      check(event);
      return {status:"candidate", candidate:published};
    } catch (error) {
      if (controller.signal.aborted) return {status:"cancelled"};
      if (signal.aborted || error instanceof Error && error.name === "TimeoutError") throw Error("timeout");
      const code = error instanceof Error ? error.message : "";
      throw Error(exposedErrors.has(code) ? code : "unavailable");
    } finally {
      event.sender.removeListener("destroyed", closed);
      if (active?.controller === controller) active = undefined;
    }
  });
}
