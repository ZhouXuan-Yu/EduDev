# P06c-B2/B3 正式同历史模型切换验收

日期：2026-10-03；M10/M01；合同91、93，B1基础见92。正式同历史模型切换专项已交付；最终仓库门禁以本文收尾记录为准。完整P06c、D1–D7、P07/P08与总目标继续active，三元题组保持暂停。

## 1. 本轮实际交付

- 现有typed `selectXiaozhiModel` → model-settings → production-host共用教育组装 → Pi原生 `AgentSession.setModel` → SQLite/JSONL双源 → 原HeroUI Dropdown/Pro PromptInput。已有绑定历史空闲时可真实Flash↔Pro切换；保留同会话ID、同native header/file、消息前缀和创建snapshot。没有新聊天替代、空run、模型回复或复制效果。
- 创建指纹仅使用main核验的originModel；当前请求、stream、手动/自动compact策略使用当前目标模型。旧snapshot不重写，目标真实官方能力与完整system/messages/tools/output容量准入。容量不足、目录移除、CAS冲突、active/configuring/关闭/归档均有固定拒绝；不虚构GPT/Claude角色或推理档位。
- B1账本两表增量增加 `baseline_entries_json TEXT NOT NULL DEFAULT '[]'`，旧库副本/新库幂等。只有完整旧fingerprint通过后记录已有同origin bootstrap entry IDs（最多4096）；既有ledger再写binding必须保持其模型与原路径，schema5正式可读。旧Windows分隔符保留账本原身份，新路径规范化。
- memory/Skills原生隔离后以精确 `xiaozhi.model-restore.intent.v1/commit.v1`恢复当前已授权模型标记，不恢复被排除消息或旧摘要。分支无message时，在SDK加载前写durable intent，承认Pi自动bootstrap的准确entry；不造假消息。restore前退出由当前authority校验后完成；已写model_change后退出只补receipt，不重复setModel、不新增选择revision。
- 全局配置锁与已有run/chooser/Skills/记忆/预算锁保持。关闭等待本宿主原生模型写入；pending在snapshot/settings/start读取前恢复，已经落盘的切换恢复不需要API Key。active读取不夺取native写权限，未完成prepared不得启动新run。归档后不晚到commit。
- 稳定1366窗口截图发现长写入权限说明+Pro名挤住发送按钮。只在OfficeComposer adapter保留完整可访问名称/文本title，权限span省略、小智作用域flex收缩/必要换行；未改Pro复制源码。新增发送/停止完整矩形落在composer内断言。窄窗口可能两行，D5精准视觉仍待对齐。

### 来源与复用

仍是已锁定Pi0.80.3唯一原生循环和Hana0.449.0，未接Codex CLI。Hana容量guard/error的AST复制、Apache-2.0 LICENSE/source/output三方hash原样保留；原Pro workspace闭包32文件182153字节核验未变。当前HeroUI MCP Dropdown文档已核selectionMode/selectedKeys/onAction，沿用现成控件，无新npm依赖/安装体积变化。Finesse产品工作台语法与67用户原图R1/R2保持；上述复用不能称Codex官方同源或一比一视觉完成。

## 2. 精确命令与证据

工作目录 `D:\WorkProject\EduProject\apps\desktop`。下列成功命令均exit0；production最终build-final2后只改测试/文档，不再改应用代码。

