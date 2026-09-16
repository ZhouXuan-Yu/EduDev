# AGENTS.md

本文件是 Omni-Edu Agent 项目的 AI 协作入口。任何自动化开发开始前，必须先按本文读取约束与当前证据；不得从历史文档自行恢复已废弃路线。

## 一、每轮必读与文档优先级

每轮开始前依次读取：

1. `1.Agent.md`：强制工程规则与禁止事项。
2. `2.Memory.md`：当前进度、最近验证结果和继续位置。
3. `3.Learning.md`：已发生的错误与防复发规则。
4. `4.Wiki.md`：稳定业务与技术事实。
5. `docs/00_DOCUMENTATION_INDEX.md`：正式文档地图、状态和冲突优先级。

发生冲突时按以下顺序处理：用户本轮明确要求 > `1.Agent.md` > `docs/00_DOCUMENTATION_INDEX.md` 指定的权威文档 > `4.Wiki.md` > `2.Memory.md` 的最新记录 > 代码和测试证据 > 历史记录。规划不能覆盖代码事实，旧测试数字不能当作当前结果。

每轮结束后只按真实变化更新四份协作文档：进度写入 `2.Memory.md`，教训写入 `3.Learning.md`，稳定事实写入 `4.Wiki.md`，规则变化写入 `1.Agent.md`。不要重写历史，不要把猜测写成完成。

## 二、最终产品定义

Omni-Edu Agent 是面向 K-12 独立教师和小微教研团队的本地优先桌面工作台，核心价值是把教师已有的 30–40GB 资料沉淀为可检索、可追溯、可复用的知识库与题库，并完成两条生产闭环：

```text
教师资料 -> 解析与索引 -> 知识库/题库 -> 组卷蓝图 -> 教师确认 -> 试卷与解析
学生错题照片 -> 本地 OCR -> 教师修正 -> 错因/知识点 -> 相似题或改编题 -> 针对性练习
```

产品不是学校级平台、学生端、家长端、完整 LMS、机构经营 SaaS，也不是以聊天或知识图谱为中心的演示项目。小智是贯穿各工作台的助手；知识图谱只可作为有证据支撑的内部增强能力。

产品与模块权威定义见 `docs/11_STRATEGIC_PRODUCT_PRD.md`。

## 三、当前真实技术边界

- 桌面端：Electron + Vite + React + TypeScript + HeroUI。
- 业务真源：本地 SQLite；大文件在受管文件目录；全文和向量索引都是可重建派生物。
- renderer 只能通过 typed preload 调用 Electron main，不得直连 Node、SQLite、Python 或供应商 SDK。
- Python sidecar 只执行受限的解析、OCR、检索或 DeepTutor 能力，不拥有业务数据库、原始学生目录和写权限。
- 云模型只接收脱敏后的最小必要文本；原始错题图片和教师资料默认不上传。
- 默认单机产品不引入 Redis、Kafka、Kubernetes、远程向量数据库或多租户后端。只有经新需求和容量证据确认后才可另立方案。

完整技术边界见 `docs/12_TECH_SELECTION_OVERVIEW.md`。

## 四、大规模修改规则

1. 先读取权威文档、`git status` 和相关代码证据，保护已有脏改动。
2. 先写清用户路径、数据真源、跨进程契约、失败状态和验收证据，再动代码。
3. 每个能力必须纵向完成：主进程/Worker -> typed preload -> React 页面 -> 用户动作 -> SQLite/文件 readback -> 重启后仍成立 -> Electron E2E。
4. “后端已有”不等于完成；前端未接线或 E2E 未覆盖时，必须在 `docs/26_FRONTEND_E2E_COVERAGE_MATRIX.md` 标记缺口。
5. 新增或修改数据库结构必须同时覆盖新装和老库迁移。项目补齐 schema version 前，只允许有守卫的增量迁移。
6. 新 IPC 通道必须同步更新契约、数据库/服务、main handler、preload 和测试；参数与返回值不得退化为 `any`。
7. 新页面放入独立 workspace/component，不继续膨胀 `App.tsx`；新增导航必须同步类型、菜单、分发和 E2E testid。
8. 新 AI 工具按领域拆分，所有模型工具调用经过宿主审核；写入必须进入教师确认队列。
9. 不新增同步文件 IO，不新增仅靠 JavaScript 内存锁保证一致性的关键写入。
10. 不自动提交、推送、发布、合并或修改远端资源，除非用户明确授权。

