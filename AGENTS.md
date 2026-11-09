# AGENTS.md

本文件为 Omni-Edu Agent 项目的协作开发约定，供 Codex、Claude Code 或其他 AI 编程助手读取。

## 生效规则与权限

- 用户本轮明确要求优先于仓库文档。仓库转述的历史授权不自动成为当前会话的 commit、merge、push、部署、上传或凭证操作许可；只在实际授权范围内行动。规则冲突先指出，不自行选择权限更宽的一条。
- 本文件是跨工具协作规则入口；`CLAUDE.md` 只提供 Claude 入口，不维护另一套通用规则。产品合同按相关专题核对，实现状态以当前代码、实际测试及 SQLite/文件读回为准，规划不证明完成。
- Pi 是唯一生产 Agent Runtime；SQLite 与本地文件是业务真源。下文数据、隐私、教师确认与来源保护不因文档精简而放宽。
- 不覆盖协作者改动，不在其他工作树背后移动已检出分支，不强推、不清理未知 stash。先检查 HEAD、工作树与目标区域所有权。

## 默认启动：轻入口，然后按任务读取

1. 读取本文件和 [当前状态](docs/goal/CURRENT_STATE.md)，核对当前 HEAD 与本轮任务范围。
2. 从 [文档地图](docs/INDEX.md) 选择本轮相关的合同、源码和验收证据；不默认全文读取所有 `CURRENT`、Master、四本协作文档或历史报告。
3. 知识库/组卷任务读 [活动索引](docs/goal/KB_EXAM_ACTIVE_TASK.md)，再读其中相关实施合同和验收项。
4. UI 任务读 `.agents/skills/edudev-design/SKILL.md`、决策台账及目标目录的局部 `AGENTS.md`。设计入口是 `docs/design/system/README.md`；样张不是实际业务验收。
5. 跨模块或产品边界决策，按地图查 `docs/goal/XIAOZHI_CODEX_GOAL.md` 的相关章节及专题合同。它包含历史记录，不能把旧“下一步”自动恢复为本轮任务。

`1.Agent.md`、`2.Memory.md`、`3.Learning.md`、`4.Wiki.md` 暂留原路径供追溯，第一轮不批量搬移。它们混有历史阶段内容，不再强制每轮全文读写；领域规则需要时仍须核对，不能因未默认加载就认定失效。`docs/28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md` 是历史业务基线，不覆盖较新且已核实的合同。

## 文档维护规则

- 一条事实有一个主要维护位置，其他入口链接，不重复粘贴整段日志。
- 进度变化覆盖更新 `docs/goal/CURRENT_STATE.md` 的短摘要；知识库本轮继续位置更新其活动索引。只有涉及产品/架构/集成/验收时才更新对应专题。
- 详细命令、失败、构建摘要和截图放在本轮证据目录，当前状态链接过去；不把失败改写成通过，也不删除旧证据。
- 稳定规则有变化才更新本文件；经验与模块知识按需维护，不要求每轮给四本或十份状态文档追加同一段话。
- 状态注明适用提交或构建、日期、证据和未验证范围；区分“代码存在”“专项测试通过”“真实界面通过”“教学质量/性能通过”。
- 本轮交付达成后结束。缺输入/权限/环境时完成独立可做工作并报告阻塞；不得仅因为历史总 Goal 仍 ACTIVE 自动续开无限任务。

## 项目核心方向

这是一个面向 K-12 独立教师与小微教研团队的本地优先桌面工作台。产品中心是教师个人知识库、结构化题库、智能组卷和错题训练，不是通用 AI 聊天或学校管理平台。

所有开发必须服务于两条最终业务闭环：

```text
教师资料 -> 解析与索引 -> 题库/知识库 -> 按蓝图组卷 -> 教师确认 -> 试卷与解析
学生错题照片 -> 本地 OCR -> 教师校正 -> 错因/知识点 -> 相似或变式题 -> 针对性练习
```

不要把项目扩展成学校级平台、学生端、家长端、校园管理系统或完整 LMS。

## 工程原则

