import { nativeImage, type IpcMain, type IpcMainInvokeEvent } from "electron";
import type { OmniEduStore } from "../db";
import { validPageBox } from "../../shared/material-page-preview";
import { validFormulaRecognitionQuery, type FormulaRecognitionQuery, type FormulaRecognitionResult }
  from "../../shared/material-formula-recognition";
import { localFormulaAvailable, recognizeLocalFormula } from "./material-formula-recognition-runtime";

async function formulaSource(store: OmniEduStore, query: FormulaRecognitionQuery) {
  const { reference, page, regionId } = query;
  const key = { resourceId: reference.resourceId, version: reference.version, page };
  const view = await store.materialStructures.view(key);
  if (view.summary?.generation !== reference.generation || view.references?.[reference.candidateId]?.sha256 !== reference.sha256)
    throw Error("source_changed");
  const source = view.questions.find(question => question.id === reference.candidateId)
    ?.formulaSources?.find(source => source.page === page && source.regionId === regionId);
  if (!source || source.rasterSha256 !== view.page?.rasterSha256 || !validPageBox(source.box)) throw Error("source_changed");
  return { source, key };
}

export function registerFormulaRecognition(store: OmniEduStore, ipcMain: Pick<IpcMain, "handle">,
  check: (event: IpcMainInvokeEvent) => void) {
  let active: { id: string; controller: AbortController } | undefined;
  ipcMain.handle("materials:formula-recognition", async (event, input: unknown): Promise<FormulaRecognitionResult> => {
    check(event);
    if (!validFormulaRecognitionQuery(input)) throw Error("invalid_input");
    if (input.action === "status") return { state: await localFormulaAvailable() ? "ready" : "unavailable" };
    if (input.action === "cancel") {
      if (active?.id === input.requestId) active.controller.abort();
      return { state: "cancelled" };
    }
    if (active) return { state: "busy" };
    const controller = new AbortController();
    const { signal } = controller;
    const closed = () => controller.abort();
    active = { id: input.requestId, controller };
    event.sender.once("destroyed", closed);
    try {
      const { source, key } = await formulaSource(store, input);
      await store.materials.verify(key.resourceId, key.version, signal);
      const image = await store.materialStructures.image(key);
      if (image.sha256 !== source.rasterSha256) return { state: "source_changed" };
      const raster = nativeImage.createFromDataURL(await store.readStructureImage(image, signal));
      const [left, top, right, bottom] = source.box;
      const x = Math.floor(left * image.width), y = Math.floor(top * image.height);
      const width = Math.ceil(right * image.width) - x, height = Math.ceil(bottom * image.height) - y;
      if (width * height > 420_000 || Math.min(width, height) < 8 || raster.isEmpty()) return { state: "unclear" };
      const png = raster.crop({ x, y, width, height }).toPNG({ scaleFactor: 1 });
      if (png.length > 1024 * 1024) return { state: "unclear" };
      const result = await recognizeLocalFormula(png, signal);
      if (signal.aborted) return { state: "cancelled" };
      check(event);
      await formulaSource(store, input);
      await store.materials.verify(key.resourceId, key.version, signal);
      return result;
    } catch (error) {
      if (signal.aborted) return { state: "cancelled" };
      const code = error instanceof Error ? error.message : "";
      return { state: ["source_changed", "missing", "not_found"].includes(code) ? "source_changed" : "failed" };
    } finally {
      event.sender.removeListener("destroyed", closed);
      active = undefined;
    }
  });
}
