# Pi 教育智能体项目内审与修改说明书

- 日期：2026-10-23
- 适用仓库：`D:\WorkProject\EduProject`
- 适用应用：`apps/desktop`（Electron + React + TypeScript）
- 执行对象：另一个 AI / 后续工程会话
- 本轮状态：**只产出说明书，不保留代码改动**。本轮实验性修改已全部回滚；当前工作区只包含用户原有的未提交改动。

---

## 0. 先读：边界、基线与回滚

### 0.1 不可违反的边界

1. **不要提交、push、发布、上传资料或修改远端资源**，除非用户明确要求。
2. **Pi 唯一模型循环**不能被替换成第二个调度循环。所有改动必须保留 `src/main/xiaozhi-agent/pi-session.ts` 的单一 AgentSession 生命周期。
3. **教师审批、human gate、任务准入、来源/版本/学生绑定、SQLite 单一真源**不得被 UI 或模型文字绕过。
4. **不要删除真实用户数据**。本轮清理只允许删除可重建的构建中间产物和缓存。
5. 工作区已有大量未提交改动（`git status` 数百项）。动手前必须先 `git status --short`，对本说明书涉及的每个文件保存当前 diff 或复制备份，避免覆盖用户已有改动。

### 0.2 本轮已验证的基线

本轮曾按本说明书草案实施并验证，随后按用户要求回滚。可作为后续执行的预期结果：

```text
cd apps/desktop
npx tsc --noEmit                          # 通过
npm run test:renderer-components          # 240/240 通过
node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs
                                          # 8/8 通过
npm run build                             # tsc + electron-vite build 通过
```

Orca 侧：

```text
orca status --json                        # app running, runtime ready, Orca 1.4.232
cd D:\WorkProject\orca-forge
npm test                                  # 64/64 通过
node scripts/cli.mjs doctor               # orca 可用，插件已安装
claude plugin details orca-forge          # 40 skills / 23 agents / 3 hooks
```

### 0.3 本轮已执行的“非代码”清理

- 删除 `apps/desktop/.local-ocr/{layout-v1,page-v1,pdf-v1,resume-v2}-work`（约 120 MB，PyInstaller 构建中间目录，已被 `.gitignore` 忽略）。
- 删除 `apps/desktop/src/main/education/vendor/deeptutor-reading/__pycache__`（约 48 KB，未被 Git 跟踪）。
- **未删除** `.local-ocr/{dist,page-v1-dist,layout-v1-dist,pdf-v1-dist,resume-v2-dist}` 任何运行时副本。原因见 §2.2。

如需完全恢复，只能重新跑 PyInstaller 构建；这些目录不是业务数据。

### 0.4 与并行复核的对齐（重要）

工作区已有另一份复核：`docs/audit/ARCHITECTURE_PERFORMANCE_REVIEW_2026-10-23.md`。它对本文若干建议做了修正；执行时以该复核的约束为准，尤其是下面几条。**不要把两轮的测试通过数混用**：本轮草案跑过 build/组件/Pi smoke；并行复核只跑了 `tsc --noEmit` 与 `git diff --check`，没有跑 build/Electron/真实 provider。

| 本文旧表述 | 应采用的口径 |
|---|---|
| `publicSkills` 按 `catalog.revision` 缓存后不会读到旧内容 | revision 只覆盖**应用内 catalog 提交**；外部磁盘直接改文件不会自动递增 revision。可缓存展示元数据，但执行/预览的完整性检查必须独立；故障结果不能永久缓存 |
| 500ms 改 5s 是安全低风险改动 | 只能作为候选实验；会改变运行期撤权/文件变化发现延迟。保留交付边界检查，并验证发现时限，不能先定安全结论 |
| journal 只保留最近 50 轮，`begin` 后后台 prune | `events.list` 目前没有“历史已压缩”标记；cursor 可能很大但 events 为空。先设计保留水位、快照重置和 receiver 恢复，未经数据保留批准不要删除 |
| `close()` 清空几个 Map 可显著减轻长期资源占用 | 主要是生命周期卫生；不证明运行期间内存泄漏。应先测会话结束后 Map/host 引用是否释放 |
| 先给 reading/learning/question/math 各设 warm worker | 先量化各 worker 启动耗时与请求频率；常驻 Python 会增加空闲内存。需要空闲回收、取消、崩溃恢复和 requestId 隔离合同 |
| 统一巨型 `HostContext` / `PiRunState` 后按行区间拆 | 巨型 context 只是把闭包耦合搬到跨文件。各服务只传最小能力接口，运行 owner 状态只保留一份；原报告部分行区间重叠且会漂移，不能机械剪切 |
| `:not([data-slot])` 能放行所有第三方组件 | 只保护带该属性的节点；第三方组件内层原生节点不一定有。更稳妥是 legacy 容器作用域或明确 CSS layer，并经 Portal、浅色/暗色验证 |
| 优先重构 `tool-registry` | 维护收益明确，但生产性能收益未证明；优先生产 App 启动、流式、UI、snapshot。不要因 legacy 命名或低图谱入度删除代码 |
| Orca 插件收尾与 EduProject 优化一起做 | Orca 插件、用户级技能配置、跨项目修改不属于 EduProject 性能范围；作为独立交付，见 §5 |

并行复核还指出：`App.tsx` 的生产分支 early return 在 2805 行之后，前面的 hooks/effect 仍会执行；`PiEducationWorkspace.tsx:168-196` 与 `OfficeConversation.tsx:91-112` 在流式更新时遍历全部已加载 turns，尚未建立逐轮 memo 边界；`events/publisher.ts:18-24` 是 16ms 时间窗聚批，不是每 token 事务。这些应优先于长文件拆分处理。

---

## 1. 拆除“引入组件被全局约束”

### 1.1 问题定位

用户的核心诉求：**新引入的组件应使用它自己的主题与样式，不再被项目全局 UI 设计系统强制接管**。当前有三层约束：

| 层级 | 文件 | 证据 | 影响 |
|---|---|---|---|
| 全局 token | `apps/desktop/src/renderer/styles.css:1-14` | `:root` 重新定义 `--surface`、`--muted`、`--accent` 等 HeroUI 真实 token | 所有 HeroUI/第三方组件被改成旧项目配色 |
| 全局元素选择器 | `styles.css:66-110`、`styles.css:524-552` | 裸 `button/input/select/textarea/h1/h2/h3/p/label` 规则 | 新组件的字号、边框、宽度、placeholder、disabled 状态被强制 |
| 工作区 token 重绑 | `apps/desktop/src/renderer/components/office/pi-workspace-theme.css:19-58` | `.ai-console-v3.xiaozhi-pi-workspace, .pi-office-menu, .pi-themed-surface` 上重绑 `--foreground/--surface/--muted/--accent/--field-*` 等 | Pi 工作区及其 Portal 内所有 HeroUI 组件被重新主题化 |
| 工作区占位符覆盖 | `apps/desktop/src/renderer/components/office/pi-workspace-glass.css:7-10` | `.pi-themed-surface :is(input, textarea)::placeholder` | 新输入组件的 placeholder 被强制颜色 |
| 产品区 token 重绑 | `apps/desktop/src/renderer/components/product/product-spaces.css:9` | `.product-workspace { --surface: ...; --muted: ... }` | 产品页内新组件继续被接管 |
| 全局技能 | `C:\Users\ZhouXuan\.claude\skills\enterprise-vue-ui-architect\SKILL.md` | 描述写“改任何前端页面/外壳前必读”，内容是 Vue 3 + Element Plus | 与本项目 React/HeroUI 不匹配，属于全局误约束 |
| 文档口径 | `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md:19-24`、`docs/12_TECH_SELECTION_OVERVIEW.md:229-248`、`AGENTS.md:185-203` | 强制 HeroUI/HeroUI Pro 主设计系统、MCP fallback | 后续 AI 会继续按旧约束写代码 |

