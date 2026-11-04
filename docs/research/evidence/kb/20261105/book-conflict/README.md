# 已知答案冲突隔离：2026-11-05

已修复：答案册独立来源认证通过、同试卷/题号唯一匹配且答案不同后，规范题同步进入待整理，不能继续用于正式Pi读取或组卷。两份答案、角色来源、原图和付费回执保留。现有教师入口的实际补正及来源核对可恢复使用，普通勾选/保存不能解禁。

基线 `ed1c2d5`，分支 `codex/knowledge-base-reuse-implementation`。原生Windows、Node 24.12.0。生产只改 book repository 并新增内部冲突模块；使用原 archive issue、writer、journal before/after 和工作队列。无新表/共享schema/IPC/依赖/服务/模型轮次。旧 held 观察经原后台队列重新认证；历史观察不改，配对撤销不会自动删除已发生的分歧事实。

| 证据 | 本轮结果与范围 |
| --- | --- |
| `match-terminal.log` | 30项，包括9项新增冲突隔离/历史重验/保护角色/回滚/取消/版本/来源竞争/教师补正边界 |
| `document-terminal.log` | 原结构化书册来源7项，导入时另运行配答30项；保留原题面、图块、文档及角色证据 |
| `folder-terminal.log` | 当前10项目录/摘要边界；修正旧夹具缺 ai()/status，不冒称旧文档中的12项 |
| `page.log` | 原页归档112项通过；受控图像/响应不能证明自然OCR或答案正确 |
| `components.log` | renderer 246/246 |
| `build-terminal.log` | build通过，显式进程退出0；主进程SHA与实际Electron一致 |
| `journey-summary.json` | 5项有效桌面检查：递归PDF→配对→自动冲突→原件/双尺寸→Pi普通provider与题篮资格拒绝→普通保存仍阻断→教师补正→实际选题加入题篮→冷启读回；renderer错误0 |
| `shared-electron.log` | 207/207通过，2个尺寸、32张本地截图，进程退出0；最终主进程SHA与本轮专用Electron相同 |

桌面夹具保留在本机临时目录 `omni-folder-books-U3RIyo`。首次5条受控模型响应、真实云请求0；修正验收方式后在同一夹具续测，新增调用0，不重新导入/OCR/发送模型。源检查通过不等于正式Pi资格：教师仍需能查看待核题。实际生产Pi provider通过typed来源桥调用；没有新自然provider调用或完整Pi聊天任务，因此不能称自然解题验收。组卷拒绝当前返回通用 `unsupported`，题本显示具体“答案存在冲突”；更精确的组卷拒绝说明仍有改进空间。实际补正题可加入题篮；本例未正式确认整卷或导出Office/WPS。

初版脚本沿用旧“v3已配答”文案到held题，这是错误描述。原日志保留，最终摘要排除该项，仅接受实际验证的5项；新脚本已按冲突/正常模式分别描述。所有失败与修复见 `failures.json`。图片只留本地，仓库仅存文件大小/SHA；不包含用户自然资料、原始付费响应、数据库或凭证。

性能：主进程4,047,139→4,049,094字节（+1,955）；preload 38,520和renderer入口7,758,791不变。`migration.log`在100,100条合成日志/100冲突的内存SQLite运行精确生产SQL：首次建索引及排队31.3854ms，重复启动50次P95=0.2492ms，命中冲突partial index。旧版没有这项安全回填，不能宣称提速。`lookup.log`是原答案检索组件资格复测，其before/after是历史算法对照，本片未修改该算法；新P95=0.0482ms，仅合成内存热测，不是源验证、文件I/O、40GiB、冷启动或检索全链路达标。

`audit.json`：既有42项（8高、26中、8低、0严重），未变更依赖/锁文件。本轮没有修改renderer组件或UI基线，未重跑已知指纹漂移的UI设计合同，也不宣称视觉获得用户接受。

命令在 `apps/desktop` 执行（日志通过cmd重定向保留原字节）：

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-book-match-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-books-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-book-answer-lookup-benchmark.mjs
node --experimental-transform-types scripts/education/kb-book-conflict-migration-benchmark.mjs
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --folder-pairs --plain-question --answer-conflict
node --experimental-transform-types scripts/education/kb-book-document-journey.mjs --resume=$env:TEMP\omni-folder-books-U3RIyo --plain-question --answer-conflict
node scripts/electron-smoke.mjs
npm audit --json
```

边界：隔离在独立来源成功认证并发现冲突后生效；无答案册、仍未处理/失效证据及旧9题物理推理矛盾均不能据此视为独立验真。历史回填源失效会保留工作错误，不能称全部历史题已重验。复杂数学条件、真实搜题正反例、120自然留出、200查询、三套正式蓝图成品、40GiB/72h及普通Windows安装换机保持OPEN。完整Goal和KB-A01～A10不关闭。

回滚：可通过原 `OMNI_EDU_BOOK_ANSWER_WRITEBACK=0` 暂停新匹配/隔离与排队执行，保留既有读器、冲突issue与journal；索引可重建。不得批量删除issue来使冲突题恢复资格。实际补正仍沿现有教师版本/来源门禁；未验整版旧二进制降级。

收尾：本轮所有验证进程均已结束；git diff --check通过。同步前再次fetch确认origin/main仍为基线ed1c2d5，无协作者新增提交；正常推送后由工具核对HEAD、origin/main与知识库分支。
