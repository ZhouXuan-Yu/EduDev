# P06d-A 阅读区、过程行与输入布局验收

日期：2026-10-03；合同 docs/97（包含实例发现后的限定修正），M10/M01。**本切片通过，完整 D1–D7/P06 与总目标仍未完成。** 最终应用 `index-D4i0noIl`，build-final4 与最后 test:smoke 重建同一 renderer 入口；之后没有应用源码修改。没有提交、推送、新依赖、表、IPC、授权或系统网络变化。

## 1. 实际交付

- 原 HeroUI Pro ChatMessage/StreamMarkdown/ChatTool/Group/PromptInput 继续消费同一真实 Pi 投影。工具行改为实际公开动作类别的16px线性图标，未知类别用中性 Workflow；状态/来源/实际耗时仍可展开。失败和等待继续自动展开。未修改原 Pro32份来源，未增加第二智能体循环。
- 阅读正文实际内部 p 为16px、27.2px行高、`rgb(48,51,50)`；补局部规则修复旧14px内容样式和 Markdown 主题色覆盖。段落间隔16px、正文/过程节点间隔24px；已结束时长位于细分隔线上方，仍用真实 run.elapsedMs。
- 输入取消叠加28px横向 padding，小窗外边线16px，最大928px。真实内容1366/1920：正文与 textarea 左边线差6.67/2.33CSSpx；输入壳宽662/928px。默认 toolbar 及长技能选择状态均单行，实际模型与技能全名仍在菜单/说明内可查。窄于440px CSS允许换行；本次实际文件分栏宽度仍可单行，不能称已验所有窄宽换行。
- 实例发现原 AppLayout 切换 asideResizable 会重建子树。新增 session-keyed OfficeComposerState 在壳外持有临时输入状态，保留草稿、技能、队列模式、错误/发送停止互斥ref；原独立 OfficeComposer 使用本地 fallback。开启/关闭文件面板保留同会话状态，新会话清空。该状态不写SQLite/localStorage、不授予工具/Skills/文件权限；原宿主/IPC仍是真源。
- 修改范围：office适配CSS、OfficeComposer/ToolProcess、PiEducationWorkspace及新增OfficeComposerState；基线/metrics/真实过程脚本补隔离profile和实际内部节点检查；新增布局实例脚本。无新依赖/许可证/安装体积变化。

## 2. 实测与精确命令

以下 cwd 为 `D:\WorkProject\EduProject\apps\desktop`。所有模型请求只用现有本地配置与合成教研资料；独立SQLite/profile，native chooser 返回在所属测试 main 受控。未接触正式教师库/原图/学生档案。

| 命令 | 最终结果 | 证据 |
| --- | --- | --- |
| `npm run build` | exit0，build-final4/index-D4i0noIl | p06d-build-final4.log |
| `npm run test:renderer-components` | 79/79，exit0 | p06d-renderer-final2.log |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 来源32文件/182153字节，exit0 | p06d-pro-source.log；只是来源证明 |
| `node scripts/xiaozhi-agent/pi-composer-layout-ui-smoke.mjs` | 9/9，exit0 | jVR4nR/report.json；p06d-composer-ui-final.log |
| `node scripts/xiaozhi-agent/pi-public-process-ui-smoke.mjs` | 17/17，exit0 | QrIEtt/report.json；p06d-process-ui-final2.log |
| `node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | 5/5，exit0 | NbmawZ/report.json；p06d-approval-ui-final.log |
| `npm run test:smoke` | 重建相同入口；207/207，ok=true，exit0 | p06d-main-smoke-final.log |
| `git diff --check` | exit0；标准CRLF提示，不改core配置 | 本轮实际命令；doc28既有Markdown硬换行保留 |

真实过程17项：自然请求实际知识库/目录/读取，执行尚在运行时已显示公开文字；原生公开文本与已存投影一致、顺序/id不变、私有推理和合成电话未进DOM；工具组展开来源/实际耗时、missing file失败默认展开、真实native compaction、等待提问期间切换文件面板保留未发送队列草稿/模式且无新增run、停止/重启读回保持。发送后输入为空。不是将最终回复分割成假思考。

布局9项：正常UI导入长标题Skills默认关闭→教师启用→菜单选择→完整badge/说明；两viewport完整toolbar矩形与单行；实际文件分栏输入状态保持；移除技能/新会话清空。审批5项：两viewport等待可达、拒绝零写入、确认一次实际copy/实测耗时、重启不重放。此轮审批没有新增同历史模型切换验收，既有94/96证据仍独立。

基线3iPyqG与最终截图、DOM/DPR/zoom/window metrics、三专项报告、成功/失败日志共30个原字节文件在 `docs/design/codex-2026-10-03/p06-chat-reading/artifacts.json`，每项列source/bytes/SHA256。不复制DB、密钥或native私有消息。最终renderer DPR约1、zoom1、host displayScaleFactor1.5；参考截图DPI未知，不能把CSS边线误差称同DPI全页像素误差。

## 3. 发现与修复记录

1. 首次baseline ptPPST在历史读取未结束截图，废弃作为稳定验收；脚本等待真实conversation与输入可用后3iPyqG才为基线。
2. build首次失败：HeroUI Button无title prop；移到内部span，保留原aria-label与完整菜单名称。
3. UXACPr前10通过、1920边线10.33px失败：滚动条可用宽度偏移，最大宽改928；最终两窗差6.67/2.33。
4. mHhCLU前7通过、真实内部p色为原主题oklch：以前检查外层commentary不足，补Markdown根ink并检查真正内部p字体/行高/颜色。最终17通过。
5. EndJHo前6通过，但文件关闭后草稿/技能随子树重建消失：以会话key稳定输入Context修复；追加未发草稿/技能/队列模式与不同会话清空实例，最终9和17通过。未用force click或削弱授权。

## 4. 下一项与未验证边界

下一 **P06d-B**：四根→67第1/2/5/8/9→35最新→本节；读取原R1/R2与最终P06d-A截图。冻结 docs/99 控制卡/侧栏/权限模型弹层对照合同，再对现成 Pro/Hana 的计划、澄清问题、审批/队列、错误重试与弹层逐项适配，1366先、1920后，实际等待→回答/拒绝/确认/补充编辑撤回→停止/重启实例。保留32份原源，不改宿主授权/JSONL真源。设置跳转返回时未发送草稿是否应恢复、极窄分栏全部状态仍需单独核验，不沿用本轮文件开关结果。

完整D1–D7/D5/P06父项仍不勾：原图未给设置/Skills全部弹层；此次没有所有主题、字体与未知原DPI的1:1证明。图像缩略图/Office/PDF正文与产物在P07，实际无VPN/Windows安装/最终八组在P08；两条教育业务闭环、三元题组暂停等现有边界保持。下一项完成以前本项目整体智能体仍未完成。
