# Phase2 P2-02：旧请求接入同一 Pi 宿主

## 用户追加范围修订

用户本轮明确：旧接口中的数据为模拟数据，可以删掉，以后续新接口数据为主。停止为旧模拟业务补学生/范围/三元/续跑兼容迁移；下一个任务改为 P2-03 退役旧装配、排除生产模拟回填、新接口直接连接真实本地事实。普通请求两个别名只保轻量 wire adapter，本轮已实施到真实验收，不扩展旧契约。验收夹具用于测试，不作为生产数据。只删除经源码/来源明确识别的模拟数据或回填；API Key/设置、原文件、用户新接口真实数据不属于本次模拟数据删除。Master产品目标不变。

已从真实源码确认 db.init→seedIfEmpty 会在空库自动造“小A”及两条学习记录；seedPlatformDefaults 还会在空题库造两道“内置演示题库”题。这些自动模拟业务注入本轮删除，迁入原 Electron 验收的显式测试夹具；默认本地老师、标签字典、空报告模板属于基础配置，保留。新库/清空后启动与冷重启应保持学生、学习记录、题库真实为空；教师显式创建的事实应保持。已有无来源标记的学生不按姓名猜测批量删除，本轮不清空日常数据库。新增 db.ts 和原 electron-smoke.mjs 前置备份后实施；无 schema 迁移。

## 2026-10-05 本轮合同（实施前冻结）

唯一主线 Master 已完整读取（2584 行），SHA 保持。P2-01 closeout 在修改前 verified=true。跳过测试样例说明书专项。M01/M10；Phase2 DOING，完整阶段未接受。

### 交付结果

旧 typed `runDeepTutorConsole` / `runDeepSeek` 的普通教师请求接入当前唯一 ProductionHost；宿主保存一次用户消息、一次 Pi run 和结果。旧 wire 返回 AiConsoleRunResult，通过新增可选 receipt 标明真实会话/run；不伪造结构化教育校验、grader 或旧确认结果。增量可选 commandId 支持同会话跨两个旧别名重试复用 native 命令账本。无 commandId 的旧调用是新的显式请求，不按文本去重。

### 事实和复用比较

- 当前已有 ProductionHost.start、active.done、SQLite 命令账本、snapshot、原生 Pi prompt/abort。旧 handler 独立 Direct/DeepTutor/Graph assembly 已被 P2-01 生产 gate 拒绝。
- Pi 最新官方 SDK 文档：prompt resolves after run including retries；不能把 agent_end 当宿主提交完成。复用现有 execute.done，结果必须来自宿主提交后的公开 snapshot。
- Hana 本地 0.449.0（解压源码无 Git），bridge-session-manager.ts:1393 直接 await session.prompt，finally 处理分支/资源；上游 package.json 当前0.450.0、Apache-2.0。只借用 native prompt 生命周期思路，本轮无复制/升级/新依赖。
- DeepTutor 本地 be1701108a22c1037bb8004322ef6145302cbf5e，OpenMAIC 636fab0d7edee5e7c2694117c38ece8f623573f9；本轮不搬入它们的 Runtime。教育 Domain 保留，Phase4/5进一步适配。上游 API commit 页本轮不可访问，不宣称版本最新。
- A：薄 Facade + 同 host 原生完成 promise，选用。B：新 poll/model loop，拒绝。C：恢复旧直连/sidecar，拒绝。无 UI 重写，无新增 Pro 组件。

参考：https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md；https://github.com/liliMozi/openhanako。

### 改动与兼容

shared contracts 增量可选 commandId/runtimeReceipt；main 独立 console facade；runtime registrar 选择 production adapter 或隔离 legacy；ProductionHost 增加 main-only waitForRun。preload 原 typed invoke 直接继承共享类型，无 renderer 新入口。现有 Pi 工作区消费相同事件/历史。

