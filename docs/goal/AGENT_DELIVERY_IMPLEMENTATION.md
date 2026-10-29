# 小智交付能力实施合同

执行入口为 `XIAOZHI_AGENT_DELIVERY_GOAL.md` 及其四份规格；唯一进度入口仍是 `WORK_PROGRESS.md`。本文件保存具体切片设计，不替代验收记录。2026-10-29 启动 W0/W1，所有 REQ/AT 仍待阶段集中验收。

## W0 / E01 默认文件能力

- 教师结果：不选私人目录，也能创建本会话文件；文件卡与原文件面板可读取，继续修改沿已有审阅、版本核验与撤销处理。
- 现状缺口：production-host 在无 workspace grant 时不注册 text/Office/document/export 工具；Pi 的私有 cwd 位于数据根，不能直接当作业务文件授权。通用 HTML 只允许固定 Anatomy 模板；普通 Office v1 不含备注和精确页结构。
- 复用链：conversation-output → production-host 的文件租约/服务与 Pi 配置 → 原 typed preload 的文件/修改/Office 接口 → PiWorkspaceFiles、PiTextChangeCard、PiOfficeArtifactCard → SQLite 原账本与本地文件。不得另建文件事实表。
- 默认目录：真实 dataRoot 的同级 `XiaozhiOutputs/<dataRoot 路径摘要>/<sessionId>`，只用于本会话成果；不同实例、会话隔离。显式工作目录优先。创建失败返回已有权限/读取错误，不静默切换到其他私人目录。
- 兼容：保留旧 `options.workspace`、privateWorkspaceId 和 native session binding；生成目录作为独立文件读写范围，不能改变旧会话身份。已有显式产物输出目录保持优先；原批准绑定原路径及内容版本。
- 拟修改：production-host、pi-session、source-availability、工具目录；新增 conversation-output；随后接通 HTML 创建/隔离预览、版本化精确 PPT 页/备注契约及生成/读回/审阅。无 DDL、新 runtime、新依赖或新增通用权限审批。
- 正常与边界：真实保存/读回/重启；会话隔离；已存在文件不覆盖；目录不可写、归档、取消、旧版本、教师拒绝保留既有反馈。默认目录不等于已有资料或私人读取许可。
- 验证：一次相关构建、组件检查、专项受控集成；阶段功能齐后按 AT-E01-01…10 与适用 C 项从正式入口集中取证。受控模型测试仅证明调用链，不证明自然质量、真实教师确认或安装通过。
- 回退：必须保留新native能力记录的装配兼容、默认目录只读租约及通用HTML预览；只停新增写入。写入停用兼容开关尚待实现/验证，直接整提交回退可能使新能力记录不可装配，不视为已验证回退。目录、SQLite 和已保存文件均不删除。后续备份/恢复须显式覆盖默认产物根，当前不承诺整机迁移已完成。

## E01 第二切片：精确PPT页与教师备注（2026-10-29冻结）

- 教师结果：要求8页就输出8页，不自动多加封面/按段落拆页；每页含可编辑文字/有限表格与独立讲者备注，检查答案只放answer备注。审阅卡能查看、修改备注；本地读取工具能从实际PPT读回备注及页序。
- 契约：新增 `xiaozhi.presentation-draft.v1`，沿现title/sections；每个section是一页，pageId唯一稳定，speakerNotes为非空的`{kind:script|answer,text}`数组。普通Office v1及课堂/试卷格式保持原验证/生成语义，新schema仅允许pptx。已有工具名、native创建指纹、表/IPC不变。
- 消费者：shared验证→office_create_document定义→service propose/revise→原SQLite draft_json/content_md与generator_version→PptxGenJS逐页/notes parts；原PiOfficeArtifactCard追加教师备注审阅/编辑；实证Hana anydoc 0.1.2已提取notes，生产直接复用现document-worker/预览/office_read_document，避免再次解析/重复备注；测试独立按OOXML relationship读回页序及备注。
- 版式：固定16:9，一页一section，标题/文字/表格保持可编辑；按实际换行预算选择字号，内容过密明确拒绝、保留拟稿，不静默截断/自动加页。新生成器版本只用于新schema，旧数据content_md和生成器identity不改变。
- 恢复/回退：新schema读取必须保留，取消/拒绝/来源冲突复用原机制；已有文件与父版本不覆盖。纯字段与worker解析扩展，无DDL/新依赖/额外权限审批；不能宣称任意旧PPT对象保真修改已完成。
- 检查：一次必要契约/生成/独立OOXML读回、正式界面修备注/保存/工具读回/重启；构建与renderer门禁。实际Office/WPS编辑、全页渲染与自然模型质量未验证时如实保留，不把局部专项写为AT全组通过。

