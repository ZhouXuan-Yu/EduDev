import {
  NATIVE_TEXT_SCHEMA,
  validNativeTextRequest,
  type NativeTextResult,
} from "../../shared/material-native-text";
import { readNativePdfText } from "./material-native-text-reader";
const parent = (
  process as unknown as {
    parentPort?: {
      on: (name: string, listener: (event: { data: unknown }) => void) => void;
      postMessage: (value: unknown) => void;
    };
  }
).parentPort;
let started = false;
async function receive(value: unknown) {
  if (started) return;
  started = true;
  let result: NativeTextResult;
  try {
    if (!validNativeTextRequest(value)) throw Error("invalid_input");
    result = await readNativePdfText(value);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    result = {
      schemaVersion: NATIVE_TEXT_SCHEMA,
      ok: false,
      error: [
        "source_changed",
        "invalid_input",
        "too_large",
        "unavailable",
      ].includes(code)
        ? code
        : "parse_failed",
    };
  }
  if (parent) parent.postMessage(result);
  else process.send?.(result);
}
if (parent) parent.on("message", (event) => void receive(event.data));
else process.on("message", (value) => void receive(value));
