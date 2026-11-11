# 20261111 讲义草稿恢复 R1 冻结交接

## 状态与写集

SOURCE_FROZEN_READY_FOR_ROOT_AFTER_DRAFT_BUILD。root 已要求生产源码冻结，本次只写本文，11文件实际SHA逐项只读核验与static-check.json一致。当前准备after-draft-out正式组合构建，正式GUI及SQLite复验由root/Terra继续。

本根因是已保存QA讲义的说明未保存修改后，经返回列表、同一行重进而丢失。根因首次修复，记作讲义草稿恢复R1。教学布局R1、其他组repair2及原f8d9失败计数均保持原身份。

root release前的构建为source58f7b987/build7f26bc65，build28115正式exit0、125 protected一致、246组件/style9 exit0。上述结果属于该冻结构建，本轮新源码的统一build由root执行。

本修复实际生产写集为2文件。累计清单由原10项扩展为11项，其余9文件SHA与static-check-pre-draft-recovery-R1.json一致。

| 文件 | SHA256 |
| --- | --- |
| apps/desktop/src/renderer/components/TeachingBookWorkspace.tsx | 15597f949e719204573fa7e5880f4dd3e268b5c4c8874305c8da9a0866022a14 |
| apps/desktop/src/renderer/components/teaching-book-draft-state.ts | 84a582141c3a7802991e71183dddf3eeb4caf2a656602f4981020e6eb006a127 |

精确合同与计划分别为CONTRACT-draft-recovery-R1.md、DRAFT_RECOVERY_PLAN.md，授权扩展记录为planned-manifest-draft-recovery.json。最终可审计清单为static-check.json的files数组。

## 实现结果

- 同一已加载讲义重新进入仅展开editorOpen，保持详情与所有挂载输入，不调用loadBook。
- 返回目录时保留当前页面会话草稿，并提示重新打开可继续编辑。列表上有“继续编辑当前草稿”和“放弃未保存修改”的明确入口。
- 不同讲义、新建、手动刷新、显示归档、重新编译预览和归档入口统一检查未保存输入及保存中状态。已有新建草稿再次打开只展开，输入保留。
- 七类本地输入分别比较信息、章节、页面、块、来源、整块patch、选区。块与patch的预填基线独立，原块取消ID继续有明确退出路径。
- 复用原DesktopFrame导航guard，阻止dirty/saving时切页，并保护beforeunload。读取或保存期间编辑区域使用原生inert，避免在旧对象等待新读取时提交旧对象输入。
- 回读使用请求及对象身份检查。保存其他表单后，讲义信息或块草稿继续保留原CAS数字。只有明确的信息保存ACK后的回读接受该字段的已保存基线。
- 新回读的归档、状态、来源、健康和其他元数据使用新真源，仅在保留草稿时携带旧CAS数字。未知ACK即使服务端文字相同，原编辑基线及dirty仍保留，错误反馈继续可见。
- 当前对象最后一次真实读取快照单独保存在组件内存。明确放弃会回到该快照并恢复其当前CAS数字，保留原失败/未知反馈；块取消只恢复该对象最新读取的块事实。已消失的编辑块在保存前显式阻断，避免意外转为新块创建。

## 入口迁移与保留

| 操作 | 定位与行为 |
| --- | --- |
| 返回列表 | 原teaching-book-back；隐藏编辑区并保留草稿 |
| 同一讲义重入 | 原teaching-book-item-{id}；同一已加载身份不重新读取 |
| 继续当前草稿 | 新teaching-book-resume-draft |
| 明确放弃全部未保存修改 | 新teaching-book-discard-drafts；恢复最后读取快照，不写库 |
| 块取消 | 原teaching-book-block-cancel；原清理编辑状态保留，并恢复最新读取块版本 |
| 新建/刷新/显示归档/归档/预览重编译 | 原ID保留，先走草稿保护 |
| 保存讲义与其他业务操作 | 原ID、服务、载荷、版本与权限guard保留 |

所有原data-testid/testId/testPrefix定位属性共205项仍在。UI事件适配的8个入口为新建、刷新、显示归档、讲义行选择、返回、归档、预览重新编译、块取消。原表单26项value/change/disabled绑定严格对照，归档筛选的onChange增加保护并单独记录。

## 已运行验证

| 命令 | 实际结果与范围 |
| --- | --- |
| node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/draft-recovery-dom-test.cjs | exit0，25项；真实React组件DOM、真实DesktopFrame和受控内存host |
| node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/draft-recovery-ast-check.cjs | exit0，24项；15个原写入handler、16条原效果guard、22处本组件宿主调用/载荷与26项字段绑定 |
| 两文件TypeScript Compiler API定向语义检查，无emit | TeachingBookWorkspace.tsx和teaching-book-draft-state.ts均0诊断；报告draft-recovery-type-check.json |
| node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/static-check.mjs | exit0；11文件、7份TS/TSX、4份CSS；205旧定位、73原命名函数覆盖、56宿主调用、14原effect/guard覆盖、20受保护JSX、186原事件/disabled覆盖 |

