# 已核对结构题的后台配答

老师核对并保存完整题面后，已关联的独立答案册可以在后台补齐题库的答案或解析。匹配沿用保存的双遍原页凭据、试卷标题和题号，结果保留答案册标题、页码及原页入口。

## 持久化和保护

- `material-structure-book-work.ts`、`material-book-answer-work.ts` 和 `material-book-answer-index.ts` 接入现有本地配答执行器。保存完整题面触发单题入队。启用题册关联时按 ID 分批发现，迟到答页仅唤醒受影响题号。解绑清理待办，已应用日志继续可查。
- `material-book-answer-repository.ts` 在写回事务里核对工作令牌、题目版本、配对修订、来源和当前答案索引。自动任务的冲突只留下待核记录。已有教师答案出现分歧时保留；已有解析无法和答案册核对时，把拟补答案留在待核记录。
- `material-original.ts`、`material-repository.ts`、`material-structure-repository.ts`、`material-ai-repository.ts` 和 `db.ts` 复用同一原文件物理身份的校验结果。每次使用仍检查原件身份，身份变化后重新计算全文件摘要。原件、结构页和答案回执继续使用原有权限与真实性校验。
- `QuestionStructureBookMatch.tsx` 与 `question-book-answer.ts` 让已展开的答案区域更新待办状态、写回结果和待核理由，同时保留手动匹配。

## 验证

| 证据 | 结果 |
| --- | --- |
| 本地真实 Electron 与受控排印 PDF | 教师从题本核对含图和小问的题目并保存完整题面，后台暂停时任务落盘，应用重启后自动补齐两项。原图和完整转写逐值一致，独立答案册第 1 页可以打开，小智使用的题源接口读回成功，新增模型请求 0 |
| `kb-structure-book-boundaries.mjs` | 结构题 17/17，兼容原 AI 页匹配 36/36。包含晚到答案、抢占、重启、解绑、历史草稿、冲突保留和重试 |
| `kb-book-document-boundaries.mjs` | 独立答案文档 7/7 |
| `kb-ai-page-boundaries.mjs` | AI 原页、OCR 与归档 249/249 |
| `npm run test:renderer-components` | 253/253 |
| `npm run build -- --outDir test-results/build-structure-auto-book-final` | 整合最新版主线后的冻结构建通过 |
| `node scripts/electron-smoke.mjs` | 独立复查前构建通过 207 项，复查修补由最终冻结构建和专项验收覆盖 |
| `npm audit --omit=dev --audit-level=high` | 23 项存量通告，含 8 项 high。依赖文件无变更 |

桌面验收命令为 `node --experimental-transform-types scripts/education/kb-structure-auto-book-electron.mjs <已授权的本地临时排印 PDF 验收根>`，通过 `OMNI_EDU_TEST_BUILD_ROOT` 指向冻结构建。答案页回执绑定原文件物理身份，复制 PDF 会触发来源变化。正式回归在自有临时验收库原位置运行，先保存 SQLite 快照，并保留最初复制场景的失败证据。

最终冻结构建从重启到答案在题本可见约 2.145 秒，包含 Electron 启动和题本打开。上一版依赖教师点击，无法用同一路径比较。受控验证中对同一文件身份检查 100 次仅需一次全文件摘要。迟到答页从重新扫整册改为仅扫描受影响题号。自然大库的处理时长仍需实测。

## 剩余与回滚

资料全文默认检索仍可能命中结构重建前的历史分块。接下来治理默认可见性并保留既有引用。出版物自然样本的检索指标、混合目录规模、正式组卷和安装迁移继续按 KB-A01～A10 验收。

设置 `OMNI_EDU_BOOK_ANSWER_WRITEBACK=0` 可暂停新增配答写入，待办和已保存答案来源仍可读。需要降级时，先使用升级前数据库备份。新表保存待办，答案和审计仍由既有题库与归档日志持有。