补充：`styles.css:1220-1297`、`styles.css:3030-3049` 还有一批 HeroUI BEM 类覆盖（`.chat-list-view__*`、`.chat-message__*`）。它们也是约束，但属于**第二阶段**，第一轮不要动，避免一次改太多。

### 1.2 推荐修改顺序（P0 → P1）

> 原则：先把“颜色/主题”解耦，再处理“布局/尺寸”。每一步都独立可验证、可回滚。

#### P0-1：`styles.css` 的项目 token 改为独立命名空间

**改什么**

- 在 `:root` 中把与 HeroUI 冲突的 token 改名为项目私有 token：

```css
:root {
  /* 保留布局/项目专用 */
  --app-surface: #ffffff;
  --app-surface-soft: #f7f7f8;
  --app-line: #d9dde3;
  --app-line-strong: #111827;
  --app-muted: #6b7280;
  --app-text: #111827;
  --app-accent: #002fa7;
  --app-danger: #a93432;
}
```

- 在 `styles.css` 内把所有 `var(--surface)`、`var(--surface-soft)`、`var(--line)`、`var(--line-strong)`、`var(--muted)`、`var(--text)`、`var(--accent)` 替换为对应 `var(--app-*)`。
- 其他项目 CSS 文件也要迁移。建议映射：

| 旧 token | 新 token |
|---|---|
| `--surface` | `--app-surface` |
| `--surface-soft` | `--app-surface-soft` |
| `--line` | `--app-line` |
| `--line-strong` | `--app-line-strong` |
| `--muted` | `--app-muted` |
| `--text` | `--app-text` |
| `--accent` | `--app-accent` |
| `--danger` | `--app-danger` |
| `--foreground` | `--app-text` |
| `--background` | `--app-surface` |
| `--surface-secondary` | `--app-surface-soft` |
| `--border` | `--app-line` |
| `--separator` | `--app-line` |

**例外（必须逐文件确认）**

- `components/students/student-training.css`：原文件使用 `--surface-secondary`、`--separator`、`--foreground`，分别映射到 `--app-surface-soft`、`--app-line`、`--app-text`。
- `components/office/office-markdown.css`、`components/office/pi-question-source.css`：`--foreground` → `--app-text`。
- `components/office/hana-settings/*`、`pi-model-settings.css`、`pi-settings-workspace.css`、`pi-task-review.css`、`product/teacher-library.css`：原文件使用 `--border`，映射到 `--app-line`。
- 不要用一次全局 `sed` 盲替换；先：

```bash
cd apps/desktop
grep -rn -E 'var\(--(surface|surface-soft|surface-secondary|line|line-strong|muted|text|accent|danger|border|separator|foreground|background)\)' \
  src/renderer --include='*.css' | grep -v heroui-pro
```

**为什么**

HeroUI 的 `--surface`、`--muted`、`--accent` 等是组件主题 token。项目在 `:root` 重定义它们，等于给所有组件换肤。改成 `--app-*` 后，项目旧样式继续工作，HeroUI/新组件回到自己的默认主题。

**风险**

- 旧页面的颜色/边框会变化，尤其依赖 `var(--surface)` 等但未迁移的文件。
- 迁移不完整会出现“透明/无边框”。必须按上面的 grep 清单逐个文件改，改完跑 `npm run build` 和截图检查。

#### P0-2：给裸元素选择器加 `[data-slot]` 保护

**改什么**（`styles.css`）

```css
button:not([data-slot]),
input:not([data-slot]),
select:not([data-slot]),
textarea:not([data-slot]) { font: inherit; }

button:not([data-slot]) { cursor: pointer; }
button:not([data-slot]):disabled { cursor: not-allowed; opacity: 0.62; }

h1:not([data-slot]),
h2:not([data-slot]),
h3:not([data-slot]),
p:not([data-slot]) { margin: 0; }

h1:not([data-slot]) { font-size: 28px; line-height: 1.08; }
h2:not([data-slot]) { font-size: 17px; line-height: 1.25; }
h3:not([data-slot]) { font-size: 14px; line-height: 1.35; }
p:not([data-slot]) { color: var(--app-muted); line-height: 1.55; }
```

`styles.css:524-552` 的 `input/select/textarea/label` 同样加 `:not([data-slot])`。

**为什么**

本地 HeroUI 组件（`src/renderer/heroui-pro/components/**`）普遍在根节点输出 `data-slot="..."`（如 `prompt-input`、`chat-message`、`input` 等）。`:not([data-slot])` 让旧的原生表单/标题继续吃旧样式，但放行 HeroUI 和新引入组件。

**修正（见 §0.4）**：`[data-slot]` 只保护带该属性的节点；第三方组件内层原生节点不一定有。若目标组件没有稳定的 `data-slot`，优先用 legacy 容器作用域或明确 CSS layer，并验证 Portal、浅色/暗色。不要声称这一条能放行所有第三方组件。

**注意**

- 不要给 `* { box-sizing }` 和 `body` 加保护；它们是基础布局，保留。
- `label.full` 这类项目专属类保持原样。
- 第二阶段的 `.chat-*` BEM 覆盖先保留，等第一轮视觉验收后再逐块处理。

#### P0-3：`pi-workspace-theme.css` 删除 HeroUI token 重绑

**改什么**

删除 `pi-workspace-theme.css:19-58` 整段（从 `--foreground: var(--pi-ink);` 到 `--focus: var(--pi-focus);`），只保留：

```css
.ai-console-v3.xiaozhi-pi-workspace, .pi-office-menu, .pi-themed-surface {
  --pi-ink: ...;
  --pi-muted: ...;
  /* ...保留全部 --pi-* 变量... */
  color: var(--pi-ink);
  color-scheme: light;
}
```

**为什么**

这段把 HeroUI 的全部语义 token 映射到 `--pi-*`，是“引入组件被全局约束”的核心。删除后：

- 现有项目 CSS 仍可用 `--pi-*`。
- 新引入的 HeroUI/第三方组件在 Pi 工作区内使用 HeroUI 默认主题。
- Portal（Modal/Tooltip/Sidebar.Mobile）也不再继承旧主题。

**前置条件**

先迁移仍在使用旧别名的项目 CSS。可用：

```bash
grep -rn -E 'var\(--(foreground|surface|surface-secondary|muted|text|accent|danger|border|line|line-strong)\)' \
  apps/desktop/src/renderer --include='*.css' | grep -v heroui-pro | grep -v styles.css
```

如果有 Pi 工作区文件仍用这些别名，先改成 `--pi-*`，再删重绑。

#### P0-4：`pi-workspace-glass.css` 删除占位符覆盖

删除 `pi-workspace-glass.css:7-10`：

```css
.pi-themed-surface :is(input, textarea)::placeholder {
  color: var(--pi-muted);
  opacity: 1;
}
```

保留：

- `:108-111` 的 `:focus-visible` 轮廓（可访问性，不是设计约束）。
- `:117-123` 的 `prefers-reduced-motion`（可访问性）。
- `:11-107` 的 Pi 专属布局规则（它们主要匹配 `.pi-*`/`.office-*`，不会误伤新组件）。

