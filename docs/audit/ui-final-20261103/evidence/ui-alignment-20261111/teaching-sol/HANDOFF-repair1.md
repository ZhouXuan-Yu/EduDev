# 20261111 教学 R1 最终冻结交接

## 状态与计数

SOURCE_FROZEN_READY_FOR_ROOT_BUILD。生产源码已冻结，本次仅重跑原 static-check.mjs 并刷新十文件清单和本文。教学 R1 对应源9c6202ad/buildf8d943a7的教学文件首屏 FAIL，一次针对性去重修复。其他组的 repair2 计数沿 root 记录。

累计写集仍为精确10文件，本 R1 修改其中3文件，其余7文件 SHA 与 pre-repair1 清单一致。当前 static-check.json 的 files 数组已与实际十文件逐一重新核对。catalogue CSS 实际、manifest 与 canonical geometry 报告三者 SHA 一致，均为 9cdf014f6a16fdfdc35603ead9b41eaadae8d596d920320ea7ffac8764eeef6d。

root 此前严格 preflight 发现旧 manifest 中 CSS SHA 滞后，该次 FAIL 由 root 保留。本次重跑恢复清单一致性，原 guard 及生产文件均保持当前冻结状态。

## R1 改动与根因

Terra 的 final-teaching-cascade.json 记录容器1047px、两列400.297px/622.703px，旧 teaching-files.module.css 同 specificity 后加载获胜，标题也被旧26px规则覆盖。原截图、final-findings.md、r1-css-readonly.json 和 R1_PLAN.md 保留各自失败身份。

教学文件页已解除旧 teaching-files.module.css 和 teacher-library.css 的直接接入，原组合层双绑 class 归一到 teaching-catalogue-alignment.module.css。整包页同步移除旧 teacher-library 根、heading/grid/detail/count/actions 布局 class。新模块承接必要 toolbar、search外层、count、actions、详情标题和预览容器布局。默认单列，宽窗已选对象的双列放入min-width1101px的明确范围，窄窗沿默认单列。

旧 teaching-files.module.css 原文件保留。静态扫描确认 renderer 源码中的消费者为0。ResourceTable 原源码、官方控件、Pi组件、原业务 handler 与 data-testid 继续沿原接线。

| 本R1修改文件 | 当前SHA256 |
| --- | --- |
| apps/desktop/src/renderer/components/product/TeachingArtifactsWorkspace.tsx | c6a63324fc189113fed19bb4b46162826fe87451c47834269427ad97364fab18 |
| apps/desktop/src/renderer/components/product/TeachingDeliveryWorkspace.tsx | 2386b7acdc9dca57b60a6e128b9fa217960b97937de4772b23e10871e2042c02 |
| apps/desktop/src/renderer/ui-system/teaching-catalogue-alignment.module.css | 9cdf014f6a16fdfdc35603ead9b41eaadae8d596d920320ea7ffac8764eeef6d |

## 实际静态验证

原命令 node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/static-check.mjs，本次最终 exit0。

- 6份TSX解析、4份CSS解析、全部CSS module类引用通过。
- 205个旧 data-testid/testId/testPrefix 定位属性保留。
- 原73份命名函数、56处宿主调用、14处effect/guard、20处受保护JSX和186处原事件/disabled属性对照通过。初始讲义5处提示文案替换仍单列，R1仅调整布局接入。
- 当前 files 数组10项、无重复，逐项实际SHA一致。

canonical 命令 node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/repair1-canonical-geometry.mjs，最后一次实际 exit0，28检查、24合成几何样本通过。该报告的 sourceCssSha256 已与本次 manifest 和磁盘实际CSS核对一致，本次冻结后只读核验报告。

canonical 检查使用本地 Vite CSS Modules 预处理和静态DOM选择器匹配。旧双绑类负控制重现两条最高 specificity 候选与旧双列/26px获胜。当前单模块接入在1366/1920/800、空态/已选、旧CSS置前/置后共24组合中，grid与标题均有唯一最高 specificity 候选。空态详情display none，单列占满合成容器；已选双列与间距守恒。1366/1047采用Terra实测容器宽作为静态输入，其他容器尺寸为合成样本。产物模块CSS保存在 repair1-canonical.module.css。

canonical 初次选择器引擎不支持无关focus-visible选择器，修正为仅检验目标属性的规则；原失败保存在 repair1-canonical-geometry-initial-fail.json。随后检查暴露同模块宽窄断点的两条同 specificity 候选，已把双列声明限定到明确宽窗范围；该次原失败保存在 repair1-canonical-geometry-breakpoint-fail.json。原断言和唯一候选要求保持，后续结果单独记录。

## 后续验收与边界

当前仅静态检查通过。root下一次统一正式构建与Terra实际winner、矩形、三尺寸及教学文件/整包真路径复验继续执行。此前源9c6202ad/buildf8d943a7的工程结果保留其身份，教学首屏原FAIL永久归档。性能、正式GUI与业务结果由新的冻结构建验证。

MIGRATION.md 的新父入口继续有效。source-candidates 前打开 question-notebook-filter-toggle，分类创建前打开 question-notebook-category-toggle 中确切“分类管理”按钮，原教师核对、来源、题号、分类关联与题篮断言继续运行。

回滚按本R1三文件的限定补丁并统一重建。repair1-source-before.json 保存R1前十文件源与SHA，static-check-pre-repair1.json保存前轮清单。原业务数据与其他writer源码按原所有权保护。

## 累计十文件全路径 SHA256

| 文件 | SHA256 |
| --- | --- |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingArtifactsWorkspace.tsx | c6a63324fc189113fed19bb4b46162826fe87451c47834269427ad97364fab18 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingDeliveryWorkspace.tsx | 2386b7acdc9dca57b60a6e128b9fa217960b97937de4772b23e10871e2042c02 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeacherNotebookWorkspace.tsx | f63b979c271076859fd406f93b6d38ed94d2168e307435a1ce0dca32cc15b751 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeachingBookWorkspace.tsx | c60180a84265db38c8a5ff2effaef46506e68af54f5e75e3216ee3a556a8bc53 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/QuestionNotebookWorkspace.tsx | aff2d8475cbf074c80385e689354afb3b6517d5685a181ff6ee9a41a2e22813a |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/ClassroomWorkspace.tsx | 21fad6252282f93de91f1db7ab73de3fc78e422e3799aa5814be6a7cb29d2e15 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-catalogue-alignment.module.css | 9cdf014f6a16fdfdc35603ead9b41eaadae8d596d920320ea7ffac8764eeef6d |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-editors-alignment.module.css | 43a1f868ec0870dc85e463add9d5c294afe7254ec1ef34abb51924c0cfcd3d47 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-question-alignment.module.css | 553110d3dead9b7c7ab17034e9a8d35d891dec09a8629d23fb16ff2c1c1963b8 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-classroom-alignment.module.css | 830b2ed7304fcf19853dc5a20dcc1e0312a2d02e95c8dad62c29d99b25b4bbd7 |
