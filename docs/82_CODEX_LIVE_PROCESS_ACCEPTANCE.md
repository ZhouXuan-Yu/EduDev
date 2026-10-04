# P06a：真实公开过程与测量基线验收

日期：2026-10-03。合同：docs/81；设计基准：docs/67；M10/M01。**本轮切片通过，完整 P06/Codex 视觉和办公联网目标仍未完成。** 三元题组暂停。

## 1. 实际交付

- 正式 Pi 公开 text 分段与 main 工具事件按真实身份、顺序实时显示；公开说明用深灰正文，工具用细灰行。模型仍运行时，实际页面已经显示首段公开说明；最终答案不覆盖之前段落。仅使用公开 text 和受控事实，不显示隐藏 reasoning。
- 复用现有 HeroUI Pro ChatTool/ChatToolGroup/Disclosure。只把连续实际工具组成一组，不跨说明、计划、控制或整理事实；每个 call 保留状态、来源、实际耗时和可展开详情。失败/拒绝/等待确认优先展示，未知状态不假标完成。
- main 在 Pi native tool start/end 用 performance.now 测实际耗时；真实 usage activeMs + waitingMs 生成轮次“已处理”时长。旧 v1 缺字段兼容、不填假零；snapshot 从已有持久 usage 恢复时间，真实重启逐项回读一致。
- 成功的授权目录列表、文件信息和文本读取，将既有相对 source 经教育脱敏后作为公开详情来源，如“课堂甲.txt”；不增加原始 args/output 或宿主绝对路径。只丰富 details，原模型 content 保持原数据。复制排除此异步 enrichment，避免已经写入后的新 await 影响提交状态。
- 实际 native compact 显示细行，完成默认收起，失败默认展开；私有摘要不显示。原有提问、停止、文件确认/拒绝仍实际可用，等待与成功状态保持真实。
- shared v1 增加可选 durationMs/elapsedMs；没有新表、迁移、IPC 或依赖，没有新增工具权限、第二模型循环或改写原生历史。

## 2. 来源、布局测量与剩余差距

HeroUI MCP 本轮核对 chain-of-thought/chat-tool/chat-conversation 文档；组件源码沿项目已移植本地闭包。ChatTool/ChatToolGroup/styles/index 四文件与 `D:\WorkProject\HeroUIPro\herouipro-v3\src\components\chat-tool` 精确 SHA 相同，记录在 `design/codex-2026-10-03/p06-baseline/hero-process-source.json`。Pro 许可沿现有 README，不称 Codex 官方同一份源码。Finesse 固定 AI-console 参考仍保留，用户原图优先。

实际基线脚本记录 DOM 区域、字体、间距、颜色、DPR、zoom、Windows display scale、内容 bounds 和真实 PNG 像素。最后 baseline-WUNX9U 修正全部区域定位，before/after/live 与报告原字节保存到 `docs/design/codex-2026-10-03/p06-baseline/`，测量表见该目录 MEASUREMENTS.md。

- 当前 Windows display scaleFactor=1.5，Electron zoom=1；Playwright 内容截图 DPR 约 1、CSS viewport 1366×768/1920×1080。原生 contentBounds 与测试仿真视口不同，截图不含 Windows 原生菜单/标题框。
- 原始 R1/R2 没有参考 DPR/zoom。候选除以 1.25 只是假设，**没有完成同 DPI 叠图、整体 pixel diff 或 ≤2 CSS px 门禁**。
- 实际查看最后 after-1366x768 与 live-process：公开说明与真实细行已改，资料名可核对；整窗仍缺窄轨，侧栏/标题/常驻右检查栏与 R2 不一致。live 首段为模型实际英文公开说明，不能称所有运行说明都已完全中文一致。
- D1.1 实际测量基线、D2.1 过程功能、D3.1 实际时长/整理细行通过；D1 同 DPI、D2 精准字形/间距、D3 图片回执、D4 壳/真实文件面板、D5 控制卡/输入样式、D6 设置、D7 最终视觉仍未通过。

## 3. 精确命令与证据

cwd：`D:\WorkProject\EduProject\apps\desktop`；下表 log/report 相对此目录。最终 build 后 UI/重启保持 out 固定。每项最终进程 exit0；表列最终检查全部通过，无套内 skipped。

