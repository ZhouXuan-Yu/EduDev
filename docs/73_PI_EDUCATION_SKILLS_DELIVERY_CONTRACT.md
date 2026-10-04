# P05-A 教育 Skills 纵向交付合同

日期：2026-10-03。模块 M10/M01，承接 docs/48、72；过程与界面仍以 docs/67 原图为准。完整目标保持 active。

## 教师可见结果

教师在小智输入栏选择备课、知识查证、题目分析、教学办公四个技能，查看完整说明并发送任务。自动匹配时模型按 Pi 原生渐进加载调用真实技能读取工具；显式选择沿 Pi 原生 `/skill:name` 展开。说明不能冒充文件产物、已执行步骤或学生数据上云授权。

## 当前缺口与来源

- 正式 main 已有受限文本读取、目录、文件信息、逐次审批复制、知识检索、计划/澄清、记忆；网络和新 Office 文件写入尚未正式接通。当前 `getSkills` 返回空列表，composer 无技能入口。
- Pi exact 0.80.3 原生 `loadSkillsFromDir`、`formatSkillsForPrompt`、AgentSession `/skill:` 展开可直接使用。定制 system prompt 只有工具名包含 `read` 才追加原生技能目录，故注册一个**仅技能文件白名单**的自定义 `read`，不开放 Pi 内置文件/shell工具。
- 直接复用 Hana 0.449.0 Apache-2.0 `lib/skills/session-skill-snapshot.ts`、`skill-file-identity.ts`；独立闭包，无插件管理器/chokidar/global目录扫描。Hana 指针不验证字节版本，教育适配额外校验 realpath、文件大小、hash、固定目录。
- HeroUI MCP 已实际查询 switch/chip 文档；沿已复用 Pro PromptInput 和 OSS Dropdown 接入选择，预览使用现有正文样式。同款 Codex 私有组件源码未取得，不声称源码相同或视觉已验收。

## 改动与兼容

1. 新增 shared 技能公开目录契约，只包含名字/中文标题/说明/正文/实际支持范围；不把宿主路径、密钥或 native 私有历史传给 renderer。
2. main 内建版本化 Agent Skills 文档，落入应用私有目录，Pi 负责解析；Hana 负责每会话指针。固定内容目录仅含审核过的四份说明，无脚本、网络安装或任意文件访问。
3. `PiXiaozhiOptions` 新 main-only Skills 开关；正式 host 启用。skills 快照独立版本，旧教育/controls/memory fingerprint 保持。旧 JSONL追加快照，原前缀不改；有未知或不匹配快照拒绝恢复。既有 binding schema 升到 v3，新 reader 接受 v1/v2/v3，setter不降级，旧 v1/v2 reader 拒绝 v3。
4. native resourceLoader 和自定义 read 工具贯通同一 Pi 循环。每次模型/工具/压缩入口检查固定技能源，500ms观察器中止运行中的变化；原生显式命令与队列消费前验证名称与源。额外参数、任意路径、变化/缺失源拒绝，错误为可行动状态。内建文件缺失时，下一次启动可从本应用审核过的固定字节重建；已存在但变化的文件不覆盖。此恢复仅内建固定说明，不适用于未来外部/教师自定义技能。
5. snapshot 沿已有 typed IPC/preload 返回公开目录；composer 选择只生成允许的 `/skill:` 文本，无新 IPC、无新增 SQLite 表或业务数据迁移。选择在成功接收后清空，失败重试保留完整已选命令；运行中不得切换技能。

## 完成定义与后续

- A：原生自动/显式加载、白名单/路径/版本/旧历史边界，正式 Electron 选择/预览/发送/清空、真实 DeepSeek 使用技能与授权资料、来源/SQLite/重启、双视口；build/renderer/专项/main smoke/diff 记录精确命令和失败。
- A 通过仅表示上述内建纵向切片。**P05 总项还需 B：本地技能启停设置、教师明确授权导入/查看/编辑、自定义目录版本/冲突/撤销、冻结与恢复规则、真实工具产物支持矩阵**。先完成 A，之后顺序 B，P06 原图 D1–D7，P07 办公文件与联网，P08 无VPN/安装与最终实例。
- 本轮不绕过缺失工具：办公技能当前起草正文，不能称 DOCX/XLSX/PPTX/PDF 已生成；题目分析仅草稿，无题库正式写入；资料仍授权/脱敏，所有文件复制仍逐次确认。
- 无新依赖；Pi 已安装 MIT，Hana 两个纯文件 Apache-2.0，无新原生二进制或 Windows 打包前置程序。新模块体积/源 hash 在验收中记录，installer 实际仍待 P08。
- 回退开关仍 `OMNI_EDU_XIAOZHI_PI=0`；旧 fallback 仅参考已有公开消息，不得加载新 Skills native历史。拒绝恢复时保留原文件，教师可新建会话继续。无真实教师库操作/commit/push/系统网络修改。
