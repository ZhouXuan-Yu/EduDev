import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { readNativePdfText } from "../../src/main/assets/material-native-text-reader.ts";
import {
  NATIVE_TEXT_SCHEMA,
  validNativeTextResult,
} from "../../src/shared/material-native-text.ts";
const root = await fs.mkdtemp(path.resolve("test-results/native-pdf-range-"));
const checks = [];
const stamp = (stat) =>
  [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs]
    .map(String)
    .join(":");
async function check(name, action) {
  await action();
  checks.push(name);
  console.log("PASS " + name);
}
async function pdf(name, { large = false, rotate = 0, crop = false } = {}) {
  const file = path.join(root, name);
  const handle = await fs.open(file, "wx");
  let offset = 0;
  const offsets = [0];
  const write = async (text) => {
    const bytes = Buffer.from(text, "ascii");
    await handle.write(bytes, 0, bytes.length, offset);
    offset += bytes.length;
  };
  const object = async (number, body) => {
    offsets[number] = offset;
    await write(number + " 0 obj\n" + body + "\nendobj\n");
  };
  try {
    await write("%PDF-1.7\n");
    await object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    await object(2, "<< /Type /Pages /Count 1 /Kids [3 0 R] >>");
    await object(
      3,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ${crop ? "/CropBox [20 30 590 760]" : ""} /Rotate ${rotate} /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    );
    await object(4, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const text = "BT /F1 12 Tf 50 700 Td (C. source value) Tj ET";
    await object(5, `<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
    if (large) {
      offsets[6] = offset;
      const size = 128 * 1048576;
      await write(`6 0 obj\n<< /Length ${size} >>\nstream\n`);
      offset += size;
      await handle.truncate(offset);
      await write("\nendstream\nendobj\n");
    }
    const xref = offset;
    await write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (const item of offsets.slice(1))
      await write(String(item).padStart(10, "0") + " 00000 n \n");
    await write(
      `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    );
  } finally {
    await handle.close();
  }
  const stat = await fs.stat(file, { bigint: true });
  return {
    schemaVersion: NATIVE_TEXT_SCHEMA,
    file,
    version: createHash("sha256").update(name).digest("hex"),
    stamp: stamp(stat),
    page: 1,
  };
}
try {
  await check(
    "Actual PDF.js native extraction returns bounded source geometry and destroys its loading task",
    async () => {
      const result = await readNativePdfText(await pdf("plain.pdf"));
      assert(validNativeTextResult(result));
      assert(result.ok);
      assert.equal(result.lines[0].text, "C. source value");
      assert(result.items[0].box.every((n) => n >= 0 && n <= 1));
    },
  );
  await check(
    "A 128 MiB PDF uses range reads under one MiB without loading its unused stream",
    async () => {
      const request = await pdf("large.pdf", { large: true });
      const result = await readNativePdfText(request);
      assert(result.ok);
      assert(result.readBytes < 1048576);
      assert.equal(result.lines[0].text, "C. source value");
      console.log(
        JSON.stringify({
          syntheticFileBytes: 128 * 1048576,
          nativeReadBytes: result.readBytes,
        }),
      );
    },
  );
  await check(
    "CropBox offsets use the PDF.js viewport rather than the MediaBox origin",
    async () => {
      const result = await readNativePdfText(
        await pdf("crop.pdf", { crop: true }),
      );
      assert(result.ok);
      assert(Math.abs(result.items[0].box[0] - 30 / 570) < 0.001);
    },
  );
  await check(
    "Rotated native writing falls back to the original OCR path instead of emitting guessed boxes",
    async () => {
      const result = await readNativePdfText(
        await pdf("rotate.pdf", { rotate: 90 }),
      );
      assert(result.ok);
      assert.equal(result.items.length, 0);
      assert.equal(result.lines.length, 0);
    },
  );
  await check(
    "A stale file stamp fails before native text can be returned",
    async () => {
      const request = await pdf("changed.pdf");
      await fs.appendFile(request.file, "\n");
      await assert.rejects(() => readNativePdfText(request), /source_changed/);
    },
  );
  await check(
    "An unavailable page is rejected with no partial native receipt",
    async () => {
      const request = await pdf("page.pdf");
      await assert.rejects(
        () => readNativePdfText({ ...request, page: 2 }),
        /invalid_input/,
      );
    },
  );
  console.log(JSON.stringify({ success: true, count: checks.length, checks }));
} finally {
  const base = path.resolve("test-results"),
    relative = path.relative(base, root);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  assert(!(await fs.lstat(root)).isSymbolicLink());
  assert.equal((await fs.realpath(root)).toLowerCase(), root.toLowerCase());
  await fs.rm(root, { recursive: true });
}
