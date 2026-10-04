# P07-B3b 正式 Office 工具与教师审阅验收

日期：2026-10-04。合同124，沿120/121状态与文件基础。**本轮通过：小智正式 Pi 工具 → 本地教师修改/拒绝/确认 → 四种真实格式保存、来源与打开、故障恢复。** B3c实际Office/WPS版面、完整B及Codex整体对齐尚未完成，目标保持active。

## 1. 实际交付

- `office_create_document`进入原Pi0.80.3/Hana0.449.0唯一循环、execution registry/once和budget.wait。独立office-artifact.v1能力追加；旧native创建身份及完整prefix保持。没有接Codex CLI或第二代理循环。
- 原Office状态/生成器组合到production-host；公开事件与snapshot显式摘要，实际generating/prepared/committing/saved回调来自持久状态。main-frame typed review/revise/decide，原全局空闲owner控制只读恢复核验；跨会话、归档、关闭与迟到授权拒绝。
- 原Pro ChatTool/Markdown及既有HeroUI Tabs/TextField/Input/TextArea/Button，新增本地拟内容、结构化修改和来源卡。教师可改标题/章节/段落/表头/单元格；保存拟内容递增revision，未保存的编辑不能批准，旧确认被拒绝。未把JSON编辑框放进产品。
- 真实DOCX/PDF/XLSX/PPTX由既有三库及Hana原PDF helper生成，确认后exclusive保存、hash回读、原子登记正式artifact与来源；从原文件面板打开AnyDoc实际正文。父产物以新文件保留旧版；重启分类不重放，uncertain仅教师只读核验。
- 教师本地修订不回传模型，模型只收到必要脱敏结果。完成回执明确最终正文未回传，不能复述最初拟稿为交付内容。压缩仅保留脱敏产物身份/结果索引，不含拟正文、output或source hash。

没有新增依赖、表或上传权限；沿121三增量表。旧export入口保持。用户真实provider配置沿123已修复，本轮只使用已授权凭证在隔离合成资料上调试，没有改真实教师数据、旧native绑定或系统网络设置。

## 2. 精确门禁与终态

以下在`D:\WorkProject\EduProject\apps\desktop`运行，所有最终进程已消费终态，exit0。日志前缀为`test-results/p07b3b-user-`。

| 命令 | 最终证据 | 范围 |
| --- | --- | --- |
| `npm run build` | build4，renderer `index-C7YrpuTD.js`；后续主smoke再次同源码build | TypeScript与Electron三端构建 |
| `node scripts/xiaozhi-agent/pi-office-artifact-coordinator-smoke.mjs` | coordinator-final，R33JWX，8/8 | 实际Pi协议/once/wait、SQLite/FS/XLSX；注入模型，不是真provider |
| `node scripts/xiaozhi-agent/pi-office-artifact-host-smoke.mjs` | host-final，5gUCPM，6/6 | 原宿主owner、关闭/归档/迟到权限；实际FS/SQLite与受控异步屏障 |
| `node scripts/xiaozhi-agent/pi-office-artifact-foundation-smoke.mjs` | foundation-final，fS2Gjf，17/17 | 原Pi mutation queue、实际三库/SQLite/FS、四处真process.exit73、旧库全行保持 |
| `node scripts/xiaozhi-agent/pi-text-change-coordinator-smoke.mjs` | text-compat，BunUbt，8/8 | 旧文本协调和native兼容 |
| `node scripts/xiaozhi-agent/pi-office-artifact-ui-smoke.mjs` | ui5，NFyGeK，20/20 | 实际Electron/Pi/DeepSeek、教师页面、四真实格式、两native及真kill/restart |
| `npm run test:renderer-components` | renderer-final，79/79 | 原组件状态门禁；不替代新卡的真实UI验收 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | pro-source，32文件/182153B | 原Pro源码校验，非像素一致证明 |
| `node scripts/xiaozhi-agent/reuse-hana-pdf-renderer.mjs --verify` | hana-pdf，2文件/4原body | 原PDF源校验 |
| `node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify` | hana-read，4原源文件 | 原提取源校验 |
| `npm run test:smoke` | smoke-final，ok=true，207/207 | 最后同源码桌面主冒烟；不是真provider或WPS替身 |
| `git diff --check` | diff-check，exit0 | 仓库空白检查；既有脏改保持，无commit/push |

本轮查HeroUI Pro MCP的chat-tool/text-field/text-area/tabs实际文档。Finesse MCP不可调用，沿已登记本地0.20.0/MIT的component-scope与ai-console约束；Pro32原源和既有OSS包保持。没有把第三方组件称为Codex官方源码。

