# 多空答案分隔与本地恢复

本轮修复通用格式误判：明确两空的填空题中，模型用分号、答案册用空格分隔相同的两个答案，原先会被判为答案冲突。真实既有目录记录通过原匹配按钮恢复后，12题由6可用/6待核变为8可用/4待核，仍11份完整题文。原模型响应及引用没有重写，未新增云请求或OCR重放。

剩余3道首稿与最终稿的实质答案变化和1道图文完整性问题继续隔离。**自然全质量仍FAIL，完整Goal ACTIVE**。本报告不是120题独立留出、200查询、三套正式蓝图、真实10→40GiB/72h、Windows安装或异机迁移验收。

## 实现与边界

- `material-answer-slots.ts`新增有界纯比较器`printed-fill-slots.v1`：只在填空题且有2～12处明确下划线空位时，按相同数量拆分并保序严格比较token。数字、数学符号、顺序、单位不推断，比较器不改写输入。后续原配答writer仍保留before并写回书册答案，模型原始回执不变。其它情况沿原字面比较。
- 新`BookReferenceRecord.comparisonPolicy`随原context摘要保存，发布、可信冷读和裁图重检使用同一冻结策略。旧无字段记录维持严格字面，未知策略拒绝，模型不能自己声明比较版本。
- `material-book-fill-recovery.ts`证明旧问题仅有宿主派生的分隔符冲突：完整来源文档、未编辑、两遍均AI角色且无自报疑点、当前字段与最终稿一致、与唯一双读书册同序等价。原source校验仍由宿主执行。
- `MaterialBookAnswerRepository`复用原writer/journal保存before/after及`slotRecoveryPolicy`，只移除这一条误判并写入book角色；冷读重新证明。删除/未知版本证据、真实变化、其它疑点、教师/source角色继续拒绝。没有新增表、IPC、依赖、后台服务或界面入口。
- 新policy纳入原匹配幂等键，允许既有held误判被显式恢复；重复已应用匹配不增加journal。不直接改SQLite或重放历史收费请求。

实施前合同：`docs/goal/KB_IMPLEMENTATION_CONTRACT.md`的2026-11-09 M05段。原6/6证据保留在[上一轮报告](../../20261108/known-answer-publish/README.md)，新的8/4不会覆盖该轮失败。

## 验证

所有命令工作目录为`C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject\apps\desktop`。原始日志保存在本目录，以下组数有导入重叠，不累计冒充独立用例。

| 命令/用户路径 | 结果 | 证据 |
| --- | --- | --- |
| `node --experimental-transform-types scripts/education/kb-answer-slot-boundaries.mjs` | 25组PASS | `slot-boundaries.log` |
| `node --experimental-transform-types scripts/education/kb-book-fill-boundaries.mjs` | 新恢复13组及原配答36组PASS | `book-fill-boundaries.log` |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 引用53、原页245/配答36组PASS | `reference-boundaries.log` |
| `npm run build`（含TypeScript） | PASS，exit0 | `build.log` |
| `npm run test:renderer-components` | 246/246，exit0 | `renderer-components.log` |
| `node --experimental-transform-types scripts/education/kb-book-reference-journey.mjs --publish-conflict` | 实际受控递归PDF双线、本地OCR、答案先行、首次发布即隔离真矛盾、Pi/paper门禁、双尺寸/冷启5组PASS，exit0；8次受控响应，真实云0 | `publish-conflict.log` |
| `node --experimental-transform-types scripts/education/kb-natural-book-pair-journey.mjs "$env:TEMP\omni-natural-paired-quality-miHb1y" "$env:TEMP\omni-natural-books-62sbkdoe" --cold-read --rematch-saved` | 本地匹配/目录/冷启5组，integrationSuccess=true；因qualitySuccess=false按原约定exit1，没有放宽断言或重复派发 | `natural-rematch.log`、`natural-summary.json` |
| `node --experimental-transform-types scripts/education/kb-natural-book-source-journey.mjs "$env:TEMP\omni-natural-paired-quality-miHb1y"` | 全12题来源、8可用/4拒绝、双尺寸及二次冷启3组PASS，exit0，renderer错误0，paid/ref/question字节不变 | `natural-source.json`、`natural-source.log` |
| `node scripts/electron-smoke.mjs` | 同一冻结构建207/207，exit0，无失败；前后SHA一致 | `electron-smoke.log`、`build-before.json`、`build-after.json` |
| `npm audit --json` | exit1，28项：8high/12moderate/8low/0critical，与上轮相同；本轮未新增依赖 | `npm-audit.json` |
| 仓库根`git diff --check` | PASS | 收尾复核 |

只读实际SQLite journal另核对2条恢复：before均ai_needs_review/唯一answer_conflict，after均book_enriched/无疑点，答案角色AI→book，原图片块和题面projection一致，见`natural-recovery-journal.json`。

自然来源检查阻止了2次无body的模型目录GET；没有实际出网、模型请求或OCR重放。既有自然记录历史真实调用5次、84849 tokens，本轮增量0。提交仅包含元数据/状态/摘要，不包含自然题目文字、答案、裁图、原PDF、模型原始响应或自然截图。

## 保留失败

- `before-slot-comparison.log`：旧比较器对分号/空格返回false，先保留失败再实现。
- `fixture-invalid-source-block.log`：新受控完整文档fixture误将sourceBlockIds绑定文本；原validator正确拒绝。修复为有受控asset ID/SHA及锚点的图片块后通过，未放宽业务校验。
- 根目录误运行tsc、重复desktop路径及首次误取`preload/index.js`是命令错误；正确构建/测试在desktop运行，摘要改取实际`index.cjs`，不将失败命令算产品或有效验证。没有修改依赖或用户数据。
- 自然质量FAIL及旧6/6报告保留，8/4局部改善不代表逐字/OCR/数学独立正确。

## 性能、兼容和回滚

冻结产物见`build-before.json`。相对844b502基线，main由4337174增加至4341753B，增4579B（约0.106%）；SHA为`7298cff9cbca050ce421a952b16ab1142784ac7552febdd0e62f490fc3293293`。preload仍40997B、renderer主chunk仍7929797B，二者SHA均不变。比较器只在已存在每页最多20题的流程内执行，题面/答案长度及空数有界，不增加模型轮次；没有真实吞吐、峰值内存或P95前后对比，不能据此宣布性能验收。

`OMNI_EDU_BOOK_FILL_SLOTS=0`停止新比较策略和新误判恢复。已保存新证据继续按冻结版本重验，旧无policy记录语义不变；原件、旧题、引用和回执不删除。关闭新恢复及删除/篡改policy的负向用例已通过。未验证旧二进制降级，若需代码回退应在当前main上正常revert本轮功能并保留全部数据，不强推、不直接回写归档状态。

下一工作沿`KB_EXAM_ACTIVE_TASK.md`处理通用图文完整性及真实冲突的教师修正，再推进完整质量、检索、组卷、大库、安装迁移验收。不得继续把同一开发页的局部通过当完整功能落地。