原73函数中6项因合法UI适配变化在static-check.json明列，其余保持原AST。read adapter为loadBook/loadBooks/refreshCurrent；beginEditBlock增加防覆盖保护；updateBook只增加成功ACK后的信息回读标志；saveBlock只增加已消失块的前置阻断。严格AST检查对后两者消去确切新增UI语句后，整个原写入handler仍逐字打印等价。全部原写库/效果guard和宿主调用参数均严格保留。

初始读取effect保留原loadBooks并添加请求取消cleanup，新增beforeunload effect及DesktopFrame导航guard已逐项对照。当前helper和组件SHA与AST报告一致，组件SHA与DOM报告一致。

DOM覆盖原说明FAIL、标题/年级/语言/状态、同一行零重读、dirty换书/新建/刷新/显示归档/预览、真实DesktopFrame导航、beforeunload、明确放弃、新建正常保存、正常信息保存与CAS载荷、章节/页/来源/块/patch/选区草稿、无关章节ACK、版本冲突、未知ACK、归档只读、块新来源/状态/健康、失效块、正常块保存、迟到读取和取消后导航。

## 永久保留的失败证据

- Terra的final-findings.md中原f8d9说明丢稿FAIL及原截图保留。
- draft-recovery-dom-before.json使用修复前组件和相同说明保留断言，实际FAIL，0项完成；重新进入后实际仍为“已保存说明a”，期望为未保存QA说明。
- draft-recovery-dom-cancel-version-fail.json保留中间失败。新增正常块保存回归发现明确取消后仍沿用旧CAS数字，失败时22项完成。修复将最后真实读取快照独立保留，明确放弃/原块取消恢复其新CAS，之后原断言通过。
- 其他布局级联、canonical初次失败、断点失败和root stale-manifest preflight FAIL继续保持原记录。

## Terra的新构建真实复验

DOM受控host的结果不替代Electron、真实SQLite、真实权限或冷启。原QA讲义的真实断言仍交Terra按新immutable after-draft-out复验。

1. 打开先前QA讲义，记录真实ID、原说明和SQLite版本。改说明为独特未保存文字，返回列表，再点同一讲义，逐字检查保留；SQLite原说明和版本保持。
2. dirty时分别点另一讲义、新建、刷新、显示归档、预览重编译、主导航，检查提示、原对象、版本与输入均保留。
3. 点teaching-book-discard-drafts，核对明确放弃后可切换/新建/导航，SQLite无额外写入，原失败提示按真实回执保留。
4. 重新改说明并用原teaching-book-save保存，验证真实SQLite内容和版本、返回重进、重启读取。再按原完整journeys运行原断言。
5. 兼验辅助草稿与块取消、版本冲突、未知结果，以及新归档/来源状态在保留草稿时仍正确限制操作。

本writer保持源冻结，统一build、正式GUI、SQLite、完整journeys及性能测量待root/Terra新构建结果。回滚限定本次组件补丁和新增纯逻辑文件，统一重建；原业务数据、布局R1和其他writer源码按原所有权保留。

## 累计11文件全路径 SHA256

| 文件 | SHA256 |
| --- | --- |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingArtifactsWorkspace.tsx | c6a63324fc189113fed19bb4b46162826fe87451c47834269427ad97364fab18 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingDeliveryWorkspace.tsx | 2386b7acdc9dca57b60a6e128b9fa217960b97937de4772b23e10871e2042c02 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeacherNotebookWorkspace.tsx | f63b979c271076859fd406f93b6d38ed94d2168e307435a1ce0dca32cc15b751 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeachingBookWorkspace.tsx | 15597f949e719204573fa7e5880f4dd3e268b5c4c8874305c8da9a0866022a14 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/QuestionNotebookWorkspace.tsx | aff2d8475cbf074c80385e689354afb3b6517d5685a181ff6ee9a41a2e22813a |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/ClassroomWorkspace.tsx | 21fad6252282f93de91f1db7ab73de3fc78e422e3799aa5814be6a7cb29d2e15 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/teaching-book-draft-state.ts | 84a582141c3a7802991e71183dddf3eeb4caf2a656602f4981020e6eb006a127 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-catalogue-alignment.module.css | 9cdf014f6a16fdfdc35603ead9b41eaadae8d596d920320ea7ffac8764eeef6d |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-editors-alignment.module.css | 43a1f868ec0870dc85e463add9d5c294afe7254ec1ef34abb51924c0cfcd3d47 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-question-alignment.module.css | 553110d3dead9b7c7ab17034e9a8d35d891dec09a8629d23fb16ff2c1c1963b8 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-classroom-alignment.module.css | 830b2ed7304fcf19853dc5a20dcc1e0312a2d02e95c8dad62c29d99b25b4bbd7 |
