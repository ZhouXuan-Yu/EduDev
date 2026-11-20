# 图形选项在本卷编辑中保留原图

## 根因与代码范围

现行原题直接出卷已会输出图形选项。在题篮打开本卷编辑时，原选项的图片曾被移到普通题干图引用。图片随即失去 A、B、C、D 归属，也无法满足独立题干图的来源认证。只有图片的选项还会出现空选项内容，无法作为可确认的编辑结果。

- `paper-instance.ts` 的共享契约允许选项随自身字母保留已保存图像的块 ID 和题目版本。合规的图片选项可以没有描述文字；普通空选项仍不能进入确认。
- `question-document.ts`、`paper-instance.ts` 的主进程实现和现有图库复用图像权限。读取时核对结构文档、字母、图片顺序、来源版本及对应题，禁止把选项图冒充答案、解析和独立题干插图。
- `paper-instance-content.ts`、`PaperInstanceBlockEditor.tsx`、`PaperInstanceContent.tsx`、`usePaperInstanceImages.ts` 在编辑入口保留原图和顺序，锁定图形选项的原标签，并按标签显示保存后的图像。
- `paper-instance-export.ts` 和 `paper-office-images.ts` 在学生与教师文件中把原图放到其选项文字后，继续校验文件与来源的绑定。答题卡继续读取旧的选项标签接口。
- 验证脚本分别检查保存行为、错配与过期攻击输入、真实组件及本机 DOCX/PDF 原生文件生成。已保存的旧扁平引用继续阻止正式交付；原题模式继续可读。


## 专项验证

| 验证 | 结果 |
| --- | --- |
| `paper-instance-graphic-export-boundaries.mjs` | 6/6。原题、编辑草稿、双受众、错图和缺独立图等边界 |
| `paper-instance-options-images-test.mjs` | 13/13。新增学生版 A–D 图位、图库错位拒绝和标签锁定 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs --test` | 六套组卷专项均通过。旧测试把写入应答的临时回执和冷读状态分开校验 |
| `paper-instance-graphic-render.mjs` | 学生及教师 DOCX/PDF 共 4 份实际文件。Word 的 5 个 PNG 摘要全部一致，PDF 以原像素颜色和文字顺序对照 5 张图与 4 个选项的归属。学生文件无答案和解析，教师文件两者保留 |
| `npm audit --omit=dev --audit-level=high` | 既有 20 项依赖告警中 5 项 high、0 项 critical。没有新增依赖 |

文件专项使用受控完整试卷，通过实际 Word/PDF 引擎生成并读取文件内容。该用例未覆盖正式桌面审批、Office/WPS 原生视觉打开或实际考试卷质量。

## 回滚与范围

SQLite 表未变化。产物写入继续使用原有确认和审批。旧程序保留以原题方式生成的记录。新模式的题篮含较旧版本不能识别的可选字段，如需回滚应用，应先备份。可把受影响的活动题篮恢复原题模式。已经用新引用确认的快照需要支持该字段的应用版本，已生成文件不受影响。

自然图形样本还混有一幅独立装置图。它和选项图具有不同的来源要求。未确认的装置图仍须单独裁切并证明来源。不能因选项图片可编辑而通过整道自然题的正式验收。此项切片不代表检索、三套正式卷、约 10 GB 压力或换机已通过。