#### P0-5：`product-spaces.css` 删除 token 重绑

删除第 9 行：

```css
.product-workspace { --surface:var(--pi-paper); --surface-soft:var(--pi-soft); --text:var(--pi-ink); --muted:var(--pi-muted); --line:var(--pi-line); --line-strong:var(--pi-line); --accent:var(--pi-accent); }
```

保留第 8 行的布局与 `color/background`。

#### P0-6：文档与技能约束（避免下一轮 AI 又加回来）

1. `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md` 顶部加：

```md
> **2026-10-23 更新（当前有效）**：本文件的“统一设计系统 / 组件复用”约束已废弃。
> 项目不再强制 HeroUI/HeroUI Pro 作为唯一设计系统，也不再通过全局 token 重绑约束新引入组件。
> 组件由用户逐次引入并判断；本文件其余内容仅作历史架构参考。
```

2. `docs/12_TECH_SELECTION_OVERVIEW.md:229-248` 的“前端统一采用 HeroUI v3 + HeroUI Pro / shared/ui 包装”改为“历史选型记录；新组件不强制”。
3. `AGENTS.md:185-203` 的 “HeroUI Pro MCP Fallback” 改为“可选参考；不得阻止其他组件引入”。注意保留许可证与本地源码风险说明。
4. `1.Agent.md` 增加一条长期规则（建议放在文件顶部日期段）：

```md
## 2026-10-23 UI设计约束废弃，组件引入由教师逐个判断

旧的全站 UI 设计约束（HeroUI/HeroUI Pro 主题重绑、全局表单/标题元素覆盖、
`enterprise-vue-ui-architect` 技能）自本轮起废弃。项目 CSS 使用 `--app-*` 令牌；
`.xiaozhi-pi-workspace` 只保留 `--pi-*` 语义令牌，不再重绑 HeroUI 的
`--surface/--muted/--accent/--field-*` 等全局令牌。新增或引入的组件默认使用其自身主题。

组件引入与流程约束后续由用户逐次微调；不得以“统一设计系统”为由阻止新组件接入，
也不得用全局 `*` 或裸元素选择器覆盖第三方组件。已引入组件仍需保留原有功能、
可访问性和真实状态，不得只做展示壳。
```

5. 全局技能 `enterprise-vue-ui-architect`：

- **推荐（可逆）**：在项目 `.claude/settings.local.json` 加：

```json
"skillOverrides": {
  "enterprise-vue-ui-architect": "off"
}
```

- 只有用户明确要求“全局删除”时，才把 `C:\Users\ZhouXuan\.claude\skills\enterprise-vue-ui-architect` 移到 `~/.claude/skills-disabled/`。不要直接 `rm -rf`；该技能可能被其他 Vue 项目使用。

### 1.3 验收

```bash
cd apps/desktop
npx tsc --noEmit
npm run test:renderer-components     # 预期 240/240
npm run build
```

视觉检查至少覆盖：

- Pi 对话页（浅色/暗色）
- 设置页
- 产品区（知识库/课堂/学生）
- 一个 Modal / Tooltip / Sidebar.Mobile
- 1366×768 与 1920×1080

重点看：旧页面是否仍可达、输入框是否还有边框/高度、按钮文字是否仍可读、暗色下新组件是否不再被强制成 `--pi-*` 颜色。

### 1.4 回滚

每个文件改动前保存副本或 `git diff > /tmp/<file>.diff`。回滚时只回滚本说明书涉及的文件，不要 `git checkout .`（会丢掉用户已有改动）。

### 1.5 复核补充：Portal、CSS layer、import 约束

1. **Portal 组件不会继承 `.xiaozhi-pi-workspace` 祖先选择器。**
   - `1.Agent.md:53` 明确：`Sidebar.Mobile` Sheet 由 Portal 渲染，不能依赖 `.xiaozhi-pi-workspace` 祖先选择器；必须用 `.pi-sidebar-mobile-sheet` 专属作用域恢复 token。
   - 因此 `pi-workspace-theme.css:3` 同时列出 `.pi-office-menu`、`.pi-themed-surface` 是有意为之，不是重复。
   - 拆除 token 重绑时：
     - 现有 Pi Portal（Modal/Tooltip/Sidebar.Mobile/菜单）继续保留 `pi-themed-surface`/`pi-office-menu`/专属 class，只是不再通过它们重绑 HeroUI 全局 token。
     - 新引入的 Portal 组件默认不自动加这些 class；需要主题时由组件自己的样式或显式 wrapper 决定，不能靠全局祖先。
     - 不要删除 `1.Agent.md:53` 的规则，除非同时给出新的 Portal 主题方案。

2. **CSS layer 顺序是既有约束。**
   - `docs/archive/context-20261016/1.Agent.md:760`（以及 `docs/design/codex-.../source/1.Agent.md` 镜像）要求 HTML head 注册 `properties/theme/base/components/utilities` 顺序，防止 Vite 先加载 Pro 导致 reset 覆盖组件。
   - 当前 `styles.css` 是**未分层**样式，会压过 HeroUI 的 `@layer` 规则；这正是全局元素选择器能接管组件的原因之一。
   - 修改时保留现有 layer 顺序；如果要把 legacy `styles.css` 收进 `@layer legacy`，必须同时确认 layer 顺序和所有旧页面的优先级，不要顺手改。

3. **没有代码级 import 限制。**
   - 仓库没有 ESLint 配置、没有 `no-restricted-imports`、没有组件 allowlist、没有 tsconfig `paths` 约束；`@heroui-pro/react` 也不是依赖。
   - 因此“引入组件被全局约束”不是 import 规则造成的，而是 §1.1 的 CSS token/元素选择器 + 文档口径造成的。
   - 只需改 CSS 与文档，不需要改构建/import 配置。

4. **仍有文档口径要求 HeroUI Pro。**
   - `docs/11_STRATEGIC_PRODUCT_PRD.md:647`、`docs/12_TECH_SELECTION_OVERVIEW.md:247`、`docs/17_...:19-24`、`AGENTS.md:185-203` 仍把 HeroUI Pro 写成强制/首选。
   - 按 §1.2 P0-6 更新；`shared/ui` wrapper 在 `src/renderer` 下并不存在，该规则目前是未执行的文档要求。

---

## 2. 资源占用与冗余清理

### 2.1 运行时高优先级问题（建议先做）

#### H1. 500 ms 全量技能树轮询

- 位置：`apps/desktop/src/main/xiaozhi-agent/pi-session.ts:701-710`
- 证据：`setInterval(..., 500)` 每个 run 都启动；每 tick 调 `checkMemory()`，进而 `skills.check()`；`managed-skill-runtime.ts:79-83` 每 tick 执行两次 `checkFiles()` + 一次全量 `capture()`（重读/重哈希所有资源）。90 秒 turn ≈ 180 次全量校验。
- 修改：把 `500` 改为 `5000`，保留 `memoryTimer.unref()`。模型交付前本来就会 `checkMemory()`，5 秒只是兜底外部文件变更。
- 为什么安全：只影响外部文件变更的发现延迟，不改变 authority/fingerprint 语义。
- **修正（见 §0.4）**：这不是已证明的安全结论；5s 只能作为候选实验，必须保留交付边界检查并测量撤权/文件变化的发现时限。
- 验收：`pi-education-boundary-smoke`、`pi-memory-epoch-smoke`、`pi-skill-authority-smoke`。

