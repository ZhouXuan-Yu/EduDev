import type { TeacherResource } from "../../shared/contracts";
import {
  NATIVE_TEXT_SCHEMA,
  validNativeTextResult,
  type NativeTextResult,
} from "../../shared/material-native-text";
import { runLocalUtility } from "../xiaozhi-agent/local-utility-host";
import type { MaterialRepository } from "./material-repository";

export async function nativePdfText(
  repository: MaterialRepository,
  resource: TeacherResource,
  page: number,
  signal: AbortSignal,
): Promise<NativeTextResult> {
  const before = await repository.originalStamp(
    resource.id,
    resource.contentHash,
  );
  const result = await runLocalUtility({
    entry: "pdf-text-worker.js",
    serviceName: "小智 PDF 原生页文字",
    timeout: 45000,
    signal,
    request: {
      schemaVersion: NATIVE_TEXT_SCHEMA,
      file: resource.localPath,
      version: resource.contentHash,
      stamp: before,
      page,
    },
    valid: validNativeTextResult,
    fail: (error) =>
      ({ schemaVersion: NATIVE_TEXT_SCHEMA, ok: false, error }) as const,
  });
  signal.throwIfAborted();
  if (
    (await repository.originalStamp(resource.id, resource.contentHash)) !==
      before ||
    (!result.ok && result.error === "source_changed")
  )
    throw Error("source_changed");
  return result;
}
