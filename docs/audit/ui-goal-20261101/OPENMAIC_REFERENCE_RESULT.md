# OpenMAIC 真实参考验收边界（U6，2026-11-01）

结论：**参考验收未通过，不能声称完整流程或产品质量对齐。** 本记录仅依据已保存的公开教学内容和验收报告；不包含私有推理或原始 API body。

## 原始真实运行：BhNFAC

- Run：`run-vNU8VcMTxnvHgY1Q`；stage：`stage--W1UazzJr3r6`（由公开 API ledger 定位，随访未取得当前 owner 的读取权限）。
- 原报告 `success=false`，已通过 **3 项检查**：实际 provider 配置记录及禁用联网/媒体/云端文档能力；大纲暂停超过默认倒计时；教师通过真实 UI 明确确认三场景、40 分钟大纲。不能将倒计时自动继续算作教师确认。
- 已保存真实生成的公开课程：两页 slide《测力计里的 3 N 与 2 N》《受了浮力，为什么还会下沉》，以及一个 quiz 场景《单选题：这个物体受浮力吗》。生成完成及内容保存不等于实际预览通过。
- 严格要求测验内 **1 题**，实际为 **2 题**：正常单选题 `q1`，以及零分 `q1-followup-placeholder`（“（占位题，请忽略）”）。占位或零分不能作为忽略额外题目的理由。原断言 `Exactly one question required` 失败，保持原断言及失败结果。
- 已有 1366×768、1920×1080 的大纲截图；原运行在题数断言处停止，没有完成 slide 预览、真实答题反馈或刷新回读验收。

## 只读随访：GqFbFa

- 仅尝试访问既有 run，不重新生成课程，不调用付费模型。
- 当前 owner 的既有 run GET 返回 **404**；保护按预期阻止继续。未恢复、伪造或绕过 owner 身份，未收集到课程预览/答题反馈/刷新回读截图。
- `success=false`、`overallSuccess=false`、`supplementaryEvidenceComplete=false`，通过检查数为 0。此随访不是对原课程内容的再次失败判定，而是明确的访问权限验证边界。

## 冻结证据与未验证项

证据根目录：`apps/desktop/test-results/ui-goal-20261101/openmaic-live/run-BhNFAC/`。

- 原结果：`report.json`、`course-public.json`。
- 已有公开大纲截图：`outline-1366.png`、`outline-1920.png`。
- 随访结果：`followup-GqFbFa/followup-report.json`。

上述证据保持不变。本次仅补充此说明，未修改参考项目、断言、runtime 或生产代码。实际 slide 预览、两题答题反馈及冷/刷新回读仍未验证；不得以内容 JSON、工程检查或大纲截图代替这些 UI 操作，不得宣称与小智整体等价或完全复刻。
