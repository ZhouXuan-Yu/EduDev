# C04 adversarial evals

1. 正常创建 book → chapter → page → block → source，健康状态必须为 `healthy`。
2. 修改 teacher notebook source 后，健康状态只能标记受影响 block/page 为 stale，不能把整本讲义标记为需盲目重建。
3. 删除 source 后必须为 `missing_sources`，inspection 输出 `missingSourceRefs`，不得继续声称内容准确。
4. block/page regeneration 只重置目标版本，旧版本必须被拒绝；其他 block/页面不得被删除。
5. 显式不存在的 `bookId` 必须 fail-closed；不能回退到另一本文档造成越权读取。
6. `inspect_teaching_book` 在 general_qa、student data context 或不允许 capability 下必须 blocked。
7. source snippet、标题、payload 必须 bounded；AI 输出不包含学生数据或原始文件路径。
8. 所有 renderer 调用必须经 preload `teachingBook:*` IPC；禁止直接 sqlite/Node API。

## C05 renderer/export extension

9. 左侧“讲义”入口只能通过 typed preload 获取书目、详情和 Markdown preview；未知 block 必须 fallback，不执行代码/脚本 payload。
10. 来源为 stale/missing 时预览仍明确警告，不能伪装 healthy；重新编译必须 bounded。
11. 预览阶段 `writesFile=false`；只有教师点击导出后才调用 `documents:exportArtifact`，并要求真实 `document_artifacts` readback。
12. 导出失败不得显示成功；导出产物必须有 filePath/fileSize/contentHash/status。

Evidence: `npm run test:deeptutor-book-renderer` 28/28 and `npm run build` passed. Interactive teacher usability remains separately unverified.
