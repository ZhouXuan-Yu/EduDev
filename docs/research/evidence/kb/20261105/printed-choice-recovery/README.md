# 印刷选择数量、图文分组及付费首稿恢复

补充零云诊断：答案册22条两遍一致，其中19条无局部问题；题面来源契约仍使正式配答为0。下一应先解决来源前缀/正文归档及匹配上下文，不能把全部问题归因于模型不会解题，也不能重复付费抄答案。

## 交付与结论

实现了三个实际缺口：新标准/质量输入冻结printed-choice-count.v1，原OCR与两稿页首明确题号范围一致才检查单选/恰好/至少数量；复核裁图校验补传已冻结figureCropPolicy，避免正文/插图正确分组被误判source_changed；原资料页新增显式retry_source，保留首稿、裁图、原授权与预算，仍重新验证原件/权限/SHA/配置，结果未知、其他失败与超额不重发。恢复同时更新目录派生状态，旧失败投影可沿原重新授权纠正。无新依赖、服务、模型轮次、数据库表或IPC通道。

**自然质量FAIL：12题全待核，完整题目文档0，已知答案正式写回0。** 不能将工程检查、HTTP200或同模型一致称作知识库已可交付。完整Goal、KB-A01～A10、120自然留出、200查询、三套蓝图、40GiB/72h、普通Windows安装/换机全部OPEN。

## 真实自然资料与失败

- 用户原主书第4页、答案第3页，抽成独立PDF置于三层子目录。抽页前后1400px像素完全相同，原两本PDF摘要未变。只上传选定页/必要裁图；不改原件或逐题手改样本。PDF、图片、数据库、OCR正文、模型答案/推理和账户均留本地，不纳入Git。
- 首稿真实HTTP200、12题。已冻两段印刷要求与本地OCR一致，第4题单选却答多个字母，第10题至少两个却答一个：新门禁准确产生answer_conflict。第6题数量合法但答案仍与印刷答案不同；这条规则不能验证物理推理。
- 原22组裁图及OCR收据有效，但复核读器漏传figure策略，把第4/5/6题的3/3/4组错算成1/1/1。保留失败；零云重放同一首稿/收据，修复后12题22组全部能构建复核消息，未放宽box、SHA或归属。见crop-review-before/after.json。
- 真实UI在原批次调整目录预留到6（每单元最多3；解答实际仍限5），点击新重试按钮，复用原首稿及全部裁图，完成剩余4次请求；总5次HTTP200、116669 tokens，单次约9.4～26.6秒。首稿SHA与22组收据SHA不变。该数字只是本次成本，不证明效率提升或自然质量。
- 两稿最终来源字段与选块均一致，页文也一致，但12题正文均未通过本地OCR对照。实际首个差异含题前印刷标签、出处括号/星标；不能推断后文无数字/单位错误，更不能直接删前缀或放宽全文门禁。答案册也待核；配答journal为空，不能称已成功补答。见quality-diagnostic.json。
- 新重试曾使底层两单元已review，而目录仍保留failed/source_changed。继续修复同事务投影与旧失败刷新后，真实UI零云重新授权、双尺寸及冷启均为2待核/0失败，五次调用账本、全部原稿/裁图/规范题逐字不变。最终构建的folder-reconcile-report.json是最新调度状态；natural-pair-report.json中的folderResult是修投影前快照，不是当前状态。

## 验证

| 检查 | 结果及范围 |
| --- | --- |
| 页归档/来源/计费/恢复 | 171通过（新增17）；包含相邻正文插图、篡改拒绝、保留首稿恢复、仍失效不发云、未知/超额不重发、父任务及paused/scope_changed |
| 目录调度 | 13通过，包含原重新授权后纠正旧失败投影，不新建子任务或增加调用 |
| 正文 | 21通过 |
| 配答及结构化来源 | 30+7通过，受控收据，不是自然质量 |
| 组件 | 246/246通过，前端最终代码一致 |
| build/typecheck | 通过，见accepted-build.log |
| 最终同构建共享Electron | 207/207通过 |
| 自然导入/显式重试/原稿保留/冷启 | 5项集成检查通过，实际5次解答；质量FAIL，退出1 |
| 最终构建零云父任务校准/冷启 | 2项通过，0解答发送；2次/models探测被本地拦截，未转发网络，不计作解答请求 |
| audit | 28既有漏洞：8高12中8低0严重；依赖与锁文件未改，未声称修复 |

自然集成检查的12题数量和单题状态来自SQLite读回，UI实际覆盖递归导入、角色配置、授权、来源失败重试及双尺寸目录状态；未逐张操作12个题卡、未确认完整自然题/正式试卷可用。初版脚本检查文案过宽，已据实际动作更正证据副本并保留说明。

实际命令（工作目录apps/desktop，PowerShell的$env:TEMP均为本轮隔离目录）：

```powershell
npm run build
npm run test:renderer-components
node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs
node --experimental-transform-types scripts/education/kb-folder-ai-boundaries.mjs
node --experimental-transform-types scripts/education/kb-crop-body-boundaries.mjs
node --import ./scripts/office-agent/register-source.mjs --experimental-transform-types scripts/education/kb-book-document-boundaries.mjs
node scripts/electron-smoke.mjs
npm audit --json
node scripts/education/kb-natural-book-pair-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" "$env:TEMP\omni-real-material-NGRlNr"
node scripts/education/kb-natural-book-pair-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" "$env:TEMP\omni-real-material-NGRlNr" --resume-source
node scripts/education/kb-natural-book-pair-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" "$env:TEMP\omni-real-material-NGRlNr" --cold-read
node scripts/education/kb-natural-pair-reconcile.mjs "$env:TEMP\omni-natural-books-62sbkdoe"
```

build后直接执行同一electron-smoke.mjs，等价运行test:smoke脚本的两段，未为了命令名字重复付费或再跑桌面。根目录另执行git diff --check；日志、失败、摘要及manifest保留。真实命令不能对同一账本直接重跑；脚本会拒绝未审核的付费重放。

保留的脚本错误：首次误选处理模式控件，0模型调用；受控分组夹具最初没有制造真实分组差异，后按实际几何构造，SHA篡改在图像层验证而不是误要求纯元数据格式检查认证像素；自然结果初版查询不存在的journal.status列，修为payload_json内state/reason后仅零云续读；零网络校准初版将被拦截的/models探测误计为云解答，修正分账并保留失败日志。均不改用户题页或付费响应刷通过。

## 代价、下一步与回滚

最终体积见accepted-build.json（相对02e2f98），preload不变；renderer仅增加原重试按钮。热合成12题页的数量检查P95为0.0992ms/页（禁用旧分支0.0016ms/页），仅纯函数，不含OCR、图像、来源认证、SQLite、IPC、模型或检索，不是大库性能。没有40GiB或自然质量提升结论。

下一优先修通用来源还原：把来源版面/印刷标签与题干、已知答案及AI推导的契约分清，复用现有布局/OCR和完整题文档，按原图与独立来源修复可证明的遗漏/误分组；不逐页改验收书、不按题号硬编码、不把OCR置信度或模型一致当真值。解决自然正文归档和已知答案参与解答，再扩展留出、检索、组卷及规模/安装移植验收。

回滚：OMNI_EDU_AI_PRINTED_CHOICE_COUNT=0只停新策略，保留冻结读器、全部原始收据与隔离事实；重试仍受原预算与来源守卫，可沿原暂停。不得删除冲突、裁图或已付费稿恢复资格。旧二进制降级未验；不退回忽略figure策略的错误校验器。
