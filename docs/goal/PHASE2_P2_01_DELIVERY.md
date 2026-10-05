# Phase2 P2-01 交付合同：正式启动与旧 Runtime 边界

2026-10-05，Master Goal 唯一主线，M01/M10。跳过测试样例说明书专项。

## 可核验范围

正常开发与打包产品始终采用现有 Pi Host，旧环境开关不得回落 DeepTutor/LangGraph/直连生成。启动查询未完成或失败不显示旧 Console；失败允许重试及返回教师工作台。旧运行 IPC 先集中建立主窗口主 frame 权限与运行边界，旧 pending input 不在生产恢复成另一套会话。保留教育领域、资料/学生/教学内容页面与历史数据。

原 Pi SDK/Host、typed preload、Pro AppLayout/HeroUI 状态组件直接复用，无新增依赖、Schema、密钥、预算、上传或模型循环。仅新增薄 RuntimeAuthority 和 IPC 包装。已有 Hana 会话/工具层不复制第二套；DeepTutor/OpenMAIC Domain 后续以 Capability 接入。

受控旧回归仅允许未打包、明确 E2E + 独立 legacy opt-in + 已存在的系统临时一级 omni-edu 数据/用户配置目录，两目录须分离、无重解析路径。原教育 smoke 207 项增加明确 opt-in，保原断言。此模式不是产品支持的旧 Runtime。

源码与文档修改前保存于 apps/desktop/test-results/goal/phase2-runtime-20261005/*-before，先核状态与 Master SHA。修改 main/index.ts 仅导入/接线，不新增大段业务。host 启用由主进程策略显式传入，不读取旧环境回退开关。preload 契约不变；xiaozhi:enabled 增加 sender 校验。

## 完成定义与下一步

实施补充：原教育 regression 暴露 --user-data-dir 不等于 app.getPath('userData')。按 Electron 官方 app.setPath 接口，在 ready 前同步显式 launcher profile 到 userData/sessionData；无 switch 的日常启动不改变配置路径。新显式目录可创建，非绝对路径/文件拒绝。实际 Electron 记录并断言两个 getPath，不能仅凭启动参数声称 profile 隔离。依据：https://www.electronjs.org/docs/latest/api/app#appsetpathname-path 。

边界测试：普通 env=0、packaged、无 opt-in、非隔离/重解析/相同路径均不能 legacy；受控 legacy 可运行原回归；旧 IPC 拒绝错误 sender 且生产不调用任何 handler；Pi host 不受旧 env 影响。真实 Electron env=0 正式页、旧 IPC 不产生 run/worker、普通教师真实 Pi 请求、冷启动不重放。启动 preparing/error/retry 真页面及双尺寸浅暗图审。正常 build/typecheck、原 renderer、原 education smoke、git diff --check。

本切片只接受正式启动与入口隔离。旧 Console 的请求/续跑/停止到 Pi 的兼容 Facade 尚待 P2-02；禁止以禁用旧入口宣称教育能力迁移或完整 Phase2/Goal 完成。P2-03 再退役旧代码的生产装配；P2-04 总体验收。旧 checkpoints 本轮不迁移不重写，不自动 replay。回滚依据本轮 source-before，隔离测试与 daily out/profile 完全分开，无提交/push。