#### H2. `publicSkills()` 每次快照重读/重哈希所有已启用技能

- 位置：`production-host.ts:191-202`
- 证据：`managedSkills.catalog()` 后对每个 teacher skill 调 `managedSkills.preview()`；`preview()` 会 `verify()`，即 `readPackage` + 两次文件哈希 + native loader。
- 修改：按 `catalog.revision` 缓存 public skill 数组：

```ts
let publicSkillsCache: { revision: number; skills: XiaozhiSkill[] } | undefined;
async function publicSkills(): Promise<XiaozhiSkill[]> {
  await skillsReady;
  const catalog = await managedSkills.catalog();
  if (publicSkillsCache?.revision === catalog.revision) return publicSkillsCache.skills;
  const builtin = publicEducationSkills();
  const skills = await Promise.all(/* 原逻辑 */);
  publicSkillsCache = { revision: catalog.revision, skills };
  return skills;
}
```

- 为什么安全：任何技能增删改/启停都会 `commit()` 并递增 `catalog.revision`；revision 命中不会读到旧内容。
- **修正（见 §0.4）**：revision 只覆盖应用内 catalog 提交；外部磁盘直接改文件不会自动递增 revision。缓存仅用于展示元数据；执行/预览完整性检查必须独立，故障结果不能永久缓存。
- 注意：如果调用方会修改返回数组，先 `structuredClone`；当前调用方只读。

#### H3. `snapshot()` 热路径做 ~25 次串行读

- 位置：`production-host.ts:356-462`
- 证据：`historyPage`（904）、`waitForRun`（867）、`previewBrowserCapture`（1178）都调用完整 `snapshot`。其中 `previewBrowserCapture` 只需要一个 capture item，却触发全部学生/任务/审批/技能/预算读取。
- 修改顺序：
  1. 新增 `snapshotCapture(sessionId, captureId)`：只读该 session 的 committed turns / journal snapshots，扫描 `browserCapture.id`，不构造完整 projection。
  2. `previewBrowserCapture` 改用它。
  3. `snapshot` 内把 `listStudents('')` 改为按 `detail.session.studentId` 的定点读取（若 store 没有 `getStudent`，先加只读方法）。
  4. `readDeepSeekCapabilities(root, model)` 按 model + 文件 mtime 做短缓存。
  5. `resolveFileWorkspace` 在 888/892 两次读同一 session，去重。
- 风险：中。必须保留 `settlementRead` 重试逻辑和 journal flush 顺序。

#### H4. 事件 journal/outbox 无保留策略

- 位置：`events/journal.ts`
- 证据：`append` 每批事件写 `xiaozhi_event_journal` + `xiaozhi_event_outbox`（71-72），全仓库没有 DELETE；text delta 每 16 ms 一批（`events/publisher.ts:18-24`）。
- 修改：新增 `prune(sessionId, keep=50)`：

```ts
async prune(sessionId: string, keep = 50) {
  await transaction(async work => {
    const rows = await work.all(
      `SELECT run_id FROM xiaozhi_event_runs
        WHERE session_id=? AND status!='running'
        ORDER BY updated_at DESC, run_id DESC LIMIT -1 OFFSET ?`,
      [sessionId, keep],
    );
    for (const row of rows) {
      await work.run('DELETE FROM xiaozhi_event_outbox WHERE run_id=?', [String(row.run_id)]);
      await work.run('DELETE FROM xiaozhi_event_journal WHERE run_id=?', [String(row.run_id)]);
    }
  });
}
```

- 调用：`production-host.ts` 的 `beginJournal` 在 `begin()` 之后 `void ...prune(id).catch(()=>undefined)`。
- 为什么安全：`xiaozhi_event_runs.turn_json` 保留完整投影；只删除旧 run 的 delta/outbox。
- **修正（见 §0.4）**：`events.list` 目前没有“历史已压缩”标记；cursor 可能很大但 events 为空。先设计保留水位、快照重置和 receiver 恢复；未经数据保留批准不要删除。
- 风险：中。若 UI 需要从 `after=0` 重放 50 个之前的旧 run，会拿不到 delta。需产品确认保留数量；建议 50 或按 30 天。
- 验收：新增长历史 smoke 或 SQLite readback，确认旧 run 的 projection 仍可读、当前 run 事件完整。

#### H5. 每个工具调用新起 Python / utility 进程

- 位置：`src/main/education/worker-host.ts:7-13`、`local-utility-host.ts:22`、`ocr-host.ts:58`
- 证据：每个 reading/learning/question/math 调用 `spawn` 一次 Python；本地工具 `fork` utilityProcess；OCR spawn `.exe`。两套并发上限（4 + 8）可同时起 12 个进程。
- 修改建议（分阶段）：
  1. 先移除机器相关硬编码路径：`C:\Python314`、`D:\Anaconda`、`C:\Windows\py.exe`。只保留 `OMNI_EDU_PYTHON`、bundled `python-embed`、Windows `py` launcher。注意：本机 `where py` 存在，删掉硬编码不会立刻破坏开发；但其他开发机若没有 `py` 会 fail closed，这是预期。
  2. 再评估 warm pool：为 reading/learning/question/math 各维护 1 个可复用 worker，按 requestId 多路复用；OCR 单独一个进程池。该阶段风险较高，建议单独立项。
- 不要在同一提交里同时做“去硬编码”和“进程池”。
- **修正（见 §0.4）**：warm pool 前先量化各 worker 启动耗时与请求频率；常驻 Python 会增加空闲内存，需要空闲回收、取消、崩溃恢复和 requestId 隔离合同。

#### H6. 会话级 Map 不释放

- 位置：`production-host.ts:156` `journalFailures`、`:160-164` `learningDecisionGeneration`、`:475` `recoveringModels`
- 修改：在 `close()` 末尾清空：

```ts
journalFailures.clear();
learningDecisionGeneration.clear();
recoveringModels.clear();
```

- 为什么安全：close 后 host 不再服务快照；这些 map 只影响当前进程生命周期。
- **修正（见 §0.4）**：这是生命周期卫生，不证明运行期间内存泄漏；先测会话结束后 Map/host 引用是否释放。

#### H7. 十份重复的 teacher-decision wait 循环

- 位置：`approval-coordinator.ts:14,33-35`、`control-tools.ts:18,52-59`、`office-artifact-coordinator.ts:18,43-45`、`text-change-coordinator.ts:72-74`、`learning-review-coordinator.ts:58-59`、`original-question-coordinator.ts:16`、`paper-coordinator.ts:39`、`practice-review-coordinator.ts:27`、`question-collection-coordinator.ts:53`、`question-review-coordinator.ts:54`
- 修改：抽取 `teacher-wait.ts`，提供 `createTeacherWait<T>()`（Map + AbortSignal + resolve once）和 Set 变体。逐个替换，保持每个 coordinator 的 key 与取消语义。
- 为什么：减少重复、降低遗漏 abort/listener 泄漏的概率。
- 风险：中；需要每个 coordinator 的边界 smoke。

#### H8. `production-host.ts` 返回 facade 的 11 份重复 owner/generation guard

- 位置：`production-host.ts:783-1221`，重复 guard 在 792/797/804/813/818/824/831/836/842/849/854
- 修改：抽 `decisionGuard(sessionId, owner?)`，统一 `closing / conversationStarting / active owner / generation` 判断。
- 风险：低-中；必须保持每个方法的错误码（`busy`/`permission_denied`/`invalid_input`）不变。

