# Hana Agent 工具源码、复用与验收

日期：2026-10-02。合同 docs/43。用户要求联网、操作文件等 Agent 工具，并直接复用 Hana 贴合教育项目。

## 1. 源码实际实现

代码图索引实际目录后仍不足：primary graph 1344 nodes，但 lib/tools 被排除；supplemental 203 nodes。按不足回退读取实际源码。两个目录互补而非可直接启动的完整 checkout，primary package 0.449.0、无 .git；按文件 hash 定位复用内容。

| 能力 | Hana 源码 | 实现与小智映射 |
| --- | --- | --- |
| 注册/会话依赖 | core/agent.ts 约 500 行起 | 工具工厂注入 cwd、当前会话、授权目录、文件解析/登记；小智用 Office Host 注入，工具不自行决定全局会话 |
| 读写/编辑/目录 | lib/pi-sdk/index.ts、lib/resource-io/agent-tools.ts、pi-tool-operations.ts | Pi 内置工具通过 ResourceIO 和 principal/session 适配；完整迁移还需资源与审批绑定，不加载第二套 Pi Agent |
| 文件 stat/copy/extract | lib/tools/file-tool.ts、lib/file-ref/resource-io.ts | typed FileRef、读取根校验、目标冲突策略、会话产物登记；小智首批复用底层解析/复制/元信息，保留教育隐私排除目录 |
| 网页读取 | lib/tools/web-fetch.ts、web-reader.ts | HTTP、逐跳校验、HTML→Markdown、来源和截断；直接复制 reader，宿主 transport 补 fixed DNS、体积/取消与逐跳边界 |
| 联网检索 | lib/tools/web-search.ts | Tavily/Serper/Brave/AnySearch/浏览器路径；统一标题、URL、正文、诊断。首批复用 AnySearch 匿名 API 的原始函数，不自动切换服务 |
| 搜索限流 | lib/tools/search-rate-limiter.ts | 并发、间隔、退避、429/Retry-After；本轮复制模块并复用错误类型，任务取消兼容队列仍待接入 |
| 浏览器 | lib/tools/browser-tool.ts、lib/browser/browser-manager.ts、browser-transport.ts | start/stop/navigate/snapshot/screenshot/click/type/scroll/select/key/wait/evaluate/show；绑定 session/tab、动作日志、截图文件与模型视觉能力 |
| 权限 | lib/permission/tool-invocation-permission.ts、lib/sandbox/tool-wrapper.ts | 参数冻结、实际工具的效果/作用域、PathGuard 与 OS sandbox 分层。纯路径检查不是任意 shell 的 OS 安全边界 |

浏览器点击、输入和 evaluate 与网页读取不是同一个权限。不能把浏览器工厂中的 execute 或桌面桥单独复制后就开放操作；还需要同一会话/标签身份、授权决定、下载产物与取消。当前 DeepSeek 视觉也不能从存在 screenshot 按钮推断。

## 2. 已落盘

- `src/main/office-agent/vendor/hana`：6 份源实现/抽取文件及 manifest，源码约 42KiB（不含后续 README）。Apache notice/许可保留。
- `src/shared/office-tools.ts`：结果/错误/复制审批契约。
- `src/main/office-agent/hana-tool-adapter.ts`：office_read_text、office_file_stat、office_list_files、office_copy_file、office_web_fetch、office_web_search。
- `office-network.ts`：公网地址校验、固定 DNS 连接、逐跳验证、1MiB 响应、任务取消。系统 DNS 默认；公开 DoH 是显式配置，未改 OS。
- P0 driver `--restricted --hana-tools` 消费真实模块，动态工具声明进入实际 DeepSeek 请求，Hana 结果回送引擎后模型继续。

工具调用路径：DeepSeek → Codex app-server item/tool/call → 宿主参数快照/校验 → Hana 实现 → 版本化结果 → 引擎 → 模型继续 → 公开事件投影。不存在新的模型/工具主循环。

文件复制审批绑定 session/run/call/source/target/sourceSha256。拒绝/等待取消无写入；通过后再次核对版本，COPYFILE_EXCL 拒绝已有/并发目标，实际读回。当前去重为单宿主内存范围，不等于崩溃恢复或持久审批 UI。

