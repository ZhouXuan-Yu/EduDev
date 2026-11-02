# U4-C1 独立审查与失败保留

2026-11-02。本页区分代码审查、测试定位错误与真实用户闭环。初始生产冻结 `79c41fb03206ccb2bd4d3c237263ca632d77b4cbb3572a05c7b64f550c8b2957`，基线 main `9385600`；对应初始构建 `8d7aa2909c7595df88ca0fca27c674f5e8795239275066fd43d6714726ddce91`，455文件。不得把后续修复后的通过结果写回该构建。

## Astra 初审：两项 P2，生产尚未接受

1. `DesktopFrame.tsx` 的 `ifCurrent` 只比较历史条目对象身份。后退再前进会复用该对象，旧的 `openPaperMaterialSource` 异步读取因此可能被重新接受并跳走当前页面。要求增加导航世代，覆盖 A→B→A 的真实导航消费者测试，不能仅比较目标值或对象身份。
2. `QuestionNotebookWorkspace.tsx` 保存后 `refresh()` 在 loading 时卸载原编辑器及其守卫，并吞掉回读失败；`onSaved` 随后会清除错误并显示成功。要求保留正在完成的编辑器与守卫、如实呈现回读失败，补写入成功后回读等待/失败的真实挂载测试。宿主写入已经成功时，不自动重复写入或制造新的题目。

两项由实施者按原合同局部修复，必须经独立复审及新构建重新验收。

## 第二轮复审

生产 `a94b19ae1b240775c8e17aa1ce7b80e7439109b48f0634ce3c630a4904950c96` 通过原两项 P2 的源码及挂载证据复审：单调 epoch 覆盖历史往返；两个编辑器区分已提交与回读失败，保留相同输入节点、守卫和只读恢复，写入次数不因重读增加。新21项接力、45项编辑守卫及原回归/TSC exit0；新 build/TSC、245组件及 K39C08 正式 Electron 6项亦通过，但仅接受该受控 TXT 成功路径。

另发现一个尚需修复的 P2：普通筛选/分页读取 pending 时，C1 仍展示旧行，旧行的编辑入口也可打开；迟到结果若排除该题，会卸载新开的编辑器和守卫，丢失未保存输入。位置为 `QuestionNotebookWorkspace.tsx:201/96`、`QuestionContextEditor.tsx:37` 与 `QuestionEditGuard.tsx:43`（行号以 a94b19 冻结为准）。**这是 Astra 的冻结源码控制流发现，尚非其本人已执行的 mounted/Electron 复现。** 不将前两项的旧失败日志冒充此项证据。

要求先补“pending 普通列表读取→尝试旧行编辑→空/不同结果”的修前回归，再最小修复并复审。K39C08 成功记录不改写为该竞争时序已通过，亦不作为带此缺口直接提交生产的依据。

### 第三项修复证据

Sol 随后在原 a94 冻结实际补跑挂载回归：原45条通过，新断言 exit1；Archive/Context × 空结果/不同结果四种观察均为“入口未禁用→接受草稿→输入节点脱离”。这是该项新取得的 mounted 证据，不冒充 Electron。修复仅为 Notebook 在 C1 loading 期间向两个编辑器传递 `openDisabled`，沿原按钮 disabled 状态并防御 opening handler；默认 false 保留普通消费者，已展开编辑器及写后只读恢复不变。

生产新冻结 `627faa779e03e32bb1aee252855dd8527f96bc93bd84bbc9294978e9c083ebf5`；编辑守卫49/49、接力21/21、旧题篮45/草稿45/导航16、B及资料回归和 TSC 均 exit0。逐文件及命令见 `U4_C1_PENDING_LIST_REPAIR_FREEZE.json`，原失败 `before-result.json` 保留在 `apps/desktop/test-results/u4c1-pending-list-repair-PC9vNn/`。独立复审及最终构建实测另行登记。

## 实际桌面尝试（原文件保留）

### KgXL1N · exit 1 / 2 项通过

`apps/desktop/test-results/ui-goal-paper-material-return-KgXL1N/report.json`。真实取消上传、后退/前进、TXT 导入与原解析器生成规则抽题已通过。脚本在同题校正的“难度”控件定位超时；原表单的 label 包含选项文字，精确标签查询没有匹配。

仅将 QA 定位改为实际 archive form 内唯一可见 select，并读回 `easy`；未增加生产 testid 或改题干/保存/来源/revision 断言。QA SHA 从 `05c2008b8fbcb1ce38017e7e2c571def547039c566a8553f25e8d20ec218b79e` 变为 `7eb7eb0bf762c21fc14d17a56a2af6e37d976c60087977c232b2bb14420c1794`。独立 Astra 确认其余断言未改。

### I0DIBB · exit 1 / 3 项通过

`apps/desktop/test-results/ui-goal-paper-material-return-I0DIBB/report.json`。真实同一题目 ID 校正、未保存返回/后退阻断、保存后返回同 owner/basket/stage/uiState 且领域修订不变，已通过。尚未执行加入。

失败发生在旧 B `findInstanceCandidate` 的首次严格等待：`stem.slice(0,36)` 包含换行，而实际单行搜索框将换行保存为空格，导致预期 query 永远不匹配。SQLite 只读复核确认该差异；报告没有 `candidateQueries`，原篮仍 revision 10、1 个原成员，末次仅 ui:state。scrollTop 双方均为 0，不是该超时原因。

仅在 C1 QA 采用真实来源的单行唯一 marker 查询；保留真实 UI、分页、同题 ID、完整候选读取、来源版本及明确 Add 的修订断言。旧 B helper、原试题内容及历史 B 验收不重写。本次失败不作为生产加入功能失败或整体通过的证据。

## 初始工程门禁

- `npm.cmd run build` exit 0，含 TSC；`npm.cmd run test:renderer-components` 245/245 exit 0。
- 首次直接运行 `node scripts/xiaozhi-agent/delivery-terminal-smoke.mjs` 因缺少 TS 来源加载器而 exit 1，未形成该套通过。按项目记录改用 `node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/delivery-terminal-smoke.mjs`，13/13 exit 0。原错误日志保留。
- `npm.cmd audit --json` exit 1：42项（8 high / 26 moderate / 8 low / 0 critical），未改依赖。较旧报告45项的变化不归因于本轮代码或声称依赖已修复。

以上是初始冻结证据，P2 修复后的门禁与桌面结果另行记录。TXT 规则抽题不代表自然扫描 OCR、native 图文、公式或教学质量验收。