#### H9. `pi-session.ts:226-481` 能力身份块重复约 20 次

- 修改：表驱动。**高风险**：注释 272/282/354 明确要求 fingerprint/entry order 字节级稳定。只有在有 snapshot 测试锁定 fingerprint 的情况下才做。
- 建议：先加 fingerprint snapshot 测试，再重构；否则不要动。

#### H10. 测试脚手架编译进生产文件

- 位置：`ipc.ts:32-78`（8 个 env-gated hooks，25-50 ms `fs.existsSync` busy-loop，30 s sleep）、`production-host.ts:1123-1126`
- 修改：移到 `test-hooks.ts`，仅在非 packaged 模式安装。注意 `scripts/acceptance/*` 依赖这些 env gate，改之前先 grep 所有 env 名称并同步脚本。
- 风险：中；如果不改脚本会导致验收失败。

### 2.2 磁盘/构建冗余

| 目录 | 大小 | 结论 |
|---|---:|---|
| `apps/desktop/.local-ocr/resume-v2-dist` | 268 MB | **当前运行时**，必须保留 |
| `apps/desktop/.local-ocr/layout-v1-dist` | 268 MB | 回滚副本；`pi-attachment-ocr-native-worker.ts:55` 的 broken-runtime smoke 仍引用 |
| `apps/desktop/.local-ocr/pdf-v1-dist` | 268 MB | 回滚副本 |
| `apps/desktop/.local-ocr/page-v1-dist` | 268 MB | 回滚副本；`archive-local-ocr.mjs` 读其 licenses |
| `apps/desktop/.local-ocr/dist` | 260 MB | 最早的 image-only 运行时；`lock-ocr-runtime.mjs` 读其 licenses |
| `apps/desktop/.local-ocr/*-work` | ~120 MB | 构建中间目录，**已删**，可重建 |
| `apps/desktop/node_modules` | 1.7 GB | 不要删；删除会破坏开发环境 |
| `docs` | 140 MB | 历史合同/设计归档；是证据，不要直接删；可另立归档策略 |
| `apps/desktop/.local-release` | 33 MB | 本地发布缓存，已被 `.gitignore` 忽略；确认无进行中的 release 后可清 |
| `.orca-forge` | 564 KB | 非权威 run mirror；可 prune，但不要当业务真源 |
| `test-results` | 56 KB | 测试产物，可清 |
| `apps/desktop/src/main/education/vendor` | 7.2 MB | 含 SymPy 6.1 MB + 已删除的 pycache；不要删 SymPy |
| `apps/desktop/src/main/office-agent/vendor` | 264 KB | **不要删**：`scripts/office-agent/*` smoke 仍在用 |

**关于 1.07 GB 旧 OCR dist**：

- 直接删除会破坏 `pi-attachment-ocr-native-worker.ts:55`、`archive-local-ocr.mjs`、`lock-ocr-runtime.mjs` 的回滚/取证路径。
- 如果用户确认“不再需要本地回滚运行时”，按以下顺序做：
  1. 把 broken-runtime smoke 的 `layout-v1-dist` 改为 `resume-v2-dist`。
  2. 把 `archive-local-ocr.mjs` 的 licenses 来源改为 `resume-v2-dist`。
  3. `lock-ocr-runtime.mjs` 的 `dist` 来源改为 `resume-v2-dist` 或显式参数。
  4. 删除 4 个旧 dist（`dist`、`page-v1-dist`、`layout-v1-dist`、`pdf-v1-dist`），保留 `resume-v2-dist`。
  5. 跑 OCR 专项 smoke + 打包检查。
- **不要在未确认的情况下直接 `rm -rf`**；这些是 268 MB 级的不可逆构建产物。

### 2.3 不要删除的“看似冗余”

| 文件/目录 | 原因 |
|---|---|
| `education-skills.ts` vs `education-skills-legacy-v1.ts` | legacy 是冻结 fingerprint 源，删了会改变 session identity |
| `tools/manifest.ts` | 22 行，是 effect/timeout 策略单一来源，被 6 个模块引用 |
| `ai-harness/evals.ts`、`deeptutor-capability-evals.ts`、`usability-eval-cases.ts` | 被 `scripts/*-eval*.mjs` 使用 |
| `legacy-ai/test-runtime.ts`、`legacy-runtime-ipc.ts` | test-only authority mode，保留 |
| `pi-image-adapter.ts`、`office-generator.ts`、`science-ppt.ts` | 动态 import，静态 grep 看不到 |
| `office-agent/app-server-connection.ts`、`event-projection.ts`、`host-command-validation.ts` | **不是死代码**：`scripts/office-agent/*` 仍在 import |
| vendor 下的 `hana`/`mu-decisions`/`openmaic` | 有 `source-manifest.json` 哈希/许可证审计链，不要替换成 node_modules |

---

## 3. 长文件拆分

### 3.1 `src/main/ai-harness/tool-registry.ts`（当前 2576 行）

**Phase 1（低风险，建议先做）：schema 常量外移**

- 新建 `src/main/ai-harness/tool-schemas.ts`，内容为原文件第 32-857 行：
  - `ToolDescriptor`
  - `CompiledAiContext`
  - `AiToolExecutionResult`
  - `DEFAULT_TOOL_OUTPUT_LIMIT`
  - `ALL_AI_ROUTES`
  - `TOOL_GROUPS`
  - `progressiveToolNames`
  - `AI_TOOL_REGISTRY`
- 新文件只 import：

```ts
import type {
  AiConsoleSource, AiConsoleToolRun, AiContextKey, AiIntentRoute,
  AiModelToolJsonSchema, AiModelToolReview, AiRouterDecision,
  KnowledgeNode, LearningRecord, ResourceChunk, SimilarQuestionMatch, Student,
} from '../../shared/contracts';
import type { LearningAnalytics } from './learning-analytics';
```

- 原 `tool-registry.ts` 删除该段，改为：

```ts
import {
  AI_TOOL_REGISTRY, DEFAULT_TOOL_OUTPUT_LIMIT, TOOL_GROUPS, progressiveToolNames,
  type AiToolExecutionResult, type CompiledAiContext, type ToolDescriptor,
} from './tool-schemas';
export { AI_TOOL_REGISTRY, progressiveToolNames } from './tool-schemas';
export type { AiToolExecutionResult, CompiledAiContext } from './tool-schemas';
```

- 该方案在本轮草案中已通过 `tsc`、`npm run build`、`pi-education-boundary-smoke`。
- 结果：`tool-registry.ts` 约 1760 行，`tool-schemas.ts` 约 840 行。

**Phase 2（中风险，单独提交）：executor 拆分**

原文件 1158-2548 行按以下边界抽到 `executors/`：

| 文件 | 行范围 | 内容 |
|---|---:|---|
| `executors/index.ts` | 1158-1214 | 总 dispatcher |
| `executors/learning.ts` | 1215-1364 | 学习/掌握度 |
| `executors/knowledge.ts` | 1365-1869 | 知识库/检索/教材 |
| `executors/artifacts.ts` | 1870-2026 | 附件/教材书/可视化 |
| `executors/practice.ts` | 2027-2375 | 相似题/错题/练习 |
| `executors/memory.ts` | 2376-2547 | 记忆/治理 |
| `tool-context.ts` | 2549-2576 | `compileAiContext` |