| 命令 | 结果 | 本轮证据（test-results/xiaozhi-agent下） |
| --- | --- | --- |
| `npm run build` | tsc/electron-vite通过，renderer index-C46Ivngh | p06cb2-build-final2.log |
| `npm run test:renderer-components` | 79/79 | p06cb2-renderer-final2.log |
| `node scripts/xiaozhi-agent/pi-history-model-switch-ui-smoke.mjs` | 正式Electron、真实DeepSeek 12/12 | pi-history-model-ui-ZA9F90/report.json；p06cb2-ui-final.log |
| `$env:OMNI_EDU_E2E_PI_HISTORY_MODEL_APPROVAL='1'; node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | 真实审批/停止/同历史选择/重启13/13 | pi-process-approval-ui-iYxogy/report.json；p06cb2-approval-model-final.log |
| `node scripts/xiaozhi-agent/pi-model-switch-assembly-smoke.mjs` | 真实production assembler/SDK/SQLite/JSONL 10/10；controlledSummaryRequests=1，unexpectedRequests=0 | pi-model-assembly-A02kF1/report.json；p06cb2-assembly-final.log |
| `node scripts/xiaozhi-agent/pi-model-switch-host-smoke.mjs` | 实际host/service/native 9/9；受控官方目录8次，无provider completion | pi-model-switch-host-7VicZk/report.json；p06cb2-host6.log |
| `node scripts/xiaozhi-agent/pi-history-model-switch-smoke.mjs` | B1原生基础26/26；networkRequests=0 | pi-history-model-switch-SWNLsd/report.json；p06cb2-native-baseline1.log |
| `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | owned旧库副本/新库10/10 | pi-state-migration-TwVAar/report.json；p06cb2-migration.log |
| `node scripts/xiaozhi-agent/pi-model-settings-boundary-smoke.mjs` | 18/18 | pi-model-settings-boundary-FwBeDU/report.json；p06cb2-settings-boundary.log |
| `node scripts/xiaozhi-agent/pi-model-settings-host-lock-smoke.mjs` | 旧全局锁6/6 | pi-model-host-lock-RYLia0/report.json；p06cb2-host-old1.log |
| `node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs` | 原生Skills权限22/22，受控模型流 | pi-skill-authority-Ryq7Je/report.json；p06cb2-skills.log |
| `node scripts/xiaozhi-agent/pi-auto-control-edge-smoke.mjs test-results/xiaozhi-agent/pi-compaction-ui-UVXuHm/data` | 真实自动整理/队列/退出/预算7/7 | pi-auto-edge-oy06Vo/report.json；p06cb2-auto-edge3.log |
| `node scripts/xiaozhi-agent/reuse-hana-model-switch.mjs --verify` | 静态源/输出/license 3 | p06cb2-source.log |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 静态原Pro32/32 | p06cb2-prosource.log |
| `node scripts/electron-smoke.mjs` | 最终固定out 207/207，ok=true，exit0；owned独立profile | p06cb2-main-smoke-final3.log |

最终主门禁已经固定在build-final2/index-C46Ivngh的out，207/207、ok=true、exit0。标准git diff --check exit0（p06cb2-diff-final2.log）；本轮26个源码/测试/合同/协作文档非预期尾空白0（p06cb2-scoped-whitespace-final.json），28原有版本/日期/状态三行的Markdown两空格硬换行保留，不误修为格式问题。原字节27份报告/图/日志/源码manifest源与副本hash一致，artifacts.json含来源、bytes/SHA256；不复制DB、Key、native私有历史。

### 正式用户实例的实际边界

12项从全新owned profile可见密钥表单/原模型菜单开始，首次Flash真回复→Pro真续问→Flash真续问→重启Flash真续问；四次native assistant.model与公开projection一致，都找回首轮合成EDU标记。选择期间SQLite消息/run数量不变，JSONL既有字节前缀/header/snapshot hash保持、ledger revision/CAS读回，陈旧选择拒绝。1366×768/1920×1080是实际BrowserWindow content，DPR1.5，页面无横溢出，发送完整可达，renderer异常0。

13项从实际授权合成目录开始：等待拒绝/确认时菜单禁用、main busy；拒绝零写入→同历史Pro；Pro实际工具提出复制→教师确认一次且字节一致→同历史Flash；实际composer停止新run→同历史Pro；重启保留两决策/模型/停止状态，源文件不改、拒绝目标不存在、确认目标保持。原生chooser返回受控，实际模型和本地文件操作是真实；不是人工教师或无VPN证明。

