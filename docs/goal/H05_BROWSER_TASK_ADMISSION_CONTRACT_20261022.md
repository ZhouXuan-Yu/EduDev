# H05 内置浏览器任务准入修复合同（2026-10-22）

## 最终构建复验

当前最终构建`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373与owned副本完全一致。`D4UQf0`、`fG3tZB`各5/5，公开图片`z19EBM`、`DnmrJ6`各13/13，自然文件`6rw96n`14/14；任务状态28/28、任务计划边界17/17、浏览器准入4/4、renderer240/240。原`B9EXFP`、`6R2tIb`、`lPw1Iy`、`R1PbZP`、`oprbps`、`C0qnOS`、`wGFxRF`保持失败证据。完整H10/H05仍不因该软件矩阵关闭。

## 已验证网页步骤的后续只读观察（2026-10-22 追加）

H10日常配置副本第二次联网暴露：同一步骤已经由`navigate/snapshot`验证后，后续`screenshot`仍被`task_step_already_verified`拒绝。现`plan-runtime`把普通safe_read/local_cache以及`office_browser`的`snapshot/screenshot/show/tabs/wait/scroll`标记为`verified`步骤后仍可追加的同资源只读动作；`navigate/click/type/select/key/close`和写工具仍拒绝。`task-state`只在显式`safeAfterVerified`时放宽verified拦截，资源、criterion、call和run身份不放松。

原`pi-daily-network-copy-R1PbZP`（screenshot被verified步骤阻断）和`oprbps`（模型误建human-only计划）保留。最终构建`d8ec197c3952b4707519863996ed996cd6b6e2cf41e0a7699165f88a136952e8`/373；`pi-daily-network-copy-RxMvJv`与`Qdx3qZ`连续两次5/5，真实日常保存配置完成公开搜索、两正文、内置浏览器和截图，源DB不变、owned profile删除、0 renderer错误。任务状态28/28、浏览器准入4/4、任务计划17/17、renderer240/240。

## 当前结果

状态：`LIMITED_ACCEPTED`。构建`726eb85be68a91d98c767da5070b7f79a4d011e1a0daf7cae298bb38cb1c752b`/373。

真实`pi-browser-delivery-w54wli`20/20通过：修复后浏览器导航、DOM栏目、最终回答、PNG URL/哈希/尺寸、双尺寸预览、伪造路径拒绝、真实失败页和冷启零重放全部通过。`pi-result-readback-vtN8yp`28/28、任务计划17/17、任务状态27/27、浏览器准入4/4、renderer240/240。H10合成基线4 PASS且validator valid，但整体仍NOT_ACCEPTED。

失败`harness-baseline-B9EXFP`、`pi-browser-delivery-6R2tIb`、`pi-browser-delivery-lPw1Iy`保留。完整证据见`apps/desktop/test-results/goal/harness-h05-browser-20261022`。

## 目标与教师结果

M10/M12。教师自然要求“在小智内置浏览器打开一个公开教育网站，读取当前可见栏目并保存本地截图”时，Pi 可以先提出 `web` 任务步骤，再在同一模板版本中实际调用 `office_browser`。该修复只解除任务宿主对真实浏览器工具的错误拒绝，不改变公开网站范围、DNS 设置、教师逐次确认、截图本地化或外部效果不重放规则。

## 真实失败

当前构建 `236109bdd6617af424ffd04a7c3b04dfd853c8b32723a3a634ab02c4cd3937e6` 的 H10 基线 `harness-baseline-B9EXFP` 中：

- NET-01 的搜索、正文读取和日期核对已经通过。
- NET-02 的真实回合正常完成，但三次 `office_browser` 调用均为 `task_blocked`，随后 `office_web_fetch` 也在错误计划上被阻断。
- 失败现场在 `apps/desktop/test-results/xiaozhi-agent/pi-browser-delivery-6R2tIb/report.json`。
- 宿主任务实际已产生合法的 `browser_open`、`browser_read`、`browser_shot`、`teacher_check` 四步，前三步 kind 都是 `web`，target 都指向 `https://www.moe.gov.cn/`。

## 根因与修改边界

根因有两处：

1. `taskToolKinds.web` 只包含 `office_web_fetch`，遗漏 `office_browser`。
2. 浏览器只有 `navigate` 携带 `url`；`snapshot`、`screenshot` 等后续动作没有 `url`，原任务资源适配器因此无法把动作绑定到当前已采用 `web` 步骤的冻结 URL。

本切片只修改 H05 任务适配：

- `web` 同时接受 `office_web_fetch` 和 `office_browser`。
- `office_browser.navigate` 仍从实际 `url` 计算资源身份。
- 同一 `web` 步骤的后续无 URL 浏览器动作只能复用宿主已冻结的 criterion resource，不能传入模型自造资源、切换工具或绕过步骤依赖。
- `office_browser` 继续是 `external_effect`，继续经过执行边界、任务准入、取消/超时和未知效果规则。
- 不新增数据库、IPC、依赖、浏览器权限或第二 Agent Loop。

## 验收

1. 新增纯边界反例：`web/navigate` 使用 URL；`web/snapshot` 和 `web/screenshot` 可复用同一冻结资源；无冻结资源、错误工具或伪造资源仍拒绝。
2. `office_browser` 的 SDK schema 仍只增加宿主 `taskStepId` 包装，原领域参数不被改写。
3. 用当前源码构建后重跑真实 Electron/Pi/DeepSeek NET-02：模型必须实际调用 `office_browser`，读取当前 DOM 中一个栏目，保存真实 PNG，并在冷启后保留截图和 native 前缀且零工具/模型重放。
4. NET-01 不因本修复退化。浏览器失败反例仍显示真实失败，不伪造来源或截图。
5. 运行 build、renderer 组件、任务专项和 `git diff --check`；报告 build SHA、脚本 SHA、实际调用和未验边界。

## 保持 OPEN

本切片不关闭完整 H05、H10、图片测试适配、文件阶段磁盘不足、无 VPN、日常 profile、安装包或人工教师验收。`pi-public-image-ui-pGRANJ` 的 `r.message.content.some` 错误是测试适配问题，单独修复；`pi-natural-file-CwvbKZ` 的 `ENOSPC` 是环境阻塞，独立保留。

## 回滚

撤下 `taskToolKinds.web` 与资源适配的浏览器字段，保留任务、URI、截图和失败证据；不能删除已发生浏览器效果或把失败历史改成成功。
