# U4-C1 · 真实资料补题与原题篮回接

2026-11-02。**本切片工程与受控 TXT 桌面闭环通过，Astra 独立有限验收接受，无本轮遗留 P1/P2。整体 UI Goal 仍 active。** 功能提交 `e265ec32b04a5661e2066707208aa55ab7d6bb5b` 已正常推送 main 与任务分支；实际独立可见窗口 PID302848 已启动，标题“小智 · 最新功能验收 e265ec3 · 资料回接”。固定自有构建副本不受后续编辑影响，新UI会话无目录/输出授权、命令、run或消息，未自动调用模型；[启动记录](U4_C1_REVIEW_RUNTIME.json)。D日常及协作者三份脏文档保持原样。后续仅文档交付不改变此构建对应的生产源码。

老师从已有题篮点“从资料补充题目”，沿原资料导入、规则抽题和同题校正保存，再点“返回原题篮”。返回保留原会话、题篮、阶段与偏好，不自动加入；老师明确点击候选的加入按钮后才改变题篮。原题库、其他题篮、来源版本、授权及历史保留。

## 实现与文件

| 文件（均在 apps/desktop） | 作用 |
| --- | --- |
| `src/renderer/components/paper-ui/PaperBasketWorkspace.tsx`、`usePaperBasketWorkspace.ts` | 资料补题入口、离开前原守卫/偏好保存、同篮恢复及迟到意图拒绝 |
| `src/renderer/components/paper-ui/paper-material-handoff.ts` | IDs-only 返回引用、来源异步读取接力，不缓存题面/版本/权限 |
| `src/renderer/components/desktop/DesktopFrame.tsx` | 临时 history 接力、同步单调导航世代，后退再前进不能复活旧请求 |
| `src/renderer/App.tsx` | 给既有资料/题本消费者接线，使用独立 helper，不重写 App 树 |
| `src/renderer/components/product/MaterialsWorkspace.tsx` | 到题本校对/返回原篮；仍用原导入与 MaterialDraftGuard |
| `src/renderer/components/QuestionNotebookWorkspace.tsx`、`QuestionArchiveEditor.tsx`、`QuestionContextEditor.tsx` | 未保存/保存中/失败保护；已提交但回读失败准确提示，只读恢复不重复写入；列表加载时禁止新开旧行编辑 |
| `src/renderer/components/paper-ui/QuestionEditGuard.tsx` | 共用 C1 编辑保护，保留 Tab/Shift+Tab 与编辑器内部操作 |
| `scripts/paper-material-handoff-test.mjs`、`paper-material-edit-guard-test.mjs` | 挂载真实生产消费者，验证接力和异常竞争时序 |
| `scripts/ui-goal-paper-material-return.mjs` | 实际 Electron 导入/同题校正/返回/明确加入/冷启验证 |

无 main/preload/数据库/Worker/模型协议、Composer、vendor、CSS或依赖修改。复用原 HeroUI Button 与披露卡片；实际受测页面未发现原生 details/summary 黑三角。普通题本入口不启用 C1 特有导航保护。

## 冻结与真实验收

- 基线 main `22ae859eec9736d8a163977f06ee077bbc6079de`，包括协作者文件失败终态及中断临时文件恢复；均正常快进保留，无生产冲突。
- 10 文件生产冻结 `627faa779e03e32bb1aee252855dd8527f96bc93bd84bbc9294978e9c083ebf5`；[最终冻结清单](U4_C1_PENDING_LIST_REPAIR_FREEZE.json)。
- 最终完整 out：455文件，`037760b8fdba9e8ff75d17287a6971f1fb7b56a83513d01c89db4eb5dc140288`；src：1277文件，`e14f469d2e16c11883dde137d276c3b289df987a1a6ffa726a1991d74436fb2f`。
- QA `e835cc4586b46b62751d96d95b189a20796d54aa15a5177e21ca3c55483301b9`；实际报告 `apps/desktop/test-results/ui-goal-paper-material-return-MYqnyI/report.json`，SHA `7597547d30e4a73fccc6ed225e93f26e92761d601a76488b9d82d4c94ee15b50`。
- **6/6，exit0；两次启动，1366×768 / 1920×1080 共12图**。独立新 profile 中完成冷启；不声称第二次换了一个空 profile。
- 真实 TXT 原解析器创建 rule_extracted 记录，教师核对保存的是同一 questionId，保留 resource/version/chunk。未以手工新题或 SQL/API 造题替代。
- 实际取消文件选择、未保存返回/后退阻断、Tab/Shift+Tab 焦点与草稿不变、保存后前进后退和同篮返回；返回前后 revision10、旧成员不变。仅明确加入后 revision11、2个成员，冷启一致。
- 原20道题、旧成员、另一题篮、历史、授权及模型账本不变；观察到的 errors/network 为空。源验收数据、out及受测源码/脚本指纹前后一致。