- 本地优先：原始资料、题库、学生档案、错题图片、索引和产物默认保存在用户本机。
- 数据真源：SQLite 保存结构化业务事实，本地文件系统保存原文件和大产物；FTS、LanceDB、缩略图和缓存必须可重建。
- 脱敏上云：云端模型只能接收脱敏后的必要文本和摘要，原始资料、学生图片和整库不得自动上传。
- 教师可修正：OCR、知识点、难度、答案、解析、AI 改编题和最终试卷都必须允许教师编辑、拒绝和确认。
- 来源可追溯：原题、改编题、AI 生成题和教师创建题必须保留来源类型、父子谱系、版本与确认记录。
- 强约束输出：DeepSeek 和其他 provider 的结构化输出必须经过版本化 schema、业务规则、隐私和权限校验。
- 前后端同步交付：任何能力必须同时完成主进程/Worker、typed preload、可操作前端、失败状态和真实用户路径测试。
- 兼容现有数据：数据库、文件目录、Worker 协议和索引格式变更必须有版本、迁移、失败恢复和旧数据验证。
- 性能不得退化：修改前评估流式输出、主线程、内存、数据库和后台任务资源影响；收尾提供前后对比或明确未测原因，不以选型代替实测。
- 不得为通过测试删除有效断言、放宽安全校验、伪造真实文件或模型结果；修正错误测试必须说明证据并保留原失败。

## 产品边界与暂不建设项

- 不做多租户和复杂权限体系。
- 不做学校级教务、学生端、家长端和完整 LMS。
- 不追求 Word/PDF 像素级还原；优先保证可检索、可定位、可抽题和可导出。
- 不承诺手写字、几何图和复杂公式全自动正确，必须保留原图与教师校正。
- 不做模型微调和私有模型部署。
- 不做 Graph RAG、Corrective RAG 等高级 RAG。
- 不为单机产品引入 Redis、Kafka、Kubernetes、独立 Milvus/Qdrant 等服务。
- 2026-11-03 用户补充：允许安装/首次使用链式下载、配置并启动必要的本地附属服务，质量、本地数据和换机移植优先；不得仅因不能嵌入EXE而排除。上条约束仍用于避免无必要基础设施，不禁止经实际质量、许可证、Windows交付与移植验证的受管本地服务；不自动改变SQLite/文件事实来源或Pi编排。

## 推荐目录结构

```text
apps/
  desktop/          Electron + React + TypeScript 客户端
    src/main/       数据、权限、任务、AI 和文件宿主
    src/preload/    renderer 唯一允许调用的 typed IPC
    src/renderer/   教师可操作界面
    src/shared/     跨进程契约
    scripts/        smoke、eval、E2E 和验收脚本
python/
  omni_edu_*/       OCR、解析、索引、检索和 DeepTutor sidecar
docs/
  26_FRONTEND_E2E_COVERAGE_MATRIX.md
  28_FINAL_PRODUCT_MODULE_ARCHITECTURE.md
```

## 下一次大规模代码修改协议

大规模修改可以连续处理多个关联文件，但禁止一次性推倒重写。必须按以下协议执行。

### 修改前冻结交付合同

开始写代码前必须产出本轮可核验清单：

1. 目标模块编号和教师可见结果。
2. 当前真实能力，以及 backend -> IPC/preload -> frontend -> user action -> test evidence 缺口。
3. 将修改、迁移或新增的表、文件目录、共享契约、IPC、页面和测试。
4. 旧数据兼容、失败恢复、回滚或功能开关方案。
5. 本轮完成定义和明确不做内容。

没有这份交付合同，不开始跨模块大改。执行中若需要改变数据真源、产品边界或外部上传规则，停止并向用户说明。

### 模块依赖顺序

依赖顺序固定为：

```text
M01 本地数据底座
-> M02 资料导入与解析
-> M03 OCR 与切题
-> M04 知识库与混合检索
-> M05 结构化题库
-> M06 智能组卷

M03 + M04 + M05 + M08 学生档案
-> M07 错题训练

M06 + M07 -> M09 产物导出
全部模块 -> M10 AI 治理、M11 备份恢复、M12 安装测试
```

这不是产品阶段。允许并行设计，但实现不得让上层模块绕过尚未稳定的下层契约。

### 纵向切片规则

- 每个切片必须从共享类型或 Worker 协议开始，贯通 main/Worker、preload、renderer、SQLite/文件和测试。
- 优先补齐现有能力的前端入口与 E2E，不以新增 DAO、IPC 或脚本数量衡量进度。
- 禁止继续把新业务大段堆入 `App.tsx`、`db.ts` 或 `main/index.ts`。修改到这些文件时，只抽取本轮涉及的领域边界，不做无关大爆炸重构。
- 新领域代码按 `assets`、`ocr`、`retrieval`、`questions`、`papers`、`mistakes`、`artifacts`、`backup` 等业务域组织；共享契约保持单一事实来源。
- 旧入口在新入口验收通过前不得删除。迁移期间允许 adapter，但必须标记删除条件和对应测试。
- 不允许用 mock-only 页面、静态 demo、直接数据库查询或低层 smoke 冒充用户闭环。

