# 文件夹后台定稿等待版面发布

## 根因与修改

PDF 入库先发布正文与页回执，再完成文档结构。后台 AI 在这段间隔遇到 `source_incomplete`，把当前页移入待核并推进游标。结构随后成功也不会重新调度该页。

- `material-ai-structure-source.ts` 区分同版本结构正在生成、已发布与终态失败。 `material-ai-repository.ts` 在启动块识别前检查版面状态，在冻结结构上下文时再次检查。
- `material-folder-ai.ts` 将等待页保存为现有 `pending_local` 状态。保持游标、批次授权和已用额度，版面发布后沿原计划创建子批次。记录等待前核对批次状态、授权版本、资源版本和游标。重复检查复用同一记录。
- `material-ai-ipc.ts` 和 `MaterialAiPanel.tsx` 给单页手动整理显示本地版面正在处理。目录后台处理沿现有等待计数显示。

## 前后对比

从原桌面入口导入包含一份双栏 PDF 的目录，复用 PDFium、RapidOCR 和结构工作器此前产生的真实页数据及图片。在独立备份副本控制结构状态，模拟正文先于版面发布。测试 HTTP 完全在本机拦截。

| 检查 | 旧版 `9d04543` | 整合后 |
| --- | --- | --- |
| PDF 正文已就绪，版面尚在处理 | 1 页待核，0 页等待 | 0 页待核，1 页等待 |
| 等待期间额度和请求 | 0 次预留、0 次调用 | 0 次预留、0 次调用 |
| 版面完成后 | 重启仍停在待核，0 个子批次 | 重启保留暂停，点击继续后同一页生成 1 个带完整结构回执的子批次 |
| 原件及结构页 | 保留 | 原页记录逐字段一致 |

桌面新流程有 1 次请求抵达本地拦截器，外部传输和付费均为 0。此证据覆盖调度、授权与来源绑定。模型定稿正确性仍按自然题验收。当前未进行规模性能计时。

## 测试

- `npm run build -- --outDir test-results/build-structure-wait-main` 与 `npm run test:renderer-components` 通过，组件 **253/253**。在同一冻结构建运行 `node scripts/electron-smoke.mjs`，**207/207**。
- `kb-folder-pdf-publication-boundaries.mjs` **24/24**。使用旧提交的两个生产模块执行同一新测试，复现 1 页误入待核。新版本验证持久等待、暂停、冷启及仅调度一次。
- `ai-structure-source-boundaries.mjs` **18/18**，包括本地双栏 PDF、原有位图和补回的选项。 `kb-ai-page-boundaries.mjs` **250/250**、`kb-folder-ai-boundaries.mjs` **18/18**、Word 后台升级 **13/13**。独立旧数据库策略迁移脚本需要指定旧库，本轮没有适用夹具；本次代码复用既有状态，无表结构迁移。
- 在 `apps/desktop` 设置 `OMNI_EDU_TEST_BUILD_ROOT` 指向冻结构建。执行 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-folder-structure-wait-electron.mjs <已有结构验收数据根>`。使用上一轮构建加 `--baseline` 可复现旧窗口行为。测试夹具最初的本地模型清单和展开处理队列入口已修正，前两次分别停在账户校验和界面导航，均早于批次授权。
- `npm audit --omit=dev --audit-level=high` 有 23 项存量通告，其中 8 项 high。依赖文件无改动。

## 自然资料剩余断点

实际《风华初三三模模拟测试卷》第 1 页的 OCR 页回执可正常认证。SQLite 中 14 个同页分块处于 0、1、10～21 的来源偏移，中间有其他页的历史正文。建批把首个偏移和同页记录数交给连续正文窗口，误读第 2 页后报 `source_incomplete`。第 2 页还触发 `unit_too_large`。已保留这次真实桌面失败。优先修复页级精确来源选择和大页引用边界，再继续自然题定稿、检索和正式组卷。旧版已经记为不明原因 `source_incomplete` 的历史页保留原状态。

回退可撤销本轮代码。原件、原题、原结构回执和模型账本无迁移。运行中的等待页应使用支持该状态的版本续跑。
