import assert from "node:assert/strict";
import {
  alignSourcePartWhitespace,
  validSourceParts,
  sourcePartRanges,
} from "../../src/shared/question-source-content.ts";
import { parseAiPageResponse } from "../../src/shared/material-ai-page.ts";
import { archiveEligible } from "../../src/shared/question-archive.ts";

export async function runSourceWhitespaceChecks({
  check,
  sourceContentFixtures,
  MaterialAiRepository,
}) {
  const { fixture, enabled } = sourceContentFixtures;
  await check(
    "Exact source partitions retain identity and strict validation still rejects unequal concatenation",
    () => {
      const exact = [{ role: "body", text: "原文 \n甲" }];
      assert.equal(alignSourcePartWhitespace(exact, exact[0].text), exact);
      const parts = [
        { role: "marker", text: "1." },
        { role: "body", text: "原文" },
      ];
      assert(!validSourceParts(parts, "1. 原文"));
      assert(
        validSourceParts(
          alignSourcePartWhitespace(parts, "1. 原文"),
          "1. 原文",
        ),
      );
      assert.deepEqual(parts, [
        { role: "marker", text: "1." },
        { role: "body", text: "原文" },
      ]);
    },
  );
  await check(
    "Whitespace alignment preserves literal Unicode, line breaks and contiguous UTF16 source ranges",
    () => {
      const text = "1. \n「2025某市中考」\t😀甲−乙=2²℃\n";
      const parts = [
        { role: "marker", text: "1." },
        { role: "publication", text: "「2025某市中考」" },
        { role: "body", text: "😀甲−乙=2²℃" },
      ];
      const aligned = alignSourcePartWhitespace(parts, text);
      assert(aligned);
      assert.equal(aligned.map((part) => part.text).join(""), text);
      assert.deepEqual(
        aligned.map((part) => part.role),
        parts.map((part) => part.role),
      );
      const ranges = sourcePartRanges({ text, parts: aligned });
      assert(
        ranges.every((part) => text.slice(part.start, part.end) === part.text),
      );
      assert.equal(ranges[0].start, 0);
      assert.equal(ranges.at(-1).end, text.length);
      assert(ranges.slice(1).every((part, i) => ranges[i].end === part.start));
    },
  );
  await check(
    "Repeated text is consumed sequentially and redundant internal whitespace cannot rewrite the literal crop",
    () => {
      const parts = [
        { role: "body", text: "甲甲" },
        { role: "body", text: "甲甲" },
      ];
      const text = "甲 甲\n甲 甲";
      assert.equal(
        alignSourcePartWhitespace(parts, text)
          .map((part) => part.text)
          .join(""),
        text,
      );
      assert.equal(
        alignSourcePartWhitespace([{ role: "body", text: "2 3" }], "23")[0]
          .text,
        "23",
      );
    },
  );
  await check(
    "Numbers, negation, units, operators, exponents and omitted or added text cannot be aligned",
    () => {
      for (const [part, text] of [
        ["2", "3"],
        ["是", "不是"],
        ["2m", "2cm"],
        ["x2", "x²"],
        ["甲-乙", "甲−乙"],
        ["原文", "完整原文"],
        ["多余原文", "原文"],
      ]) {
        assert.equal(
          alignSourcePartWhitespace([{ role: "body", text: part }], text),
          undefined,
        );
      }
    },
  );
  await check(
    "Malformed partitions cannot gain roles or execute getters during whitespace alignment",
    () => {
      let getters = 0;
      const accessor = {
        role: "body",
        get text() {
          getters++;
          return "原文";
        },
      };
      for (const parts of [
        [accessor],
        [{ role: "footer", text: "原文" }],
        [{ role: "body", text: "原文", extra: 1 }],
        new Array(1),
        [{ role: "body", text: "" }],
        [{ role: "body", text: " " }],
        Array.from({ length: 33 }, () => ({ role: "body", text: "原文" })),
      ]) {
        assert.equal(alignSourcePartWhitespace(parts, "原文"), undefined);
      }
      assert.equal(getters, 0);
    },
  );
  await check(
    "Actual executor stores original v2 response bytes while cold source documents use lossless aligned parts",
    () =>
      enabled(async () => {
        const f = await fixture((response, input) => {
          if (input.previous)
            response.readings[0].crops[0].parts[0].text = "1.";
        });
        try {
          await f.run();
          const question = await f.question();
          assert(archiveEligible(question), JSON.stringify(question.archive));
          const raw = f.db
            .prepare("SELECT first_json,final_json FROM material_ai_units")
            .get();
          assert.equal(raw.final_json, f.raw[2]);
          const response = JSON.parse(raw.final_json),
            crop = response.readings[0].crops[0];
          assert(!validSourceParts(crop.parts, crop.text));
          const reading =
            question.document.context.sourceContent.crops[0].readings[1];
          assert.equal(reading.text, crop.text);
          assert(validSourceParts(reading.parts, crop.text));
          await new MaterialAiRepository(f.host).validate(question);
          assert.deepEqual(
            f.db
              .prepare("SELECT first_json,final_json FROM material_ai_units")
              .get(),
            raw,
          );
          for (const [key, value] of [
            ["text", crop.parts[2].text + "漏字"],
            ["role", "footer"],
          ]) {
            const changed = JSON.parse(raw.final_json);
            changed.readings[0].crops[0].parts[2][key] = value;
            assert.throws(
              () => parseAiPageResponse(JSON.stringify(changed)),
              /invalid_response/,
            );
          }
        } finally {
          await f.dispose();
        }
      }),
  );
}