## E01 第三切片：整包审阅与部分续做（2026-10-29冻结）

- 教师结果：同一任务的2–8份HTML/文本/Office草稿一起出现，沿原卡片预览及修改PPT，整包一次确认或拒绝。批准绑定每份文件当前内容、目标、修订号和任务要求版本。增加文件或修改草稿须重新确认。
- 实现边界：新增office_deliver_files薄编排工具，不另建Runtime；复用原text/Office服务和唯一文件账本。SQLite新增可恢复的bundle元数据表，仅存子账本引用、逻辑文件ID、状态、任务要求版本及批准指纹，不复制文件正文或正式产物事实。
- 贯通：shared bundle DTO/事件 → 原session-state与服务 → Pi附加能力identity、manifest、saved_bundle任务凭证 → typed preload → 原会话交互区整包卡。旧单文件工具和native身份保持；子草稿不能绕过整包单独批准。
- 保存与恢复：全体草稿均被审阅后才开始顺序保存；某份失败保留先前成功文件，显示部分交付及每份状态。恢复工具在新run中实读已保存子账本和磁盘，成功文件仅携带、不重写；未完成文件按原草稿重新提案、重新整包确认，可另存新名。取消/冷启失效旧待批准状态，不自动续写；不确定效果先只读核验，无法核验不重放。
- 证据：saved_bundle/current须独立核验全部文件及当前授权，部分交付不得算整包完成。教师编辑保存在原子草稿，最终保存后的正文不回传模型。没有新依赖或外部付费请求。
- 一次必要检查：实际正式界面整包改PPT/确认与拒绝；故障切点保留HTML、续做PPT并证明HTML未重写；旧批准/新文件、来源变化、取消/冷启及独立整包readback。随后相关构建/renderer/关键路径smoke；完整AT仍在P1齐后集中执行。
- 回退：保留新元数据读取及native附加identity兼容；可停止注册新整包写入入口，不删子账本/文件。默认产物备份、兼容停写开关为后续切片，不因本切片提前声明完成。

## C03 / E01 第四切片：默认成果备份与兼容停写（2026-10-29冻结）

