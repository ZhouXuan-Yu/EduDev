# AGENTS.md

本文件为 Omni-Edu Agent 项目的协作开发约定，供 Codex、Claude Code 或其他 AI 编程助手读取。

## 每轮工作记忆约束

每轮工作开始前，必须先阅读项目根目录下的四份协作文档，并以它们作为当前任务基准：

- `1.Agent.md`：产品说明书、Agent 工作方式、代码风格、禁止事项。
- `2.Memory.md`：当前进度、刚确认的事实、下次继续位置。
- `3.Learning.md`：复盘记录、踩坑原因、下次改法。
- `4.Wiki.md`：长期稳定的项目常识库、业务口径、接口说明。

每轮工作结束后，必须根据真实完成情况更新这四份文档：

- 进度变化写入 `2.Memory.md`。
- 本轮错误、踩坑、验证教训写入 `3.Learning.md`。
- 长期稳定的新口径写入 `4.Wiki.md`。
- 工作规则或禁止事项变化写入 `1.Agent.md`。

不要把临时猜测写成已确认事实；不要覆盖用户或上一轮已有改动。

## 项目核心方向

这是一个面向 K-12 独立教师与小微教研团队的端云混合桌面客户端。开发时必须优先服务于 MVP 闭环：

```text
本地题库索引 -> 错题图片解析 -> 脱敏上云分析 -> 本地相似题召回 -> 三元题组输出
```

不要把项目扩展成学校级平台、学生端、家长端、校园管理系统或完整 LMS。

## 工程原则

- 本地优先：题库、学生档案、错题历史默认保存在用户本机。
- 脱敏上云：云端模型只能接收脱敏后的题目文本和必要上下文。
- 先闭环后优化：先做可演示链路，再优化 OCR 准确率、打包体积和 UI 细节。
- 教师可修正：OCR、模型输出、题目解析都要给教师保留修正入口。
- 强约束输出：DeepSeek 返回必须走 JSON Schema 或等价校验。

## MVP 明确不做

- 不做多租户和复杂权限体系。
- 不做复杂 Word/PDF 图文混排解析。
- 不做完美 LaTeX 公式识别。
- 不做模型微调和私有模型部署。
- 不做 Graph RAG、Corrective RAG 等高级 RAG。

## 推荐目录结构

```text
apps/
  desktop/          Electron + Vue 客户端
python/
  omni_edu/         OCR、脱敏、索引、检索脚本
data/
  samples/          样例题库和测试图片
docs/
  01_PRD_MVP.md
  02_ARCHITECTURE.md
  03_DEVELOPMENT_ROADMAP.md
  04_DATA_AND_API_CONTRACTS.md
  05_SECURITY_PRIVACY.md
  06_MVP_EXECUTION_PLAN.md    # MVP 执行计划
  07_SKILL_USAGE_GUIDE.md     # Skill 使用指南
  08_TEST_PLAN.md             # 测试计划
  09_SUBAGENT_TASKS.md        # 子 Agent 任务分配
```

## MVP 执行流程

### 开发阶段

1. **工程骨架** → `docs/06_MVP_EXECUTION_PLAN.md`
2. **Python CLI** → 并行实现 index/search/ocr/sanitize
3. **Electron IPC** → 实现 preload 和 main 进程
4. **Vue 前端** → 实现 UI 组件
5. **DeepSeek 集成** → 实现 API 调用和三元输出
6. **端到端测试** → 交叉验证

### Skill 使用

参见 `docs/07_SKILL_USAGE_GUIDE.md`：

- `gstack-qa` - E2E 测试
- `gstack-investigate` - Bug 调试
- `gstack-ship` - 发布打包
- `canvas` - 可视化展示

### 子 Agent 任务分配

参见 `docs/09_SUBAGENT_TASKS.md`：
- Agent-1: 项目骨架
- Agent-2: index.py
- Agent-3: search.py
- Agent-4: ocr.py
- Agent-5: sanitize.py
- Agent-6: Electron IPC
- Agent-7: Vue 前端
- Agent-8: DeepSeek 集成

## 开发约定

- 涉及文件读取、索引、OCR 和 DeepSeek 调用时必须处理失败状态。
- 不要硬编码 API Key；使用环境变量或本地加密配置。
- 修改核心流程时同步更新 `docs/04_DATA_AND_API_CONTRACTS.md`。
- 新增 P1/P2 功能前先确认不会影响 P0 演示闭环。
- 提交前至少运行相关 lint、typecheck 或最小可用测试。
- 所有 Python CLI 必须遵循 `docs/04_DATA_AND_API_CONTRACTS.md` 中的输出契约。
- 所有 IPC 通道必须通过 preload 脚本暴露，不直接在 renderer 中调用。

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
