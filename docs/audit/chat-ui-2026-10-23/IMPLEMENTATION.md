# 对话体验修复交付合同（2026-10-23）

目标：依次修复 REVIEW.md 的 R01–R12，服务 M10 对话与 M04/M05/M09 教师流程。现有 main→typed IPC→投影→renderer 已有对话、工具、审批能力；缺口是数学阅读、草稿持久化、公开阶段/结果摘要与回复交付入口。

顺序：①构建门禁、数学与草稿；②真实阶段/耗时、空来源分支、工具摘要；③回复复制/修改/保存到既有审批、安全继续、部分结果；④首屏、面板、输入区与回复级来源。

修改边界：office renderer 与现有Pro Markdown适配；shared office-agent/xiaozhi-agent/projection新增可选公开展示字段；Pi session/production-host提供真实阶段与脱敏结果摘要；复用现有教学文件导出服务保存回复Markdown。可增加小型展示helper与定向测试，禁止将业务大段堆入App/main/index/db。不变更SQLite schema、不批量写业务数据、不上传私密资料、不增加Agent loop。

兼容/恢复：旧事件与publicItems缺少新字段时使用保守占位，不能推定有效结果；草稿只存本机按会话隔离且不自动发送；失败保留可编辑原文。继续由教师准备新草稿并再次发送，不重放旧写入/授权；保存先预览确认再系统目录选择，新窄IPC只接受身份与内容hash，main重新取持久化正文并复用已有导出服务，Word/PDF仍沿原审批。改动均可逐文件回滚；测试只用Temp隔离数据。

完成标准：标准build、组件与定向边界测试；真实Electron验证数学/公式错误与流式输入、切换/重启草稿、普通备课空库、公开过程/工具空结果与引用、复制/修改/保存审批、停止后继续、问答、双尺寸浅暗、SQLite与文件readback；关键路径兼容smoke，git diff --check。报告精确通过/失败/skipped与真实provider边界。

不做：重构模型隐藏推理、整库迁移、新增产品模块、保证网络/模型首字绝对时长、未经教师审批写文件、无证据数学正确性声明。新依赖如需引入须锁版本并记录许可证/体积/Windows打包影响。

交付：对应实现与真实23项Electron验收、217组件/16边界/207兼容门禁及已验证边界见 [DELIVERY.md](DELIVERY.md)。用户随后要求先进行下一轮方案规划，新增范围仅写入 [NEXT_IMPLEMENTATION_PLAN.md](NEXT_IMPLEMENTATION_PLAN.md)，未开始该轮重构。
