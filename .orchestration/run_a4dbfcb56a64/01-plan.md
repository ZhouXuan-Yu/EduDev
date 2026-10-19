# Run `run_a4dbfcb56a64` 冻结执行计划

> 角色：Planner P（只读）。本文件是 T0/T1/T2/G0 的执行契约，worker 不得自行扩大 Target。
> 冻结日期：2026-10-19（Asia/Shanghai）。
> 工作区：`C:\Users\ZhouXuan\orca\workspaces\EduProject\小智教育智能体`（git worktree，禁止 `cd` 到原仓库根）。
> 基线：规划开始时 `HEAD = 7ae52f10d8ebbf3a0f1c707c49439f84d97b70b5`（branch `ZhouXuan-Yu/小智教育智能体`，`2026-10-19 16:35:24 +0800 auto-sync`）；规划期间 auto-sync 继续提交，读取时已推进到 `e2ae4d5`。**T0 开工时必须重新执行 `git rev-parse HEAD`，以当时 HEAD 为基线；不得把本文件的 SHA 当作业务基线。**
> 权威优先级：用户本轮要求 > `1.Agent.md` > `docs/00_DOCUMENTATION_INDEX.md` 指定文档 > `4.Wiki.md` > `2.Memory.md` > 代码/测试证据。

## 0. 基线证据与冻结裁决

### 0.1 工作区事实（2026-10-19 读取）

已读依据：`AGENTS.md`、`1.Agent.md`、`实施计划.md`、`docs/11_STRATEGIC_PRODUCT_PRD.md`、`docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md`、`docs/24_DEEPTUTOR_OMNI_EDU_INTEGRATION_DESIGN.md`、`docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md`、`2.Memory.md`（当前进度段）、`docs/00_DOCUMENTATION_INDEX.md`、`docs/12_TECH_SELECTION_OVERVIEW.md`。

- `git status --short --branch`：仅 `.claude/.auto-push-counter` 为已修改；`.orchestration/run_a4dbfcb56a64/specs/{R-acceptance,S-supervisor,T2-error-review}.md` 为未跟踪。**规划时没有未提交的业务代码**；T0 规范中提到的“上一会话未提交 AI 控制台/DeepSeek 视觉回退改动”已被 auto-sync 提交进 `7ae52f1`。T0 开工时必须重新执行 `git status`，以当时的 HEAD 为准，不得回滚未知改动。
- `.orchestration/` 当前**未**被 `.gitignore` 忽略；`.playwright-mcp/` 有 26 个文件仍被 git 跟踪（`git ls-files .playwright-mcp | wc -l = 26`）。
- 当前 schema 迁移最大版本为 **v9**（`apps/desktop/src/main/db.ts:411`）；本轮**禁止新增 v10**。v10 保留给后续 W09。
- 关键代码锚点（行号以规划时文件为准，改动后需重新定位）：
  - `apps/desktop/src/main/index.ts:2087-2127`：`mistakeImages:runOcr`，其中 `2094-2116` 是自动 DeepSeek 视觉回退。
  - `apps/desktop/src/main/index.ts:2128-2145`：`deepseek:analyzeImage` 通用云端识图入口。
  - `apps/desktop/src/main/deepseek.ts:334`：`MAX_IMAGE_BYTES = 8MB`；`:366`：`readFileSync(imagePath)`。
  - `apps/desktop/src/preload/index.ts:227-229`：`runOcr` 与 `analyzeImageWithDeepSeek` preload 绑定。
  - `apps/desktop/src/renderer/App.tsx:1789-1818`：4 项 `contextItems`；`:1825-1832`：未使用的 `contextData`（知识图谱）；`:2181`：`contextSources={contextItems}`。
  - `apps/desktop/src/main/db.ts:1966-1994`：`applyMistakeOcrResult` / `markMistakeOcrFailed`；`:8517-8534`：`mapMistakeImageAnalysis`。
  - `apps/desktop/src/main/db.ts:3074-3110`：`exportPaper` 三件套；`:3332-3375`：`buildPaperMarkdown` / `buildAnswerSheetMarkdown` / `buildPaperAnalysisMarkdown`。
  - `apps/desktop/src/main/db.ts:3449-3500`：`proposeErrorReview`；`:5144-5160`：`parseAiConfirmationPayload` 的 `save_error_review` 白名单；`:5217-5228`：`rejectAiConfirmation`；`:5230-5275`：`confirmAiConfirmation`；`:8233-8320`：`executeAiConfirmation` 的 `save_error_review` 分支（当前逐条 `createRecord`，非事务）；`:8423-8438`：`run` / `runWithChanges`。
  - `apps/desktop/src/shared/contracts.ts:173-188`：`MistakeImageAnalysis`；`:874-895`：`PaperVersionSummary/Detail`；`:2138-2192`：`AiConfirmation*`。
  - `apps/desktop/src/renderer/components/MistakesWorkspace.tsx:269-283`：本地 OCR 调用；`:418-432`：OCR 面板；`:540-575`：错因确认内联区。
  - `apps/desktop/src/renderer/components/PaperWorkspace.tsx:34-63`：状态集合；`:394-397`：导出结果；`:572`：导出按钮。
  - `apps/desktop/scripts/renderer-component-state-test.mjs:1-120`：Vite SSR + `renderToStaticMarkup` 组件状态测试基座。
  - `apps/desktop/scripts/error-review-write-smoke.mjs:1-153`：现有错因写入 smoke 基座。
  - `apps/desktop/scripts/paper-blueprint-smoke.mjs:1-254`：现有组卷 smoke 基座。
  - `apps/desktop/scripts/electron-smoke.mjs:1353-1364`（错因确认）、`:1379-1526`（组卷）为 E2E 现有锚点。

### 0.2 环境预检（只读，2026-10-19 实测）

| 项目 | 实测值 | 结论 |
| --- | --- | --- |
| GPU | `NVIDIA GeForce RTX 5060 Laptop GPU`，8151 MiB，驱动 `595.79`，compute capability `12.0` | Blackwell sm_120，8GB VRAM，G0 必须串行跑 GPU 基准 |
| 显存即时占用 | `323 MiB used / 7577 MiB free` | 基准前需记录占用，避免把其他进程算进结果 |
| 基础解释器 | `D:\Anaconda\python.exe` = Python `3.13.9` | 只作为 venv 创建器，禁止改动 base 环境 |
| base torch | `2.14.0+cpu`，`torch.cuda.is_available() = False`，`torch.version.cuda = None` | G0 必须在独立 venv 安装 CUDA wheel，不能复用 base |
| base onnxruntime | `1.20.1`，providers `['AzureExecutionProvider','CPUExecutionProvider']` | base 无 CUDAExecutionProvider；G0 必须验证 `onnxruntime-gpu` |
| base 其他包 | `rapidocr 3.9.2`、`sentence-transformers 5.6.0`、`lancedb 0.38.0`、`pillow 12.1.1` | 仅作为版本参照，不写入 base |
| 已知环境坑 | 直接 import torch 触发 `OMP: Error #15 ... libiomp5md.dll already initialized`；设置 `KMP_DUPLICATE_LIB_OK=TRUE` 后可读取 | G0 记录该现象；不要用该变量掩盖真实冲突，优先用干净 venv |
| 磁盘 | `C:` 可用约 85 GB | CUDA torch + onnxruntime-gpu 体积可控，但需记录安装前后占用 |

### 0.3 参考项目可读性与许可证

