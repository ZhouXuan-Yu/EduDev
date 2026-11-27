# W2 独立设置窗口接入记录

状态：IMPLEMENTING。此文件是分支检查点，不是 SET-P0_ACCEPTED、MG-01 或整个 V3.1 完成报告。

## 本轮实现

- 主进程 `settings-window/runtime.ts` 负责独立窗口、可信主窗选择、生命周期 IPC 和设置状态通知。`controller.ts` 继续负责单例、非模态、加载失败、导航撤权、工作区约束和退出清理。
- `settings-window/ipc-bridge.ts` 只代理 `shared/settings-window.ts` 中审过的固定方法；保留原 handler、schema、业务授权和配置版本协议。设置窗口不能直接调用原通道；原设置通道也增加可信主窗身份检查。没有 renderer 通用 invoke、终端、文件读写或 Agent 启停接口。
- `preload/settings.ts` 暴露精简的原方法签名及版本化作用域。主窗 `settings-host.ts` 只提供开窗、可信选择、状态/装饰通知；仅 Pi 主进程启动策略启用，保留原隔离 legacy-test 回归入口。
- `renderer/settings.html/settings.tsx` 是独立页面入口，复用原 `PiSettingsWorkspace` 十类业务组件及教师/L2/历史记忆。新增布局样式属于 `ui-system`；原 HeroUI 内部样式、主左栏和 Composer 未重写。
- `DesktopFrame` 将设置导航/菜单归口开窗，不切走主页面、不写导航历史。`SettingsWindowBridge` 从现有 Workbench 发布已选会话；子窗不把 localStorage 的会话偏好当权限依据。
- 主窗蒙层仅装饰、pointer-events:none，无背景 blur。主窗聚焦、设置隐藏/最小化/关闭解除弱化。未增加主窗业务暂停或 Pi 停止操作。
- `SettingsCloseGuards` 汇总原编辑器 dirty/busy；教师记忆和 L2 草稿保留、原生关闭被拦截，已保存/放弃后解除。界面偏好复用原存储并通过 storage 事件同步；配置通知触发原服务读回。
- `desktop-ipc-lifetime` 对代理通道沿用原备份 publication 分类，避免快照等待自身。生命周期控制不作为业务写入，但仍由原 shutdown gate 管理并等待结算。

## 实际发现及修复

| 证据 | 根因 | 修复 |
| --- | --- | --- |
| ipc-red.log | 会话参数错误类型未拒绝；MCP 全局输入被误判成会话；代理备份自等待 | 参数和真实方法对齐；原服务继续校验；代理沿用原 publication 类型 |
| ipc-parity.log | previewBackupRestore 的可选 kind 参数遗漏 | 自动比较当前生产 preload 的通道/转发参数数量，修正白名单 |
| ipc-original-channel-red.log | 新接口拒绝伪造窗口，但旧无 guard 设置通道仍可被其他副窗调用 | 为审过的原设置通道追加可信主窗校验，不能只封新接口 |
| product-FZEYpH/report.json、settings-failure.png | 新布局放在旧 CSS 隔离器处理目录而失效；SettingsSection 未转发 data-testid | 使用项目 UI 系统目录；分组容器转发标准 HTML 属性 |
| product-X5lfBr/settings-teacher-memory.png | 放弃草稿后仍显示关闭保护提示 | dirty/busy 清除时同步清理该提示，保留其他错误 |
| scope-revocation-red.log | 主窗在等待readRevision时失去可信身份，旧请求仍发布选择 | await后重新核验trustedMain；保留epoch和原业务校验，正式作用域测试10/10 |

失败记录保留；没有把旧截图、夹具通过或本地提交当正式验收通过。最终同版结果以新的 CHECKPOINT_W2_INTEGRATION.json 和证据目录为准。

## 验收边界与剩余动作

后续跨会话实操已扩展至13项：A→B旧A写入拒绝、B权限从原设置UI保存、主窗输入栏同步、回A恢复草稿/原权限、关闭后SQLite匹配、17个模型/权限/备份/技能/MCP/诊断新旧通道拒绝、文档置换后销毁/重新创建。沙盒frame仅证明preload和parent访问不可用。正式失败揭示usePermissionMode只在sessionId变化时读取；新增变更订阅、请求序号与revision保护后通过。主控件内部、权限规则和数据表未修改。证据见CHECKPOINT_CONTEXT_FOLLOWUP.json。

已取得正式 Electron 双窗、十类页面可达、教师草稿关闭保护、偏好双窗同步和伪造窗口拒绝的证据。对真实服务的配置保存/历史/撤销/冲突、三类记忆修改/取消/恢复、权限审批/撤权、技能/MCP/能力及备份创建/校验/恢复，尚未据此通过。

下一步按顺序执行：

1. W2-C：在正式宿主继续补齐子 frame、导航后身份、跨会话 A→B、旧异步请求和对话框期间撤权负例。复核扩展导入等原 adapter 的 await 后校验；不复制领域引擎。
2. W2-E：在独立测试数据根从 UI 完成配置版本、历史/撤销与冲突；实际 SQLite/文件读回；原 UI 测试按独立 owner window 适配，不降低断言。
3. W2-D/E：教师、L2、历史记忆完整读写和来源；合法/非法权限、技能/托管/MCP、归档、备份完整回归。归档内OfficeConversation的文件/产物动作需单独审核，只读归档不能为此直接暴露通用文件接口。
4. W2-B/F：主任务实际运行/待审批/附件/队列保留，系统 Alt+Tab 和焦点返回、键盘/IME/搜索、长页、失败恢复、性能与 Reduced Motion。已发现原生两屏 100%/150%，125% 仍未验证；不能用 forced DPR 冒充。
5. 正式逐项完成设置专题及 LG，才进入其他已确认页面。本包其余 AC 不能因设置窗口打开而自动 PASS。

累计预算：W2-A 3/8，W2-B 1/8，W2-C 7/8，W2-D 2/8，W2-E 0/8，W2-F 0/8，W10 0/3。第6轮修正权限显示订阅；第7轮修正frame夹具未等frameattached。最后一轮前先收集await导入对话框及全局/会话配置迟到回执的完整证据再一起修复，不重置次数。后续按同一入口累加。

存储事件：D盘耗尽导致一次最终测试未启动、状态文档写入失败。C盘保留43文件快照及完整重建状态，最终Pi双窗复测曾在C盘独立数据根8/8。约100MB空间恢复后已还原状态并继续本轮修复。不得将失败启动记PASS；最终报告必须匹配最后正式构建。原临时缓存清理被自动审批拒绝，未执行。

回滚：当前检查点仅在任务分支；需要回滚时正常 revert 对应提交，并重建与重新验收。不得 reset、clean、删除其他树或覆盖协作者改动。main 合并仍被完整 V3.1 门禁禁止。
