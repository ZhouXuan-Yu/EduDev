# P07-B3b 正式 Office 工具与教师审阅纵向交付合同

2026-10-04；M09/M10；继续120完整合同与121已验状态/FS基础，凭证123已修复。上轮属于真实进展：provider加密配置/独立验证和Office底座均有新的实际状态与验收；本轮直接进入正式用户链，不重新选择SDK或重复已过基础。

## 1. 教师可见完成结果与当前缺口

当前Pi/Hana唯一循环已有授权文件、文本编辑和Office读取，Office四格式生成/ledger已通过基础；缺少Office新生产tool、原teacher wait协调、主frame typed review/revise/decide、公开摘要与拟内容教师卡。目标从当前小智导航自然提出Office任务→真实工具等待→本地拟内容与来源→教师修改/拒绝/确认→实际版本文件和正式fact→从原工作区打开→重启保持与失败恢复。

原R1/R2及67§1/2/5/8/9仍为设计与时序真源。使用agent-ui-design状态核查及本地已登记Finesse0.20.0 component/ai-console约束；HeroUI Pro MCP已查chat-tool/text-field/text-area/tabs，Pro不提供源码时沿原32文件copy，OSS沿既有包及CSS。复用原ChatTool/Markdown/Tabs/TextField/Input/TextArea/Button和文件面板，不展示JSON编辑框，不另画聊天模板，不称Codex官方源码。

## 2. 冻结纵向修改

- shared office-artifacts增量review/revise严格输入、safe error/result；agent payload/snapshot新增显式office_artifact摘要。完整draft/source hash只本地typed按需，公开event/model禁止private bytes、绝对根、完整拟内容/密文。
- main office-artifact-coordinator复用原文本coordinator的one-call等待模式、实际service与state；office_create_document独立能力注册原Pi/Hana registry/once与budget.wait。title/sections/paragraphs/table严格JSON Schema与shared校验一致；source来自本次实读version，父版本必须本会话正式artifact。
- Pi options新增main-owned Office工具factory；native独立`xiaozhi.education.office-artifact.v1`追加。旧创建/control/memory/skills/text/read身份与完整旧JSONL prefix保持，旧会话首次获得新能力不得锁死。
- production-host组合已有officeArtifacts；service workspace检查valid session/archived/closing/chooser及原授权，current run/stopped与每个异步后再核。停止/关闭/finalize取消等待并分类，不重放。verify占原全局idle owner；review/revise/approve/reject仅原当前等待、本会话/revision，模型没有teacher编辑接口。
- 主frame typed三通道office-review/revise/decide，在独立api注册，preload唯一入口，不从renderer引入FS/SDK。返回安全错误，非主frame拒绝。source内容/输出与路径权限不因IPC或摘要扩大。
- renderer PiOfficeArtifactCard在原审批区按run渲染。pending展开真实拟内容，preview和修改tabs：教师可修改标题/章节标题/段落/表头/单元格（数字仍有限number），保存拟内容递增revision、旧确认失效；有未提交编辑时不可批准旧内容。拒绝/确认/停止可达，非JSON dump。saved提供实际打开/来源/父版本；uncertain明确只读核验，失败可刷新。草稿沿session-keyed原OfficeComposerState保留，切会话/生命周期迟到结果不能串卡。
- compaction仅必要脱敏本会话产物结果索引，真实artifactId用于引用父产物，非写入授权。原文件面板可打开新产物并在摘要变化时失效旧preview；不以256项树展示限制明确路径打开。

## 3. 兼容、回退与数据安全

无新依赖/服务/表（沿121三增量表）、不迁移旧native身份/绑定、不改凭证或真实教师数据。正式旧export入口保留，新的xlsx/pptx只走真实新生成器。父binary只新版本路径，拒绝不写；审批revision/源版本/exclusive目标竞争与uncertain机制沿120。private原拟内容不自动上云；模型本来提出的draft保存在私有native历史，teacher修改仅本地并发送必要脱敏结果回执。未知raw error/cause不进UI/API。

新能力未完整用户链验收前，UI如实按真实state显示，不用静态demo冒充；回退可停止注册新factory/卡，旧工具/原文件仍保留。无commit/push/子agent/系统代理DNSVPN修改。

## 4. 本轮门禁与证据

先coordinator/host/main-frame边界专项：严格review/revise、pending等待与真实生成、revision失效、401/错误与cancel、跨session、忙/关闭/归档与owner、explicit事件无privatefields、原once与budget.wait、压缩索引不含draft。

之后真实隔离Electron与用户授权DeepSeek：从小智导航/自然任务开始，四格式（真实PDF在实际Electron）、教师修改标题/段落/表格与原文件值、拒绝零文件/正式fact、合法sources/父版本旧bytes保持、两个native内容尺寸1366×768及1920×1080、原prefix、实读预览/来源、停止/源冲突/已有目标、实际退出pending与file-after-write/restart只读核验。人工编辑必须只消费最终revision，同call不可重复保存；公开分段对照native/main持久projection。

固定out测试终态后build/renderer79、原Pro/Hana/Finesse源验证、必要主smoke207、git diff --check。精确命令/通过/失败/skipped与独立解析/真实provider/UI/实际WPS边界单列125；旧事实副本与当前配置保持。B3c实际Office-WPS-A4尚需独立验收，不能以本轮文件解析提前勾B3/B或完整Codex目标。

每轮收尾四根与26/28/35/67同步，下一仍明确B3c→C国内联网→D附件图像→E持久goal→全D1–D7/P08实际无VPN/Windows安装；总目标保持active、三元题组暂停。

## 5. 本合同执行中的精确修正

125记录实际模型number被Pi anyOf分支转string；参数改type union保持已匹配的数字和文字，SDK原实现不改。真实修订中同一来源/parent合并为一条版本/hash均一致的parent关系，坏版本仍拒绝。教师修订仅本地，saved回执及系统说明明确未回传最终正文，禁止复述旧拟稿为实际交付。PDF独立逐字回读采用PDFium，pypdf仅核A4；无去空格或削弱内容断言。20项真实UI终态、基础17/原SDK8/host6/renderer79/主207证据见125；实际Office/WPS和完整B仍需下一126。
