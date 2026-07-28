# AI 中控台与老师知识图谱方案

版本：v0.2
日期：2026-07-28
状态：前期重点方案 + 当前落地基准
依据：`docs/11_STRATEGIC_PRODUCT_PRD.md`、`docs/13_DATA_STORAGE_DATABASE_ARCHITECTURE.md`、`docs/17_FRONTEND_HEROUI_PRO_DESIGN_ARCHITECTURE.md`、`docs/20_UI_REDESIGN_PLAN.md`

## 1. 战略结论

Omni-Edu Agent 的 AI 能力不应停留在“生成复盘按钮”或“聊天入口”。前期重点应升级为：

```text
AI 中控台
-> 老师专属知识库
-> 知识图谱可视化
-> Agent 工具调用
-> 学生档案、错题、复盘、题组输出
```

老师的理想操作方式是一句话发起任务：

```text
帮我分析张同学最近一个月函数题错因，
结合我上传的讲义生成 3 道巩固题，
并给出给家长看的简短说明。
```

系统应自动调用：

- 学生档案。
- 学习记录。
- 错题记录。
- 附件元数据。
- 老师知识库。
- 知识图谱。
- 复盘模板。
- 题组生成工具。

所有输出必须可追溯、可编辑、可由老师确认。

## 2. 前期产品重点

### 2.1 AI 中控台

目标：

> 让老师用一句话调度本地学生数据、老师知识库和 AI 工具。

核心模块：

- 一句话任务输入框。
- 当前上下文选择：学生、科目、时间范围、知识库范围。
- 可调用数据范围：学生档案、学习记录、错题、附件、复盘、知识库。
- 工具调用轨迹：模型准备调用哪些工具、每个工具返回什么证据。
- AI 输出区：复盘、错因分析、题组、家长沟通摘要。
- 人工确认区：保存记录、保存复盘、保存题组前必须由老师确认。

前期骨架要求：

- 未接入模型时，显示“AI 调用未接入”，不伪造回答。
- 可以先展示工具调用计划和真实本地数据计数。
- 所有写入动作先设计为待确认状态。

### 2.2 老师知识库

目标：

> 把老师上传的 PDF、Word、PPT、图片、教案、讲义、题库沉淀为可检索、可视化、可被 AI 调用的长期知识资产。

核心模块：

- 资源导入。
- 解析队列。
- 文档结构预览。
- 知识资产列表。
- 知识图谱可视化。
- AI 引用记录。
- 解析失败和人工校正入口。

支持资源：

- PDF。
- Word / DOCX。
- PPT / PPTX。
- Excel / XLSX。
- 图片。
- Markdown。
- 文本。

## 3. 推荐技术路线

### 3.1 文档解析

主解析引擎：

- `Docling`：处理 PDF、DOCX、PPTX、XLSX、HTML、图片等多格式资源；支持版面、表格、公式、OCR、本地运行；适合本地优先桌面产品。

复杂解析增强：

- `MinerU`：用于复杂教材、扫描 PDF、公式、表格、试卷图文混排；适合作为高质量 OCR 和复杂版面解析增强管线。

轻量 fallback：

- `MarkItDown`：用于快速转 Markdown，不作为复杂教材解析主力。

参考型产品：

- `RAGFlow`：文档理解、可视化切片、引用、Agent、知识图谱能力成熟；前期作为参考，不直接整套嵌入。

### 3.2 检索与索引

前期本地方案：

- SQLite：结构化元数据、任务状态、知识节点、知识边。
- SQLite FTS5：关键词检索。
- LanceDB 或 SQLite 向量扩展：语义检索。

团队/云端升级：

- Qdrant：团队版或高并发向量检索。
- PostgreSQL + pgvector：云端统一数据方案。

### 3.3 知识图谱与 GraphRAG

前期方案：

- 自建轻量知识图谱表。
- 先实现“实体/关系/来源”三层结构。
- 使用向量检索 + 图谱邻域扩展的混合检索。
- 使用 LightRAG 思路进行低成本图谱增强检索。

后续增强：