- 当前缺口：现完整备份只复制dataRoot，默认XiaozhiOutputs在同级，备份会遗漏真实HTML/PPT；目前正式入口只有创建/校验备份，没有真正的新目录恢复入口。不得把导出副本当作已完成恢复。
- 教师结果：原设置页“创建本地备份”同时包含默认成果及SHA清单，界面说明包含范围和文件数；校验能发现成果缺失/被改。旧无成果附加区的v1备份继续可校验。
- 接缝：conversationOutputRoot纯解析 → 原backup/data-root-files、store.exportDataRoot/verifyDataBackup → 原typed结果及DataBackupPanel。沿现manifest.v1增加有版本的conversationOutputs附加元数据，保留旧文件列表；只从本实例输出scope复制到保留前缀，不跟随外部链接、不扫描其他实例或教师授权私人目录。阻止将备份放入源成果目录造成递归。无新表/依赖。
- 停写回退：启动环境OMNI_EDU_XIAOZHI_FILE_WRITES=0仅停AI text/Office/bundle写入，不撤销读权限、不改变native identity、不删除草稿或文件；原单文件/整包工具仍装配，服务实际写边界拒绝新提案、批准及执行/撤销；只读核验保持。正式页面显示停写原因，模型收到当前实际能力说明。教师手动业务导出不扩大为全盘只读。
- 检查：一次真实服务/文件备份及清单校验（含同名跨会话、遗漏/变化、旧包、无成果根、递归目标）；正式Electron从设置创建/校验，冷启停写后预览旧HTML/PPT、实读与尝试新生成无文件副作用。build/组件及关键路径门禁；完整C03仍待阶段集中AT。
- 兼容/恢复：保留所有新增schema/kind与native读取，不整提交回退到无法识别saved_bundle的旧版。备份附加区不是运行根，真正恢复需要迁移默认成果路径、文件事实与任务/会话身份并从UI读回；后续C03继续，在W3集中交付前补齐；不将全量恢复迁移加为E02的前置，尚不承诺迁移或激活可用。

## W0 / E02 真实思考设置

- 复用 model-settings/state/api、shared/xiaozhi-settings 与 OfficeComposer；新增受版本检查的会话思考覆盖，默认自动，不改 provider/key/native 模型身份。
- 单一映射以可信 provider 能力为依据，UI 与真实请求共用；不支持的档位禁用/说明，不给所有模型伪造 Ultra。运行中冻结，设置不触发生成；自动档参考仍未完成目标而非只看“继续”。
- 后续具体字段/迁移在 E01 接缝稳定后核对并补入本合同；未冻结实现前不得跨模块改写设置。验收为 AT-E02-01…10，费用边界保持已有授权。

### E02 本轮冻结交付合同（2026-10-29）

- M10/M12：正式输入框增加会话思考选择；原模型设置页增加全局默认。优先级：会话覆盖 > 全局默认 > Auto。独立 app_settings schema1/CAS 记录，不改模型、密钥、native 身份、旧设置和业务表。
- 能力来源为 DeepSeek 官方 /models 的 effort.supported_levels/default_level，随现有目录缓存实存实读。Auto/关闭/低/高/最高仅对可信能力启用；旧目录缺元数据或过期显示说明，已有覆盖不兼容时明确回落 Auto，绝不换模型或伪造 Ultra。
- 共用解析器冻结每轮 choice、实际 thinking.type、reasoning_effort、输出预算、来源和回落原因；最终 onPayload 同时覆盖普通/工具续轮/压缩请求。关闭=disabled/none；低/高/最高=enabled/low|high|max。预算受可信窗口/输出上限和完整请求容量门约束，不把更长等同更聪明。
- Auto 短确认参考上个未完成任务原始要求；独立问候保持轻量。设置与刷新只读目录，不创建对话请求或继续任务；原设置互斥锁/CAS 拒绝运行中修改，冲突刷新、失败保留旧值。最后一轮策略本地保存以便重启后查看。
- 共享类型 → 原状态服务 → 主进程设置 API → typed preload → 原模型设置页/正式输入框 → Pi 真实传输；合成 SSE 捕获 wire、SQLite 冷启、会话隔离、冲突/忙/缺能力/认证错误，并复用完整请求与截断状态。无新依赖，无新增付费模型请求，不做 D 盘安装替换。
- 单片先一次必要验证：build、组件、E02 专项真实 Electron/合成传输、关键路径 smoke；E02 完整质量/费用对照随 W3 集中验收。只有实际覆盖且达标的 AT 才备注“已实现”；其他保留部分实现/未执行。
- 回滚：正常 git revert 本片；旧模型设置和 native 会话不变，新键可保留而旧代码忽略。资料与生成文件无迁移/删除。
- 映射核对来源：https://api-docs.deepseek.com/api/list-models/ 与 https://api-docs.deepseek.com/api/create-chat-completion/ 。

