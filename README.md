# EduDev · Omni-Edu Agent

面向 K-12 独立教师与小微教研团队的本地优先 AI 教学工作台。围绕教师资料整理、题库检索、智能组卷和教学产物，降低重复劳动；不是学校级平台或完整 LMS。

## 从这里开始

- 使用和开发启动：[启动说明](启动.md)。
- AI 开工：[AGENTS.md](AGENTS.md) → [当前状态](docs/goal/CURRENT_STATE.md) → [按任务文档地图](docs/INDEX.md)。
- 知识库/组卷：[当前活动索引](docs/goal/KB_EXAM_ACTIVE_TASK.md)。
- UI：[设计规范](docs/design/system/README.md)及[项目设计技能](.agents/skills/edudev-design/SKILL.md)。

## 当前能力与验证边界

本页不再维护逐轮测试流水账。基于 `a828e062` 的代码和已有证据，项目已有资料解析、持久后台任务、结构化题库、全文/向量检索、Pi 工具调用、组卷及答案补全等实现；**代码存在不代表全部真实资料、教学质量、规模和安装验收已通过**。

知识库当前自然样本质量仍未整体通过，完整验收项仍开放。最新事实、适用构建、证据与下一工作点统一见[当前状态](docs/goal/CURRENT_STATE.md)。旧进度和能力表保存在[整理前 README](docs/archive/entry-baseline-20261109-a828e062/README.md)，不要将其中旧 P04/P05 排程或旧“尚未接入”表述视为今天状态。

## 核心流程

```text
教师资料 → 解析与索引 → 题库/知识库 → 按蓝图组卷 → 教师确认 → 试卷与解析
学生错题照片 → 本地 OCR → 教师校正 → 错因/知识点 → 相似或变式题 → 针对性练习
```

## 技术与数据边界

- 桌面端：Electron、React、TypeScript、Vite；精确依赖以 [package.json](apps/desktop/package.json) 和锁文件为准。
- SQLite 保存业务事实，本地文件保存原件/题图/产物；FTS、LanceDB 和缓存是可重建索引。
- Pi 是唯一生产 Agent Runtime；renderer 经 typed preload 调用宿主，不能直接越过主进程访问文件和数据库。
- 原件、学生图片和整库不得自动上云；模型输入、联网服务与写入遵循实际授权和现有隐私规则。
- 来源、版本和教师修订必须保留；AI 自动稿不等于教师确认或数学正确。

## 快速开始

先按[完整启动说明](启动.md)准备运行环境和依赖。在仓库根目录执行：

```powershell
cd apps/desktop
npm start
```

也可使用根目录的“启动小智.cmd”。开发工作流、隔离数据目录、Python sidecar 和测试细节以启动说明及实际脚本为准，不依赖某台电脑的固定绝对路径。

```powershell
cd apps/desktop
npm run build
npm run test:renderer-components
```

以上不是完整产品验收；按修改范围执行专项和必要 Electron 路径。涉及真实服务的测试需要有效配置与授权，缺少条件应报告 skipped/blocked，不能伪称通过。不要提交 API Key 或用户资料。

## 主要目录

- `apps/desktop/src/main/`：文件、数据、权限、任务、AI 宿主。
- `apps/desktop/src/preload/`：typed IPC 桥接。
- `apps/desktop/src/renderer/`：教师界面；遵循目录内协作规则。
- `apps/desktop/src/shared/`：共享类型与契约。
- `apps/desktop/scripts/`：专项、组件与 Electron 验证。
- `python/`：解析/OCR/检索及相关本地组件。
- `docs/`：按[文档地图](docs/INDEX.md)读取；历史资料不是当前执行指令。
