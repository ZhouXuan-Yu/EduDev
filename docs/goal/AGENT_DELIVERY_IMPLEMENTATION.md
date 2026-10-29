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

## W0 / E02 真实思考设置

- 复用 model-settings/state/api、shared/xiaozhi-settings 与 OfficeComposer；新增受版本检查的会话思考覆盖，默认自动，不改 provider/key/native 模型身份。
- 单一映射以可信 provider 能力为依据，UI 与真实请求共用；不支持的档位禁用/说明，不给所有模型伪造 Ultra。运行中冻结，设置不触发生成；自动档参考仍未完成目标而非只看“继续”。
- 后续具体字段/迁移在 E01 接缝稳定后核对并补入本合同；未冻结实现前不得跨模块改写设置。验收为 AT-E02-01…10，费用边界保持已有授权。

## W0 / E03 多轮与局部修改

- 复用当前 Pi SessionManager、任务状态、成果版本、已读来源和局部文本编辑；不新建摘要/任务真源。
- 后续核实成功文件、未完成文件、教师最新修改与短确认的承接；PPT 编辑须使用真实页结构/备注而非把全文按段落重制。源内容变化应刷新，批准不能复用到新文件/内容。
- 后续具体字段/消费者/取消恢复合同在 E01/E02 后补齐；验收为 AT-E03-01…10。旧身份、已保存成果、教师拒绝与重新明确授权均按现有边界处理。