- 需要把共享的 `store`、`state`、`sources`、`toolRuns` 等放进一个显式 `ExecutorContext`，不要靠闭包隐式共享。
- 每拆一个文件跑一次 `npx tsc --noEmit` + 相关 tool smoke。

### 3.2 `src/main/xiaozhi-agent/production-host.ts`（当前 1223 行）

**不要一次性重写**。按以下顺序抽，保持 `createXiaozhiProductionHost` 返回对象不变：

| 新文件 | 原行范围 | 依赖 |
|---|---:|---|
| `host-snapshot.ts` | 356-462 | `store`, `tasks`, `browser`, `memory`, `active`, `skills`, `options`, `root` |
| `host-skills.ts` | 187-207 | `managedSkills`, `skillsReady`, `publicEducationSkills` |
| `host-model.ts` | 463-605 | `store`, `root`, `options`, `configuring`, `active`, `starting`, `choosing` |
| `host-run.ts` | 208-247 + 606-782 | `store`, `active`, `options`, `publicEvent` |
| `host-reviews.ts` | 248-289 + 783-884 + 912-925 | 各 review coordinator |
| `host-artifacts.ts` | 290-342 + 913-925 | approvals/text/office artifacts |
| `host-settings.ts` | 935-1005 | settings/MCP/decisions/candidates/memory/skills/budget |
| `host-queue.ts` | 1007-1060 | queue |
| `host-session.ts` | 885-911 + 1061-1221 | workspace/events/history/start/stop/close/browser |

- 关键：这些函数共享大量闭包状态。先定义一个 `HostContext` 类型，把 `store`、`root`、`options`、`active`、`starting`、`choosing`、`configuring`、`closing`、`skillsMutating` 等显式传入。
- 第一刀只抽 `host-snapshot.ts`（纯读，最容易验证），跑 `pi-long-history` 或 `historyPage` 相关 smoke。
- 第二刀抽 `host-skills.ts` 与 `host-model.ts`。
- 第三刀再动 run/review/artifacts。
- 不要在拆分的同时改行为；每个提交只做移动 + 类型化。

### 3.3 `src/main/xiaozhi-agent/pi-session.ts`（当前 1015 行）

| 新文件 | 原行范围 | 内容 | 风险 |
|---|---:|---|---|
| `pi-options.ts` | 53-157 | `PROVIDER`, `MAX_TEXT`, `XIAOZHI_EDUCATION_PROMPT`, `PiXiaozhiOptions` | 低 |
| `pi-capabilities.ts` | 226-481 | 能力身份检查、工具注册、capability prompt | 高（fingerprint/entry order） |
| `pi-model.ts` | 418-522 | auth/registry/settings/resource loader | 中 |
| `pi-tools.ts` | 576-647 | tool definitions/boundaries/dispatchers/manifests | 中 |
| `pi-stream.ts` | 648-768 | `createAgentSession`, `transformContext`, `checkMemory`, stream wrapper | 高 |
| `pi-compaction.ts` | 774-826 | compaction | 中 |
| `pi-events.ts` | 769-773 + 827-893 | emit、instruction queue、subscription mapping、abort | 中 |
| `pi-runtime.ts` | 894-1014 | queue/prompt/compact/dispose | 中 |

- 运行 owner 状态只保留一份；各模块通过最小能力接口读写，不要把整个状态对象传遍所有文件（见 §0.4）。
- `pi-capabilities.ts` 是最大收益（约 250 行），但也是最高风险。先加 fingerprint snapshot 测试，再做。
- 验收：`pi-education-boundary-smoke`、`pi-skills-boundary-smoke`、`pi-memory-epoch-smoke`、`pi-long-history`。

### 3.4 拆分执行的通用规则

1. 一次只拆一个文件，单独提交/保存 diff。
2. 只做“移动 + 显式依赖”，不顺带改逻辑。
3. 每次拆完跑 `npx tsc --noEmit` + 该模块 smoke；不要只跑 build。
4. 保留所有现有导出（barrel re-export），避免外部 import 断裂。
5. 不要拆 `vendor/`；它们是 pinned 源码，拆分无收益且破坏审计。
6. 本文行号会漂移，且原报告部分区间重叠；用 grep 锚点/符号名定位，不要机械按行区间剪切。
7. 不要引入巨型 `HostContext`/`PiRunState`；各服务只传最小能力接口，运行 owner 状态只保留一份。
8. 拆分本身不声明性能收益；性能收益必须由同机器、同构建、同数据的前后测量证明。

---

## 4. Pi 内审发现（按影响排序）

| # | 严重度 | 发现 | 证据 | 建议 | 安全? |
|---|---|---|---|---|---|
| 1 | 高 | 500 ms 全量 skill/memory 轮询 | `pi-session.ts:701-710`; `managed-skill-runtime.ts:79-83` | 改 5 s 或事件驱动 | 是 |
| 2 | 高 | `snapshot()` ~25 次串行读 | `production-host.ts:356-462` | 拆 `snapshotBasic` / 定点 capture 读取 | 中 |
| 3 | 高 | journal/outbox 无保留 | `events/journal.ts:71-72`; `publisher.ts:18-24` | `prune(sessionId, 50)` | 中 |
| 4 | 高 | 每工具调用新起 Python/utility/OCR 进程 | `worker-host.ts:29`; `local-utility-host.ts:22`; `ocr-host.ts:58` | 先去硬编码，再做 warm pool | 是/中 |
| 5 | 高 | 事件日志每 16 ms 写 text delta | `events/publisher.ts:18-24` | 合并批次/保留策略 | 中 |
| 6 | 中 | 十份 teacher wait 循环 | 见 §2.1 H7 | `teacher-wait.ts` | 中 |
| 7 | 中 | 439 行 facade + 11 份 guard | `production-host.ts:783-1221` | `decisionGuard` | 低-中 |
| 8 | 中 | `pi-session.ts:226-481` 约 20 份能力身份块 | 同文件 | 表驱动 + fingerprint snapshot | 高 |
| 9 | 中 | 会话 Map 不释放 | `production-host.ts:156,160-164,475` | `close()` 清空 | 是 |
| 10 | 低-中 | 测试脚手架进生产 | `ipc.ts:32-78`; `production-host.ts:1123-1126` | `test-hooks.ts` | 中 |

**已纠正的一条误判**：`office-agent/app-server-connection.ts`、`event-projection.ts`、`host-command-validation.ts` 并非死代码；`scripts/office-agent/codex-app-server-live-smoke.mjs`、`event-projection-smoke.mjs`、`host-connection-smoke.mjs` 仍在 import。不要删除。

---

## 5. Orca 插件收尾（“最终做成一个 Orca 中的插件”）

### 5.1 现状

- `D:\WorkProject\orca-forge` 是 Orca 原生工程流水线插件，版本 0.1.2。
- 已安装：`claude plugin details orca-forge` 可见 40 skills / 23 agents / 3 hooks；`orca status` 显示 Orca 1.4.232 正在运行。
- 64 个测试通过；真实 Orca trial 已完成到 commit gate（未提交）。
- Orca **没有** `orca plugin` 命令；它的扩展形态是：
  - `~/.agents/skills/<name>/SKILL.md`（Orca skills home）
  - Claude Code plugin（Orca 托管 Claude 会话时加载）
- 当前 `orca skills installed` 列出的技能里**没有** `orca-forge`。所以“Orca 中的插件”还差一个 Orca skill 入口。

