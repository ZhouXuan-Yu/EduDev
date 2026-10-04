# Pi SDK 首个教育实例交付合同

日期 2026-10-02；依据用户明确选择 Pi SDK、国内 API 直连及 docs/48。M10/M01，只替换 AI 基座方向，不修改教师业务数据或继续三元题组。

## 本轮切片

- 锁定与 Hana 对齐的 Pi 0.80.3 SDK/core/AI，保留 MIT 许可、npm/源 hash、依赖体积与 Windows 原生依赖事实；Codex 改为历史测试开发依赖，不作为默认生产引擎。
- 复用固定 Pi full-control 示例与 Hana session-options 工具定义适配的必要函数；explicit agentDir/AuthStorage/ModelRegistry/SettingsManager/ResourceLoader/SessionManager，不使用默认 coding prompt 或默认工具。
- 注册已复用 Hana 的 read/stat/list/审批 copy，教育身份要求引用真实工具资料。main 调试 key 从忽略配置读，直连 DeepSeek；流式公开 text、工具步骤和真实终态，原始推理不公开。
- 独立合成备课实例：“读取教研资料，按学科/年级归纳备课要点并标注来源”；模型必须实际读文件再继续，不用固定 mock 文本冒充。验证停止、历史恢复与模型固定；故障注入和真实 provider 分开。
- 实际 Electron-main SDK 加载与工具闭环；build、renderer、diff。若 SDK/DeepSeek 不兼容，记录具体错误并使用 Hana 协议兼容实现修复，不改回 CLI 或自行编写第二模型循环。

## 变更与兼容

新增 `main/xiaozhi-agent` 的 SDK 适配、必要 vendor/共享投影和隔离 scripts；本切片不新建生产 SQLite 表、不新增正式 IPC、不改变真实会话/数据，不删除旧 AI 入口。无 SDK 默认资源扫描或线上包下载；全局配置/OAuth 不加载。

不同 provider 的凭证不混用。先只 DeepSeek，联网搜索不是首个备课实例的隐藏必需服务。包内包含的默认工具必须以实际 active tools 和未授权调用拒绝验证关闭，不能只靠提示词。

## 完成定义与下一步

实例实际发出 DeepSeek 请求，出现多个正文 delta 和 read 工具成功结果，回答包含文件中的核验事实；公开日志无 key/私有推理；停止后不继续文件写入，同会话恢复保留事实。SDK/工具在真实 Electron-main 运行。独立报告逐项 pass/fail/skipped/未验证；无 VPN 现场验收尚未进行则明确未验证。

完成后先 P02：将现有 `search_teacher_knowledge` 等教育工具接入，并从正式小智页面完成“知识检索 → 引用回复 → 发送清空 → 停止/失败 → SQLite/readback”。生产审批与持久幂等随 P03，不由本轮脚本冒称完成。