## W0 / E03 多轮与局部修改

### 本轮冻结合同（2026-10-29）

- M10/M09：普通对话的明确短继续沿原未完成任务/计划/已保存效果承接；新的实质指令仍成为当前任务要求，按时序保留教师原始要求与最新修订，历史不覆盖当前。复用SQLite任务、真实教师消息、Pi protected context与原instruction queue，不新增任务真源。
- 原office_read_text增加UTF8 HTML/SVG源码支持，沿64KiB/路径/版本/脱敏边界，仅实读不执行脚本。工具名与原创建身份不变。
- 原office_create_document增加可选xiaozhi.presentation-edit.v1输入：当前本会话parentArtifactId、实际文件version、新文件名和指定页字段。宿主实读并核对已保存PPT与原草稿，仅复制修改指定页字段，未改页、顺序、表格和教师备注保留；仍用原Office草稿、审阅、生成、父子版本与文件回执，新版本另存。未知外部PPT不重建为普通段落，不改变普通Office v1与旧Pi创建指纹。
- 具体接缝：共享局部修改契约、hana-tool-adapter、task-state/coordinator、compaction-context、Office service/coordinator、原卡片与文件版本投影；typed IPC与原批准入口复用，无新表/新依赖。新版本原卡可预览/改稿/拒绝/批准；目标歧义不猜artifact，先列本会话成果并集中选定。
- 旧批准不复用；实读版本或原文件变化返回冲突，失败不覆盖旧文件。短继续的效果检查重新核验；取消、拒绝与重启沿现生命周期。单片必要检查涵盖真实HTML读改、短继续同task、当前修订优先、PPT只改第4页、旧版本保持、错误/版本冲突、冷启和会话隔离；合成模型仅验证执行路径，不充当自然任务理解质量。
- 功能对齐优先；复用已通过的队列/整包部分续做/压缩治理，不为本片重复增加审阅或安全体系。E03后进入E04/E05；完整固定FX/AT及质量评审集中执行。回滚正常revert本片；新版本保留在原产物账本与文件中，旧记录/文件不删除。

- 复用当前 Pi SessionManager、任务状态、成果版本、已读来源和局部文本编辑；不新建摘要/任务真源。
- 后续核实成功文件、未完成文件、教师最新修改与短确认的承接；PPT 编辑须使用真实页结构/备注而非把全文按段落重制。源内容变化应刷新，批准不能复用到新文件/内容。
- 后续具体字段/消费者/取消恢复合同在 E01/E02 后补齐；验收为 AT-E03-01…10。旧身份、已保存成果、教师拒绝与重新明确授权均按现有边界处理。

## E03 第三切片：可重读请求与已应用追加（2026-10-30冻结）

- 教师结果：压缩后可按同会话来源ID重读长请求完整正文；生成中实际应用的追加与教师选项回答随本任务保存并恢复，取消/未应用队列不能冒充当前要求。多份课件沿原ask_teacher集中选定，回答保留来源。
- 复用：原SQLite用户消息、control账本、原ask_teacher UI/typed preload；只增加read_teacher_request只读能力与有界来源索引，不建第二任务/权限系统。正文先沿现student sanitizer脱敏再分页；来源ID/版本不做文本替换。
- 接缝：request-sources→protected context/reader→Pi独立additive identity与manifest/catalog；control applied回执记录真实应用顺序，旧已应用记录明确顺序未知。旧创建/control/memory身份保持。无DDL、新依赖、新外部请求或额外批准。
- 兼容与回退：新来源能力的native身份读取保留；只读无文件效果，旧消息/controls无需迁移。撤回/中断/隔离run不恢复为已应用；新版本冲突要求从offset0重读。
- 检查：一次源码边界与旧身份检查、一次相关构建/组件、正式Electron受控长请求→重读→追加→压缩/选择路径；阶段完整AT后集中备注已实现，不将受控调用当自然推理质量。