### 5.2 收尾步骤

#### S1. 增加 Orca skill 发现入口（推荐）

新建 `C:\Users\ZhouXuan\.agents\skills\orca-forge\SKILL.md`：

```md
---
name: orca-forge
description: >-
  Use Orca Forge for gated planning, supervised worker dispatch, review,
  verification, evidence, and commit gates in Orca-managed worktrees. Trigger
  on /orca-plan, /orca-build, /orca-status, /orca-approve, or a request to run
  a multi-task engineering pipeline with real Orca Run/Task/Dispatch state.
---

# Orca Forge

Orca owns Run/Task/Dispatch/gate state. `.orca-forge/` is a non-authoritative mirror.

Load the installed Claude Code plugin commands from `D:\WorkProject\orca-forge`.
Do not substitute a non-Orca subagent tool for supervised Orca workers.

Core flow:
1. `/orca-plan <objective>` — classify, plan, create gated Task DAG.
2. Human resolves the plan gate.
3. `/orca-build <run_id>` — dispatch ready tasks, validate evidence, re-run acceptance.
4. `/orca-verify`, `/orca-review`, `/orca-status`, `/orca-recover`.
5. Human resolves the commit gate. Never auto-commit.

Before acting, run `node D:\WorkProject\orca-forge\scripts\cli.mjs doctor`.
```

验证：

```bash
orca skills installed | grep orca-forge
```

注意：这是用户级目录；写入前确认用户同意。更保守的做法是把该 skill 放在项目级 `~/.agents/skills` 的副本或通过 `orca skills install` 管理。

#### S2. 真实 Orca E2E（scratch repo，不碰 EduProject）

```bash
# 1. 新建临时 git 仓库
# 2. 在该仓库写 .orca-forge/config.json，配置真实验证命令
# 3. 在 Orca 中打开该仓库，启动 Claude 会话
/orca-plan add a small feature
# 4. 未批准前 /orca-build 必须停在 gate
/orca-approve <gate-id> approve
/orca-build <run-id>
# 5. 强制一个 worker 失败，验证 evidence 拒绝 + terminal retained
# 6. 批准 commit gate，验证 commit task 只在 gate 后派发
# 7. 结束：worker-list 无 active/ready/reclaimable
```

验收项见 `D:\WorkProject\orca-forge\docs\manual-e2e.md`。

#### S3. 降低 always-on token 成本（可选但推荐）

`claude plugin details orca-forge` 显示 always-on ~3,221 tokens。原因：20 skills + 20 commands 全部被当作 skills 加载。

建议：

- **核心保留**：`orca-pipeline`, `orca-plan`, `orca-build`, `orca-status`, `orca-approve`, `orca-review`, `orca-verify`, `orca-worker`, `orca-routing-guide`。
- **移入 library（不放进插件 manifest）**：`orca-add`, `orca-add-feature`, `orca-change`, `orca-change-feature`, `orca-refine`, `orca-refine-code`, `orca-build-mvp`, `orca-gan-build`, `orca-gan-loop`, `orca-eval`, `orca-eval-harness`, `orca-dynamic-workflow`, `orca-continuous-learning`, `orca-continuous-loop`, `orca-memory`, `orca-memory-store`, `orca-team`, `orca-team-orchestration`, `orca-self-evaluation`。
- 保留 commands 作为快捷方式，但把长文档移入 `references/`，`SKILL.md` 只留路由与安全约束。

#### S4. 可选：`edu-pi-audit` Orca skill

如果用户希望“内审”本身可复用，新建 `~/.agents/skills/edu-pi-audit/SKILL.md`，把本文档的 §1-§4 作为 checklist，输出：

- 资源热点（轮询/进程/日志）
- 冗余文件（需验证 import）
- 长文件拆分建议
- 全局 UI 约束检查
- 验收命令

不要在 skill 里硬编码本次行号；用 `grep` 锚点。

### 5.3 “没完成的全部完成”清单

- [x] Orca 发现入口：Orca 自动把 Claude 插件技能列为来源 `Claude plugin orca-forge`，实测发现 12 个核心 skill；不需要再写 `~/.agents/skills/orca-forge/SKILL.md`。
- [x] `orca skills installed` 能列出 orca-forge：12 个核心 skill；`library/` 中的 8 个方法 skill 不被常驻列出，符合预期。
- [ ] scratch repo 真实 Orca E2E（plan gate → build → verify → commit gate）：仍需真人批准 gate，不能用自动批准代替。
- [ ] worker-list 结束无 reclaimable：属于上一条真实 E2E 的验收项。
- [x] `npm test` 68/68；新增 `run-use --id` 与 preflight 测试。
- [x] `claude plugin validate .` 通过。
- [x] always-on token 从 3,221 降到 2,210（-31%）。未达到 <1,500；继续压缩需要再移动核心 agent/command 或缩短描述，收益递减。
- [ ] 可选：`edu-pi-audit` skill。

已完成的插件改动（orca-forge 0.1.5）：

- 核心/库两层：12 skills + 20 commands + 15 agents 常驻；8 method skills + 8 specialist agents 移入 `library/`，按需读取，不占常驻 token。
- 修复 `/orca-resume`：原命令使用 `run-use --run`，真实 Orca 要求 `--id`；新增 `bind` CLI 命令并接入 `/orca-resume`。
- 新增 `preflight` CLI：检查 git worktree、Orca 可达性、commands 的 argv/对象/null 形态、worktree link 源路径；EduProject 实测 `ok: true`。
- 版本 0.1.5 已更新到用户级安装；`claude plugin details orca-forge` 显示 32 skills / 15 agents / 3 hooks / 2,210 tok。

### 5.4 明确不在 Orca-native 范围

- DSH ACP/SDK adapter
- Codex app-server 控制面
- 跨 harness `forge` daemon

如果用户要的是“跨 harness”，应使用 `D:\WorkProject\forge`，不要把它塞进 Orca 插件。Orca-native 的最终形态就是 `orca-forge` + Orca skill 入口。

---

## 6. 验收命令汇总

```bash
# EduProject 桌面端
cd D:\WorkProject\EduProject\apps\desktop
npx tsc --noEmit
npm run test:renderer-components
node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs
npm run build

# Pi 专项（按改动选择）
node scripts/xiaozhi-agent/pi-long-history-ui.mjs
node scripts/xiaozhi-agent/pi-skills-boundary-smoke.mjs
node scripts/xiaozhi-agent/pi-memory-epoch-smoke.mjs
node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs

# Orca 插件
cd D:\WorkProject\orca-forge
npm test
node scripts/cli.mjs doctor
claude plugin validate .
orca skills installed
```

构建通过不等于 Electron 用户闭环通过；UI 改动必须实看 1366×768 / 1920×1080、浅色/暗色、Modal/Tooltip/Sidebar.Mobile。

---

## 7. 文件/行号索引（当前工作区）

