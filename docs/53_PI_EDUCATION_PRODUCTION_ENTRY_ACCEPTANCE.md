# Pi 教育智能体正式入口验收

日期：2026-10-02。交付合同：docs/52；基座与 Hana 源码对齐：docs/48–51。P02/N03 是正式入口切片，完整 Harness 仍进行中。

## 本轮实际交付

- 主链：正式小智 → typed preload → education production host → 嵌入式 Pi AgentSession → DeepSeek。没有 Codex CLI 子进程或第二模型循环；旧入口通过 `OMNI_EDU_XIAOZHI_PI=0` 保留。
- 复用 Hana 的 SDK 边界、运行 registry、工具失败提升、流式 guard、每轮执行去重；本轮接入现有教育 `search_teacher_knowledge` 的参数审核、执行与脱敏，不直接 SQL、不授权原始学生目录。
- `education-tools.ts` 把已审核的知识片段转换为“资料1/标题”引用；隐藏数据库 ID，公开工具结果只投影有界资料标题。工具失败成为 SDK isError，空检索保持事实结果。
- 新 `production-host.ts`、`ipc.ts`、`session-state.ts`：单会话运行所有者、字段白名单、主进程凭证、提交后终态、退出取消。新增增量幂等绑定表 `xiaozhi_pi_session_bindings`，其私有相对 JSONL 路径不进入 renderer。
- 本地历史/运行/事件复用原表；模型历史由 SDK SessionManager 管。旧对话只读显示，首次 Pi 不重放旧模型消息；模型变化拒绝静默续用旧私有历史。
- 新 `PiEducationWorkspace` 复用已有 OfficeConversation、OfficeComposer、AiConversationSidebar；真实正文分段、工具、来源、停止、失败和重启回读。发送后清空输入，IME 不发起请求，按 runId 去重事件，切换会话取消旧补读覆盖。

## 实际实例与报告

测试根为忽略目录 `apps/desktop/test-results/xiaozhi-agent/`，使用合成教研资料，不上传真实学生数据。

| 验收 | 命令 | 结果 / 报告 |
|---|---|---|
| 正式 Electron + 真实 DeepSeek | `node scripts/xiaozhi-agent/pi-production-ui-smoke.mjs` | exit 0，11/11，pi-production-ui-KYHeeL/report.json；335 个首轮公开事件 |
| 新旧 schema/幂等/未来版本拒绝 | `node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-production-ui-DMYANI/data/app.db` | 4/4，pi-state-migration-Z66LPw/report.json |
| renderer 状态 | `npm run test:renderer-components` | 79/79，pi-production-renderer-final.log |
| build + 旧教育主路径 | `npm run test:smoke` | exit 0，ok=true，前端 207/207，pi-production-legacy-gate-final.log |
| diff 门禁 | `git diff --check` | exit 0，只有 LF/CRLF 提示 |

正式实例从教师可见导航导入 Markdown，再在小智发起检索；实际 provider 多 delta、工具结束、来源标题与核验事实进入回复；SQLite 恰一用户/一助手，重启后固定模型/私有历史续问、真实流停止、无密钥可见失败均验证。最终新增 IPC 额外凭证字段拒绝/并发第二运行拒绝通过。11 项无失败/skip；迁移 4 项、组件 79 项和旧入口 207 项不累加为互不重叠的总数。

1366×768、1920×1080 截图均已查看，输入/发送可达、真实知识标题显示。当前侧栏尺寸、窄图标轨道、浮动右卡、字体与间距尚未完成 Codex 一比一；不得把可达截图当作视觉对齐完成。

## 失败与修复记录

- zzoOhM：默认首页就是小智，测试从不可见 nav-ai 导航而超时；修为实际“工作台”返回导航。
- oQ4ZWi：前八项通过，测试用错误的新建按钮标签；改稳定 testid，后续完整 9/9。
- DMYANI 首版回复暴露 chunk ID；工具适配改人类引用别名与资料标题，G75DmY 真实复验通过。
- `pi-production-legacy-gate.log` 的 `npm run test:smoke` exit 1，旧学生创建成功反馈第 1703 行超时；此前同脚本直接运行 exit 0。本轮添加失败截图与反馈日志，最终串行 `npm run test:smoke` exit 0、207/207，未改学生业务。没有证据把首次失败归因于 Pi 或并行负载，偶发失败仍保留。

## 未验证范围与下一项

当前仅只读教师知识检索和空私有工作目录受限文件工具；没有开放真实原始目录、shell、网页搜索、写入产物。无 VPN 现场、Windows 安装包、全量真实教师库迁移/恢复、持久审批、完整 Skills、计划/澄清/压缩与设置菜单均未放行。发布依赖问题继续按 docs/51 处理。

**下一步第一项 P03/N04**：先冻结持久 command/approval/取消与崩溃恢复合同；复用现有 run/确认记录与 Hana 快照，贯通审批卡/工具调用/一次提交/readback。最小实例：同命令重复零重复写、拒绝零写、批准恰一次、停止后迟到零写、杀进程后旧审批失效与不自动重放、新旧库兼容。写审批通过后再扩教育草稿、办公文件与 Skills，继续 docs/35 全部目标。
