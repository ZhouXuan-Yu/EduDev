# P07-A 正式文本产物、审阅与版本撤销交付合同

日期：2026-10-04；M10/M01，109共同合同之A。前一轮107→108是实际进展：原生阅读中断已修复并双窗口验收。本合同冻结完整A，不以主进程基础冒充正式用户闭环。

## 1. 教师结果与现状

自然交代“整理这份教研资料并保存备课摘要”或“把指定段落改成……”，小智公开说明→实际读文件→拟修改→教师查看修改前后→批准/拒绝→真实文件提交及版本回读→打开/撤销；重新启动仍知道哪个文件实际变更。当前copy审批是复制专用，不能通过改标签让编辑绕过权限。现有原文件panel/版本和当前run计划保持；持续goal另属P07-E。

完整验收必须包括新建和原文件精确修改、拒绝零写、确认一次、停止/迟到/跨会话/撤权、源版本冲突、重启不重放、实际撤销及手工修改后的撤销冲突、两native窗口真实UI和readback。批准前只是拟结果，不能标文件已改变。

## 2. 现成来源

- 已安装Pi0.80.3（third_party/pi/LICENSE，MIT），root exports实际核到createEditToolDefinition/createWriteToolDefinition、generateDiffString/generateUnifiedPatch、withFileMutationQueue。原EditOperations/WriteOperations仅访问主进程内存拟结果；不公开默认FS/bash。原精确编辑包含BOM/CRLF、唯一/重叠校验和原有限模糊匹配，原diff计算以实际before/after为准，不重写算法或伪造成功文字。
- Hana0.449.0现有FileRef/resource-io、snapshot input及workspace-authority和审批链继续授权/排除根/链接/hardlink/版本校验。Hana desktop line-diff是jsdiff包装，但Pi root已有diff无需新增依赖。
- 已调用HeroUI MCP chat-tool/code-block文档；Pro实现未由MCP提供，沿已登记本地原ChatTool Approval/Actions/CodeBlock/Tabs/FileTree闭包复用。Finesse原ai-console使用真实在流审批/依据/回执/常驻停止；用户R1/R2是外观基准。

## 3. 增量边界与分步接线

### A1 主进程可靠基础（本轮先交付，不能勾完整A）

新增shared/xiaozhi-changes.ts，schema xiaozhi.change.v1；新增main/xiaozhi-agent/text-edit-proposal.ts、text-change-state.ts、text-change-service.ts。session-state仅增量组合changes/migrate/recover；db.ts不堆新领域代码。

SQLite增量表xiaozhi_pi_text_changes：会话/run/call唯一、workspace hash、相对文件名、operation create/edit、before/after原字节、hash、原diff/patch、revision/CAS、状态/时间。最多64KiB每个文本、16次替换、diff/patch512KiB上限、每会话256条；未知版本/损坏原字节拒绝执行。before恢复记录是本地私有事实，不自动进模型/公开消息。仅.md/.txt，Office格式另属B。

只操作教师明确授权、与dataRoot及系统私有根隔离的工作区，不创建缺失父目录、不跟随links/hardlinks，不覆盖原始资料/题库/正式产物数据根。既有排除规则保持，Windows ADS/设备名/尾点空格/路径规范别名拒绝。读写边界重新核root/path/来源hash；Pi原mutation queue在本进程串行同目标。批准/拒绝由revision CAS记录；apply必须approved且current run，批准前零写。

提交在same-dir唯一临时文件wx写/flush后，最后同步重核源/目标/root再rename；新建用exclusive hardlink安装后unlink临时以不覆盖并发新目标，提交后hash回读。执行intent先落SQLite；文件与SQLite无法同事务，失败/退出保留uncertain、重启只标待核验，不自动写。verify仅检查实际hash，不重放；undo必须当前after版本、明确教师动作，再恢复before或删除本轮新产物；手工后续修改拒绝撤销。OS外部进程在最终hash和rename间的极短竞争不能称OS级文件CAS，主进程内mutation/host owner必须覆盖完整作业。

### A2 正式Pi工具/审批/typed接线（A1后必须完成）

office_create_text/office_edit_text由同Pi唯一循环调用A1。复用当前run budget.wait和执行registry，真实teacher decision协调；新增change event/snapshot只投影安全相对路径/diff/真实状态。typed decision/undo必须main-frame/session/active/全局host owner校验，renderer不得传正文、root、hash或伪审批。

新增工具会改变工具快照，需要单独版本化office capability entry/旧会话迁移授权，不改创建fingerprint或旧JSONL；每次restore需核当前目录/权限。改变受保护summary只补安全实际产物事实，不能复活撤权来源/隐藏原文。现有copy、教育记忆、Skills、模型切换和自动compact仍验。

### A3 教师审阅与真实变更组件（A2后）

原ChatTool/CodeBlock/Tabs内展示“修改前后/拟修改/确认/拒绝”；真实提交之后显示实际文件变更摘要、可打开及撤销。历史重新读取main事实，等待/失败/不确定不得显示成功或默认隐藏。只文件操作而非Git/SDK字段；失效diff拒晚答，未发草稿/阅读/Stop继续保持，两native窗口完整动作可达。

## 4. 安全、兼容、回滚

新表CREATE IF NOT EXISTS、schema1/唯一索引及状态CAS，旧DB副本/全新库重复迁移，教育/历史/旧copy记录原值保留。新表不delete/修改真实教师资料；回滚保留记录，未注册工具前旧UI完全不承诺编辑功能。没有新依赖/远端服务/凭证/上传规则；原Pi/Hana唯一循环及SQLite/本地文件真源保持。

恢复pending/approved→interrupted、executing→uncertain、reverting→undo_uncertain，不prompt、不重放。原字节/private SQLite不归档到公开测试报告；测试只隔离合成资料。审批/撤销异常保留原intent/实际文件和可读失败，不重试写入。

## 5. 门禁与完成定义

- A1实际SDK+SQLite+文件专项：多处精确替换/模糊字符/CRLF+BOM/重复重叠/UTF8边界；新建/批准前零写/拒绝/唯一call/CAS/双会话/撤权/源和目标冲突/stop；重启/真实子进程退出前后切点/verify只read/undo及冲突；旧库/新库幂等迁移。证据明确不是UI/provider。
- A2/A3从实际小智页面自然请求、真实DeepSeek及审批/文件审阅/打开/撤销，1366×768与1920×1080、重启与readback；不得用只调用service的脚本或静态卡片称用户闭环完成。
- 本轮桌面门禁npm run build、npm run test:renderer-components、相关专项；关键生产路径变化后npm run test:smoke；收尾git diff --check。每次修改需等活实例终态后再构建，保存失败、精确命令和边界。
- A1通过后继续A2/A3，完整A通过后才109的B/C/D/E与P08。D1–D7精准视觉和完整Codex体验仍不缩减；官方Skills/设置参照仍待补，三元题组暂停。
