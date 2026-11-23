import assert from "node:assert/strict";
import {naturalLessonDraft} from "../../src/main/education/natural-lesson-draft.ts";

const accepted = (text, grade, subject) => assert.deepEqual(naturalLessonDraft(text),
  {mode:"outline",lesson:{subject,grade,curricula:[]}});
accepted("请生成一份五年级语文教案。主题是区分事实和观点。", "五年级", "语文");
accepted("帮我写一份40分钟的高一物理《浮力》教案。", "高一", "物理");
accepted("新任务：为我设计一节数学 四年级的单元教案。", "四年级", "数学");
accepted("请为小学六年级下册科学准备一份教案。", "六年级", "科学");
for(const prompt of [
  "五年级语文教案", "请查看五年级语文教案", "帮我改写五年级语文教案",
  "如何写五年级语文教案？", "给我一个五年级语文教案模板",
  "请写一份语文教案", "继续做五年级语文教案", "导出已确认的五年级语文教案",
  "请根据我上传的资料写五年级语文教案", "写一份五年级语文教案并生成PPT",
  "写五年级语文和六年级数学的比较教案", "请列出五年级语文的教案检查标准",
  "能否解释教案为何要有板书设计", "生成一份教案，数学和语文待定",
]) assert.equal(naturalLessonDraft(prompt), undefined, prompt);
console.log("PASS explicit natural lesson draft admission and normal chat controls");
