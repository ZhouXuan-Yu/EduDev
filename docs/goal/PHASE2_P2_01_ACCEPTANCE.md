# Phase2 P2-01：启动与旧 Runtime 边界验收

2026-10-05。P2-01 限定实现 A/C 接受；Phase2 继续，完整 Goal / 发布 / 人工验收 NOT_ACCEPTED。测试样例说明书专项跳过，Master 未修改。

## 交付

- 主进程 RuntimeAuthority 决定 Pi 或显式隔离 legacy-test。正常开发 env=0 和打包策略都仍为 Pi；旧开关不再选择正式产品 Runtime。
- 11 个旧编排 IPC 使用集中 registrar，先校验当前主窗口主 frame，再核 runtime。正常应用拒绝旧 sidecar、Console、Graph resume、直接生成、续跑/预算/输入/取消/停止。getDeepTutorSidecar 同时有内部保护。生产 pending input 返回空列表，不隐式恢复旧 loop。
- Host 默认 Pi，不再读取旧开关；typed enabled 查询校验 caller。App 准备状态、10 秒启动查询失败、显式失败、可见重试与返回教师工作台，均不挂载旧 Console。启动超时仅限初始化查询，不是 Agent 运行预算。
- 显式 --user-data-dir 在 ready 前经官方 app.setPath 同步 userData/sessionData；无 switch 不变。测试实际 getPath 校验两个路径，不能仅以参数推断隔离。[Electron 官方接口](https://www.electronjs.org/docs/latest/api/app#appsetpathname-path)。
- 原 Pi Host/native session/教育领域与原 Pro AppLayout/HeroUI Button/Spinner 复用，无新依赖、数据库迁移或密钥变化。保留资料、学生、教学内容页面与旧对话；不删除确定性 context compiler 或教育领域。

## 真实证据

最终 owned build3：323 文件，SHA `81acedfc0e0cad93d3a7d30189c83792a1b160406fa9f5b19789b0175d7c17fe`。

|检查|结果与证据|
|---|---|
|正常 npm build / tsc|exit 0，phase2-runtime-20261005/build3.log|
|原 renderer 组件|111/111，renderer.log；本轮 renderer 源在此后未改变|
|运行策略 / IPC 边界|22/22，pi-runtime-boundary-WIm9X8/report.json|
|原教育主流程|207/207，education3.log；附实际隔离 profile 和 legacy-test 选择断言，保原 207 项|
|正式 Electron + 真实 DeepSeek|13/13，pi-runtime-ui-vazbqj/report.json；同 build3/script SHA，rendererErrors=[]|
|UI 图审|最终 10 PNG 已逐张读取：准备/失败浅暗 1366×768、1920×1080 共 8；旧历史与真实教学回复 2。8 处状态正文对比最低 5.39336466369807，按钮可达|
|实际操作|普通 env=0 启动 Pi；11 旧入口拒绝且零 run；侧栏打开合成旧历史无重放；启动挂起/拒绝、返回与重试；真实分数课建议可见编号；发送栏清空；SQLite 唯一 succeeded Pi run；冷重启无新增 run|

精确命令 cwd apps/desktop：

```powershell
npm run build -- --config test-results/goal/phase2-runtime-20261005/workspace-build3.config.ts
npm run test:renderer-components
node scripts/xiaozhi-agent/pi-runtime-authority-smoke.mjs
$env:OMNI_EDU_TEST_BUILD_ROOT=(Resolve-Path test-results/goal/phase2-runtime-20261005/build3).Path
node scripts/electron-smoke.mjs
node scripts/xiaozhi-agent/pi-runtime-authority-ui-smoke.mjs
```

根目录 git diff --check exit0。owned closeout.json 绑定源码、文档、build3、报告、日志与 PNG；初始快照不覆盖。HEAD `20aa86656cdb5a0f85e0e11fa21863b50233fcb1` 未变化；daily out 323/SHA `0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981` 未变化。

## 首次失败与修复

1. UI jewF8X 错把 async waitForFunction 的 Promise 视为完成，真实回复仍流式就断言并关窗中断；改宿主侧 await 轮询，同时校验 SQLite succeeded 与真实 DOM，再冷启动。旧失败与 PNG 保留，不记为 provider 故障或稳定通过。
2. education1 实際 app 配置目录与 launcher profile 不一致，legacy 策略正确拒绝；同步显式 userData/sessionData。首次应用默认 Electron 窗口偏好可能被读取/写入，不能宣称此前 profile 从未触及；不猜测回滚用户设置。最终实际路径已验证隔离。
3. education2 在重载准备状态期间提前选择导航，随后 nav-ai 隐藏；原 navigate 等待实际可见返回入口或教师导航，207 项原断言保留。
4. JBjE0H 新旧历史文字同时在侧栏 preview 与正文出现，严格 locator 冲突；限定 office-conversation 正文。保留失败报告，未改生产历史呈现。

本轮只有各最终一次成功，不声称三次连续稳定。旧学生成功反馈间歇问题仍为 Phase7 OPEN。未验证 daily 当前用户反馈、安装/无 VPN、人工验收、全 Shell 像素一致或完整教育迁移。

## 唯一下一步

P2-02：冻结旧 Console / 直接请求到同一 Pi 的兼容 Facade，先落实请求校验、单次投递与原 AiConsoleRunResult 接缝，再接续跑/停止/问答/重试；保留教师权限、历史与教育事实，不恢复预算，不整搬 DeepTutor/OpenMAIC Runtime。P2-03 才清退重复装配，P2-04 再完整 Phase2 接受。当前禁用旧入口不等于教育能力迁移完成。