[整理后的实际结果](U4_C1_DESKTOP_RESULT.json) · [四次尝试分别保留](U4_C1_ATTEMPTS.json) · [根因与三项 P2 修复](U4_C1_REVIEW_AND_REPAIRS.md)。Astra 独立只读复核了冻结 SHA、实际 SQLite、12图尺寸和4张关键图；接受范围为本切片工程和受控文字闭环。

## 命令与结果

| 命令（apps/desktop） | 真实结果 |
| --- | --- |
| `npm.cmd run build` | exit0，含 TSC；最终日志 `test-results/ui-goal-20261101/u4c1-final-build-22ae859.log` |
| `npm.cmd run test:renderer-components` | 245/245，exit0 |
| `node scripts/paper-material-handoff-test.mjs` | 21/21，exit0，挂载消费者，含 ABA/同批次导航 |
| `node scripts/paper-material-edit-guard-test.mjs` | 49/49，exit0，含写后回读延迟/失败/只读恢复及反向列表竞争 |
| `node scripts/paper-basket-renderer-interaction-test.mjs` / `paper-draft-decision-interaction-test.mjs` / `desktop-navigation-guard-test.mjs` | 45 / 45 / 16，分别 exit0，不合计为一套产品验收 |
| B及资料相关回归 | hook19/UI15/options-images10/review5、披露6/草稿14及资料切片分别 exit0；命令逐项在最终冻结清单 |
| `node scripts/xiaozhi-agent/owned-file-stage-smoke.mjs` | 并入主线后的8项，exit0，真实临时文件与子进程崩溃边界 |
| `node scripts/ui-goal-paper-material-return.mjs --run-ui --expect-build=037760b8fdba9e8ff75d17287a6971f1fb7b56a83513d01c89db4eb5dc140288` | 最终 Electron6/6，exit0 |
| `npm.cmd audit --json` | exit1，42项：8高/26中/8低/0严重；未改依赖，不宣称修复安全审计 |

项目没有独立 lint/typecheck 脚本；类型检查由真实 build/TSC 完成，没有禁用校验或新增无关工具。初始错误定位、换行搜索等待及缺少来源加载器的命令失败保留，不改写为通过。

## 性能、风险与回退

上轮整合构建→本轮整合构建：renderer 7595.41→7606.15 kB（+10.74），CSS455.42与preload37.71 kB不变；main3700.11→3704.12 kB包含协作者宿主增量，不能全归因于 C1。只复用原读取/偏好持久化，无模型、OCR队列或逐token工作新增。未测 P95/内存/主线程，不以包体积宣称性能达标。

TXT规则抽题不证明自然扫描/图文/数学质量；延迟与失败注入来自挂载消费者，未冒充真实宿主磁盘故障。来源变化拒绝沿原 A/B 宿主合同，未把旧受控边界当成本次新 Electron 故障注入。参考卷蓝图/模板、用途/版式、精确当前卷导出意图、原生 Office 和教师质量仍开放；旧题本的密集表单也不是全页视觉重构已完成。

回退仅限定本切片10个 renderer 文件及其测试/接线，保留所有 B v2 读写、题库、来源、篮、审核/快照、历史与文件；不删数据或改写旧记录。没有迁移或新持久化真源。
