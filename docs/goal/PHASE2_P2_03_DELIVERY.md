# P2-03 生产唯一 Pi 装配交付合同

日期：2026-10-05。Goal ACTIVE；Phase2 DOING。用户已明确旧接口模拟数据可删除，以新接口真实数据为主；不继续旧学生、范围、三元和续跑兼容专项。

## 目标与当前缺口

M01/M10：正常教师启动只装配 Pi SDK 宿主。现有 RuntimeAuthority 已阻断旧编排执行，但 main/index.ts 仍静态导入并注册 Direct、DeepTutor Sidecar 和 Graph 旧闭包。本轮将其隔离到显式受控测试模块；生产只保留两个投递同一 Pi 的普通请求别名及明确退役响应。

教育领域计算、教师确认、来源与 SQLite 原事实保留。旧模拟种子上一轮已删除，回归 fixture 仅由隔离脚本显式创建；本轮不清空日常库、不猜测无来源历史记录是否模拟。

## 复用与方案

复用当前 Pi ProductionHost、RuntimeAuthority、权限注册器及 ConsoleFacade。旧实现原样移入受控模块，不新造 SDK 循环。现有 agent-loop 的确定性教育上下文计算继续保留，DeepTutor/OpenMAIC 教育能力的生产适配在后续 Phase4/5 完成。无新增依赖、SDK 升级或许可证变化。

## 修改范围

- main/index.ts：移除旧 Runtime 导入/闭包/状态；在 store.init 后根据主进程权威策略动态装配测试模块；生产注册 Pi 别名和退役端点。
- 新受控 legacy-ai/test-runtime.ts：入口再次校验 RuntimeAuthority，保留原教育回归能力和只读历史接缝。
- legacy-runtime-ipc.ts：明确端点清单和生产注册路径，维持当前窗口、主 frame 与关闭状态校验。
- 原 runtime 边界、正式 Electron 验收脚本：验证正常启动拒绝旧端点、真实 Pi 请求与冷启动仍正常；原教育回归验证移出后能力。
- 四份根协作文档、四份 Goal 状态文档、稳定 CURRENT/架构/验收文档同步真实证据。

## 兼容与回滚

不修改 Schema、共享返回结构、preload、数据目录、模型配置或预算。旧会话可读，不自动重放。测试 Runtime 只允许未打包、显式 opt-in 且独立 OS 临时数据/配置目录；生产不回退。修改前将精确源文件与文档保存到 owned evidence 目录，失败可按清单恢复源码，禁止触碰真实教师数据。

## 完成定义

正常 build/typecheck；renderer 门禁；当前边界验证；原教育 207 项隔离回归；正式真实 DeepSeek/Pi 页面请求、旧别名单次投递、无模拟注入、冷启动 readback；生产主 bundle 不包含旧 Runtime 实现并通过执行边界，实际页面截图审阅；git diff --check。记录失败和未验证边界。只接受 P2-03，不将此切片当成完整 Phase2、Goal、发布或教师验收。下一步 P2-04 全阶段工具、控制、压缩和恢复验收。

## 2026-10-05 P2-03 生产唯一 Pi 装配接受

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING；Current Task：P2-03 限定 A/C 接受。完整 Phase2、Goal、发布与人工验收仍 NOT_ACCEPTED。用户的新接口真实数据优先、旧模拟兼容停止、跳过测试样例书专项规则继续生效。

Done：main/index.ts 从约2300行减为502行；Direct/DeepTutor Sidecar/Graph 的旧状态、闭包与注册移入 legacy-ai/test-runtime.ts。生产只装配 Pi；两普通旧名经同一 Pi Facade，9旧编排名明确退役。测试模块在显式隔离 opt-in 时动态加载，factory 再核当前真实 packaged/env/data/profile 策略；教育 Domain、传统业务及历史只读保持。

Evidence：owned build 324 文件/SHA ee048bf95d934b5b9dbef6925931153591aeabda333c018971542eb01e5cebd8；正常 npm build/tsc exit0，renderer111/111，运行边界39/39，原教育隔离回归207/207 exit0，正式真实DeepSeek/Pi UI 2cvNGJ 17/17 exit0、rendererErrors=[]。V8 Inspector 实际主进程已加载脚本清单证明正常启动和实际请求/冷重试均不含 test-runtime；原教育回归反向断言该隔离模块确实加载。最终6PNG逐张审阅，浅暗双尺寸输入控件可达、回复和历史可读；本轮无UI源修改，不宣称Codex像素一比一。

新鲜/重复/冷启动的学生、学习记录、题库均无自动演示注入。真实页面发送清空输入，旧别名并发同commandId只新增一次Pi run，结果与SQLite正文相同，cold receipt/native JSONL SHA保持。新接口继续取真实本地事实；没有清空日常库、猜测已有记录、回填模拟结果或投入旧三元/续跑兼容。

Failed：初次抽取后相对导入深度错误，首tsc失败；修正shared和dynamic type import路径后tsc/build通过。诊断读取两次工作目录错配，仅只读且已重读。正式17/17和教育207/207本轮首次运行通过；不宣称三连稳定。

Doing/Next：P2-04 全Phase2验收：真实工具调用、权限确认/控制、自动上下文整理、恢复、当前无运行预算与provider真实缓存口径；之后Phase3五产品空间，再Phase4/5教育能力。移走旧编排不等于DeepTutor/OpenMAIC个性化能力已完成。

Blocked：无当前阻塞。Open：用户日常联网/图片/凭证反馈、无VPN/安装、完整教育黄金A–G、分发许可/安全、全UI人工与完整Goal。未替换日常out，Master与HEAD 20aa86656cdb5a0f85e0e11fa21863b50233fcb1 保持；未提交/push，无新依赖/Schema/预算/密钥/系统proxy/DNS/VPN修改。先前P2-01首启动profile偏好可能触及的事实保留，本轮所有实际测试独立profile已核验。

证据：apps/desktop/test-results/goal/phase2-retire-20261005/；交付合同：docs/goal/PHASE2_P2_03_DELIVERY.md。