10项组装覆盖memory+Skill同时撤权/带native摘要，安全分支与空messages分支、restore各退出位置、不重复entry、原始字节保留与旧敏感合成文本/派生摘要不进入当前模型、origin伪造/坏restore/容量拒绝。手动compact实际调用Pi原生路径，唯一摘要HTTP为受控SSE并核body.model=Pro，compact后仍可Flash重开；这不是实时provider摘要测试。7项另有真实provider自动整理/追加指令一次消费/退出不自动重放/一请求预算。

9项host覆盖真实旧schema4未seed绑定选择、stale与binding绕账本拒绝、prepared abort/原生后恢复、close等待但不晚commit、归档拒绝、官方移除/完整容量拒绝、旧B1列增量迁移。只复制已关闭且位于test-results的owned数据，原UI源app.db hash不变；没有解密或使用副本真实Key，目录请求仅synthetic key受控响应。

## 3. 失败、修复与未证范围

- 首次TS检查apiKey可选类型不匹配，common assembler调用按已验证key收窄；build1通过。工具栏Button不支持title prop导致build-final失败，将title留原生span、完整aria-label留Button；最终build-final2通过。
- assembly首次PQL4Hu owned私有workspace fixture缺xiaozhi-pi父路径，严格权限正确拒绝；修fixture，不放宽production校验。host1–5分别是猜错审批表、误认GET必须显式method、目录响应缺官方object/capability字段、重启未清测试故障hook；修受控fixture后7VicZk9通过。原失败日志仍在test-results。
- 第一模型UI fOsGlV Enter驱动确认超时，现场已发送/运行；改实际可见Send按钮。oHn5iY12通过但图截在动画中；补稳定动画capture。KNFcsl13截图发现真实1366发送被裁切，冻结93补充并修工具栏，最终ZA9F90/iYxogy重验。早期图保留作为差距证据，不冒称精准视觉。
- approval AOTMA0/ZPfegu测试错把私有cancelled code当公开status/error；按当前契约公开status=interrupted、error=已停止本轮核验，未改变production停止语义。
- 自动整理PTOqSr旧测试未先展开现有“任务详情”，WjN63c把未知usage.tokens当对象；修测试正常入口与nullable usage断言后oy06Vo7通过，未放宽预算行为。
- 最终main-smoke-final2旧教育no-key路径一次SQLITE外键错误。旧脚本隔离DB但共用Electron默认profile；补独立owned profile并保留跨本次重启同一profile，重跑final3。现有证据不能将隔离前错误直接定性为产品已修复，收尾需如实记录。
- 未证完整D1–D7同DPI≤2px/所有Codex组件同源、完整设置C、Office/PDF完整阅读与产物、图片工具、真实无VPN/安装/最终八组。新库/副本实例不等于真实教师库迁移；没有commit/push、系统网络修改或真实教师数据变更。

## 4. 原字节证据与下一第一动作

图/report/log/source manifest保存 `design/codex-2026-10-03/p06-model-switch-production`，artifacts.json记录原来源、bytes/SHA256。只复制显式报告/截图/日志，不复制DB、密钥、native JSONL、私有摘要或真实教师资料。原图R1/R2与完整设计仍以67为准。

下一P06c-C：先读四根→67第1/2/5/8/9→35最新→本文，图查当前native Settings命令、正式模型/Skills页、工作目录与权限、UI prefs、归档和备份入口；对照Hana完整设置导航/搜索源码与现成HeroUI组件，冻结docs/95可验合同后按shared/main/typed preload/renderer纵向实施。统一可达导航与真实设置搜索、当前授权目录/Skills/偏好/归档/备份，保留旧入口到验收，不复制Hana第二store/人格权限、不造无能力选项；实际双viewport/重启/错误和撤权验证。之后精准D1–D7、P07办公联网图片产物、P08实际无VPN/安装/最终八组。整目标不能标complete。