| 参考 | 读取结果 | 许可证/边界 |
| --- | --- | --- |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC` | 可读；已读 `lib/quiz/*`、`lib/export/*`、`lib/video-export-app/*`、`tests/quiz-answer-key.test.ts`、`packages/@openmaic/generation` | `LICENSE` = MIT（THU-MAIC, 2026）。**未发现 exam-paper / answer-sheet 模块**：`grep -rni "exam paper\|answer sheet\|试卷\|答题纸"` 仅命中 PBL worksheet/pptxgenjs 内部 worksheet，不能冒充试卷模块 |
| `D:\WorkProject\小智智能体借鉴项目\DeepTutor` | 可读；已读 `deeptutor/agents/question/*`、`tools/question/*`、`core/errors.py`、`services/llm/error_mapping.py` | `LICENSE` = Apache-2.0；本仓库固定 vendor 见 `python/vendor/DEEPTUTOR_UPSTREAM.md`（v1.5.11, commit `456f9c24226e008f1ff07a7e3455d7b4d39f6221`） |
| `D:\WorkProject\小智智能体借鉴项目\edu-rag` | 可读；已读 `ingestion/chunker.py`、`core/nodes/retriever.py`、`core/reranker.py`、`core/retrieval_quality.py`、`evaluation/retrieval_evaluator.py`、`data/test_sets/retrieval_manual_v1.example.jsonl` | **unknown**：`D:\WorkProject\小智智能体借鉴项目\edu-rag\LICENSE` 不存在（ENOENT）；只读思路，不复制代码/文本 |
| `D:\WorkProject\小智智能体借鉴项目\Edurag_study` | 可读；已读 `ingestion/chunker.py`、`core/embeddings.py`、`core/nodes/retriever.py`、`requirements.txt`、`README.md` 中的 D1–D9 决策 | **unknown**：`D:\WorkProject\小智智能体借鉴项目\Edurag_study\LICENSE` 不存在（ENOENT）；只读思路 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book` | 可读；已读 `book-en/chapter1.md:486-494`、`book-en/chapter4.md:281-297`、`chapter4/collaboration-tools/main.py:120-240`、`run_experiment_4_5.py:331-415` | `LICENSE` = Apache-2.0；Python/MCP 栈与本项目不兼容，只复用概念 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src` | 可读；65 个组件目录已枚举 | **unknown/restricted**：`package.json` 写 `"license": "SEE LICENSE IN LICENSE"`、`"access": "restricted"`，但根目录无 `LICENSE` 文件；只能按现有 vendor 授权复用源码，禁止新增 npm 依赖或再分发 |
| `python/vendor/deeptutor` | 可读；固定基线，禁止修改 | Apache-2.0 + `DEEPTUTOR_THIRD_PARTY_NOTICES.md`；适配写在 bridge/host proxy |

### 0.4 冻结裁决（worker 不得自行改变）

- **D-P1（T0 云 OCR 同意模型）**：本地 OCR 失败**不得**自动调用云端。新增独立 IPC `mistakeImages:runCloudOcr`，输入必须含 `confirmedUploadOriginal: true`；缺省/`false` 时在读取图片和调用 provider 之前 fail-closed。通用 `deepseek:analyzeImage` handler 与 preload 方法**删除**，不保留旁路。
- **D-P2（云端置信度）**：云端 OCR 不提供可信置信度时，`MistakeImageAnalysis.ocrConfidence` 返回 `null`，并新增派生字段 `requiresReview: true`、`ocrSource: 'cloud'`。DB 层用 `ocr_confidence = -1` 作为无迁移哨兵（`applyMistakeOcrResult` 已接受 `number`，T0 传 `-1`）；**`db.ts` 不改**。归一化发生在新增的 `apps/desktop/src/shared/mistake-ocr.ts`（main 的 IPC 返回与 renderer 的列表加载都调用它），把 `<0` 映射为 `null`/`requiresReview`。禁止用 `0.85` 等伪造值，禁止在 UI 显示 `-100%`。
- **D-P3（答题纸模板持久化）**：本轮**没有迁移通道**，答题纸模板只作为**导出时参数**（session 内可编辑，不跨重启持久化）。持久化的证据是导出的真实文件 + `document_artifacts` 行 + SHA-256；UI 必须标注“本次导出设置”，不得暗示已保存为模板。若未来要求持久模板，另立 v10 之后的迁移，不在本轮偷偷加列。
- **D-P4（试卷对比只读）**：对比在 main 的纯读函数中完成，经 typed IPC `papers:compare` 暴露；不新增表、不写 `paper_versions`、不触发导出/存档。重复 key 或歧义匹配标 `ambiguous`，不得猜测合并。
- **D-P5（T2 事务边界）**：`save_error_review` 的记录写入、FTS upsert、readback 与 `ai_confirmation_items` 状态更新放在**同一个 `BEGIN IMMEDIATE`**；批量确认/拒绝同样单事务。任一条失败全部回滚，确认项保持 `pending`。
- **D-P6（串并行与合并顺序）**：T0 是基线，必须先完成并本地提交；T1/T2 从 T0 提交分叉。共享文件与文档按 **T1 → T2** 顺序合并；若协调器并行运行，T2 必须在自己的分支上 rebase/合并 T1 的共享文件变更后再提交。禁止两个 worker 同时修改同一文件的同一段。
- **D-P7（迁移车道）**：本轮 `schemaMigrations` 保持到 v9；不得出现 v10；`npm run test:db-migration` 必须通过。v10 保留给后续 W09。
- **D-P8（同步 IO）**：T0 只把 `deepseek.ts` 的图片读取改为 `fs/promises`；不得新增任何同步文件 API。`db.ts` 已有的同步 IO（`mkdirSync` 等）不在本轮清理范围，但 T2 新事务 helper 不得再引入同步 IO。
- **D-P9（参考复用）**：参考项目只读。OpenMAIC/DeepTutor/edu-rag/Edurag_study/ai-agent-book 的代码不得粘贴进业务文件；需要复用时在报告中写“参考路径 + 复用的概念/字段/测试模式”，实现必须是本项目技术栈。
- **D-P10（验证真实性）**：fixture、fake provider、deterministic smoke 只能证明工程链路；真实 DeepSeek/真实教师样本/真实 GPU 质量必须单独标注。没有证据的项写 `unknown` 或 `NOT VERIFIED`，不得写成通过。

---

## 1. 冻结任务契约

### 1.1 T0 — 基线稳定化与隐私修复

#### Target

原始目标文件：
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/deepseek.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/heroui-pro/components/**`（仅上下文修复需要时）
- `README.md`、`.gitignore`、`docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md`、`2.Memory.md`、`3.Learning.md`
- 根目录 `test-enhanced-components.js`（删除；当前未被 git 跟踪）
- `.playwright-mcp/`（加入 `.gitignore`）

为满足 typed IPC 四件套与可测试性，Planner 追加的最小扩展（不得再扩大）：
- `apps/desktop/src/shared/contracts.ts`（新增云 OCR 输入/结果/审计类型；`MistakeImageAnalysis.ocrConfidence` 改为 `number | null`，新增可选 `requiresReview?: boolean`、`ocrSource?: 'local' | 'cloud' | ''`）
- `apps/desktop/src/main/mistake-ocr.ts`（**新建**：本地 OCR / 云端 OCR 的纯编排，依赖注入）
- `apps/desktop/src/shared/mistake-ocr.ts`（**新建**：`-1` 哨兵 → `null`/`requiresReview`/`ocrSource` 的共享归一化）
- `apps/desktop/src/renderer/ai-context-sources.ts`（**新建**：5 源上下文纯构造函数）
- `apps/desktop/src/renderer/components/MistakesWorkspace.tsx`（**仅** OCR 面板的云端同意按钮/对话框/结果标签；其余区块归 T2）
- `apps/desktop/scripts/cloud-ocr-consent-smoke.mjs`（**新建**）
- `apps/desktop/scripts/renderer-component-state-test.mjs`（仅追加 5 源上下文断言）

不包含：`apps/desktop/src/main/db.ts`、`package.json`、lockfile、迁移注册表、`PaperWorkspace.tsx`、错因 executor。

#### Change

1. **P0 隐私：移除自动云端回退**
   - `mistakeImages:runOcr` 只执行本地 `getOcrWorker().runOcr`；本地失败时只调用 `markMistakeOcrFailed` 并抛错，**删除** `2094-2116` 的 `analyzeImageWithDeepSeek` 分支。
   - 删除 `deepseek:analyzeImage` handler（`index.ts:2128-2145`）与 preload `analyzeImageWithDeepSeek`（`preload/index.ts:228-229`）。保留 `deepseek.ts` 的 `analyzeImageWithDeepSeek` 作为云端 provider 实现，但只能被 `mistake-ocr.ts` 的同意路径调用。
2. **P0 新增显式同意的云 OCR**
   - 新 IPC：`mistakeImages:runCloudOcr`，输入：
     ```ts
     type CloudOcrInput = {
       analysisId: string;
       confirmedUploadOriginal: true; // 必须字面 true
       teacherNote?: string;          // ≤500 字符，不进入模型
     };
     ```
   - 输出：
     ```ts
     type CloudOcrResult = {
       analysis: MistakeImageAnalysis; // ocrConfidence=null, requiresReview=true, ocrSource='cloud'
       audit: {
         provider: string; model: string; requestId: string;
         confirmedAt: string; imageBytes: number;
       };
     };
     ```
   - 校验顺序（缺一不可）：`analysisId` 非空 → 记录存在 → `localPath` 是受管路径且文件存在 → `confirmedUploadOriginal === true` → 有 API Key → provider 调用。**校验未通过时不得读取图片、不得编码 base64、不得调用 provider。**
   - 云端结果：`applyMistakeOcrResult` 以 `confidence=-1` 落库；IPC 返回前经 `apps/desktop/src/shared/mistake-ocr.ts` 归一化为 `ocrConfidence=null`、`requiresReview=true`、`ocrSource='cloud'`；renderer 从 `listMistakeImageAnalyses` 读到的 `-1` 也必须经同一函数归一化。`lowConfidenceCount` 固定 `0` 但不得展示为“高置信度”。
   - 云端失败：**不写业务表**（不调用 `applyMistakeOcrResult`，不覆盖已有 `ocr_done` 文本/状态；原 `needs_ocr` 保持 `needs_ocr`），只在 IPC 返回可行动错误。T0 不改 `db.ts`，因此不新增 `markCloudOcrFailed` store 方法；UI 必须保留原分析记录并显示错误。
   - 审计：返回 `audit`，并写一条 bounded 主进程日志（provider/model/requestId/confirmedAt/imageBytes），**不得**记录图片路径、base64、学生姓名或题干原文。由于本轮无迁移，不新增 SQLite 审计表；在 docs/26 明确该边界。若协调器要求 SQLite 持久审计，必须另申请迁移车道，T0 不得自行加表。
   - UI：OCR 面板新增次级按钮“云端识别（会上传原图）”；点击后弹出确认对话框，必须勾选“我确认会上传原图到云端”才可确认；取消/关闭零调用。结果区显示“云端识别：未提供置信度，必须教师复核”，不得显示百分比；`ocrConfidence === null` 时禁止走 `Math.round(... * 100)` 的百分比文案。
3. **P1 同步 IO**
   - `apps/desktop/src/main/deepseek.ts:366`：`readFileSync` → `await readFile`（`node:fs/promises`）；先 `stat` 检查 `size > 8MB` 直接 fail-closed，读取后再校验 `buffer.length`。保留 `MAX_IMAGE_BYTES` 与现有错误文案。
4. **P1 上下文回归**
   - `App.tsx`：把 `contextData` 的知识图谱项合并进 `contextItems`，共 **5 源**（学生档案、学习记录、附件元数据、老师知识库、知识图谱）；count 使用 `aiResult?.graphNodes?.length ?? knowledgeOverview.counts.nodes`；删除未使用的 `contextData`。
   - 新 `ai-context-sources.ts` 导出纯函数，App.tsx 只调用它；禁止在组件内重复派生。
5. **Hygiene**
   - README 更新为当前现实：主导航 9 项（今日/小智/知识库/题库/智能组卷/错题训练/学生/产物/设置）、OCR/解析/向量已落地、W07/W08 状态；不得沿用“207 路径”等旧计数。
   - 删除根 `test-enhanced-components.js`。
   - `.gitignore` 增加 `.playwright-mcp/` 与 `.orchestration/`；并执行 `git rm -r --cached .playwright-mcp .orchestration`（只取消跟踪，不删除本地文件），使 `git ls-files .playwright-mcp` 为 0，且规划/报告不再出现在提交中。
   - `index.ts` 顶部移除不再使用的 `analyzeImageWithDeepSeek` import（若已无其他调用）。
   - 更新 `docs/26`、`2.Memory.md`、`3.Learning.md` 的真实结果；不得把规划写成完成。
6. **Tests**
   - 新 `cloud-ocr-consent-smoke.mjs`：用 esbuild 打包 `main/mistake-ocr.ts` + `shared/mistake-ocr.ts`，注入 fake deps/provider；不启动 Electron、不发网络请求。覆盖：
     - 未确认/`false`/缺字段 → provider 调用 0、`applyMistakeOcrResult` 0；
     - 确认 → provider 调用 1，结果为 `null` 置信度 + `requiresReview=true` + `ocrSource='cloud'`；
     - provider 失败 → 不写成功结果、不改已有 OCR 状态/文本，错误可行动；
     - 本地 OCR 失败 → 云端 provider 调用 0（无回退）；
     - 审计对象序列化后不含图片路径/base64；
     - 取消路径 → 零调用。
   - `test:renderer-components` 追加：5 源上下文函数返回 5 项、图谱 count 优先取 `aiResult.graphNodes.length`、无图谱时回退 `knowledgeOverview.counts.nodes`。
7. **Gates**
   - `npm run build`
   - `npm run test:renderer-components`
   - `npm run test:ai-mistake-image`
   - `node scripts/cloud-ocr-consent-smoke.mjs`
   - `git diff --check`
   - `git status --short --branch`（提交后干净；`.orchestration` 被忽略）
8. **Commit**
   - 只暂存本任务拥有的路径（`git add <paths>`，不要 `git add -A`）；本地提交，不 push。提交信息说明隐私边界与异步 IO。auto-sync 可能在运行中提交，提交前重跑 `git status`，不得把别人的改动带进本提交。

#### Constraints

- 不改 `db.ts`、schema、迁移注册表、确认队列语义。
- 不新增同步 IO；不新增第 4 个 JS 互斥锁。
- 不伪造置信度；不在日志/SQLite/UI 保存原始图片、base64、完整学生姓名或题干原文。
- 不删除既有测试、不降低断言；不修改 T1/T2 区域。
- 保留未知来源的未提交改动；禁止 `git reset/checkout/clean`；不 push。
- `deepseek.ts` 的 provider 函数可以保留，但不得存在任何未经同意的调用路径。

#### Ownership

- 仅上述 Target 文件（含新增的 `main/mistake-ocr.ts`、`shared/mistake-ocr.ts`、`renderer/ai-context-sources.ts`）。
- `MistakesWorkspace.tsx` 只允许改 OCR 面板（约 `269-283`、`418-432`）与新增同意对话框；不得改错因/题组区块。
- 不触碰 `PaperWorkspace.tsx`、`db.ts`、`packages`、`python/`。`db.ts` 必须在 T0 的 diff 中保持零改动。

#### Observable acceptance

- 上述 gates 全绿；`cloud-ocr-consent-smoke.mjs` 输出每个 case 的 provider 调用次数与断言结果。
- `rg "analyzeImageWithDeepSeek" apps/desktop/src/main/index.ts` 不再命中 `mistakeImages:runOcr` 区块；`rg "deepseek:analyzeImage" apps/desktop/src` 零命中。
- `rg "readFileSync\(imagePath\)" apps/desktop/src/main/deepseek.ts` 零命中。
- `git ls-files .playwright-mcp | wc -l` = 0；`.orchestration/` 被忽略。
- 证据写入 `.orchestration/run_a4dbfcb56a64/t0-report.md`，含命令输出、测试计数、commit SHA。
- `worker_done --files-modified <list> --report-path .orchestration/run_a4dbfcb56a64/t0-report.md --outcome succeeded`。

---

### 1.2 T1 — W07 试卷对比 + 答题纸模板

#### Target

- `apps/desktop/src/renderer/components/PaperWorkspace.tsx`
- `apps/desktop/src/main/db.ts`（**仅** paper 读/导出/答题纸区块：`getPaper`/`getPaperVersion`/`exportPaper`/`buildPaper*` 与新增 `comparePapers`；约 `3074-3110`、`3332-3375`）
- `apps/desktop/src/shared/contracts.ts`（新增 `PaperCompare*` 与 `PaperAnswerSheetTemplate` 类型）
- `apps/desktop/src/main/index.ts`（新增 `papers:compare`；扩展 `papers:export` 参数）
- `apps/desktop/src/preload/index.ts`（新增 typed 方法）
- `apps/desktop/scripts/paper-blueprint-smoke.mjs`
- `apps/desktop/scripts/renderer-component-state-test.mjs`（追加对比/模板状态）
- `apps/desktop/scripts/electron-smoke.mjs`（组卷段追加对比 + 模板导出路径）
- `apps/desktop/src/renderer/styles.css`（仅必要时）
- `apps/desktop/src/renderer/heroui-pro/components/**`（仅零新增依赖的 vendor）
- `docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md`、`2.Memory.md`

不包含：`MistakesWorkspace.tsx`、错因 executor、OCR/vision、迁移注册表、`package.json`、lockfile。

#### Change

1. **对比视图（只读）**
   - 新类型（冻结）：
     ```ts
     type PaperCompareRef =
       | { kind: 'paper'; id: string }
       | { kind: 'version'; id: string };

     type PaperCompareInput = { left: PaperCompareRef; right: PaperCompareRef };

     type PaperCompareField =
       | 'orderIndex' | 'stem' | 'answer' | 'analysis' | 'points'
       | 'difficulty' | 'knowledgePoint' | 'sourceKind' | 'questionType'
       | 'locked' | 'teacherEdited';

     type PaperCompareValue = string | number | boolean | null;
     type PaperCompareChange = { field: PaperCompareField; left: PaperCompareValue; right: PaperCompareValue };

     type PaperCompareSnapshot = {
       stem: string; answer: string; analysis: string; points: number;
       difficulty: string; knowledgePoint: string; sourceKind: string; questionType: string;
     };

     type PaperCompareItem = {
       key: string;
       status: 'added' | 'removed' | 'changed' | 'unchanged' | 'ambiguous';
       leftIndex: number | null;
       rightIndex: number | null;
       left: PaperCompareSnapshot | null;
       right: PaperCompareSnapshot | null;
       changes: PaperCompareChange[];
     };

     type PaperCompareSide = {
       kind: 'paper' | 'version'; id: string; title: string;
       versionNo: number | null; totalPoints: number; itemCount: number;
     };

     type PaperCompareResult = {
       left: PaperCompareSide;
       right: PaperCompareSide;
       summary: {
         added: number; removed: number; changed: number; unchanged: number; ambiguous: number;
         totalPointsDelta: number; orderChanged: boolean;
         difficultyDelta: Record<string, number>;
         knowledgePointsAdded: string[]; knowledgePointsRemoved: string[];
       };
       items: PaperCompareItem[];
     };
     ```
   - 匹配规则：优先 `questionId`（非空）→ key `q:<questionId>`；否则归一化题干（trim、折叠空白、ASCII 小写、保留标点）→ key `s:<normalized>`。同一侧 key 重复时全部标 `ambiguous`，不做位置猜测；只有唯一匹配才进入 `changed/unchanged`。
   - 字段变化：order、stem、answer、analysis、points、difficulty、knowledgePoint、sourceKind、questionType、locked、teacherEdited。
   - 顺序变化：比较两侧匹配 key 的序列；不同即 `orderChanged=true`。
   - `papers:compare` 只读，不写 `paper_versions`、不写 `document_artifacts`、不触发 `archivePaperVersion`。
   - UI：选择左侧/右侧（论文或版本），并列/差异列表显示 added/removed/changed/ambiguous；明确“只读对比，不会自动合并”；版本选择复用现有 `listPaperVersions`。
2. **答题纸模板**
   - 新类型：
     ```ts
     type PaperAnswerSheetTemplate = {
       titleLine?: string;        // ≤120 字符
       examInfo?: string;         // ≤300 字符
       instructions?: string;     // ≤1000 字符
       answerSpacingLines?: number; // 1..10，默认 2
     };
     ```
   - 校验（main 侧，拒绝而非静默截断）：类型/长度/整数范围；拒绝 HTML 标签模式（如 `<script`/`<img`）、`javascript:`/`data:` URL、除 `\n`/`\t` 外的控制字符；允许数学不等号 `<`/`>` 作为纯文本。只输出 Markdown 纯文本，不把模板拼进 HTML。
   - `exportPaper(id, destinationRoot?, template?)`；`buildAnswerSheetMarkdown(paper, template?)`：
     - 默认标题 `# <paper.title> 答题纸`；
     - 有 `titleLine` 时替换标题行；
     - `examInfo` 渲染为一行斜体/普通文本（按现有 Markdown 风格）；
     - `instructions` 渲染为“作答说明”段落；
     - `answerSpacingLines` 控制每个题号后的空行数（1..10）。
   - 保留 `document_artifacts` + SHA-256 + `status` + readback；试卷正文不得泄露答案，答题纸不得包含答案。
   - **模板不持久化**：UI 标注“本次导出设置”；重启后只保证导出的文件/artifact 可回读，不保证模板输入值保留。报告中如实写明。
3. **Tests**
   - 扩展 `paper-blueprint-smoke.mjs`：
     - 两个版本对比：added/removed/changed/unchanged、顺序变化、总分差、知识点差；
     - 重复 key/歧义 → `ambiguous`，不崩溃、不猜测；
     - 对比零写入：`paper_versions` 数量、`document_artifacts` 数量不变；
     - 模板导出：标题/考试信息/说明/空行数写入真实文件；
     - 非法模板（HTML/超长/越界 spacing）拒绝，零文件、零 artifact；
     - 答题纸不含答案；SHA-256 与 `document_artifacts` 回读；重启后 artifact 仍可读。
   - Electron E2E（`electron-smoke.mjs` 组卷段）：
     - 选择两篇/两版本 → 对比 → 断言 added/removed/changed 与只读提示；
     - 填写模板 → 导出答题纸 → 真实文件 + hash + SQLite readback → 重启 readback；
     - 1366×768 与 1920×1080 截图。
4. **Docs**
   - `docs/26` 更新“智能组卷”行的“未做”项：对比视图与答题纸模板改为已实现/已验证；模板不持久化边界写清楚。
   - `2.Memory.md` 记录真实命令、计数、截图路径、未验证项。

#### Constraints

- 不新增表/列/迁移；`schemaMigrations` 保持 v9。
- 不修改试卷候选写路径、AI 生成、OCR/vision、错因 executor。
- 保留 `sourceKind` 标签；不得在对比/导出中改写来源。
- 不新增同步 IO；renderer 不得直接访问 Node；typed preload only。
- 参考复用只引用概念/字段/测试模式；不粘贴 OpenMAIC/DeepTutor 代码；不新增 `temml`、`mathml2omml`、`recharts`、`marked` 等依赖。
- 模板不得持久化；不得用 `paper_versions.note`、`papers.status` 等字段偷存设置。
- 本地提交，不 push。

#### Ownership

- 上述文件；`db.ts` 只改 paper 区块（新增 `comparePapers`、调整 `exportPaper`/`buildAnswerSheetMarkdown`），不得改 confirmation/error-review/OCR/迁移区块。
- `PaperWorkspace.tsx` 全部归 T1。
- 共享文件（contracts/index/preload/electron-smoke/renderer-component-state-test/docs）按 D-P6 与 T2 顺序合并。

#### Observable acceptance

- `npm run build`
- `npm run test:paper-blueprint`（扩展用例全过）
- `npm run test:renderer-components`
- `npm run test:smoke`（Electron E2E 完成；若因内存被杀，必须记录原始错误并标 `BLOCKED`，不得标通过）
- `git diff --check`
- 证据：对比结果 JSON、只读零写入断言、答题纸文件字节、SHA-256、`document_artifacts` 回读、重启回读、双视口截图。
- `worker_done --files-modified <list> --report-path .orchestration/run_a4dbfcb56a64/t1-report.md --outcome succeeded`。

---

### 1.3 T2 — W08 错因复核单事务 + 批量确认

#### Target

原始目标文件：
- `apps/desktop/src/main/db.ts`（`save_error_review` executor + 相关 helper only）
- `apps/desktop/src/renderer/components/MistakesWorkspace.tsx`
- `apps/desktop/scripts/error-review-write-smoke.mjs`
- `docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md`、`2.Memory.md`

为满足 typed IPC 四件套与批量语义，Planner 追加的最小扩展：
- `apps/desktop/src/shared/contracts.ts`（新增批量输入/结果类型）
- `apps/desktop/src/main/index.ts`（新增 `aiConfirmations:confirmBatch` / `rejectBatch`）
- `apps/desktop/src/preload/index.ts`（新增 typed 方法）
- `apps/desktop/scripts/renderer-component-state-test.mjs`（追加批量 UI 状态）
- `apps/desktop/scripts/electron-smoke.mjs`（错因段追加批量确认路径）

不包含：`PaperWorkspace.tsx`、paper 区块、OCR/vision、迁移注册表、`package.json`、lockfile。

#### Change

1. **单事务**
   - 新私有 helper `commitErrorReviewConfirmation(item, payload)`：
     - `BEGIN IMMEDIATE`；
     - 事务内重新读取确认项，断言 `status='pending'`；
     - 校验 `studentId` 非空；`review.items` 非空；所有 `recordId` 属于该学生且存在（沿用现有越权/窗口校验）；
     - 每条 `category` 必须在 `ERROR_REVIEW_CATEGORIES`（`structural/deviation/application/metacognitive/unknown`）；
     - 用**裸 INSERT** 写 `learning_records`（`record_type='error_review'`；`title`/`subject`/`occurred_at` 复用现有 executor 的规则：`title = 错因复核：<label>`、`subject = review.window ? 'error_review' : ''`、`occurred_at = now()`；`content` 字段保持现有 JSON 结构：category/confidence/note/evidence/sourceRecordId/taxonomyVersion/window/teacherConfirmed=true；tags `[category,'error_review']`），**不要**调用 `createRecord`（它会 `mkdirSync`、`listRecords`，且不是事务友好的最小写入）；
     - 对每条新记录执行 `upsertRecordFts`；`touchStudent` 一次；
     - 事务内按 id 全量 readback，数量不符 → 抛错；
     - `UPDATE ai_confirmation_items SET status='confirmed', payload_json=?, result_json=?, confirmed_at=?, updated_at=? WHERE id=? AND status='pending'`，用 `runWithChanges` 断言命中 1 行；
     - `COMMIT`；任何异常 `ROLLBACK` 并重抛。
   - `confirmAiConfirmation` 对 `actionType='save_error_review'` 走该 helper；其他 action 保持现有路径。
   - 失败后确认项保持 `pending`，记录零写入；重试可成功。
   - 保留现有 `parseAiConfirmationPayload` 白名单；新增字段必须同步加入。
2. **批量确认/拒绝**
   - 新类型：
     ```ts
     type AiConfirmationBatchInput = { ids: string[] }; // 1..20，去重
     type AiConfirmationBatchResult = {
       items: AiConfirmationItem[];
       readbacks: Array<AiConfirmationDecisionResult['readback'] | null>;
     };
     ```
   - 实现拆分（避免嵌套事务）：`validateErrorReviewConfirmation(item, payload)` 做纯校验；`writeErrorReviewConfirmationInTx(item, payload)` 只做裸 INSERT/FTS/readback/状态更新，**不发 `BEGIN`**。单条路径由 `commitErrorReviewConfirmation` 发 `BEGIN IMMEDIATE` 后调用；批量路径共用一个 `BEGIN IMMEDIATE`，逐条调用 `validate...` + `write...InTx`。
   - `confirmAiConfirmationsBatch(input)`：
     - 校验 1..20、无重复、全部 `actionType='save_error_review'`、全部 `pending`；混合 action 或任一非 pending → 整体拒绝，不做任何写入；
     - 单个 `BEGIN IMMEDIATE`，按输入顺序逐条执行与单条相同的校验/写入/readback/状态更新；
     - 任一条失败 → 全部回滚；返回错误，所有项仍 pending。
   - `rejectAiConfirmationsBatch(input)`：
     - 校验 1..20、无重复、全部 `save_error_review` 且 `pending`；
     - 单事务内逐 id 执行 `UPDATE ... SET status='rejected', rejected_at=?, updated_at=? WHERE id=? AND status='pending'`，用 `runWithChanges` 断言每条命中；任一未命中 → `ROLLBACK` 并整体失败；成功返回全部项。
   - 重复确认/拒绝：第二次调用必须报“只能确认/拒绝待确认项”，零写入。
   - 并发：`BEGIN IMMEDIATE` + 事务内 re-read + `WHERE status='pending'` 保证单赢家；输家整体失败，不产生部分写入。
3. **UI**
   - 错因复核面板的待确认项支持多选（checkbox），显示已选数量；批量“确认写入”“拒绝（零写入）”按钮；保留单条确认/拒绝。
   - 批量执行中显示 working；失败显示主进程返回的具体错误；成功后用主进程返回的 items/readback 刷新，不做乐观写入。
   - 空选择/超过 20 条/混合 action 在前端先拦截；后端仍必须再校验。
4. **Tests**
   - 扩展 `error-review-write-smoke.mjs`：
     - 批量确认 2 条 → 2 条 `learning_records`，2 个确认项 confirmed，readback 一致；
     - 失败注入（在 store 实例上包装 `upsertRecordFts` 或裸 INSERT helper，使第 2 条抛错）→ 0 条记录、0 条 FTS、2 个确认项仍 pending；
     - 批量拒绝 → 2 个 rejected、0 条记录；
     - 混合 action / 重复 id / 已确认项 → 整体拒绝，零写入；
     - 单条确认仍可用；重复确认拒绝；
     - 重启后记录/确认项仍可回读。
   - Electron E2E：选择多条 pending 错因项 → 批量确认 → 记录 readback → 重启 readback；至少一张截图。
5. **Docs**
   - `docs/26` 更新“错因复核教师确认写入”行：单事务、批量确认/拒绝、失败回滚、重启回读；删除“逐条写入非单事务”的旧边界。
   - `2.Memory.md` 记录真实命令、计数、失败注入证据、未验证项。

#### Constraints

- 不新增表/列/迁移；`schemaMigrations` 保持 v9。
- 不改变错因 taxonomy 语义；继续使用 `ERROR_REVIEW_CATEGORIES` 与 `error-taxonomy.ts`，不得创建第二套分类。
- 不绕过教师确认；不新增写路径；拒绝/失败零写入。
- 不新增同步 IO；typed preload only；不修改 paper/OCR/vision。
- 批量只允许 `save_error_review`；其他 action 走现有单条路径。
- 本地提交，不 push。

#### Ownership

- 上述文件；`db.ts` 只改 confirmation/错因区块（`proposeErrorReview` 如需、`rejectAiConfirmation`、`confirmAiConfirmation`、`executeAiConfirmation` 的 `save_error_review` 分支、新增 batch/helper），不得改 paper/OCR/迁移区块。
- `MistakesWorkspace.tsx`：错因复核面板与批量 UI；不得改 T0 的云 OCR 同意区块（只读保留）。
- 共享文件按 D-P6 在 T1 之后合并。

#### Observable acceptance

- `npm run build`
- `npm run test:error-review-write`（扩展用例全过）
- `npm run test:renderer-components`
- `npm run test:smoke`（Electron E2E 完成；内存被杀则记录并标 `BLOCKED`）
- `git diff --check`
- 证据：事务回滚日志/断言、记录与 FTS 计数、确认项状态、重启 readback、批量 E2E 截图。
- `worker_done --files-modified <list> --report-path .orchestration/run_a4dbfcb56a64/t2-report.md --outcome succeeded`。

---

### 1.4 G0 — GPU 能力基线

#### Target

- 隔离 venv：`C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu`（绝对路径，在仓库/worktree 之外）。
- 报告：`.orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md`。
- Worktree：current（只写报告，不改业务文件）。

#### Change

1. 用 `D:\Anaconda\python.exe -m venv C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu` 创建 venv；**不得**修改 `D:\Anaconda`。
2. 升级 venv 内 `pip/setuptools/wheel`；记录 `python --version` 与 venv 路径。
3. 安装 CUDA 12.8+ 兼容的 PyTorch GPU wheel（RTX 5060 Laptop / Blackwell sm_120）。优先官方 CUDA 索引（`https://download.pytorch.org/whl/cu128`，运行时以官方可用性为准）；记录实际安装版本与索引。验证：
   - `torch.__version__`、`torch.version.cuda`
   - `torch.cuda.is_available()`
   - `torch.cuda.get_device_name(0)`、`torch.cuda.get_device_capability(0)`
   - 若不可用：记录完整命令、报错、wheel 是否存在、是否 sm_120 不受支持；不要反复重试超过时间盒。
4. 安装 `onnxruntime-gpu`（选择支持 CUDA 12.x / Blackwell 的版本；以 `pip index versions onnxruntime-gpu` 与官方文档为准）。验证：
   - `onnxruntime.__version__`
   - `ort.get_available_providers()` 必须含 `CUDAExecutionProvider`；若没有，记录完整 provider 列表、错误与 fallback。
5. 安装 `rapidocr>=3,<4`、`sentence-transformers`、`lancedb`、`pillow`（与 `python/requirements-ocr.txt` 及现有 worker 兼容）。记录精确版本。
6. GPU smoke（串行，避免同时占 8GB VRAM）：
   - RapidOCR：复用 `python/ocr-smoke.py` 的样图生成与断言思路，用 venv 解释器运行；记录识别文本、行数、最低置信度、耗时、GPU/CPU provider。**不要修改** `python/ocr-smoke.py`。首次运行会下载/缓存 ONNX 模型：记录来源、耗时、缓存路径；无网络或下载失败时记录 blocker，不得伪造 GPU 结果。若当前 worker 未暴露 provider 配置，用独立 inline script 实例化 `RapidOCR`/ORT session 验证 CUDA provider；不得修改 `python/omni_edu_ocr/**`。
   - sentence-transformers：用 venv 执行 `SentenceTransformer('BAAI/bge-small-zh-v1.5', device='cuda')` 编码一句中文（如“一次函数图像的斜率表示纵向变化量与横向变化量之比。”）；记录 device、维度、耗时、`torch.cuda.max_memory_allocated()`。
   - 记录 `nvidia-smi` 的 VRAM 使用前后值。
7. CPU fallback：
   - 强制 CPU provider / 禁用 CUDA，运行同一 OCR 与 embedding smoke；确认 `python/ocr-smoke.py` 仍能通过。
   - 记录 CPU vs GPU 的延迟与显存表。
8. `OMNI_EDU_PYTHON`：
   - 在报告中给出使用方式：`OMNI_EDU_PYTHON=C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu\Scripts\python.exe`；说明它被 `apps/desktop/src/main/ai-harness/ndjson-worker.ts:35` 与 `sidecar-client.ts:38` 读取。
   - 验证设置后 OCR/parse/embed worker 的能力探测会选中 venv（可只做 `--version`/`find_spec` 级验证，不要求启动 Electron）。
9. 报告必须包含：精确命令、包版本、CPU/GPU 基准表、VRAM、rollback（删除 venv 即可，不影响 base）、`OMNI_EDU_PYTHON` 用法、blocker（如有）、时间戳。

#### Constraints

- 不全局 pip install；不改 `D:\Anaconda`；不改业务代码/`package.json`/lockfile/DB/迁移。
- 不提交业务文件；只允许写报告。
- 时间盒：单步 >30 分钟或需要重启/手工驱动安装 → 停止并报告 blocker。
- 8GB VRAM：GPU 基准串行，不并发跑多个 GPU 任务。
- 失败不要删 venv；记录路径与状态。
- 不伪造 `torch.cuda.is_available()` / provider 结果；不可用就写 `false` + 精确 blocker + CPU fallback。

#### Ownership

- venv 路径与 `.orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md`。
- 不编辑仓库其他文件。

#### Observable acceptance

- 报告存在且包含上述全部字段。
- `torch.cuda.is_available()` 结果已记录；false 时有精确 blocker + fallback。
- `ort.get_available_providers()` 已记录；无 CUDA provider 时有精确 blocker。
- RapidOCR 与 embedding smoke 结果含延迟；CPU fallback 已验证。
- `worker_done --files-modified .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md --report-path .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md --outcome succeeded|failed`。
- 判定：报告完整 + CPU fallback 成立 → `succeeded`（即使 GPU 被 blocker）；无法产出报告或违反约束 → `failed`。

---

### 1.5 任务依赖与执行顺序

```text
P（本文件）
  -> T0（基线，本地提交）
       -> T1（paper） ─┐
       -> T2（error） ─┴─> S（监督） -> R（验收）
       -> G0（独立 venv，可与 T1/T2 并行）
```

- T0 必须先完成，T1/T2 从 T0 提交分叉；G0 可并行。
- T1/T2 共享文件与文档按 **T1 → T2** 合并（D-P6）。
- R 在 T0/T1/T2/G0 全部 `worker_done` 后独立复跑，不信任 worker 自报。

---

## 2. Reference-reuse matrix

> 规则：每行必须给出可执行的路径。`复用` 指概念/字段/算法/测试模式，不是粘贴代码。`禁止复制` 包含许可证、技术栈与产品边界三类原因。

### 2.1 T0 — 隐私同意 / 异步 IO / 上下文

| 参考路径（具体） | 复用什么 | 禁止复制什么 | 适配边界 |
| --- | --- | --- | --- |
| `apps/desktop/src/main/index.ts:2087-2127` | 现有本地 OCR 的受管路径守卫、`applyMistakeOcrResult`/`markMistakeOcrFailed` 状态机 | 自动 DeepSeek 回退分支（`2094-2116`） | 抽到 `main/mistake-ocr.ts` 纯编排，index 只做 IPC 接线 |
| `apps/desktop/src/main/db.ts:1966-1994` | `applyMistakeOcrResult` 的文本/状态更新、attachment 回写 | 伪造 `confidence`、覆盖已有本地结果 | 云端结果用 `null` + `requiresReview`；DB 用 `-1` 哨兵，无迁移 |
| `apps/desktop/src/main/db.ts:8517-8534` | 只读参考 `mapMistakeImageAnalysis` 的字段映射 | **不得修改 `db.ts`**；不得把 `-1` 直接暴露为置信度 | 在 `apps/desktop/src/shared/mistake-ocr.ts` 归一化（`<0` → `null`/`requiresReview`/`ocrSource='cloud'`），main 与 renderer 共用 |
| `apps/desktop/src/preload/index.ts:227-229` | typed IPC 绑定方式 | 通用 `analyzeImageWithDeepSeek` 暴露 | 新增 `runCloudOcr` 专用方法，输入必须含 `confirmedUploadOriginal: true` |
| `python/vendor/deeptutor/capabilities/protocol.py:1-80` | bounded capability context / 隐私策略思想 | Python runtime、UnifiedContext 实现 | 转成 TS 输入类型 + main 侧白名单校验 |
| `python/vendor/deeptutor/core/tool_protocol.py:1-80` | 显式参数 schema、`items` 必填等契约纪律 | BaseTool/ToolDefinition 代码 | TS discriminated union + IPC 注解；不退化为 `any` |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\chapter4\collaboration-tools\main.py:120-240` | HITL 审批：显式批准、超时/默认行为、审计 | MCP/Python 协作框架代码 | 教师勾选 + 确认对话框 + `audit` 返回；无超时自动上传 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\chapter4\collaboration-tools\run_experiment_4_5.py:331-415` | 审批上下文（risk/consequence/decision）与超时证据 | 实验 harness、发布流程 | 只记录 provider/model/requestId/confirmedAt/imageBytes，不记录图片 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\book-en\chapter4.md:281-297` | “不可逆操作需 pre-approval”原则 | 原文措辞/示例 | UI 文案独立撰写，符合中文教师语境 |
| `apps/desktop/src/renderer/heroui-pro/components/badge.tsx`、`context-indicator.tsx` | 已有 Badge/状态指示器 | 新增未 vendor 的依赖组件 | 优先复用本地组件；不足时按 `docs/17` §7 查 MCP |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\chat-tool` | 工具状态展示 anatomy（可选） | 直接粘贴 Pro 源码到新文件 | 只允许 vendor 到 `renderer/heroui-pro/`，并保留依赖/CSS |
| `apps/desktop/src/main/db.ts:2` | 已存在的 `node:fs/promises` 导入与异步文件 IO 模式 | `readFileSync`/`writeFileSync` 新增用法 | `deepseek.ts` 改用 `readFile` + `stat` 边界 |

### 2.2 T1 — 试卷对比 / 答题纸模板

| 参考路径（具体） | 复用什么 | 禁止复制什么 | 适配边界 |
| --- | --- | --- | --- |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\quiz\grading.ts` | “exact answer-key alignment，无 fuzzy normalization”的判定原则；歧义不解析 | Quiz runtime、`QuizQuestion` 类型、Next.js 客户端代码 | 用于对比的“changed”判定：不把标点/空白差异静默归一 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\tests\quiz-answer-key.test.ts` | 负向用例模式：大小写/空白/全角/包装符不得静默等价 | Vitest/Next import、测试夹具 | 改成 node smoke 的 assert 用例；用于比较与模板校验 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\video-export-app\quiz-layout.ts` | “先测量再渲染”、字体/间距确定性的思想 | 浏览器 premeasurement、HyperFrames、视频导出 | 答题纸用固定 Markdown 空行数 + 文本断言，不引入浏览器测量 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\video-export\emit-hyperframes\quiz-question-list.ts` | 题号/题组列表的稳定输出结构 | HyperFrames emitter、PPTX/视频管线 | 改成 `buildAnswerSheetMarkdown` 的纯文本/Markdown 输出 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\export\latex-to-omml.ts` | 公式导出的边界意识（不要假装高保真） | `temml`/`mathml2omml` 依赖、PPTX OMML 代码 | 本项目只导出 Markdown 文本；公式高保真单列未完成 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\components\scene-renderers\quiz-renderer.tsx` | 题面/选项/答案分区的渲染信息架构 | React/Next/Tailwind/场景运行时 | 在 `PaperWorkspace.tsx` 用本项目 HeroUI/React 19 重写 |
| `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\tests\video-export\quiz-layout.test.ts` | 布局断言的测试组织方式 | 视频导出夹具 | 只借鉴断言层次；实际断言 Markdown 内容/空行 |
| `python/vendor/deeptutor/agents/question/pipeline.py:144-290` | canonical question type taxonomy：`choice/concept/fill_in_blank/short_answer/written/coding`；allowed types/per-type counts 归一化 | Python pipeline、LLM 调用 | 在 TS 中建立 `questionType` 映射；对比只读，不重建题目 |
| `python/vendor/deeptutor/agents/question/pipeline.py:1291-1360` | quiz payload 的 bounded normalize/repair 思路（仅用于读取健壮性） | 修复模型 JSON 的完整逻辑；用归一化掩盖教师可见差异 | 对比的 `changed` 判定仍用原文；归一化只用于 key 构造，且重复/歧义必须标 `ambiguous` |
| `python/vendor/deeptutor/tools/question/question_extractor.py:150-180` | 题目字段集合（question/options/correct_answer/explanation/type） | MinerU/LLM 抽取实现 | 映射到 `PaperItem` 的 stem/answer/analysis/questionType |
| `python/vendor/deeptutor/agents/question/mimic_source.py:42-60` | 上游题型 → canonical taxonomy 的映射表 | 复制映射代码/注释 | 手写 TS 映射，保留来源语义 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\data-grid\data-grid.tsx` | 对比表格（行/列/状态） | 新增 `recharts` 等依赖 | 零新增依赖才 vendor；否则用现有 `list-view`/原生表格 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\list-view\list-view.tsx` | 试卷/版本列表 | 未安装依赖 | 优先复用本地已 vendor 的 `renderer/heroui-pro/components/list-view` |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\segment\segment.tsx` | 论文/版本二选一 | 未安装依赖 | 零依赖，可 vendor |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\action-bar\action-bar.tsx` | 对比/导出动作栏 | 未安装依赖 | 零依赖，可 vendor |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\empty-state\empty-state.tsx` | 无版本/无差异空态 | 未安装依赖 | 零依赖，可 vendor |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\resizable\resizable.tsx` | 左右对比分栏 | 未安装依赖 | 零依赖，可 vendor；保留键盘替代 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\checkbox-button-group\checkbox-button-group.tsx` | 版本多选 | 未安装依赖 | 零依赖，可 vendor |
| `apps/desktop/src/main/db.ts:3074-3110` | `exportPaper` 三件套 + `document_artifacts` + SHA-256 + 版本存档 | 绕过 artifact 管线直接写文件 | 模板只改变 Markdown 内容，仍走同一导出管线 |
| `apps/desktop/src/main/db.ts:3332-3375` | `buildPaperMarkdown`/`buildAnswerSheetMarkdown`/`buildPaperAnalysisMarkdown` 的分节与来源标注 | 把答案写进答题纸 | 扩展 `buildAnswerSheetMarkdown(paper, template?)`；保持答案隔离 |

### 2.3 T2 — 错因复核事务 / 批量确认

| 参考路径（具体） | 复用什么 | 禁止复制什么 | 适配边界 |
| --- | --- | --- | --- |
| `apps/desktop/src/main/ai-harness/error-taxonomy.ts:12, 57-130` | `omni.error.taxonomy.v1`、四类 + unknown、证据/复核规则 | 第二套分类器、自由文本推断 | 直接复用；T2 只处理已分类条目的写入 |
| `apps/desktop/src/main/db.ts:221-230` | `ERROR_REVIEW_CATEGORIES` / `ERROR_REVIEW_LABELS` | 新分类枚举 | 继续使用同一集合 |
| `apps/desktop/src/main/db.ts:3449-3500` | `proposeErrorReview` 的服务端重算、范围/归属校验 | 提案阶段写业务表 | 提案仍零写入；批量确认只消费 pending 项 |
| `apps/desktop/src/main/db.ts:5144-5160` | `parseAiConfirmationPayload` 的 `save_error_review` 白名单 | 跳过白名单直接读 payload | 新增字段必须同步白名单；T2 不新增 payload 字段也可 |
| `apps/desktop/src/main/db.ts:8269-8318` | 现有逐条 executor 的字段结构与 readback | 逐条非事务写入 | 改为事务 helper；字段 JSON 保持不变 |
| `apps/desktop/src/main/db.ts:8423-8438` | `run` / `runWithChanges` | 新增第 4 个 JS 锁 | 事务内用 `runWithChanges` 断言状态行命中 |
| `python/vendor/deeptutor/core/errors.py:1-80` | 分层错误类型（Configuration/Validation/Service/LLM） | Python 异常类 | TS 错误消息按同一语义分层；不新增错误表 |
| `python/vendor/deeptutor/services/llm/error_mapping.py:1-80` | 统一错误映射规则（auth/rate limit/context length） | provider SDK 依赖 | 只用于 smoke 的失败分类与可行动错误文案 |
| `python/vendor/deeptutor/core/tool_protocol.py:1-80` | 显式参数 schema | Tool 框架 | 批量 IPC 输入用显式类型 + 上限 |
| `python/vendor/deeptutor/capabilities/protocol.py:1-80` | capability 边界/所有权 | capability runtime | confirmation 仍是唯一写入口 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\chapter4\collaboration-tools\main.py:120-240` | pending → approve/reject 的 HITL 流程与审计 | MCP 多通道审批实现 | 映射到 `ai_confirmation_items`；批量仍由教师显式触发 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\chapter4\collaboration-tools\run_experiment_4_5.py:331-415` | 审批上下文、超时/默认行为、决策记录 | 实验发布流程 | 只复用“显式决策 + 上下文”字段；不引入超时自动通过 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\book-en\chapter4.md:281-297` | 不可逆操作 pre-approval | 原文/示例 | 教师确认队列的产品语义不变 |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\book-en\chapter1.md:486-494` | 工具风险分级 + human-in-the-loop | 风险工具框架 | 批量确认只处理 `save_error_review`，不扩大工具面 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\checkbox-button-group\checkbox-button-group.tsx` | 多选待确认项 | 新增依赖 | 零依赖；也可用现有原生 checkbox + 样式 |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\action-bar\action-bar.tsx` | 批量确认/拒绝动作栏 | 新增依赖 | 零依赖，可 vendor |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\list-view\list-view.tsx` | pending 列表 | 新增依赖 | 优先本地已 vendor 的 `list-view` |
| `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\timeline\timeline.tsx` | 确认/拒绝审计时间线（可选） | 新增依赖 | 零依赖；无需求则不引入 |
| `apps/desktop/scripts/error-review-write-smoke.mjs:1-153` | 现有 smoke 的 esbuild 打包、临时 dataRoot、store 初始化、越权/拒绝断言 | 删除或弱化断言 | 在同一文件扩展；新增失败注入与批量用例 |

### 2.4 G0 — GPU 基线

| 参考路径（具体） | 复用什么 | 禁止复制什么 | 适配边界 |
| --- | --- | --- | --- |
| `python/requirements-ocr.txt` | `rapidocr>=3,<4` 版本约束 | 在 base 环境安装 | venv 内安装；版本记录到报告 |
| `python/ocr-smoke.py` | 中文样图生成、health/ocr/错误路径断言、识别文本与置信度 | 修改脚本本体 | 用 venv 解释器运行；输出目录放临时目录 |
| `python/vector-smoke.py` | 3 文档索引、语义查询、upsert、fail-closed 断言 | 修改脚本本体 | 用 venv 运行；GPU/CPU 各跑一次并记录延迟 |
| `python/omni_edu_ocr/ocr.py:28-105` | RapidOCR 引擎加载、`lowConfidenceCount`、协议字段 | 在 worker 内硬编码 GPU/CUDA | G0 只做基线；worker 的 provider 选择另行评审 |
| `python/omni_edu_embed/embed.py:38-180` | `BAAI/bge-small-zh-v1.5`、512 维、`normalize_embeddings=True`、LanceDB | 改模型/维度或引入 Milvus | 基线验证；不改 worker |
| `C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu` | 目标隔离环境 | 复用 base site-packages 或全局 pip | 所有安装只进 venv |
| `D:\Anaconda\python.exe` | venv 创建器 | 修改 base、卸载 base 包 | 只读使用 |
| `D:\WorkProject\小智智能体借鉴项目\Edurag_study\requirements.txt` | `torch>=2.4`、`sentence-transformers>=3.3` 的兼容下限参考 | 复制整个 conda 环境（LangGraph/Milvus/pymilvus） | 只取版本下限，不引入其编排栈 |
| `D:\WorkProject\小智智能体借鉴项目\edu-rag\requirements.txt` | `sentence-transformers>=3.0`、`rank_bm25` 等版本参考 | `pymilvus`、`ragas`、`langchain*` 整套 | 本项目用 LanceDB + 原生 TS/SQLite；不安装 Milvus/RAGAS |
| `D:\WorkProject\小智智能体借鉴项目\ai-agent-book\chapter3\retrieval-pipeline\requirements.txt` | 仅作历史版本对照 | `torch==2.1.2`、`sentence-transformers==2.2.2` 等旧 pin | 不复制旧版本；以官方 CUDA 12.8 矩阵为准 |
| 官方 PyTorch CUDA 索引：`https://download.pytorch.org/whl/cu128` | 安装 CUDA 12.8 wheel | 非官方第三方 wheel | G0 记录实际可用性；不可用则 blocker |
| ONNX Runtime CUDA EP 文档：`https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html` | provider 安装/验证步骤 | 全局 CUDA toolkit 安装 | 只装 `onnxruntime-gpu`；不改系统驱动 |
| RapidOCR 官方：`https://github.com/RapidAI/RapidOCR` | 安装/模型说明 | 复制仓库代码 | 只用 pip 包与本地 worker |
| sentence-transformers 官方：`https://www.sbert.net/` | `device='cuda'`、编码 API | 复制示例项目 | 只用 API；记录版本与显存 |
| `nvidia-smi` | GPU/驱动/显存事实 | 把其他进程占用算作基线 | 基准前后各记录一次 |

---

## 3. Ownership / conflict map

### 3.1 文件级归属

| 文件/目录 | T0 | T1 | T2 | G0 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `apps/desktop/src/main/mistake-ocr.ts`（新） | 写 | - | - | - | T0 纯编排 + 依赖注入 |
| `apps/desktop/src/shared/mistake-ocr.ts`（新） | 写 | - | - | - | T0 `-1` 哨兵归一化；main/renderer 共用 |
| `apps/desktop/src/main/index.ts` | 改 OCR/AI 区块 | 加 `papers:compare`/导出参数 | 加 `aiConfirmations:*Batch` | - | 按区块；禁止整文件重写 |
| `apps/desktop/src/main/deepseek.ts` | 改 `readFile` | - | - | - | |
| `apps/desktop/src/main/db.ts` | **不动** | paper 区块 | confirmation/error_review 区块 | - | 见 3.2 |
| `apps/desktop/src/preload/index.ts` | 改 OCR 方法 | 加 paper 方法 | 加 batch 方法 | - | 按区块 |
| `apps/desktop/src/shared/contracts.ts` | 加 CloudOcr 类型 | 加 PaperCompare/模板类型 | 加 Batch 类型 | - | 按区块 |
| `apps/desktop/src/renderer/App.tsx` | 写（5 源） | - | - | - | |
| `apps/desktop/src/renderer/ai-context-sources.ts`（新） | 写 | - | - | - | |
| `apps/desktop/src/renderer/components/MistakesWorkspace.tsx` | 仅 OCR 同意区块 | - | 错因批量区块 | - | T0 先提交，T2 后基于 T0 |
| `apps/desktop/src/renderer/components/PaperWorkspace.tsx` | - | 写 | - | - | |
| `apps/desktop/src/renderer/heroui-pro/components/**` | 仅上下文需要 | 可 vendor 零依赖组件 | 可 vendor 零依赖组件 | - | 不得新增 npm 依赖 |
| `apps/desktop/scripts/cloud-ocr-consent-smoke.mjs`（新） | 写 | - | - | - | |
| `apps/desktop/scripts/paper-blueprint-smoke.mjs` | - | 写 | - | - | |
| `apps/desktop/scripts/error-review-write-smoke.mjs` | - | - | 写 | - | |
| `apps/desktop/scripts/renderer-component-state-test.mjs` | 加 5 源断言 | 加对比/模板状态 | 加批量状态 | - | 按追加段落 |
| `apps/desktop/scripts/electron-smoke.mjs` | - | 加 paper E2E | 加 error batch E2E | - | 按现有锚点 |
| `README.md`、`.gitignore`、`docs/26`、`2.Memory.md`、`3.Learning.md` | 写 | 写 docs/26、2.Memory | 写 docs/26、2.Memory | - | 文档按 T1→T2 合并 |
| `.orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md` | - | - | - | 写 | |
| `.orchestration/run_a4dbfcb56a64/01-plan.md` | **禁止** | **禁止** | **禁止** | **禁止** | Planner P 独占；worker 只读 |
| `.orchestration/run_a4dbfcb56a64/{t0,t1,t2}-report.md` | 写 t0 | 写 t1 | 写 t2 | - | 报告只由对应 worker 写 |
| `package.json` / lockfile | **禁止** | **禁止** | **禁止** | **禁止** | 新增 smoke 用 `node scripts/<name>.mjs` 直跑 |

### 3.2 `db.ts` 区块归属

| 区块 | 行号（规划时） | 所有者 | 允许改动 |
| --- | --- | --- | --- |
| schema 声明/迁移注册表 | `255-430`、`7841-7890` | **无人** | 禁止改；保持 v9 |
| `createRecord` / 学习记录基础 | `1648-1698` | **无人** | T2 不调用/不修改；新 helper 用裸 INSERT |
| paper 蓝图/试卷/题目 CRUD | `2400-3110` | T1 | 仅 paper 读/导出/对比 |
| `exportPaper` / `buildPaper*` | `3074-3110`、`3332-3375` | T1 | 模板参数、对比函数 |
| `proposeErrorReview` | `3449-3500` | T2 | 如需批量提案扩展，仅此段 |
| `parseAiConfirmationPayload` | `5144-5160` | T2 | 只允许新增必要白名单字段；本轮尽量不改 |
| `rejectAiConfirmation` / `confirmAiConfirmation` | `5217-5275` | T2 | 单事务、批量路径 |
| `executeAiConfirmation` error_review 分支 | `8269-8320` | T2 | 改为事务 helper |
| `run` / `runWithChanges` | `8423-8438` | **无人** | 复用，不修改语义 |
| `mapMistakeImageAnalysis` | `8517-8534` | **无人** | **T0 不改 `db.ts`**；`-1` 哨兵由 `apps/desktop/src/shared/mistake-ocr.ts` 在 main IPC 返回与 renderer 列表加载时归一化；T0 的 `git diff apps/desktop/src/main/db.ts` 必须为空 |

> 说明：D-P2 的 `-1` 哨兵**不**在 `mapMistakeImageAnalysis` 中处理。冻结方案：`applyMistakeOcrResult` 按现有签名接收 `confidence=-1` 并原样落库；新增 `apps/desktop/src/shared/mistake-ocr.ts` 提供 `normalizeMistakeImageAnalysis(analysis)`，把 `<0` 映射为 `ocrConfidence: null`、`requiresReview: true`、`ocrSource: 'cloud'`；`main/mistake-ocr.ts` 在 IPC 返回前调用它，`MistakesWorkspace.tsx` 在 `listMistakeImageAnalyses` 之后调用它。这样 `db.ts` 保持零改动，且 UI 不会显示 `-100%`。若后续确需在 DB 映射层处理，必须另立迁移/扩权，不在本轮。

### 3.3 迁移车道

- 本轮 **无迁移**：`schemaMigrations` 最后一项必须是 v9（`create_parse_jobs`，`db.ts:411`）。
- v10 **保留**给后续 W09（不是本轮）。
- 禁止：新增表、加列、改列类型、回填、重命名、删除索引、修改 `seedIfEmpty`/`seedPlatformDefaults` 的业务方法调用。
- 守卫：
  - `npm run test:db-migration` 必须通过（基线 v1、v2+ 幂等、v99 fail-closed、乱序/重复拒绝）。
  - `git diff apps/desktop/src/main/db.ts` 中不得出现 `version: 10` 或新的 `CREATE TABLE`/`ALTER TABLE`（T1/T2 的 diff review 必查）。
  - 若数据库版本高于程序版本，启动必须 fail-closed（既有逻辑，不改）。

### 3.4 合并协议（T1/T2 共享文件）

1. T0 先本地提交；T1/T2 从该提交分叉。
2. T1 先合并共享文件（contracts/index/preload/electron-smoke/renderer-component-state-test/docs）。
3. T2 在 T1 合并后的基线上追加自己的段落；若冲突，按“保留双方新增、按区块排列”解决，不得覆盖 T1 内容。
4. `docs/26` 与 `2.Memory.md` 同样按 T1→T2 顺序；T2 在自己的段落写自己的证据，不重写 T1 数字。
5. 任何 worker 不得 `git reset/checkout/clean`；auto-sync 提交可能与本地提交交错，提交前重跑 `git status`，只 `git add` 自己拥有的路径。

---

## 4. Acceptance matrix

> `Evidence` 必须是可复现的命令输出、SQLite 回读、真实文件 hash 或截图路径；不能只写“通过”。
> 下表 G0 命令中的 `$VENV_PY` 指 `C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu\Scripts\python.exe`；在 PowerShell 中先 `$VENV_PY = "C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu\Scripts\python.exe"`，在 Git Bash 中先 `VENV_PY="/c/Users/ZhouXuan/AppData/Local/OmniEdu/venvs/gpu/Scripts/python.exe"`。

| # | 任务 | 命令 | 预期证据 | Pass/Fail 判据 |
| --- | --- | --- | --- | --- |
| A1 | T0 | `cd apps/desktop && npm run build` | tsc + electron-vite 退出 0 | 退出码 0；无 TS 错误 |
| A2 | T0 | `npm run test:renderer-components` | 组件断言计数；5 源上下文断言在输出中 | 全过；断言数不少于改动前 |
| A3 | T0 | `npm run test:ai-mistake-image` | 原有错题图片/脱敏断言 | 全过；无回退相关失败 |
| A4 | T0 | `node scripts/cloud-ocr-consent-smoke.mjs` | 每个 case 的 provider 调用次数、结果字段、审计字段 | 未确认=0 调用；确认=1 调用；失败/取消=0；审计无路径/base64 |
| A4b | T0 | `node scripts/cloud-ocr-consent-smoke.mjs`（归一化 case） | `normalizeMistakeImageAnalysis` 对 `-1` 的输出 | `ocrConfidence=null`、`requiresReview=true`、`ocrSource='cloud'`；非负值保持原样 |
| A5 | T0 | `rg "deepseek:analyzeImage" apps/desktop/src` | 无输出 | 0 命中 |
| A6 | T0 | `rg "analyzeImageWithDeepSeek" apps/desktop/src/main/index.ts` | 仅 provider 定义/导入，不在 runOcr 区块 | 无自动回退调用 |
| A7 | T0 | `rg "readFileSync\(imagePath\)" apps/desktop/src/main/deepseek.ts` | 无输出 | 0 命中 |
| A8 | T0 | `git ls-files .playwright-mcp .orchestration \| wc -l`；`git check-ignore .orchestration/run_a4dbfcb56a64/01-plan.md` | `0`；输出忽略规则 | 0；`.orchestration/` 被忽略 |
| A9 | T0 | `git diff --check`；`git status --short --branch` | 无 whitespace 错误；提交后干净 | 全过 |
| A10 | T1 | `npm run build` | 退出 0 | 通过 |
| A11 | T1 | `npm run test:paper-blueprint` | 对比/模板/零写入/重启断言 | 全过；新增用例可见 |
| A12 | T1 | `npm run test:renderer-components` | 对比/模板 UI 状态 | 全过 |
| A13 | T1 | `npm run test:smoke` | Electron 组卷段：对比→模板→导出→readback→重启；双视口截图 | 通过；若内存被杀则 `BLOCKED` + 原始错误 |
| A14 | T1 | `node scripts/paper-blueprint-smoke.mjs`（导出/回读段） | `document_artifacts` 中答题纸行、SHA-256、文件字节含模板文本 | 三者一致；答题纸无答案 |
| A15 | T2 | `npm run build` | 退出 0 | 通过 |
| A16 | T2 | `npm run test:error-review-write` | 批量确认/失败注入/拒绝/重复/重启断言 | 全过；失败注入后记录数=0、项仍 pending |
| A17 | T2 | `npm run test:renderer-components` | 批量选择/按钮/状态 | 全过 |
| A18 | T2 | `npm run test:smoke` | 多选→批量确认→记录 readback→重启 | 通过；内存被杀则 `BLOCKED` |
| A19 | T2 | 并发/幂等（smoke 内，best-effort） | 两个并发批次最多一个成功；总记录数正确；重复确认必须拒绝 | 无重复写入；若 sqlite3 驱动不支持同连接并发事务，记录原因，仍必须通过重复确认拒绝断言 |
| A20 | G0 | `nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader` | RTX 5060 Laptop / 8151 MiB / 595.79 / 12.0 | 记录到报告 |
| A21 | G0 | `"$VENV_PY" -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'n/a', torch.cuda.get_device_capability(0) if torch.cuda.is_available() else 'n/a')"` | torch 版本、CUDA 版本、available、device、capability | 有值；false 时记录 blocker |
| A22 | G0 | `"$VENV_PY" -c "import onnxruntime as ort; print(ort.__version__, ort.get_available_providers())"` | providers 列表 | 含 `CUDAExecutionProvider`；否则 blocker + CPU fallback |
| A23 | G0 | `"$VENV_PY" python/ocr-smoke.py <tmp>` | 识别行数、文本、置信度、耗时 | ok=true；中文样例识别成功 |
| A24 | G0 | `"$VENV_PY" -c "from sentence_transformers import SentenceTransformer; m=SentenceTransformer('BAAI/bge-small-zh-v1.5', device='cuda'); ..."` | device、dims=512、延迟、VRAM | 有值；CPU/GPU 对比表完整 |
| A25 | G0 | CPU fallback 运行 OCR/embedding | CPU provider/`device='cpu'` 结果 | 仍成功；报告含 CPU vs GPU 表 |
| A26 | G0 | `test -f .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md && grep -E "torch.cuda.is_available\|get_available_providers\|VRAM\|OMNI_EDU_PYTHON\|rollback" .orchestration/run_a4dbfcb56a64/g0-gpu-baseline.md` | 报告存在且关键字段可检索 | 缺一项即 fail |
| A27 | 全局 | `npm run test:db-migration` | v9 基线、无 v10 | 通过 |
| A28 | 全局 | `npm run test:ai-confirmation` | 现有确认队列回归 | 通过（T2 必跑；T0/T1 建议跑） |
| A29 | 全局 | `git diff --check` | 无输出 | 通过 |
| A30 | 全局 | `git log --oneline -3` + `git status` | 本地提交存在、无 push、工作区干净（除忽略项） | 通过 |

---

## 5. Risk register

| # | 风险 | 触发场景 | 影响 | 缓解/证据 | 所有者 |
| --- | --- | --- | --- | --- | --- |
| R1 | **隐私泄露：自动上传原图** | 本地 OCR 失败自动回退；通用 `deepseek:analyzeImage` 被其他入口调用 | P0：违反产品红线，学生原图离开本机 | 删除回退与通用入口；新 IPC 必须 `confirmedUploadOriginal === true`；A4/A5/A6 守卫 | T0 |
| R2 | **隐私泄露：日志/审计含图片** | 调试时打印 base64/路径；异常堆栈带路径 | P0/P1 | 审计只记录 provider/model/requestId/confirmedAt/imageBytes；A4 断言序列化不含路径/base64 | T0 |
| R3 | **云端置信度伪造** | provider 不返回 confidence，用 0.85 兜底 | P1：教师误信低质量 OCR | `null` + `requiresReview=true`；UI 不显示百分比；A4/A4b 断言 | T0 |
| R4 | **同步 IO 冻 UI** | 8MB 图片 `readFileSync`；大文件/备份 | P1：主进程阻塞 | D-P8；A7 守卫；T2 新 helper 不用同步 IO | T0/T2 |
| R5 | **迁移越权** | T1 为模板加列、T2 为批量加表 | P0：老库/新库分叉，无法回退 | D-P7；`schemaMigrations` 保持 v9；A27 + diff review | T1/T2 |
| R6 | **事务部分写入** | 第 2 条记录失败但第 1 条已提交 | P0：学生档案出现半套错因记录 | D-P5；单事务 + 失败注入；A16 | T2 |
| R7 | **确认项重复执行** | 两个批次并发确认同一 pending 项 | P0：重复学习记录 | `BEGIN IMMEDIATE` + 事务内 re-read + `WHERE status='pending'`；A19 | T2 |
| R8 | **批量确认绕过教师** | UI 默认全选/自动提交 | P0：违反教师确认红线 | 显式多选、显式按钮、无自动提交；A18 | T2 |
| R9 | **对比歧义误判** | 两道题同 questionId/同题干，被错误配对 | P1：教师看到错误差异 | `ambiguous` 状态；不猜测；A11 | T1 |
| R10 | **答题纸模板注入/破坏导出** | 模板含 HTML/超长/负 spacing | P1：导出文件损坏或 XSS 风险 | main 侧长度/字符/范围校验；拒绝而非截断；A11/A14 | T1 |
| R11 | **模板伪持久化** | 用 `paper_versions.note`/`papers.status` 偷存设置 | P1：重启后误导教师 | D-P3；UI 标注“本次导出设置”；A14 只验证 artifact | T1 |
| R12 | **内存不足/GPU 争用** | 本机可用内存小；Electron + torch + sidecar 同时跑 | P0/P1：smoke 被杀、结果不可信 | G0 串行；T1/T2 跑 smoke 前关闭 GPU 任务；内存被杀标 `BLOCKED`，不伪造通过 | 全部 |
| R13 | **CUDA/ORT 不支持 sm_120** | wheel 无 Blackwell 支持或 Python 3.13 不兼容 | P1：GPU 基线不可用 | G0 记录精确 blocker + CPU fallback；时间盒 30 分钟/步；不硬装系统驱动 | G0 |
| R14 | **OMP 库冲突** | Anaconda base 的 `libiomp5md.dll` 与 torch/ORT 冲突 | P1：import 崩溃/结果异常 | 用干净 venv；记录 `KMP_DUPLICATE_LIB_OK` 现象；不用它掩盖 | G0 |
| R15 | **auto-sync 覆盖/混入改动** | 后台 auto-sync 在 worker 运行中提交 | P1：提交包含他人改动/冲突 | 开工/提交前 `git status`；只 `git add` 自己路径；不 reset/clean；记录 HEAD | 全部 |
| R16 | **参考许可证/技术栈错配** | 直接粘贴 OpenMAIC/edu-rag 代码 | P0/P1：许可证/维护风险 | D-P9；矩阵写明禁止项；报告引用路径而非代码 | 全部 |
| R17 | **文档冲突** | T1/T2 同时改 docs/26、2.Memory | P1：合并冲突/数字打架 | D-P6 T1→T2；各写各的段落；不重写对方数字 | T1/T2 |
| R18 | **fixture 冒充真实** | fake provider/seed 被写成 live 通过 | P0：验收失真 | D-P10；报告分 `fixture`/`live`/`unknown`；A4/A13/A18 标注 | 全部 |
| R19 | **G0 污染 base 环境** | 误用 `pip install` 到 Anaconda | P0：影响其他项目 | 所有命令使用 venv 绝对路径；报告记录 `where python`；不修改 `D:\Anaconda` | G0 |
| R20 | **8GB VRAM 被其他进程占用** | llama-server/WSL 等占用 | P1：基准失败/偏差 | 基准前后记录 `nvidia-smi`；串行；必要时先记录 blocker 而非杀进程 | G0 |

---

## 6. Do-not-reinvent rules（强制）

### 6.1 UI：HeroUI Pro 优先（docs/17 §7）

- 写任何新 UI 前，先按 `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md` §7.1 顺序：`list_components` → `get_component_docs` → `get_css` → `get_docs` → `get_theme_variables`；MCP 不可用时用 `npm run heroui:mcp -- list|docs|css|guide|tokens`。
- 落地源：`D:\WorkProject\HeroUIPro\herouipro-v3\src\components\<kebab-case>`；本项目已有 vendor 在 `apps/desktop/src/renderer/heroui-pro/components/`，**优先复用已 vendor 的**（`badge`、`list-view`、`chat-*`、`prompt-input`、`markdown` 等）。
- 本轮优先候选（均在 `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\`）：
  - 对比/列表：`data-grid`、`list-view`、`segment`、`action-bar`、`empty-state`、`resizable`
  - 批量确认：`checkbox-button-group`、`action-bar`、`timeline`
- 只允许 vendor **零新增依赖**的组件；`docs/17` §7.3 的 12 个需新增依赖组件（`recharts`、`marked`、`@number-flow/react`、`embla-carousel`、`maplibre-gl`）**不得**在本轮引入。禁止用 `<div>`/`<button>` 手写后声称“以后换 HeroUI”。
- 1366×768 与 1920×1080 都必须可操作；拖拽/多选必须有键盘或按钮替代；状态不能只靠颜色。

### 6.2 Agent / Capability / Error taxonomy：DeepTutor vendor 模式

- 错因分类唯一真源：`apps/desktop/src/main/ai-harness/error-taxonomy.ts`（`omni.error.taxonomy.v1`，四类 `structural/deviation/application/metacognitive` + `unknown`）。**禁止**新建第二套分类器、禁止用自由文本推断掌握度。
- 写入分类白名单唯一真源：`apps/desktop/src/main/db.ts:221-230` 的 `ERROR_REVIEW_CATEGORIES` / `ERROR_REVIEW_LABELS`。
- Agent/Capability 边界参考（只读）：
  - `python/vendor/deeptutor/capabilities/protocol.py`
  - `python/vendor/deeptutor/core/tool_protocol.py`
  - `python/vendor/deeptutor/core/errors.py`
  - `python/vendor/deeptutor/services/llm/error_mapping.py`
- 宿主边界：Electron main 仍是数据、权限、隐私、工具审核、确认和审计的唯一控制面（`docs/24` §4）；sidecar 只返回草稿/建议/证据。
- 不得编辑 `python/vendor/deeptutor/**`；适配写在 bridge/host proxy。

### 6.3 Paper / Exam render / export：先查 OpenMAIC

- 已检查：`D:\WorkProject\小智智能体借鉴项目\OpenMAIC` **没有** exam-paper / answer-sheet 模块；只有 quiz、slide、video export、PPTX/OMML。**不得声称复用了 OpenMAIC 的试卷/答题纸模块。**
- 可复用（概念/测试模式）：
  - `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\quiz\grading.ts`：exact answer-key alignment、歧义不解析。
  - `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\tests\quiz-answer-key.test.ts`：负向测试模式。
  - `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\video-export-app\quiz-layout.ts`：先测量再渲染的确定性思想。
  - `D:\WorkProject\小智智能体借鉴项目\OpenMAIC\lib\video-export\emit-hyperframes\quiz-question-list.ts`：题号/列表结构。
- 禁止复制：Next.js/React 客户端代码、HyperFrames、PPTX/OMML、`temml`/`mathml2omml` 依赖、视频导出管线。
- 本项目试卷/答题纸/解析必须继续走 `document_artifacts` + SHA-256 + status + readback；不得直接写文件绕过 artifact 管线。

### 6.4 RAG / Chunking / Retrieval / Eval：先查 edu-rag 与 Edurag_study

- 已读参考：
  - `D:\WorkProject\小智智能体借鉴项目\edu-rag\ingestion\chunker.py`：递归/语义/Markdown 三策略、`chunk_size=512`、`overlap=64`、分隔符 `["\n\n","\n","。","."," ",""]`、超长块二次切分。
  - `D:\WorkProject\小智智能体借鉴项目\edu-rag\core\nodes\retriever.py`：direct/multi-query/hybrid、复杂度→top_k、merge/dedupe。
  - `D:\WorkProject\小智智能体借鉴项目\edu-rag\core\reranker.py`：CrossEncoder + `RerankerUnavailableError` + sigmoid。
  - `D:\WorkProject\小智智能体借鉴项目\edu-rag\core\retrieval_quality.py`、`evaluation\retrieval_evaluator.py`：recall@5/10/20、precision@5、MRR@10、nDCG@10、拒答/阈值校准。
  - `D:\WorkProject\小智智能体借鉴项目\edu-rag\data\test_sets\retrieval_manual_v1.example.jsonl`：带 `answerable`/`relevant_chunk_ids` 的评测样本格式。
  - `D:\WorkProject\小智智能体借鉴项目\Edurag_study\ingestion\chunker.py`：中文分隔符优先级、超长块兜底。
  - `D:\WorkProject\小智智能体借鉴项目\Edurag_study\core\embeddings.py`：`BAAI/bge-small-zh-v1.5`、`normalize_embeddings=True`（余弦=点积）。
  - `D:\WorkProject\小智智能体借鉴项目\Edurag_study\README.md` D1–D9：中文路径 Milvus 只能 FLAT；BM25 内存索引启动必须重建；清洗禁用 NFKC（`x²`→`x2` 损坏数学语义）；BGE query/document 非对称编码；推理模型护栏。
- 本项目边界：SQLite FTS5 + LanceDB + 现有 `python/omni_edu_embed`；**不引入** Milvus、LangChain、RAGAS、pymilvus。向量不可用必须降级 FTS5；任何命中必须能回到 source/page/chunk。
- 未来做 RAG 变更时，先读上述路径，再写本项目的评测集；不得把 edu-rag/Edurag_study 的代码直接搬进 `python/`。

### 6.5 GPU setup：用上游 RapidOCR / ONNX Runtime / sentence-transformers 指南

- 只用官方安装矩阵：PyTorch CUDA wheel、`onnxruntime-gpu`、`rapidocr`、`sentence-transformers`。不要手写 CUDA kernel、不要从源码编译 ORT、不要改系统驱动。
- 固定 venv：`C:\Users\ZhouXuan\AppData\Local\OmniEdu\venvs\gpu`；不污染 `D:\Anaconda`。
- 版本以实际安装日志为准，不复制 `ai-agent-book` 的旧 pin（`torch==2.1.2`/`ST==2.2.2`）。
- 8GB VRAM 串行；记录 `nvidia-smi` 前后；不可用就记录 blocker + CPU fallback。
- 运行入口通过 `OMNI_EDU_PYTHON`（`apps/desktop/src/main/ai-harness/ndjson-worker.ts:35`、`apps/desktop/src/main/ai-harness/sidecar-client.ts:38`）；不要在代码里硬编码 venv 路径。

### 6.6 跨切面

- **真源**：业务数据只写本地 SQLite；renderer 只经 typed preload；大文件只在受管目录。
- **IPC 四件套**：`contracts.ts` → `main/index.ts` handler（写参数/返回注解）→ `preload/index.ts` → 测试；缺一不可。
- **确认队列**：任何 AI/批量写入必须先 `ai_confirmation_items` pending；拒绝/失败零写入；确认后 readback。
- **无同步 IO**：新增代码用 `node:fs/promises`；不新增第 4 个 JS 互斥锁；一致性用 `BEGIN IMMEDIATE` + UNIQUE/状态守卫。
- **证据分级**：fixture/fake/dry-run 只证明链路；live/真实教师/真实 GPU 单独标注；没有证据写 `unknown`。
- **不要重写文档**：只更新与本轮真实变化相关的段落；不复制历史计数；不改 `docs/26` 中不属于本轮的旧快照。

---

## 7. Worker handoff checklist

每个 worker 的 `worker_done` body 必须是 3 句中文摘要，并附：
- 实际修改文件清单（`--files-modified`）。
- 报告路径（`t0-report.md` / `t1-report.md` / `t2-report.md` / `g0-gpu-baseline.md`）。
- 命令与真实输出摘要（测试计数、readback、hash、截图路径）。
- `live` / `fixture` / `BLOCKED` / `unknown` 的明确标注。
- 未完成项与下一步（不得用“基本完成”掩盖）。

报告模板建议：

```markdown
# <task> report
## 1. 结论（done / partial / blocked）
## 2. 修改文件（逐项）
## 3. 命令与证据
- command:
- exit code:
- key output:
## 4. 参考复用（路径 → 复用内容 → 未复制内容）
## 5. 边界与未验证项
## 6. 提交 SHA / git status
```