## 3. 真实20项与独立格式回读

NFyGeK：官方目录HTTP200确认deepseek-flash，再从小智可见导航和授权目录chooser开始自然任务；不是脚本直接调用生成器来冒充教师路径。

1. 自然DOCX待审，批准前零文件/正式fact。
2. native1366×768确认与拒绝可达。
3. native1920×1080确认与拒绝可达。
4. 页面拒绝零写、同目标无重复提出。
5–12. DOCX/PDF/XLSX/PPTX各两项：真实教师标题/段落/数字修订、旧revision拒绝、保存fact/hash/native身份保持；真实打开本地Office正文。首DOCX本地标记不进native，最终回复不复述旧标题。
13. 独立python-docx/openpyxl/python-pptx和PDFium逐字核教师修订；pypdf另核所有PDF页面A4。XLSX实际数字41且无公式单元格。
14. 自然创建正式第二版DOCX，captured父产物来源、原文件bytes不改。
15. 待审期间来源被修改，批准conflict，零目标/正式fact。
16. 常驻composer停止待审写入，interrupted且零文件。
17. 实际secondary Electron window三通道均denied。
18. pending时真实杀owned进程树，重启interrupted、不生成、不写。
19. 文件已安装、正式fact未登记时实际main切点杀树；重启uncertain，教师页面只读verify登记一次，原bytes/mtime不变。
20. 第二次真实重启所有持久摘要一致，拒绝/停止不复活，文件不重写。

四格式字节：DOCX9896、PDF48758、XLSX6976、PPTX65952。数值只表征此合成实例；不表征任意长文布局或Office兼容。UI打开图和两尺寸截图已实看；PDFium另实看eZdtl4首页中文字/标题/表格，无粗体逐字空格。

## 4. 发现与修复，失败不抹除

- host1/3YXjLc通过4项后，夹具把closing期既有宿主`busy`错期待为`permission_denied`；改精确错误期待，保持零效果/uncertain断言，host2/qzwXuT及最终6/6通过。
- ui1/YXP9ms通过4项后数字控件断言失败。私有合成native真实args为number37/8，ledger成为string；Pi原JSON-schema anyOf校验按分支先转string。改成匹配类型union，不改SDK内部代码。原SDK专项额外核number37、文字`37`/`008`和`=1+1`保持，实际XLSX类型也回读。
- ui2/eZdtl4通过12项后pypdf标题逐字插推断空格；实际PDF渲染与PDFium逐字text正确。独立文本验收改PDFium，不去空格/不放宽marker；原pypdf仅A4校验。原四文件独立复验通过。
- ui3/vP2pVA通过13项后，夹具将新轮启动间隙`running`且宿主active暂未读到当成终态；改只认新runId且completed/failed/interrupted终态，保留自然任务与原断言。
- ui4/ffAz2n通过13项后暴露真实谱系缺陷：同一文件作为实读source和parent被service误拒。合并为一条parent来源，保留version/hash；坏version仍conflict，旧版仍不可覆盖。修订后的基础17、原SDK8、宿主6和ui5完整20通过。完成回执/系统说明同步避免把本地教师修订前内容当最终文件。

上述原日志/报告保留。不是外部重复阻塞，没有降低完整124/120/118要求。

## 5. 公开档案与下一唯一动作

原字节档案：`docs/design/codex-2026-10-03/p07-office-artifact-user-flow/artifacts.json`。包含最终与失败报告/日志、合成截图、源码/合同/许可依据及当前runtime hash；不含.env、DB、private native JSONL、凭证或密文。DOCX后来被故意append以验来源冲突，档案只取其私有ledger内原生成buffer，核与正式fact/output hash一致，不把被故意改坏的source当交付文件。

**下一四根→67§1/2/5/8/9→35→118/120/124/125，冻结126 B3c Office-WPS-A4实际版面合同。** 先核本机WPS实例隔离与现成文档/表格/演示API；不隐藏/关闭/修改现有用户窗口。只用本轮合成文件与长文/长表，真实Office/WPS打开核内容、表格、Excel行高/换行、PPT布局；PDF核A4分页/中文尾部。发现问题直接修现成库配置，再真实验收。不把独立库/AnyDoc预览当WPS证据。

完整B通过后继续C国内联网与引用、D附件图像、E持久goal、全D1–D7及P08实际无VPN/国内API/Windows安装；官方Skills/设置缺失参照保留，总目标active，三元题组暂停。