## 3. 依赖

exact jsdom 29.0.2 / undici 7.24.7 / ipaddr.js 2.2.0，均 MIT。网页 reader 使用与 Hana 相同的 jsdom；后两项用于地址检查及固定连接。三个包各自安装字节 7,027,994 / 1,609,243 / 62,306。当前可达依赖闭包 40 包、22,716,505 bytes（含现有共享依赖，不能叫纯新增或最终安装包体）。npm 本次新增 38 包；无新增原生编译。真实 Electron 43.2.0 / Node 24.18.0 宿主专项验证可用，installer 未验收。

## 4. 真实结果

- 初次联网报告 `hana-tools-560AQH/report.json`：本地 11 项通过，两个真实外部请求失败，exit 1。系统 DNS 将公开域名解析为 198.18.0.33/34，公网检查拒绝；没有放宽私网地址范围。
- 显式 DoH 后 `hana-tools-3IT2bD/report.json`：本地 11/11，网页/检索 2/2，exit 0。真实搜索返回教育部课程方案 PDF 等链接，无搜索 key；第三方匿名服务可用性不能承诺长期不变。
- `codex-p0-Nk0Tpb/report.json`：首个真实模型扩展报告 exit 1，断言误将网页标题要求出现在 reader 正文中。实际工具已经成功，标题在 title 字段；修正字段断言，保留失败报告。
- `codex-p0-wQPu3W/report.json`：真实 DeepSeek 与受控模式 14/14、exit 0，包含文件→回答、复制→stat/readback、网页→回答、检索→真实链接引用、重启历史/公开投影、停止及既有故障边界。审批回调为合成测试精确 source/target allowlist；HTTP故障仍为注明的注入用例，不是全部真实服务故障。
- 首次 Electron-main `hana-electron-RHTkOk/report.json`：实际 Electron/Node 下相同本地 11/11，exit 0；独立主进程实例，无生产 UI 声明。
- 新增并发目标 COPYFILE_EXCL 专项后最终 Node `hana-tools-Ox3ENg/report.json`、Electron `hana-electron-W3ejl9/report.json` 均 12/12 exit 0（Electron 子报告 hana-tools-AhaOlf）；与旧用例重叠不能累计成独立总数。
- `npm run build` exit 0；`npm run test:renderer-components` 79/79 exit 0。无关键旧页面变更，不额外重跑完整旧 Electron 用户路径来冒充新入口。
- 收尾 `git diff --check` exit 0，只有现有 LF/CRLF 提示。未提交、push、系统初始化或真实教师数据变更。

命令（cwd apps/desktop）：`node scripts/office-agent/hana-tools-smoke.mjs --live-network`、`node scripts/office-agent/hana-tools-electron-smoke.mjs`、`node scripts/office-agent/codex-app-server-live-smoke.mjs --restricted --hana-tools`。

## 5. 后续按能力逐项接入

| 目标 | 当前边界 / 下一交付 |
| --- | --- |
| 正式小智工具调用 | 现阶段仅隔离 Host/Harness 实例；A01–A07 接入生产主进程、typed preload、SQLite 和可见页面 |
| 读写与文件管理 | 首批 read/stat/list/copy；write/edit/move/delete 需草稿、教师批准、冲突和可恢复提交 |
| DOCX/XLSX/PPTX/PDF | 后续复用 Hana extract/document 模块及依赖，实际文件实例验证；文本工具明确拒绝二进制，不能把格式清单当已支持 |
| 浏览器/下载 | 复用完整 session/tab/transport/动作权限/文件登记依赖，逐项导航、快照、点击、输入、下载验收 |
| Skills/MCP | 工具目录、启用、授权与不可用诊断；技能不能扩大执行权限 |
| OS 与 shell | H05 授权未答复，仍禁止初始化系统或任意内置命令；受控工具测试不代表 OS 沙箱完成 |

小智继续面向教育工作台的资料整理、备课、文档与研究需求；不自动读取学生库/原图，不自动上传整库，不恢复三元题组开发，不把来源资料中的句子当用户授权。整套 Hana 人格/会话/远程桥接不复制到小智竞争主 Harness。
