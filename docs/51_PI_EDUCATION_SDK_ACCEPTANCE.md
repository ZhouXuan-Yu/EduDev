# Pi / Hana 教育基座首片验收

日期：2026-10-02。对应 docs/48–50、M10/M01。P01 通过隔离 SDK 实例范围，正式小智页面尚未切换。未修改真实教师 SQLite、资料目录或系统网络；无 commit/push。

## 已完成与源码来源

- 安装 exact `@earendil-works/pi-coding-agent`、`pi-agent-core`、`pi-ai` 0.80.3，MIT，npm gitHead `a23abe4a695df8b69b613f73e9fdda2a8af894d4`。固定 full-control 示例用于初始化：memory-only AuthStorage/ModelRegistry/SettingsManager、自定义教育 ResourceLoader/提示词、独立 SessionManager。不启动 Codex/Pi CLI，不加载全局资源/OAuth。
- 直接复用 Hana 0.449.0 的六个运行模块/必要函数闭包：session-options、SessionExecutionRegistry、tool-outcome-adapter、shared/tool-outcome、stream-guard、tool-protocol-sanitizer。Apache-2.0 来源/hash/适配记录在 `apps/desktop/src/main/xiaozhi-agent/vendor/hana/source-manifest.json`，可由 `scripts/xiaozhi-agent/vendor-hana-runtime.mjs` 重建。shared 来自 supplemental，未虚构完整仓库 commit。
- `pi-session.ts` 将这些层拼为小智会话：DeepSeek 官方 `https://api.deepseek.com/v1`，只读授权文件和教师审批复制；默认 read/write/edit/exec 等内置工具实际关闭。恢复时校验模型/目录/提示词/工具快照，拒绝静默换模型。SDK JSONL 保存私有历史，公开投影仅正文、工具、安全终态；有单轮预算、取消、运行防重。
- `hana-tool-scope.ts` 是小智必要适配：每轮重新建立 Hana 去重缓存；进入缓存前冻结参数，检查同 ID 不同参数冲突，最多 256 个调用身份。原 Hana 会话级缓存不能直接充当小智跨轮/重启幂等。生产审批/写入幂等仍在 P03。
- 沿用先前 Hana read/stat/list/copy 宿主及文件范围门禁。联网没有成为首片的隐藏前置。SDK 自己执行模型/工具循环；未另写模型循环。
- `@openai/codex` 0.154.0 移至 devDependencies，保留旧实验。生产切换将在 P02 完成后执行。

## 实际证据

以下命令工作目录为 `D:\WorkProject\EduProject\apps\desktop`。脚本均使用独立 `test-results/xiaozhi-agent` 合成教研资料，不扫描真实教师目录。报告不保存密钥或私有推理；私有 SDK 历史可含必要工具正文，不对外公开。

| 命令 | 结果 | 实际证据与范围 |
|---|---|---|
| `node --experimental-strip-types scripts/xiaozhi-agent/pi-education-live-smoke.mjs` | 9/9，exit 0 | `pi-sdk-vME8Wm/report.json`；Node 24.12.0、真实 DeepSeek deepseek-flash；此为缓存适配前的第一版通过记录 |
| `node scripts/xiaozhi-agent/pi-education-boundary-smoke.mjs` | 7/7，exit 0 | 最终缓存适配后 `pi-boundary-cOfMDR/report.json`；真实 SDK/文件工具，模型协议注入，不是 provider 证据 |
| `node scripts/xiaozhi-agent/pi-education-electron-smoke.mjs` | 9/9，exit 0 | 最终 `pi-electron-YQSktU/report.json`，内部 `pi-sdk-fbFgX4/report.json`；Electron 43.2.0 / Node 24.18.0，实际主进程加载 SDK 并再次调用 DeepSeek |
| `npm run build` | exit 0 | 最终 typecheck/main/preload/renderer 构建通过；Pi 新入口尚未接入生产 bundle，不能据此称新正式页面验收通过 |
| `npm run test:renderer-components` | 79/79，exit 0 | 现有页面组件门禁；本轮未改正式 UI，无新页面闭环声明 |
| `git diff --check` | exit 0 | 仓库收尾；仅既有 LF/CRLF 提示 |

### 真实 provider 的九项

