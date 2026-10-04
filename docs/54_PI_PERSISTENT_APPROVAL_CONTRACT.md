# Pi 持久审批、命令防重与恢复交付合同

2026-10-02，P03/N04，M10/M01/M09。P02 的正式只读入口通过 docs/53；本轮把用户选定教学工作目录的文件复制贯通真实审批。全办公编辑、Skills、设置与视觉仍按总清单推进。

## 当前证据与目标

Hana 0.449.0 的 session-permission-wrapper 冻结宿主/SDK 双身份及目录/参数，审批后重验；ResourceIO 复制能直接复用，本项目已加 COPYFILE_EXCL。现有 adapter 的 approveCopy 为内存回调，正式 Pi 没注册复制。小智确认表已存在，但旧执行器只接学生报告/题组/mastery，不能伪造学生 ID 或调用旧执行器完成文件效果。

教师新建小智会话、通过本机目录选择器授权教研工作目录，发起复制任务；看到来源/目标和一次性审批，拒绝零写、批准实际复制与读回。停止/重启使未执行审批失效；效果已执行但记录没提交时显示待核验，核验只读现有文件，不自动重新复制。

## 修改清单

- shared 契约新增 commandId、工作目录公开标签、版本化审批投影、批准/拒绝/只读核验动作；事件/快照贯通 main/preload/正式 UI。凭证、原始 SDK 身份、绝对私有目录不从 renderer 输入。
- domain session-state 增量创建 `xiaozhi_pi_commands`、`xiaozhi_pi_workspaces`；复用既有 ai_agent_runs/messages/events 与 ai_confirmation_items（新 action_type `pi_office_copy`）。旧学生确认列表/执行入口排除此类型，保留原事实/类型行为。DB 只窄适配。
- commandId 固定本地会话/请求 hash，重复命令返回同 run、不再次调用模型或存消息；不同参数同 commandId 拒绝。创建过程中退出不重放未完成命令，保留可见中断并允许教师发新命令。
- 工作目录由 main 原生选择器返回；拒绝数据根/其祖先、用户/磁盘根及系统/密钥目录、链接。已有 SDK 绑定不静默换目录：新会话先授权目录，按固定目录/model/tools/prompt 恢复。
- Pi approveCopy 接持久队列；审批绑定会话/run/call、来源 hash、来源/目标相对路径与目录指纹。Hana adapter 增加持久执行前/后回调；ResourceIO 在最终同步复制前再次检查取消，依旧不覆盖。
- 宿主停止使待审批/已批准未开始项失效，取消等待 callback；已开始效果不能伪称撤销。启动 pending/approved 失效，executing 标待核验，旧批准不恢复。核验比较现有普通文件 hash，只记录观察结果，不写原文件。
- 复用 HeroUI Pro ChatTool Approval/Actions/Approve/Reject，状态为真实 pending/executing/executed/rejected/interrupted/uncertain 等；按钮防重仅 UX，持久 CAS 为执行门禁。通过现有 OfficeComposer 添加目录入口与权限/状态反馈，不添加空按钮。

## 兼容与回滚

新增表幂等，旧确认行原样保留。P02 未授权目录的历史继续只读工具，不改旧 SDK fingerprint；选目录只允许无绑定会话。旧入口仍由 `OMNI_EDU_XIAOZHI_PI=0` 回退，不删除原业务数据或新历史。故障测试只在明确隔离目录，新旧库副本迁移，禁止清理真实数据。

## 完成定义

实际 Electron 页面 + 真实 DeepSeek 发起工具：审批等待零写、批准恰一次及文件 hash、重复命令不重跑、拒绝/停止迟到零写、来源变更拒绝、越界拒绝、应用强制退出后旧审批失效、执行后落库前退出待核验且不重放、重启读回。两个视口审批/输入/停止可达。故障切点只在 E2E 环境启用，不伪造正常 provider 工具历史。

运行 build、renderer-components、P03 专项、P02 受影响正式检索/发送路径、必要 test:smoke、git diff --check；精确报告失败/pass/skipped 与未验证边界。每轮四份协作文档及总台账同步。下一项 P04 控制/记忆，再 P05 Skills/P06 一比一界面/P07 完整办公联网/P08 无 VPN 与安装实例。
