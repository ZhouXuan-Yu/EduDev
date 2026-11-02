# U4-A 持久手选组卷：桌面验收

日期：2026-11-02。**本切片功能验收通过，完整 UI Goal 尚未完成。** 测试源码为 `8baf5939d7c0085ba3c830330b2adffb71dab85a`，最终 QA 包含独立 DOM/异步恢复修正；实际 out 的 455 文件指纹为 `20eed7fccb81ba0ec06ad7ede7ca23f6e2896eb46a3a747d1ed72f335ee6e353`。后续未提交的 B 宿主和导航修复未编入这个构建，不冒称已经桌面验证。

## 教师已能使用的功能

从教学工作台进入找题，使用现有真实题库筛选完整题目，加入同库持久题篮；可调序、移除、重新加入、跨分节移动和修改蓝图。预览绑定同一题篮修订，学生版没有答案 DOM，教师版通过组件卡片查看答案与来源。明确保存快照、教师确认后出现原六类导出入口。实际导出文件另验，不以出现按钮代替导出成功。

原应用前进/后退、返回工作台、冷启恢复同篮/顺序/来源版本/筛选偏好，以及归档保留旧篮只读、新建独立空篮均已实际执行。原自动组卷、历史、三来源策略、原审批与数据持久化保留。

## 真实执行结果

cwd：`D:\WorkProject\EduProject-sidebar\apps\desktop`。

| 命令 | 实际结果 | 范围 |
| --- | --- | --- |
| `npm.cmd run build` | exit 0，含完整 TSC | 8baf593；仍有原大包/未使用导入警告 |
| `npm.cmd run test:renderer-components` | 240/240、exit 0 | 同一整合源码；不覆盖随后 B/导航改动 |
| `node scripts/education/paper-basket-boundaries.mjs` | 43/43、exit 0 | 同库 owner、CAS、幂等、版本及导出安装拒绝边界 |
| `node scripts/ui-goal-paper-basket.mjs --run-ui --from=test-results/ui-goal-paper-9G2OGc --active-session=aisession_8b649d13-87fc-4285-b1a1-e8e69e942300 --owner=aisession_7a4a1a6c-ad0d-4614-bef7-33b9be2322b2 --questions=question_d0ed2e88-704b-4b96-90f1-d4f880ab7e10,question_5326992e-9786-418b-829e-8be64ee8e237` | Actual7：10/10、exit 0 | 真实 Electron，真实入库的受控文字题，独立字节副本及新 profile；1366×768 / 1920×1080 共 12 张截图 |
| `node scripts/ui-goal-paper-basket-cold.mjs --run-ui --from=test-results/ui-goal-paper-basket-Trfuaj` | 3/3、exit 0 | 原失败副本的独立冷启诊断；不与完整 10 项累加 |
| `npm.cmd audit --json` | exit 1，45 项：8 高、29 中、8 低 | 无新增依赖；既有漏洞未解决 |

Actual7 原始报告为本机 `test-results/ui-goal-paper-basket-NXf0Yk/report.json`，命令日志 `test-results/ui-goal-20261101/u4a-actual-ui-attempt-7.log`。摘要和截图哈希见 [accepted.json](evidence/u4a/accepted.json)，历史失败见 [attempts.json](evidence/u4a/attempts.json)。原件副本和 out 前后指纹完全一致，持久模型账本未新增，renderer 错误与 firstWindow 后观察到的网络请求均为 0；不把观察前的启动网络称为已拦截。

启用态文字对比度实测：搜索 17.72，保存快照 10.42。实际 Tab→Enter 展开答案、Escape 保留触发器焦点、Enter 收起；组件支持的 Escape 语义保留，未强改 vendor。页面无原生 details/summary。父已目视复核整理、教师预览、冷恢复、归档截图；教师视觉接受、物理指针和系统 DPI 另列。

[完整题目 1366](evidence/u4a/accepted-run/full-question-selected-1366.png) · [整理 1366](evidence/u4a/accepted-run/organized-1366.png) · [学生版 1920](evidence/u4a/accepted-run/student-preview-1920.png) · [教师页签/焦点 1920](evidence/u4a/accepted-run/teacher-preview-1920.png) · [冷恢复 1366](evidence/u4a/accepted-run/cold-restored-organize-1366.png) · [归档 1920](evidence/u4a/accepted-run/archived-readonly-1920.png)。教师截图处于键盘回归后的答案收起态，不冒称截图本身展示了答案全文。

## 已修复与仍有边界

- 源码修复包含隐式自动模式切换、空篮蓝图明确放弃和多图布局恢复；原回归及独立复核按各自冻结版本保留。具体宿主门禁见 [宿主记录](U4_A_HOST_VALIDATION.md)。
- Actual1～3 分别因嵌套控件定位、旧 OR 检索第一页假设、嵌套标题定位失败；Actual4 因返回时读到未恢复的空壳失败。未删除截图、完整题面和唯一性断言来通过。
- Actual5 发现会话打开与快速切模块竞争；新增修复另有 29 项受控回归，尚不属于本构建的实际验证。
- Actual6 冷启期间出现空身份；独立证实旧 QA 跨 await 未复查当前 DOM、会把旧节点/加载态当成功。新门禁在宿主返回后核对同一连接节点和实际可用状态；独立冷启与完整 Actual7 通过。原次生产清空的精确触发者仍未证明，不把 QA 修复称为已修复生产根因。Actual7 首次启动诊断截断了 916 条早期事件，不用其声称完整归因；冷启段没有截断。
- 归档预览的缺额提示与只读原因区分、归档内容重复呈现已交 B 界面统一处理；未据测试通过声明整体视觉已经理想。
- U4-B 的本卷内容编辑与六类真实输出、C/D、无考试用途及完整教师/ChatGPT 对照仍待；B 宿主当前为未交付增量，不由本页关闭。

性能仅确认没有新模型调用/全库扫描，UI 偏好不增加内容 revision。没有新的 P95、主线程或自然题库质量结论。回退用本切片提交的限定范围 revert，保留新增表、原篮及回执；不得删除数据或以旧仅读器覆写随后升级的 v2 篮。