- Graphiti：用于时间型知识图谱和 Agent 长期记忆。
- Microsoft GraphRAG：用于大规模文档集合全局主题和社区摘要。
- KAG / OpenSPG：用于学科知识体系稳定后的 schema 约束推理。

### 3.4 Agent 工具调用

前期方案：

- 使用模型 tool calling / function calling 抽象。
- Electron main 暴露安全工具接口。
- Renderer 只展示任务、证据、确认状态。

可调用工具：

```text
list_students
get_student_profile
search_learning_records
search_teacher_knowledge
query_knowledge_graph
list_attachments
generate_review_draft
generate_parent_summary
generate_mistake_triplet
save_review_after_teacher_confirmation
save_learning_record_after_teacher_confirmation
```

复杂流程增强：

- LangGraph：用于多步骤、可中断、可恢复、human-in-the-loop 的 Agent 工作流。
- LlamaIndex：用于文档 Agent、索引构建、查询引擎和低代码 RAG 组合。

## 4. 数据模型草案

### 4.1 teacher_resources

用途：老师上传的知识资源。

字段：

- id
- title
- resource_type
- original_file_name
- local_path
- file_size
- content_hash
- parse_status
- parse_engine
- created_at
- updated_at

### 4.2 resource_chunks

用途：文档解析后的可检索片段。

字段：

- id
- resource_id
- chunk_index
- heading
- content_md
- page_number
- bbox_json
- token_count
- embedding_status
- created_at

### 4.3 knowledge_nodes

用途：知识图谱节点。

字段：

- id
- node_type
- name
- summary
- source_kind
- source_id
- confidence
- created_at
- updated_at

节点类型：

- 知识点。
- 题型。
- 错因。
- 教学方法。
- 讲义。
- 题目。
- 学生问题。
- 复盘建议。

### 4.4 knowledge_edges

用途：知识图谱关系。

字段：

- id
- source_node_id
- target_node_id
- relation_type
- evidence_source_id
- evidence_text
- confidence
- created_at

关系类型：

- 包含。
- 关联。
- 导致。
- 适合练习。
- 来源于。
- 可解释。
- 可迁移。

### 4.5 ai_tool_runs

用途：记录 AI 中控台每次工具调用。

字段：

- id
- task_id
- tool_name
- input_json
- output_summary
- evidence_refs_json
- status
- created_at

### 4.6 ai_tasks

用途：AI/OCR/图谱任务队列。

字段：

- id
- task_type
- title
- status
- student_id
- resource_id
- input_json
- output_json
- error_message
- requires_teacher_confirmation
- created_at
- updated_at

## 5. AI 中控台页面设计

布局：

```text
左侧：上下文选择
中间：一句话输入 + AI 输出
右侧：工具调用轨迹 + 证据引用
```

### 5.1 上下文选择

模块：

- 当前学生。
- 科目。
- 时间范围。
- 知识库范围。
- 是否允许使用未校正 OCR。
- 是否允许生成可保存草稿。

### 5.2 一句话任务区

模块：

- 主输入框。
- 常用任务模板。
- 运行按钮。
- 当前模型和隐私状态。

常用任务：

- 分析错因。
- 生成阶段复盘。
- 生成巩固题。
- 整理家长沟通摘要。
- 根据讲义找相关例题。

### 5.3 工具调用轨迹

每一步必须显示：

- 工具名。
- 输入摘要。
- 输出摘要。
- 引用来源。
- 是否需要老师确认。

### 5.4 输出确认

写入类动作必须进入确认状态：

- 保存学习记录。
- 保存复盘。
- 保存题组。
- 更新学生标签。
- 写入知识图谱。

## 6. 老师知识库页面设计

布局：

```text
左侧：资源导入与资源列表
中间：解析状态与文档预览
右侧：知识图谱与 AI 使用状态
```

### 6.1 资源导入

模块：

- 选择本地文件。
- 批量导入。
- 文件类型过滤。
- 默认复制到本地知识库目录。
- 解析引擎选择：自动、Docling、MinerU。

### 6.2 解析队列

状态：

- 等待解析。
- 解析中。
- 已解析。
- 解析失败。
- 需要人工校正。

