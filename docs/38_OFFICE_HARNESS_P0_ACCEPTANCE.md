# 小智 Office Harness P0 实测记录

日期：2026-10-02。合同：docs/37；总目标及待办：docs/34–35。**P0 部分通过，完整目标仍未完成。**

## 实测环境与复用

- 官方 Codex CLI/app-server 0.154.0，项目依赖 exact lock，Windows x64。原生引擎未修改；协议 glue 只转发 JSONL，不实现模型/工具循环。
- DeepSeek 实际模型 `deepseek-flash`，Responses，低推理档。调试凭证来自 Git 忽略文件，报告不记录凭证、请求原文或隐藏推理。
- 每次创建独立 runtime 配置/历史和合成工作目录，不继承全局 Codex 会话与 MCP。合成文件内容包含只有实际读取才知道的金额和随机核验编号。
- 默认协议生成会省略实验字段；`generate-ts --experimental` 实际包含 dynamicTools。initialize 的 experimentalApi=true 后，动态工具调用与 thread/resume 恢复均实测通过。
- Windows x64 npm 包解压声明 398,574,236 字节。官方 native exe/全部 helper 在 Git 忽略的 resources/codex/vendor 布局复制后运行，主程序 SHA-256 与锁定包相同。LICENSE/NOTICE 保存于 third_party/codex。外置布局验证不等于签名安装包验收。

## 实例及冒烟证据

在 `apps/desktop` 执行：

```powershell
node scripts/office-agent/codex-app-server-live-smoke.mjs --restricted --extended --packaged-runtime
node scripts/office-agent/codex-app-server-live-smoke.mjs --extended
npm run build
npm run test:renderer-components
```

| 专项 | 结果 | 报告 |
| --- | --- | --- |
| 受控模式 + 实际资源布局 | 10/10，exit 0 | test-results/office-plan/codex-p0-0gfeXq/report.json |
| 原生文件审批与崩溃恢复 | 10/10，exit 0 | test-results/office-plan/codex-p0-Bt26uL/report.json |
| 受控模式模型快照补验 | 10/10，exit 0；每次请求与恢复均固定选定模型 | test-results/office-plan/codex-p0-qtxEYd/report.json |
| TypeScript + Electron main/preload/renderer build | 通过，exit 0 | 本轮命令输出 |
| renderer-component-states | 79/79，exit 0 | 本轮命令输出 |

两个运行时专项重叠基础用例，不能相加声称 20 个不同用例。受控专项的故障注入与真实 provider 请求分开：

1. 真实 initialize → thread/start → turn/start → 正文 delta → completed/nonempty。
2. 实际模型请求 office_read_text，宿主读真实合成文件，模型继续准确报告金额与随机编号。
3. 相对路径和绝对路径越界拦截；只是宿主工具边界测试，不宣称 OS 全局权限已配置。
4. 杀掉自己启动的 app-server 进程树，再以原 threadId 恢复；模型记得金额，已完成工具不重跑。
5. 在真实工具调用等待时 interrupt，收到 interrupted 终态。原先长文本停止用例因回合已结束而出现 `no active turn`，已改为实际活跃工具等待状态，未延长预算掩盖竞态。
6. Responses 接口确定性注入一次 HTTP 500，引擎重试的请求快照不变；随后真实 DeepSeek 回复成功。
7. 确定性 Responses 注入未授权的 shell_command、exec_command、apply_patch：引擎 dispatch 返回 unsupported，合成越界哨兵文件不存在。这一项不冒充真实模型决策。
8. 实际上游工具列表不包含 shell/patch/image/browser/computer/子智能体；包含 office_read_text、用户输入和 goal。关闭宿主技能发现，防止继承全局技能范围。
9. 受控模式通过仅在宿主内存持有供应商 key 的转发器连接真实 DeepSeek；引擎环境里只有一次性本地转发令牌。
10. 真实 contextCompaction 项完成后，模型仍正确回忆工具事实。
11. 原生 apply_patch 产生真实 fileChange 审批：等待时零写；decline 零写；accept 后真实文件内容 readback。
12. 审批等待时强制退出，重启恢复最后 turn 为 interrupted，旧活跃审批为 0，文件仍不存在；新 turn 重新发起审批、明确 accept 后才写入并 readback。