| 主题 | 文件:行 |
|---|---|
| 全局 token | `apps/desktop/src/renderer/styles.css:1-14` |
| 全局元素选择器 | `styles.css:66-110`, `styles.css:524-552` |
| BEM 覆盖（第二阶段） | `styles.css:1220-1297`, `styles.css:3030-3049` |
| Pi token 重绑 | `apps/desktop/src/renderer/components/office/pi-workspace-theme.css:19-58` |
| Pi placeholder 覆盖 | `apps/desktop/src/renderer/components/office/pi-workspace-glass.css:7-10` |
| 产品区 token 重绑 | `apps/desktop/src/renderer/components/product/product-spaces.css:9` |
| 500ms 轮询 | `apps/desktop/src/main/xiaozhi-agent/pi-session.ts:701-710` |
| 技能全量校验 | `apps/desktop/src/main/xiaozhi-agent/managed-skill-runtime.ts:79-83` |
| 快照热路径 | `apps/desktop/src/main/xiaozhi-agent/production-host.ts:356-462` |
| publicSkills | `production-host.ts:191-202` |
| browser capture 快照 | `production-host.ts:1174-1185` |
| close | `production-host.ts:1203-1219` |
| journal 写入 | `apps/desktop/src/main/xiaozhi-agent/events/journal.ts:71-72` |
| journal 读取上限 | `events/journal.ts:151-161` |
| Python 进程 | `apps/desktop/src/main/education/worker-host.ts:7-13,29` |
| utility 进程 | `apps/desktop/src/main/xiaozhi-agent/local-utility-host.ts:22` |
| OCR 进程 | `apps/desktop/src/main/xiaozhi-agent/ocr-host.ts:58` |
| tool registry 拆分 | `apps/desktop/src/main/ai-harness/tool-registry.ts:32-857` |
| production host 拆分 | `production-host.ts:356-1221` |
| pi session 拆分 | `pi-session.ts:53-1014` |
| 文档约束 | `docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md:19-24`; `docs/12_TECH_SELECTION_OVERVIEW.md:229-248`; `AGENTS.md:185-203` |
| 长期规则 | `1.Agent.md:299` |
| 全局技能 | `C:\Users\ZhouXuan\.claude\skills\enterprise-vue-ui-architect\SKILL.md` |

---

## 8. 变更记录

- 2026-10-23：首次内审；实验性改动（UI token 解耦、500ms→5s、publicSkills 缓存、journal prune、Python 去硬编码、tool-registry 拆分）已按用户要求全部回滚，代码库未保留本轮修改。
- 2026-10-23：删除了 `.local-ocr/*-work` 构建中间目录和 `deeptutor-reading/__pycache__`（非代码、可重建）。
- 2026-10-23：吸收并行复核 `docs/audit/ARCHITECTURE_PERFORMANCE_REVIEW_2026-10-23.md` 的修正（见 §0.4），调整 publicSkills 缓存、5s 轮询、journal 保留、close 清理、warm pool、长文件拆分、`[data-slot]` 与 tool-registry 优先级的表述；Orca 插件明确为独立交付。
- 本文件本身是本轮唯一新增的交付物。工作区 `1.Agent.md` 顶部的“架构性能审查范围”是并行产生的文档，不是本文件修改。

---

## 9. 2026-10-23 Composer/Grouped 实跑记录

用户目标：用小智输入框/上传区替换为 HeroUI Pro 官方 `Composer` 与 `Grouped` 结构，完全使用组件、不自定义样式，并用该目标测试 orca-forge 插件。

### 9.1 已落地的产品改动

- `chat-attachment` 本地组件补齐官方 anatomy：`ChatAttachment.Icon/Info/Size`、`size` prop、`data-variant`（media/file）、官方 BEM 样式 `chat-attachment.compat.css`。这不是项目自定义样式，而是把本地落后的 vendored 组件更新到文档版本。
- `OfficeComposer` 改为官方 Composer 结构：`ChatAttachmentInput` → `ChatAttachmentInput.Dropzone` 渲染 `PromptInput.Shell`，`ChatAttachmentInput.Trigger` 渲染 `PromptInput.Action`（Paperclip），附件在 `PromptInput.Content` 内用 `PromptInput.Attachments`。
- 删除 `office-conversation.css` 中对 `prompt-input-shell/content/textarea/toolbar/send` 的项目覆盖；官方 shell 以 24px 圆角/主题 token 生效。
- `usePiAttachments` 卡片改为 `ChatAttachmentGroup` + `ChatAttachment`（Preview/Info/Size/Remove），移除旧的 `pi-attachment-item`/caption 包装。
- 新增 typed 导入链路：`attachment-coordinator.importPaths`、`xiaozhi:attachment-import`、preload `getPathForFile` + `importXiaozhiAttachments`、shared `validAttachmentImportInput`。拖拽/粘贴/文件选择都进入既有 main 独占导入、SQLite ledger、OCR/预览/审批管线。
- `sendBlocked` 在存在待发送附件时为 true，避免 D2-C 之前正文发送静默丢失附件。

### 9.2 验证结果

- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- `npm run test:renderer-components`：240/240。
- `pi-attachment-entry-boundary-smoke`：10/10。
- `pi-attachment-entry-source-smoke`：6/6（3 个适配文件按官方 anatomy 校验，2 个未改文件 byte-identical）。
- `pi-attachment-entry-ui-smoke`：23/23，真实 Electron + 真实文件 + SQLite + OCR/预览 + 8 个上限 + 跨会话/frame 权限 + 重启恢复。
- 截图：`apps/desktop/test-results/composer-ui-grouped-5.png`、`composer-ui-media.png`。

### 9.3 插件实战发现与修复

- `--operation review` 原先仍生成 implement/review/commit；现已改为只有一只读 review task（`worktree: current`）。`--operation verify` 同理。
- GAN 图只生成 `gan` gate，但 pipeline 元数据曾写 plan/commit；已统一为 `['gan']`。
- coordinator 增加 `worker_unresponsive` 检测，但真实 review worker 被误报：其 transcript 有 Bash 活动，Orca projection 仍为 `unknown/unverifiable`。正在改为 transcript probe（有增长即视为 alive），见后续插件版本。
- review spec 增加“禁止 `find` 整个 repo/node_modules”，因为一个 review worker 在 `find apps/desktop` 时长时间阻塞。
- 插件版本：0.1.10（review/verify-only graph + GAN gate + preflight/bind + transcript liveness + running-tool alive + classifier `inspect` 误判修复）；91/91 测试，validate 通过，always-on 2,210 tok。
- 本轮真实 run：`run_d5fe7df749f2`（research worker 停顿，已停止）、`run_549c48445aed`（review worker 因 unbounded find 被停止）、`run_5c1dd6f6b8bf`（review worker 长时间思考/读取，最终被停止；未产出 review 报告）、`run_3e8aa2de02ae`（`inspect` 被误判为 spec → GAN，已废弃）。这些 run 不产生 commit。

### 9.4 未完成

- liveness transcript probe：已完成（orca-forge 0.1.10，91/91 测试）；transcript 增长或 running tool call 会重置 stall 计数，读取失败不单独升级。已知边界：长时间纯思考、transcript 不增长的 worker 在达到 `--stall-after`/`--timeout` 窗口后仍会被报告为 `worker_unresponsive`；coordinator 只报告、不停止 worker，实际窗口需按任务调大。
- 分类器 `SPEC_PATTERN` 已改为词边界；`inspect` 不再被当成 spec 文档，verify/review 不再被强制 large+GAN。
- 插件 verify 真实 run：`run_af00a40c4202`（verify-only，无 gate）worker 长时间思考后被停止，未产出插件生成的 verify 报告；本地验收命令已全部独立通过。
- 插件 review 真实 run：`run_5c1dd6f6b8bf` 的 review worker 运行较久后被停止，未产出报告；建议用更小的 diff 或更明确的文件清单再跑一次。
- D2-C 的附件发送正式流程仍按原计划独立验收。