### 6.3 知识图谱可视化

节点：

- 讲义。
- 知识点。
- 题型。
- 错因。
- 练习题。
- 学生记录。
- 复盘建议。

交互：

- 搜索节点。
- 点击节点查看来源。
- 展开一跳/两跳邻居。
- 按资源、学生、知识点过滤。
- 查看 AI 引用过的路径。

前端推荐：

- Sigma.js + Graphology。
- 小规模编辑或图分析后续可补 Cytoscape.js。

## 7. 安全和隐私约束

- 原始 PDF、Word、图片默认只保存在本地。
- AI 默认只接收脱敏摘要和必要片段。
- 老师可选择哪些资源允许 AI 使用。
- 未校正 OCR 默认不参与高风险结论。
- AI 输出不得直接写库，必须进入老师确认。
- 工具调用日志不得保存学生隐私全文。

## 8. 前期开发切片

### 切片 1：UI 骨架

- AI 中控台成为一级导航。
- 老师知识库成为一级导航。
- AI 页面展示一句话入口、上下文、工具调用轨迹骨架。
- 知识库页面展示资源导入、解析队列、知识图谱骨架。

### 切片 2：本地数据表

- teacher_resources。
- resource_chunks。
- knowledge_nodes。
- knowledge_edges。
- ai_tasks。
- ai_tool_runs。

### 切片 3：资源导入

- 选择 PDF/DOCX/PPTX/图片。
- 复制到本地知识库目录。
- 保存元数据。
- 解析队列入库。

### 切片 4：Docling 解析

- Python CLI 调 Docling。
- 输出 Markdown、JSON、页面信息。
- 保存 resource_chunks。

### 切片 5：知识图谱 MVP

- 从资源标题、章节、标签、错题记录抽取轻量节点。
- 保存 nodes/edges。
- 用 Sigma.js 渲染图谱。

### 切片 6：AI 工具调用 MVP

- 定义本地工具 schema。
- 支持 AI 查询当前学生和学习记录。
- 支持 AI 查询老师知识库。
- 支持工具调用轨迹展示。

### 切片 7：人审写入

- AI 生成复盘草稿。
- 老师确认后保存。
- AI 生成题组草稿。
- 老师确认后保存到错题资产。

## 9. 验收标准

- 老师打开应用后能直接看到 AI 中控台入口。
- 老师能看到专属知识库入口。
- AI 中控台能说明当前可调用哪些真实数据。
- 知识库页面不伪造解析结果或图谱内容。
- 知识图谱页面能明确展示节点、关系、来源、未接入状态。
- 所有 AI 写入动作必须需要老师确认。
- 原始资源不会自动上传云端。
- 核心学生记录和复盘流程仍可离线完成。

## 10. 当前实现状态

本轮已经落地为可运行本地链路：

- DeepSeek 配置：设置页手动输入 API Key，保存到本地 `app_settings`，前端只显示掩码。
- AI 中控台：通过 Electron main/preload 调用 DeepSeek，输入当前学生、学习记录、附件元数据、知识库命中切片和图谱节点。
- 工具轨迹：每次 AI 调用返回工具状态、数据源、知识库引用，并写入 `ai_tasks` / `ai_tool_runs`。
- 老师知识库：新增 `teacher_resources`、`resource_chunks`、`knowledge_nodes`、`knowledge_edges`。
- 资源导入：支持 PDF、Word、PPT、Excel、图片、Markdown、TXT 进入本地知识库目录；Markdown/TXT 立即本地切片。
- 解析队列：PDF、Word、PPT、Excel、图片先保存元数据并进入 `resource_parse` 待处理任务，不伪造解析结果。
- 知识图谱 MVP：基于真实资源和切片生成资源节点、章节节点和来源关系。
- 前端页面：知识库页展示真实资源、解析状态、切片预览、图谱节点和本地资产统计。

仍按透明待接入处理的增强能力：

- Docling / MinerU 的真实复杂版面解析。
- OCR 校正界面、公式/表格结构化抽取。
- 向量索引、Embedding 构建和相似题召回。
- Sigma.js / Graphology 的大规模交互图谱渲染。
