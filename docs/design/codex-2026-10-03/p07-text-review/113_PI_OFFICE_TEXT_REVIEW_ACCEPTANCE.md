# P07-A 正式文本工具、审阅与撤销验收

日期：2026-10-04；合同109/110/112，承接111 A1；M10/M01。**本轮A2/A3通过，110定义的有限UTF8文本切片A完成；完整Codex目标、Office/PDF/联网/附件/持久目标及P08仍未完成。** 无新依赖，无Codex CLI、第二agent循环或Pro源修改。

## 1. 已交付的真实教师路径

选教学工作目录→自然任务→Pi原循环读取/提出office_create_text或office_edit_text→聊天区本地差异/原内容/修改后审阅→教师拒绝或确认→main再次核原版本→实际文件提交并回读→可打开文件/撤销。只支持既有父目录内64KiB UTF8 .md/.txt，不以此称完整Word/PDF办公。

| 接线 | 真实实现与来源 |
| --- | --- |
| Pi工具 | 原SDK ToolDefinition/SessionExecutionRegistry/Hana execution-once与Pi budget.wait；主进程text-change-coordinator组合A1原Edit/Write算法及版本service，没有另写替换/diff/agent loop |
| 会话兼容 | 独立xiaozhi.education.office-text.v1能力记录，原创建/controls/memory/skills指纹先按旧算法验证，新增office工具与说明在其后追加；未知版本或撤掉既有能力fail closed。旧SDK历史追加字节及原创建entry不改 |
| 持久等待/停止 | 等待安装后才发change事件；approve/reject含revision CAS，停止/关闭/finally失效pending/approved并释放等待。执行/撤销不确定沿A1恢复只读核验，不自动重放 |
| main/typed | 新text-change-api两通道只主窗口主frame；会话/change ID归属、revision、固定动作及无额外字段。每次目录权限含未归档/关闭后重核；undo/verify共享既有全局空闲作业锁，退出等待已开始作业 |
| 本地审阅与模型 | event/snapshot仅显式白名单摘要，不含before/after/diff/patch/私有root。完整审阅仅本地按需API；模型只得必要脱敏file/operation/outcome回执和固定安全错误，不自动发送before/差异。压缩保留当前安全结果索引、统计省略数和排除run，不复活撤销内容或授新权限 |
| 真实UI | 原Pro ChatTool、CodeBlock与OSS Tabs/Button；工作区仍原FileTree/AppLayout。查看修改显示原Pi带行号diff，不让教师处理补丁header/SDK JSON；完整patch仍本地留档。实际状态/拒绝/冲突/不确定/核验/撤销明确 |
| 打开/撤销 | 打开重新读父目录/当前文件版本，再走现有typed preview；撤销仅当前after一致。已打开文件的修改状态变化清旧预览，提示刷新后看真实版本，不继续显示缓存旧正文 |

新事实schema/表是111已迁移的xiaozhi_pi_text_changes，本轮不改教育业务表或数据真源。Pi0.80.3/MIT与Hana0.449.0/Apache执行机制继续，原Pro32闭包182153bytes无变化；HeroUI MCP chat-tool/code-block/tabs已查，本地原源复用。Pro和Codex官方源码的关系不作未核实承诺。

## 2. 最终精确门禁

cwd：D:\WorkProject\EduProject\apps\desktop；最终renderer index-p3T26x0-.js。build7及最后test:smoke均从同一最终runtime源码构建；最终16自然UI在build6，之后仅添加未打包E2E明确开启的main故障切点，正常runtime行为/renderer未改；9真实恢复UI在build7。实例运行期间没有改runtime源码/out。全部合成、owned目录及隔离SQLite，无真实教师资料/库或学生图片上云。

| 命令 | 最终结果 | 证据与边界 |
| --- | --- | --- |
| `npm run build` | build7 exit0（含tsc） | p07a2-build7.log；最终main/preload/renderer可构建 |
| `npm run test:renderer-components` | 79/79、exit0 | p07a2-renderer-final.log；最终renderer源码状态，随后仅主进程执行说明微调 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes、exit0 | p07a2-pro-final.log；原组件静态闭包，非Codex全页同源证据 |
| `node scripts/xiaozhi-agent/pi-text-change-foundation-smoke.mjs` | 20/20、exit0 | JNvXSO/p07a2-foundation.log；真实Pi/文件/SQLite/四子进程exit73/旧隔离库，无provider/UI |
| `node scripts/xiaozhi-agent/pi-text-change-coordinator-smoke.mjs` | 8/8、exit0 | PLIL0r/p07a2-coordinator-final2.log；真实SDK/FS/SQLite/handler，模型协议注入，不是真provider |
| `node scripts/xiaozhi-agent/pi-text-change-host-lock-smoke.mjs` | 6/6、exit0 | J2mZme/p07a2-host-final2.log；真实production host空闲锁/归档/关闭/真实undo，受控异步barrier，无provider |
| `node scripts/xiaozhi-agent/pi-text-change-ui-smoke.mjs` | 16/16、exit0 | HXcPmt/p07a2-ui-final2.log；真实DeepSeek自然任务、实际Electron/main/typed/原组件/SQLite/FS/kill/restart |
| `node scripts/xiaozhi-agent/pi-text-change-recovery-ui-smoke.mjs` | 9/9、exit0 | hWop58/p07a2-recovery-ui.log；真实自然任务/教师确认、production main实际file/undo-file切点、真实Electron树退出/重启、页面uncertain/undo_uncertain和教师只读verify |
| `$env:OMNI_EDU_E2E_PI_HISTORY_MODEL_APPROVAL='1'; node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | 13/13、exit0 | uXeBGM/p07a2-copy-model.log；原复制拒绝/批准、运行锁、同历史模型切换/原native身份和审批字节、实际双窗菜单与重启；执行说明后仅edit指引更新，该套先于最终微调 |
| `node scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | 11/11、exit0 | cVChPb/p07a2-auto-boundary.log；完整请求计数/原Hana hook和native切点/失败等确定性边界，不作新真实自动整理实例或VPN-off证明 |
| `npm run test:smoke` | 最终207/207、ok=true、exit0 | p07a2-smoke-final2.log；最终runtime同源码重建，原生产路径兼容 |
| `git diff --check` | exit0 | 最终p07a2-diff-check.log；保留原大脏树，无提交/push |