| 命令 | 最终结果 | 证据及范围 |
| --- | --- | --- |
| `npm run build` | exit0 | `test-results/xiaozhi-agent/pi-public-process-build-final2.log`；renderer index-B3pTEQyR.js |
| `npm run test:renderer-components` | 79/79 | `test-results/xiaozhi-agent/pi-public-process-renderer-final.log` |
| `node scripts/xiaozhi-agent/pi-workspace-baseline.mjs` | success=true | baseline-WUNX9U；portable before JSON/PNG/report；不调用 provider |
| `node scripts/xiaozhi-agent/pi-public-process-smoke.mjs` | 5/5 | `test-results/xiaozhi-agent/pi-public-process-contract.log`；公开顺序/并行身份/分组边界/重复 end/未知时长/旧 v1；收尾再次 exit0 |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | 16/16 | `test-results/xiaozhi-agent/hana-auto-source-audit.json`；SDK10 + tools6 静态来源，非用户实例证明 |
| `node scripts/xiaozhi-agent/pi-public-process-ui-smoke.mjs` | **12/12，success=true** | `test-results/xiaozhi-agent/pi-public-process-ui-54wIzX/report.json`、`pi-public-process-ui-final.log`；正式 Electron/main/typed preload/真实 DeepSeek，报告 model=deepseek-flash |
| `node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | **5/5，success=true** | `test-results/xiaozhi-agent/pi-process-approval-ui-jkD3PD/report.json`、`pi-public-process-approval-ui.log`；真实拒绝零写入/确认一次复制/readback/重启不重放 |
| `node scripts/electron-smoke.mjs` | **207/207，ok=true** | `test-results/xiaozhi-agent/pi-public-process-smoke-final.log`；最终固定 out 现有教育主路径 |
| `git diff --check`（repo cwd） | exit0 | `test-results/xiaozhi-agent/pi-public-process-diff-final.log`；另31个本轮相关源码/脚本/文档空白与冲突检查0错误，保留Markdown合法双空格换行 |

真实过程 12 项：首段在 active 时可见；自然教育请求自动查知识/授权教研目录；读取随机代号与 37/38/31 分钟事实；实际工具与总耗时；main/UI 身份与顺序；native 公开 text 与持久分段一致；原生连续双读使用 Pro Group 并展开逐项来源/时长；双视口输入可达；真实缺失文件失败自动展开；真实 native compact 与 provider usage/私有摘要边界；真实待回答问题与停止；实际重启全部 items/elapsed 回读相同。发送后输入清空在实际 send helper 验证。

审批 5 项：双视口等待操作可达；页面拒绝后目标不存在且 declined 回执保留；页面确认后实际副本字节相同且 executed/完成回执；重启两种决定与文件事实保持，没有重放。

所有资料为隔离测试根中的合成教研数据；原生目录 chooser 返回由 owned main 注入，未称人工 Windows chooser。没有修改真实教师库、系统 DNS/代理/VPN、远端资源或提交/推送。本轮 provider 通过不代表无 VPN/安装包已验收。

## 4. 修订与失败保留

- 初版过程实例 m1G5q7 为 11/11，通过后看截图发现动作缺少实际文件名；增加只读公共详情来源并加入 active 文本可见断言，最后独立重验 54wIzX 为 12/12。
- baseline 前两个报告区域 selector 不完整，改用真实稳定 testid 后 WUNX9U 全区域记录；旧报告保留，不把缺测区域当成功。
- 图索引仍旧时按确认文件回读；猜错文档/CSS 路径或 shell 通配符导致只读失败，使用实际 rg 文件清单与准确路径恢复，不当应用/provider 失败。多文件 patch 缺准确锚点时整体未应用，重读后修正。
- 没有本轮最终功能测试失败；以上初始测量/查找错误与修订不被抹掉。构建/静态 hash/可达实例各有范围，不能互相替代。
- 补充空白扫描首次将架构文档原有3行Markdown双空格硬换行误报；git diff --check本身通过。检查器允许非空Markdown行末恰两空格后31文件0错误，未为检查删除原文合法格式。

## 5. 下一第一动作

**P06b：先冻结 docs/83 框架/面板交付合同，再查现成 Pro app-layout/sidebar/tabs/file-tree 的真实源码闭包和当前教育导航。** 按 R2 做窗口框架、窄轨、会话侧栏、标题、阅读列/输入壳和紧凑资料卡；真实文件 preview/tree 与资料卡是不同模式，接 main/typed preload 权限、开关/调宽/偏好回读。不能给空能力加可点按钮，不能一次推倒 App.tsx。参考 DPI 尚未确认时继续比例/组件与真实交互，保留精度门禁。

随后 P06c 国内模型/权限/Skills 与偏好设置，P07 实际办公文件/联网，P08 实际无 VPN/安装/新旧数据及最终八组实例。D3 图片依真实可公开事件和授权文件能力接入，不造缩略图。完整目标继续 active。