注入工具用例初次把合成 function call 继续交给真实 DeepSeek，缺少与合成调用匹配的 reasoning_text 而被 provider 拒绝。修正为独立故障线程，确定性只检查 dispatch 拒绝；真实推理历史、工具继续和压缩仍由未改写的 provider 回合验证。不能用伪造隐藏推理让测试通过。

## 当前未放行项

- Windows `windowsSandbox/readiness` 实际返回 **notConfigured**。没有运行 OS sandbox setup，没有宣称原生命令已隔离。生产默认必须保持受控办公能力；若开放内置命令，须先实际配置和验证 OS 权限，不能靠提示词。
- H01 按 P0 依赖/资源布局范围完成；正式签名 installer、arm64 与升级/回滚未验证，归安装交付门禁；资源布局要求必须写入正式打包配置。
- H06 的压缩、重试、同线程身份恢复及公开投影补读/去重合同已按 P0 范围通过；生产 SQLite、preload 订阅与跨进程运行所有者尚未接入，归 A02/A04/A07。
- 原生等待审批崩溃后不会自动恢复旧请求；持久宿主审批与界面补读需要独立实现，原批准结果不可自动套用新回合。
- Electron 正式页面仍走旧 direct/DeepTutor/教育图。当前没有接管生产 AI、没有完成 Codex UI、skills/设置/模型选项或办公文件编辑。
- npm audit 记录在忽略的 test-results/office-plan/npm-audit-runtime.json，当前依赖树 5 项（2 moderate、3 high），涉及 Electron/已有渲染或网络依赖；本轮未做无关全量升级。发布前需定向处理并复验，不把新增 Codex 依赖归因成这 5 项。

## 下一切片

继续 H05：系统初始化授权待答复；同时准备已有 UI 组件复用与办公工具合同。P0 放行后做 main → typed preload → 可操作小智工作区 → 真实 Electron 验收。基座选择已有实际可行性，仍不能宣布完整 Harness 或全项目完成。

## 事件恢复与 Windows 权限补验

- `node scripts/office-agent/sync-protocol-types.mjs`：从锁定 0.154.0 的 experimental 生成协议复制 67 份必要类型及依赖；保留原始头与 Apache-2.0 来源，未手写引擎协议。
- `node scripts/office-agent/event-projection-smoke.mjs`：14/14，包括 delta/completed upsert、真实 phase、重复序号、旧 epoch、序号缺口、部分历史不覆盖、隐式推理/原始工具内容遗漏、文本预算与凭证脱敏。
- `node scripts/office-agent/codex-app-server-live-smoke.mjs --restricted --extended`：12/12，exit 0；报告 `test-results/office-plan/codex-p0-146P9Y/report.json`。新增真实正文与 thread/read 的 itemId/phase/text 一致、重复通知不重复、杀进程重启后历史投影一致。
- 初次事件补验失败是测试在 await 后读取已追加状态通知的活动数组，比较批次不一致；改为固定事件快照后实测通过。失败报告 `codex-p0-gNYFLE/report.json` 保留，不删除失败记录。
- `node scripts/office-agent/windows-permission-smoke.mjs`：exit 1；报告 `windows-permission-ScZNM6/report.json`。官方错误 `Restricted read-only access requires the elevated Windows sandbox backend`，尚未进入文件访问探针，不能声称越界读写被 OS 拒绝。
- 依据 AGENTS.md 的私有状态保护要求，已就官方初始化所需本地低权限账号、防火墙和权限策略变更提出明确授权问题；尚无答复，不执行系统初始化。
- 本轮 `npm run build`、`npm run test:renderer-components` 79/79 通过；新增投影未接管生产用户路径，不将专项结果称作 Electron 新工作区验收。
