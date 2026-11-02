# U4-B · 卷内编辑的真实桌面验收

2026-11-02。源码提交 `76f0f61`；运行根为 `D:\WorkProject\EduProject-sidebar\apps\desktop`。这是正式 Pi Electron，使用自有测试数据副本和独立 profile，未操作 D 盘日常窗口或协作者工作树。

## 已实现的功能

教师可以在当前卷内修改题干、公式、表格、选项、小问、答案与解析；保存后逐题核对，形成不可变快照，再进行教师确认。明确换题和恢复原题保留各自版本。卷内修改不写回题库，也不改其他会话的题篮和历史试卷。

编辑输入和已保存内容分开：前者仅是按数据目录隔离的恢复副本，后者以宿主 SQLite 回执为准。核对绑定实际修订及摘要；修改使原核对失效。没有至少两个有效结构化选项的选择题允许留稿，但阻断正式快照和答题卡。

学生预览不挂载答案、解析及其来源图片读取器；教师预览通过既有卡片查看。未更换 Composer、模型、第三方组件源码或全局样式。

## 实际桌面结果

入口：`node scripts/ui-goal-paper-instance.mjs --run-ui --from=test-results/ui-goal-paper-9G2OGc --owner=aisession_7a4a1a6c-ad0d-4614-bef7-33b9be2322b2 --witness-owner=aisession_8b649d13-87fc-4285-b1a1-e8e69e942300 --questions=question_d0ed2e88-704b-4b96-90f1-d4f880ab7e10,question_5326992e-9786-418b-829e-8be64ee8e237`。

原始报告：`apps/desktop/test-results/ui-goal-paper-instance-SgbRQN/report.json`；日志：`apps/desktop/test-results/ui-goal-20261101/u4b-ui-attempt3-76f0f61.log`。**success=true，9 项通过，两次启动，1366×768 / 1920×1080 共 12 张截图。**

| 验收动作 | 实际结果 |
| --- | --- |
| 同一真实来源题加入两个不同会话题篮 | 独立保存；来源题保持绑定 |
| 分组表单修改并保存题干、选项、小问、答案、解析 | 宿主实例读回一致 |
| 未核对修订尝试正式快照 | 被阻止；学生 DOM 无答案区 |
| 当前修订核对、Tab / Enter / Escape、展开教师答案 | 实际操作通过；原生 details 数量为 0 |
| 教师确认当前编辑快照 | 不可变记录一致；出现六个导出入口，本例不据此宣称已导出文件 |
| 换题并恢复原题 | 绑定正确来源版本；此前快照不变 |
| 冷启恢复保存内容及独立未保存输入；明确放弃后者 | SQLite 内容与界面偏好一致，放弃不写领域事实 |
| 全题库、另一题篮、旧快照与本轮换题前确认快照 | 独立 SQLite 读回不变 |
| 模型台账、控制台及可观察网络 | 无新持久模型运行/请求/事件；无 renderer/console 错误，无 firstWindow 后 HTTP 尝试 |

启用的保存/快照操作实际文字对比度约 10.42；截图对应定位无横向溢出。测试数据是此前由正式入口收录的 20 道受控文本题的字节副本，不代表自然扫描、复杂数学、答案正确性或教师审美接受。

## 失败记录和修复依据

1. `ui-goal-paper-instance-v4yoAr`：6 项通过，冷启就绪判断提前返回。保留原报告和截图。实际安装 Playwright 的该轮轮询没有 await 异步谓词；独立浏览器探针 `u4b-async-wait-probe-Oz3i1O` 证明 async false 提前返回，sync false 正常超时。DOM 时间线随后显示正确题篮，不能据此认定生产状态被清空。
2. `ui-goal-paper-instance-t9T6nw`：真实等待修正后，首次蓝图保存仍被 QA 拦截。SQLite 未写入可选 `uiState` 时，产品采用正式默认值；旧 QA 错误要求对象必须存在。只对 undefined 使用产品默认值，显式偏好仍严格比较，null 仍拒绝。
3. 最终 `SgbRQN`：使用独立 await 轮询、IPC 后同节点、唯一可见 DOM、精确题篮/修订/偏好及即时身份断言，通过上述九项。没有为通过 QA 修改生产状态、放宽审批或增添固定等待。

最终 QA 冻结：`u4b-ui-qa-default-ui-freeze-5zPpzh/freeze.json`；driver SHA256 为 `970d7b62e96fe3d85ce081e2450a802903b9baef8456afd80aa92512641f42ee`。QA 11/11、真实浏览器等待专项 8/8、表单专项 4/4。旧 A 公共 driver 仍有异步轮询限制；其既有实际截图/断言保留，不能把新 B 等待修复倒算为旧 A 全覆盖。

可版本化证据：[精简实际报告](U4_B_DESKTOP_RESULT.json)、[展开教师答案 1366](u4b-desktop/teacher-answer-1366.png)、[学生预览 1920](u4b-desktop/student-preview-1920.png)、[冷启恢复 1920](u4b-desktop/cold-restored-1920.png)。截图来自上述同一次实测，未复制测试数据库或 profile。

## 源码、构建与边界

最终 21 个 renderer 文件见 [冻结清单](U4_B_RENDERER_P2_FREEZE.json)，宿主与协议见 [宿主验证](U4_B_HOST_VALIDATION.md)。生产渲染器、持久化客户端和编辑器按职责拆分，旧来源题独立留作对照。

父任务最终 build / TSC exit 0，455 个 out 文件摘要 `756bd2ae8df3568887c104b4a6253f9383fe812399468b777e92f9f4b64a34fc`。提交前后 source/out 字节对应证明为 `u4b-p2-build-76f0f61-source-match.json`。第一次集成组件 245/245 在四项 renderer P2 修复前运行；修后执行相关专项及完整 build，不把前一轮结果描述成修后全套重跑。宿主 17/17 的图片 fixture 合法选项补充及原失败见 [记录](U4_B_OPTIONS_FIXTURE_17_RESULT.json)。依赖审计仍为 45 项，exit 1，未改变依赖。

本例不验证真实 Office 文件及 Pi 审批、不覆盖快速跨页导航、不证明 U4-C 的上传/OCR/参考卷、U6 的课程结果质量或完整 ChatGPT 体感。六类文件必须另有实际写入、审批和读回证据；教师验收仍独立进行。

构建日志的未压缩体积对照：A `8baf593` → B `76f0f61` 对应构建，main 3628.23→3691.77 kB、preload 37.07→37.71 kB、renderer JS 7535.60→7595.05 kB、CSS 454.46→455.42 kB。这是包含期间主线整合的整体差值，不将全部增量归因于单一编辑组件，也不代表内存或 P95 测量。编辑验证没有新增模型调用或全库扫描。

回退须保留 v2 读取兼容、新表、原始题库、题篮、幂等回执及历史快照；不能删除数据或用旧 v1 写入器覆盖已升级题篮。若仅撤销入口，应保持已有 v2 内容可读，并在独立分支验证后正常整合，避免整段 revert 掉协作者更新。