本切片普通教师请求：不带学生、非默认时间/知识范围和三元 intent。不能静默忽略这些旧参数，必须在创建会话或模型调用前明确拒绝；它们的兼容迁移仍 OPEN，不能宣称教育能力已迁移。缺省 session 创建新的普通会话；指定 commandId 必须带已存在 session，拒绝未知/归档会话。旧 continuation/budget/checkpoint 不自动重放，后续控制适配仍 OPEN。

不改数据库 schema、native JSONL、日常 profile/out/key、系统代理/DNS/VPN、Master；不设 Agent 运行预算。不删旧数据/Domain。源/文档备份保存于 owned phase2-facade-20261005；回滚只本轮差异。

### 完成定义

边界验证：不合法字段/访问器/超长/空请求/未知归档/不支持旧范围拒绝且无模型；跨别名同 command 并发和冷重试只有一次 run，冲突明确错误；结果按真实 Pi 状态/工具/来源映射，失败不伪称成功。正式 Electron 使用真实 DeepSeek 验旧 typed 调用→同一事件→当前可见 Pi 回复→SQLite/native→冷启动不再投递。build/renderer/原隔离教育回归/diff check。本轮源码无视觉结构修改，真实新结果截图仍审阅；不重复验已闭合启动八种图。

完整 P2-02（学生/范围/控制兼容）、P2-03装配退役、P2-04阶段接受仍 OPEN；完成后继续，不把此普通请求切片等同 Phase2 完成。

## 本轮实际验收与继续位置

Goal ACTIVE；Current Phase：Phase2 Pi Runtime Consolidation DOING。普通教师旧别名与生产无模拟注入限定 A/C接受，完整 Phase2/Goal/发布/人工 NOT_ACCEPTED。

用户明确旧接口数据为模拟，可删除，以新接口为主；跳过测试样例书专项。旧学生/范围/三元/续跑兼容不再作为交付目标，不将放弃兼容记作教育能力已完成。

生产：两个旧普通请求别名投递同一 Pi host，native done 后核 SQLite终态，公开 receipt/真实回复/工具/来源，不伪造grader；增量可选commandId跨别名并发/冷重试只一次run。删除db.init自动小A/两条学习记录和空题库两道演示题注入，迁入原验收显式typed fixture。默认老师/字典/空模板保留；已有无来源标记的记录未按姓名批删，日常库未清空。

固定 owned build2：323/SHA 9afa29f2d4083689c4945ea51619427327b7d6c6d4bebbf8758035ab64b580b1；正常build/tsc exit0，renderer111/111，原边界扩展34/34，原教育207/207（明确隔离legacy回归、显式fixture），正式真实DeepSeek/Pi UI iZe6lx 15/15 exit0、rendererErrors=[]。fresh/repeated/cold三业务表0；两旧别名同命令只有一个新增Pi run，返回与SQLite正文逐字相同，cold receipt/native JSONL SHA原样。6PNG实际审阅：兼容回复浅暗双尺寸4、原真实回复及旧历史2；无UI源修改/不宣称像素一比一。

首失败保留：qBUGFd功能10已过但cold locator变成两个assistant，改last；9W53Od实际两run均succeeded，模型在“兼容”和编号间加空格使硬编码复合字符串断言误报，改独立随机编号，并加返回正文与SQLite完全相同断言。未改模型输出，不删除失败，不宣称三连稳定。

Next：P2-03：抽出/退役旧 Direct、DeepTutor 与 Graph 编排装配；生产只注册 Pi 当前请求和控制，保确定性教育 Domain。停止为旧模拟参数补业务兼容。新接口从真实本地事实读取，不回填模拟结果。之后 P2-04阶段验收，再 Phase3五产品空间。

Master、HEAD、daily out SHA保持，无提交/push/新依赖/Schema/预算/密钥或系统DNS/proxy/VPN变更。本轮最终运行已核实际profile隔离；原P2-01首次默认profile偏好可能触及的事实保持。原用户日常联网/图片/凭证、无VPN/安装、完整教育黄金A–G、分发许可/安全/全UI人工仍OPEN。

精确命令和失败记录见 ACCEPTANCE 最新条目；hash/readback见 owned closeout.json。