1. 小智教育身份、自定义工具 allowlist、无默认 shell/coding 工具。
2. 实际调用 read 获取合成五年级数学教研文本，多个正文 delta；回复包含随机批次、37 分钟、来源文件。
3. 模型实际请求复制，宿主审批，文件字节 readback 一致。
4. 私有 SDK JSONL 存在，未包含调用密钥。
5. dispose/open 后同 session ID、固定 model；原文件已改，仍按之前历史正确回答。
6. 同历史改模型恢复明确拒绝。
7. 不存在的资料文件产生实际 tool error；Hana adapter 将正常返回的失败结果提升为 Pi `isError=true`。
8. 模型请求复制后等待宿主审批，重复 prompt 返回 busy；取消后迟到批准不写文件，registry 释放。
9. 公共事件按 session/run 序号递增，无凭证、thinking/reasoning 字段。

Node 与 Electron 复跑是同九项，不累加成十八个独立能力。

### 注入边界的七项

未注册 `exec_command` 被真实 SDK dispatch 拒绝；新轮复用 call ID 读取更新事实；同轮不同参数 ID 冲突；重复相同复制只审批/写入一次；fetch 失败只产生 failed 终态和安全错误码；空正文不能 completed，私有推理不进入投影；断流到预算时取消并释放运行。全部在真实 SDK 内执行，模型事件为合成，不算真实网络失败现场。

## 失败与修复记录

- TypeScript `SessionEntry` 联合类型未收窄 custom.data；改为显式 type 判别。公共事件 payload 拆为有判别字段的联合，移除 `as never`。
- Node 静态 import 早于 source resolve hook，首次 ERR_MODULE_NOT_FOUND；改为注册 hook 后 dynamic import。
- 自定义 provider 虽有 AuthStorage runtime key，Pi 仍要求 registerProvider.apiKey/oauth；memory-only registry 同时注入 key，无 models.json/auth.json 落盘。失败报告 `pi-sdk-FyaBs8` 保留。
- 首个真实工具成功，模型在批次标识中增加空格；原精确字符串断言误报。改为忽略排版空白，随机批次/时长/来源/工具结果仍须对应。失败报告 `pi-sdk-ujDFB4` 保留。
- 空正文校验原在 completed 之后；移到终态前，协议注入验证只有 failed。
- 新工具 scope callback 缺上下文类型，显式 ToolDefinition 修复；依赖体积脚本最初误指 app 子目录的 third_party，改为仓库根。

## 依赖与 Windows 打包事实

- 新安装命令 added 226 packages；SDK/core/AI 自身 npm 解包合计 19,299,352 bytes。SDK shrinkwrap 还带独立嵌套 core/AI 0.80.3；不能只估算顶层三个包。
- `node scripts/xiaozhi-agent/measure-pi-dependencies.mjs` 实测本机已安装 Pi 生产依赖闭包 236 个 package 位置、215,697,292 bytes（约 205.7 MiB），含既有共享包，**不是安装包新增量**。完整清单见 `third_party/pi/dependency-footprint.json`。
- 包含 TUI console/clipboard 多平台 `.node`、photon-node WASM 和多 provider 库。Windows 主进程实际 SDK 路径已通过；x64/arm64 安装包、asar/native 布局、图片/剪贴板工具、离线安装仍未验收。P08 需显式打包必需资源，不能运行时下载补齐；不为减体积随意删依赖。
- `npm audit --omit=dev --json` exit 1，当前整树 8 个受影响 package：4 high / 4 moderate / 0 critical（含既有与 SDK 嵌套依赖，未把全部归因新 SDK）。报告 `test-results/xiaozhi-agent/npm-audit-production.json`；发布门禁未放行。定向修复属于生产接入/打包任务，不执行强制升 Pi 1.0 或全树自动升级。
- SDK 必需 cost 数字字段目前是内部占位；未向用户显示零成本/准确价格。contextWindow 32768、maxTokens 4096 是保守宿主预算，未宣称为模型全部能力。

## 本轮未验证与下一步

尚未交付：正式小智 main/preload/页面切换，实际教育库工具、持久审批、退出恢复、Skills、完整计划/澄清/压缩、设置模型选择、一比一完整 UI、联网浏览/办公产物、安装包。SDK 首片通过不等于完整 Codex 功能已完成。

实际关闭 VPN 的网络环境尚未验收。此轮直连官方 API、未依赖 Cloudflare/搜索，但机器系统隧道未改变；不冒称“完全不翻墙已通过”。

**下一项 P02**：先冻结 `search_teacher_knowledge` 与正式小智入口的纵向合同，复用已有脱敏/工具审核/教育查询，不另建教育数据真源；SDK → 现有教育知识检索 → typed preload → 公开正文/工具步骤 → 正式页面。验收教师真实操作检索/引用、发送即清空、IME、防重、停止/失败、SQLite/readback 和重启。未验收新入口前保留旧入口；持久写审批随 P03，避免只增加独立脚本而正式入口一直不通。
