# P07-B3b 教师审阅与正式产物接线合同

日期2026-10-04；M09/M10，承接118完整B3与119生成基础。本合同完整结果是教师从小智提出办公任务、查看与修改拟内容、明确确认本次版本、保存真实Office文件并核来源；底层阶段通过不能算页面交付、完整B或Codex一致。

## 1. 当前事实与缺口

现有Pi/Hana唯一循环、SessionExecutionRegistry/once、预算teacher wait、文本change coordinator/typed主frame、原Pro ChatTool/CodeBlock与文件Tabs均可复用。图谱找到exportDocumentArtifact调用main/index及旧writer，未找到未入图的text-change service；当前实际源码为准。旧document_artifacts没有类型CHECK或来源表，旧writer只markdown/pdf/docx，不能把新xlsx/pptx送到其fallback DOCX分支。119只buffer生成，不存在Office拟内容/审批/正式保存链。

本轮相关既有脏改来自本任务持续工作，保留其内容；领域新增文件，不在db.ts/App.tsx堆业务。不新增代理循环、Codex CLI、联网服务或依赖。

## 2. 冻结的数据和协议

- shared `xiaozhi.office-artifact.v1`：四格式proposal、严格相对路径、office-draft.v1内容；来源最多16个授权相对路径及本次读取的文件version。main捕获sha256，未知来源不伪造，零来源标ai_generated。更新正式binary通过parentArtifactId引用旧事实和精确hash，创建新的目标文件/新artifact id；禁止覆盖原binary。
- 私有 `xiaozhi_pi_office_drafts`：conversation/run/call唯一，workspace/input hash，draft JSON/hash、content_md、格式/目标相对路径/parent id、revision/state，固定生成器版本、输出bytes/hash及artifact id、main固定结果绝对路径、时间。输入256KiB/输出16MiB/每会话256条，原内容和目录不入公开事件。
- 私有 `xiaozhi_pi_office_draft_sources`：draft id/ordinal/path/version/sha256；正式 `document_artifact_sources`：artifact id/ordinal/type（workspace_file或parent_artifact）/source id/path/version/hash。来源保存在SQLite关系，不能只放聊天。
- 状态pending→approved→generating→prepared→committing→saved；拒绝rejected、取消interrupted、版本冲突conflict、生成failed、写入意图后未能确认uncertain。恢复pending/approved/generating/prepared→interrupted、committing→uncertain；只分类，不自动写/重跑生成。
- committing→saved由单条revision CAS更新触发SQLite原子trigger：同一语句插入原document_artifacts并复制来源关系；任意约束/既有id冲突令整句回滚。不用INSERT OR REPLACE，不覆盖已有正式事实。FS与SQLite不在同一事务，uncertain只读核验精确目标/hash，成功核验可登记本次已有产物，不重新生成或安装。
- DocumentArtifactType增量xlsx/pptx；旧export input仍限制三种，旧createDocumentBuffer明确unsupported而不fallback。旧表/记录/文件不删除，迁移CREATE IF NOT EXISTS幂等，旧库副本与fresh实际验证。

## 3. 权限、确认与实际文件效果

沿用authorizedWorkspace/approvedFile、排除dataRoot/凭证/链接/Windows别名、原Pi withFileMutationQueue和宿主全局owner。现有父目录、严格扩展与格式相符，目标不存在；source lstat普通单链接文件、最多50MiB、本次version匹配且hash捕获，确认/生成之后/安装之前均重新核。

教师本地review按需取完整拟内容和来源；公开snapshot/tool仅显式白名单safe摘要。decision只session/id/revision/action；单独typed revise允许本地teacher提供严格office-draft结构，main再次校验、pending revision CAS递增，旧批准无效，不能通过编辑接口直接保存/授权路径。模型不能调用teacher revise或修改已确认内容。

批准先持久化approved，原teacher wait返回后生成approved内容。生成器动态main import，取消、目录权限和current run在每个await之后再核。buffer持久化prepared后记committing；固定同目录临时文件wx写入/fsync，原目录/来源/目标再次核→exclusive link安装→unlink临时→实际nlink1/hash readback→原子正式事实登记。未知、取消和晚结果不能产生伪saved；已经物理安装后取消仍保留真实事实。main raw cause不进入IPC/模型。

## 4. 正式宿主和同款界面

office_create_document注册原Pi tool registry/Hana once+预算wait，新增独立office-artifact.v1，不改旧native快照指纹。同一工具调用拟内容→teacher wait→生成提交→真实回执，没有第二agent loop。修改正式Office通过新proposal+parentArtifactId及新路径，旧版本保持。

新增主frame channels review/revise/decide，typed preload单一入口，closing/archive/会话/current和全局owner遵循现有文本审阅模式。event/snapshot显式project白名单，不把private ledger spread出去。renderer原Pro ChatTool/CodeBlock与已有Tabs/FileTree复用，pending显示“审阅拟内容”，可编辑结构中的标题/段落/表格、拒绝/确认；saved显示真实产物、打开/来源/新版本，uncertain提供只读核验；取消、错误与stale revision均有反馈。

需要新组件先HeroUI Pro MCP官方文档/CSS及Finesse能力，Pro原源不开放时用已登记本地copy与依赖，不另画聊天模板，不称第三方源码是Codex官方源码。未知官方Skills/设置截图仍单独待证，不影响此接线。

## 5. 验收与推进顺序

1. 先私有状态/关系/服务/正式fact atomic登记，实际SQLite/FS/原生成器、来源变化/目标冲突/教师revision/授权取消、真实故障退出+重启只读核验、旧库全行readback。记录121基础，不能称UI完成。
2. 持续同合同接原Pi协调器/独立能力/main-frame typed/原组件与真实teacher修改确认。真实DeepSeek自然四格式任务、拒绝零写、同call不重放、源变化、更新新版本/旧版不改、停止/关闭、两native尺寸和重启恢复，记录正式接线验收。
3. B3c真实Office/WPS打开、中文长文/A4/表格/Excel可读行高与PPT布局。保持用户现有WPS窗口，不把独立库解析当WPS证明。

每阶段build、renderer、原Pro/Hana来源verify、必要专项及关键用户路径主smoke，git diff --check；报告准确区分真实文件/受控生成fixture/真实provider/UI/Office证据，保留失败。四根+26/28/35/67同步真实状态及唯一下一动作。

回退保留旧export和工具入口，新Office能力未通过完整用户链不替换旧入口；迁移增量不删除真实数据。无commit/push/系统网络修改/远端资源变更/子agent。完成B3b+B3c才完整B；C国内联网/D附件图像/E持久goal/全D1–D7/P08实际无VPN和Windows安装/完整目标继续。