### 数据和迁移安全

- SQLite migration 必须增量、幂等并能在旧数据库副本与全新数据库上运行。
- destructive migration 必须先备份或复制验证，不得为了通过测试删除真实数据。
- 原始文件、教师确认题目和正式产物不可被索引重建覆盖。
- 任务必须幂等、可取消、可恢复；应用退出后不得永久遗留伪 `running`。
- OCR、parser、embedding 和索引格式必须保存版本；新旧版本不得静默混用。
- 大规模文件测试使用明确的测试数据目录，禁止扫描用户未授权目录或把测试产物写入正式数据根。

### 前端与测试完成定义

每个模块切片只有同时满足以下条件才算完成：

1. 教师从当前可见导航进入并完成真实操作。
2. loading、empty、success、cancel、error、partial/retry 状态均有界面反馈。
3. 关键控件有稳定 `data-testid`，但测试必须从用户操作开始。
4. SQLite/文件 readback 与应用重启后状态一致。
5. 组件/契约测试覆盖边界，模块专项 smoke 覆盖底层，Electron E2E 覆盖主路径和关键失败路径。
6. 1366×768 与 1920×1080 不出现不可达控件；导出模块另需 A4/Office/WPS 验证。
7. 测试报告写明精确命令、通过数、失败、skipped 和未验证边界。

涉及桌面端代码的最低门禁：

```powershell
cd apps/desktop
npm run build
npm run test:renderer-components
# 再运行本轮模块专项测试；改变关键用户路径时运行 npm run test:smoke
```

仓库级收尾必须运行 `git diff --check`。构建通过不等于 Electron 用户闭环通过，deterministic proxy 不等于真实 provider 或真实教师验收。

### 大规模修改停止条件

- 发现当前脏改动与目标区域重叠且无法确认所有权。
- 需要删除、覆盖或不可逆迁移真实用户数据。
- 需要改变本地优先、隐私、教师确认或来源谱系规则。
- 连续三次被同一外部条件阻塞，且安全替代路径已耗尽。

遇到上述情况应保留现场、报告证据并请求用户决定，不得自行扩大权限。

### 外部动作与多 Agent

- 未经用户明确授权，不提交、不 push、不发布、不上传资料、不修改远端资源和凭证。
- 只有用户说“启动子agent模式”时才启用项目约定的 Sol-Luna 流程；普通大改请求不自动派发子 Agent。

## 开发约定

- 涉及文件读取、索引、OCR 和 DeepSeek 调用时必须处理失败状态。
- 不要硬编码 API Key；使用环境变量或本地加密配置。
- 修改核心流程时更新受影响的共享契约、当前状态及对应专题，并链接一次性证据；不再强制同步回写所有状态文件和四本协作文档。旧编号文档保留证据，不逐切片新增编号总纲。
- 新增功能前先确认它属于 M01–M12，且不会绕过两条最终业务闭环。
- 提交前至少运行相关 lint、typecheck 或最小可用测试。
- 所有 Python Worker/sidecar 输出必须有版本化协议、超时、取消、错误码和 bounded stderr。
- 所有 IPC 通道必须通过 preload 脚本暴露，不直接在 renderer 中调用。
- 新依赖必须说明用途、许可证、安装体积和 Windows 打包影响，并锁定版本。

## HeroUI Pro MCP Fallback

When a task needs HeroUI Pro components, try the `heroui-pro` MCP first.

If the MCP result indicates the requested component or template requires a paid membership, is unavailable, or cannot be fetched, use the local HeroUI Pro source as the fallback:

- Local source root: `D:\WorkProject\HeroUIPro\herouipro-v3\src`
- Component folders: `D:\WorkProject\HeroUIPro\herouipro-v3\src\components`
- CSS and themes: `D:\WorkProject\HeroUIPro\herouipro-v3\src\css`
- Shared utilities: `D:\WorkProject\HeroUIPro\herouipro-v3\src\utils`

Fallback workflow:

1. Search the local component folders by a close kebab-case name match, for example `data-grid`, `app-layout`, `rich-text-editor`, or `sidebar`.
2. Read the matched component source and nearby CSS/util imports before copying or adapting it.
3. Reuse the local implementation directly when possible, preserving its required CSS, theme files, and utility dependencies.
4. If multiple folders are plausible, inspect each candidate and choose the one whose API and rendered behavior best match the requested HeroUI Pro component.
5. After integrating a local fallback component, run the project checks needed for the touched frontend surface.
