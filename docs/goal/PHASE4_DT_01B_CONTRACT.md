# DT-01b：完整收录正文检索与教师来源定位

2026-10-05。M02/M04/M10，Master Goal ACTIVE；本轮从已接受的 DT-01a 继续，学生策略/OpenMAIC 不冒充完成。

## 冻结交付范围

1. Pi 增加 `education_search_materials` 只读工具：查询整个资料库或一个指定资料的全部已收录段落，不受目录50份/正文10段分页限制。全文留在本机；仅必要脱敏命中片段交给同一模型。使用已固定的 DeepTutor `search_units` 原始代码，保留 exact/normalised/terms 的全局匹配层次，terms 只作线索。
2. MaterialRepository 一次读取一致的派生正文快照（SQLite 唯一真源）；明确安全上限20,000段/8MiB正文，超过上限返回“未完成搜索，请缩小资料范围”，不得静默截断或声称无结果。私密段落排除并返回覆盖计数；没有正文如实反馈。
3. worker 添加独立 `xiaozhi.education.search.v1` 协议，固定路径、无凭据、可取消/超时、输入输出限制，原 quote.v1 契约保持。搜索结束重新核对快照，不交付变化中的旧证据。无新循环/持久服务/依赖/表迁移/权限提升。
4. 来源含真实 resourceId、源hash、段落ID/序位与派生正文hash。公开事件/SQLite投影保存限定元数据；模型不能通过文本任意建立来源按钮。教师点工具卡或右侧来源，typed IPC 重验源及正文版本后，在现有“我的资料”直接打开对应段落，跨目录页也可达；变化/缺失显示可重试反馈，原页码未定位不伪称页码。
5. 新增独立 native search marker，不改 quote.v1/material.v1 原身份；缺工具/未知版本拒绝恢复。旧会话可添加，保留历史前缀。回滚需保留识别新marker的兼容代码，不能直接移除再加载新历史。

## 实施与验收

- 增量修改：education共享协议/worker/host/search-provider；MaterialRepository source/snapshot；materials IPC/preload/typed API；Pi装配/事件安全投影；现有来源卡/资料详情导航。复用已集成HeroUI组件，不另造工作台。
- 先原源码核对与真实worker边界，再build/typecheck/renderer组件、相关资料回归。扩展现有统一教育实例runner的 DT-01b 场景，真实文件UI导入、超过10段的尾部正文、真实Pi/DeepSeek搜索与继续阅读/核验、来源点击、SQLite/文件回读、冷恢复、变化拒绝。
- 有UI必须实际查看浅/暗1366×768、1920×1080截图；静态截图不是动画/全量像素验收。旧全207/Phase3等已有未过门禁仍单列OPEN，不扩大本轮主任务到旧模拟样例。
- 本轮只读，无数据迁移或删除；保留现有脏改动。构建资产不在运行时变动，测试全部隔离owned目录。
- 仅上述门禁全部有真实证据后接受DT-01b，之后推进DT-02；未通过仍DOING。全DeepTutor/Golden F、OpenMAIC/Golden E及整个Goal仍OPEN。