## 五、产品与数据强约束

- 题目来源必须标记为 `library_original`、`library_adapted`、`ai_generated` 或 `teacher_created`；AI 生成不得伪装成题库命中。
- OCR、解析、题目、答案和解析都必须保留教师修正入口、版本和来源证据。
- 教师资料导入必须支持断点、去重、失败重试、进度和可重建索引；不能把 30–40GB 文件内容整体塞入 SQLite。
- 检索优先混合使用 SQLite FTS5 与本地向量索引；向量索引失效时必须可降级到关键词检索。
- 普通中文印刷体 OCR 默认采用 RapidOCR + ONNX Runtime；复杂版面/表格/公式按需启用 PaddleOCR PP-StructureV3 / PP-FormulaNet。模型必须可下载、校验、切换和回退。
- 云端请求必须可审计、可取消、超时可恢复，且不保存隐藏推理链。只展示可验证的阶段、工具、来源、预算和终态摘要。
- 教师确认前，不得把 AI 草稿写入正式题库、正式试卷、学生结论或报告终稿。

## 六、小智与 DeepTutor 边界

- 小智工程基线：`docs/22_XIAOZHI_EDU_AI_HARNESS_PLAN.md`。
- 教师可用性评分：`docs/23_XIAOZHI_USABILITY_EVAL_RUBRIC.md`。
- DeepTutor 复用边界：`docs/24_DEEPTUTOR_OMNI_EDU_INTEGRATION_DESIGN.md`。
- DeepTutor vendor 必须固定版本并保留许可证；适配代码放在宿主/bridge，不在 vendor 内隐式修改。
- Electron main 始终是数据、权限、隐私、工具审核、确认和审计的唯一控制面。
- fake model、dry-run、proxy grader、seed fixture 和 deterministic smoke 只能证明工程链路，不能宣称真实 provider 或生产质量通过。

## 七、前端与设计规则

- 信息架构、页面状态和 HeroUI 复用规范见 `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md`。
- 首页和导航围绕知识库、题库、组卷、错题训练和产物组织，不围绕技术模块、开发阶段或知识图谱组织。
- 1366×768 和 1920×1080 都必须可操作；DOM 存在但被裁切不算可用。
- 所有页面具有 loading、empty、error、success/ready 和部分失败状态；错误不能抹掉最近一次有效 readback。
- 需要 HeroUI Pro 时先查官方来源；受限或不可用时，从 `D:\WorkProject\HeroUIPro\herouipro-v3\src` 读取匹配组件及其 CSS、主题和依赖后复用。

## 八、验证与完成定义

文档改动至少运行链接/引用检查和 `git diff --check`。代码改动按风险运行：

```powershell
cd apps/desktop
npm run build
npm run test:renderer-components
npm run test:smoke
```

AI、DeepTutor、OCR、检索或导出变更还必须运行对应专项 smoke。真实 API Key、真实模型质量、原生系统对话框和生产安装包必须单独标注验证状态。

只有同时满足以下条件才可称为“完成”：真实入口可见、用户能操作、失败态明确、业务真源可回读、重启后成立、相关 E2E 通过、文档状态已同步。后端方法、编译成功、mock 或单次脚本输出都不等于产品完成。

## 九、文档维护

- 新增长期文档前先判断能否合并进现有 8 份主文档；默认不新增编号方案文档。
- 实施进度写 `2.Memory.md` 或 E2E 矩阵，不在产品/架构文档尾部无限追加日志。
- 文档中必须区分：目标方案、已实现、已验证、未验证、明确不做。
- 删除或替换文档时同步更新 `docs/00_DOCUMENTATION_INDEX.md`、README 和活动引用。
- 历史方案需要追溯时使用 Git 历史，不保留会被 AI 当成当前约束的重复文件。