16实际页面项包含：自然任务真实工具/批准前零写；两个actual native1366×768与1920×1080确认控件可达；拒绝零文件；批准与review.after精确一致/独立office marker1个；当前版本文件面板打开；先读真实内容再Pi编辑/创建native指纹保持；撤销原字节；打开的旧预览清除和刷新正确；旧revision/跨会话拒绝零效果；手工后改拒绝undo；确认期间原文改变不覆盖；composer停止；实际Electron树taskkill后startup状态interrupted/零文件；再次普通重启无重放/晚批准拒绝；SQLite state/revision与页面一致。原Pi带行号diff还与真实review.diff直接相等，未放宽断言。

8专项覆盖发布前waiter、事件白名单及安全回执、并发/旧revision/越会话/额外字段、真编辑undo/冲突、native signal停止、撤权与安全错误、主frame handler拒绝、压缩安全索引及excluded run、旧native追加能力/原entry及prefix字节/原once只执行一次。6宿主项覆盖双向全局锁、实际undo、归档review/undo拒绝、权限读取期间启动/换目录拒绝、关闭等待且不晚写、源隔离库字节不改。

9恢复UI补齐：真实DeepSeek自然创建→教师确认→production service实际写文件、SQLite仍executing时切点→真实owned Electron树退出→startup uncertain→两actual native尺寸核验按钮可达→教师点击verify→已存在文件字节/mtime不变、classified applied。之后明确undo，在物理删除新产物而SQLite仍reverting时切点→真退出/重启undo_uncertain→页面verify分类reverted，不重建文件→普通重启保持零产物。切点仅main内部选项，IPC只在未打包且OMNI_EDU_E2E_DIALOG_MODE=1、固定stage白名单时配置；不能由renderer请求启用，无代理模型或伪状态注入。

## 3. 失败、修正和未验证边界

- UI1 H3KOVU 14项通过；补真实退出/旧预览后UI2 w62l3r 16项报告成功但SIGKILL只杀包装进程，测试连接仍持有Electron。依据确切测试profile/PID仅清owned进程后脚本收尾；此轮不作为自动干净退出证明。改现有Windows owned taskkill /PID /T /F + app.close清协议，UI3 8hssjW16/exit0、无残留owned进程。
- 切换原Pi行号diff后Hi5An0前11项通过，新的确认前冲突任务等待120秒超时。公开消息/截图及本地回读证明：实际文件精确包含教师指定原文，但模型因全文替换和历史undo误判歧义，发ask_teacher，没有提出写入，也未写文件。此失败保留，不能被先前16成功抹掉。只补office执行说明与tool描述：当前原文匹配及明确替换时直接提出新审阅，全文替换也合法；不因旧结果反复询问；原文确实不匹配/不唯一/缺失才澄清。不改变教师确认、权限、原自然任务或原验收断言；HXcPmt最终16全过。
- 早期新脚本syntax括号、sessionFile属性误用及取消返回断言暴露问题已修：signal在wait返回后立即检查；关闭在异步目录读之后再次检查，6宿主项验证。错误日志/失败报告与成功均留档，source读取曾误用cwd/不存在猜测路径，已按真实文件清单纠正，不混作运行失败。
- 本切片是文本编辑，不是完整Office/PDF导出、国内联网、附件/图片、跨run持久goal。64KiB/16替换/既有父目录、256条记录边界保持。数据根、真实题库/正式产物和权限排除不开放。SQLite/FS非同事务；最后同步hash→rename仍不宣称OS外部进程级CAS。
- 真实API不等于“已关闭VPN”或安装包证明；未改系统网络、未部署/提交/推送。参考DPI/未知官方Skills/设置状态和完整D1–D7仍未核齐，原Pro复用不等于Codex官方同源或完整像素一致。模型引导由本次实例验证，不承诺所有自然任务永不误判。

## 4. 固定下一动作

四根→67§1/2/5/8/9→35最新→109 B/本文→**先冻结114 P07-B Office/PDF本地正文/可打开产物合同**。优先重新核Hana document-extract/AnyDoc实际source、现有Python parser/export与资产来源，再选可直接复用的最小已许可方案。核依赖精确版本/Windows包/体积及取消/超时，能复用现有parser的不开第二服务。shared/Worker/main/typed/真实预览和导出贯通，合成DOCX/PDF/XLSX/PPTX实例、扫描PDF反馈、Office/WPS/A4实际打开验收，再C国内联网/D附件/E持久goal/P08及全D1–D7。A已完成不再重复阅读/换引擎，未完成范围不会压缩丢失；总目标active，三元题组暂停。

## 5. 证据归档

docs/design/codex-2026-10-03/p07-text-review/artifacts.json记录原日志、报告、合成截图、此次源码和最终bundle/source SHA，逐文件byte/hash回读。保留所有失败及前置成功。禁止复制SQLite/native JSONL/私有摘要/原before文件或Key；.env.local仍ignored且未修改。112与本文是合同/实例证据，67继续是视觉和公开过程唯一基准；四根及26/28/35同步下一位置。
