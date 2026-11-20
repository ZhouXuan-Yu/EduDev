# 扫描选择题的局部红批冲突

## 根因

真实 U16 第 2 页的印刷题干来自嵌入扫描图。该题位置的四处 PDF 原生字符都在 A–D 右侧，对应红色批注。其余原生位置在本题上方。旧门禁要求原生文本中找到印刷题号和后一个题号，导致未重建印刷文字的扫描题一直待核。原页中的红批也落在同一整题矩形内，沿用整题矩形会把批注一起交给下游。

## 实施与来源

- `material-pdf-question-conflict.ts` 验证同一版本和页的两个原生读取结果对字符的覆盖一致，页级 OCR 与版面原始行逐字对应。只接受完全落在各选项右侧、位置成列的独立候选标记。
- `material-structure-repository.ts`、`material-structure-runtime.ts`、`material-question-archive.ts` 与 `db.ts` 复核源图文件摘要、标记实际红色像素和裁片干净程度。从题干逐行、A–D 和图注得到独立原像素裁片。正式发布草稿前重算同一证据。
- 现有题号边界、原文、原图与原生 OCR 冲突状态均保留。共享结构合同升级为 v9，历史 v2～v8 按原回执读取。没有新增 SQLite 表、组件或云端调用。
- `document-structure-boundaries.mjs` 和 `document-structure-electron.mjs` 覆盖缺失字符、原生符号与正文重叠、OCR 或选项不一致、出页和真实来源回读。

## 真实样本前后

| 检查 | 旧版 | v9 |
| --- | --- | --- |
| 页级 OCR | `text_conflict` | `text_conflict` 按原记录保留 |
| 题级范围 | 有完整题干和 A–D，题级无法取得互证 | 四处红批各自落在选项右侧，OCR 和版面原始行完全一致 |
| 题图与选项 | 无独立草稿裁片 | 两条题干、四个选项和题图共七张原像素裁片 |
| 答案 | 等待核对 | 保持缺答案和解析，独立证据尚待补齐 |

样本的四处标记都有红色像素，七块题面裁片的高饱和红批像素计数为 0。源图完整保留。仅草稿可写入题本，原有教师核验和正式组卷权限继续执行。

## 测试与性能

- `node --experimental-transform-types scripts/education/document-structure-boundaries.mjs` 41/41。
- 原真实 OCR 回执的内存判定各运行 1,200 次。旧定位失败的 P95 约 0.0013 ms，新的文本和几何证明约 0.165 ms。该数据不含图像解码、SQLite 和 OCR，像素工作量只限接受候选的裁片与标记盒。
- `npm run test:renderer-components` 253/253。`npm run build -- --outDir test-results/build-kb-localized-marks-final` 通过。
- `OMNI_EDU_TEST_BUILD_ROOT=test-results/build-kb-localized-marks-final`、`EDU_STRUCTURE_CHECK_CROPPED_NUMBER=1`，对单份 U16 PDF 执行 `node scripts/education/document-structure-electron.mjs`。7 项真实 Electron 检查通过，5/5 页完成，1 条原题自动草稿和 1 条教师修正确认后可冷启读回。模型调用为 0。
- 从最终 SQLite 记录比对七个裁片及原页 8 份文件 SHA-256。原页符合此检测阈值的红像素共 24,744，七片各为 0。草稿未填答案或解析，`sourceChecked` 为 false。
- 完整电子桌面后台导入用时约 194 秒，前轮两次同原件试导分别约 170 秒和 71 秒。不同阶段的 OCR 与启动缓存差异明显，单次样本不构成吞吐回归结论。
- `npm audit --omit=dev --audit-level=high --json` 报告现存 23 项通告，其中 8 项 high。依赖无变更。

## 未完成与回滚

这一证明覆盖明确分离的红批与单页 A–D 扫描题。真实相互重叠、无独立选项、OCR 冲突或不同样式继续原有待核策略。第 6 题后续还需独立解题与答案证据，再接正式组卷。约 10 GB、迁移与检索质量留出验收继续推进。可撤销本次提交回退派生解析策略，旧原件、原图和教师已有记录继续保留。
