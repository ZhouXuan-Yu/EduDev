# R13 Attached-source ExploreContext eval

## Contract

复用 DeepTutor `UnifiedContext.source_manifest` / `read_source` 的按需读取
原则，在 Omni-Edu 中只开放已绑定学生记录上的附件 source handle。工具按
query 选择最多 5 个脱敏 OCR 片段，不读取原始文件路径、不上传原图、不把
完整附件全文注入上下文。

## Adversarial cases

- 附件请求自动进入 `attached_source_exploration`，不默认加载学习记录全文；
- 未绑定学生时先澄清，不能猜测附件归属；
- 指定不属于当前记录的 attachment ID 必须 blocked；
- OCR 片段必须经过脱敏，手机号等原文不得出现在结果；
- 无匹配或无 OCR 文本时返回 bounded unknown/blocked，不读取任意路径；
- 返回 source handle、recordId 和摘要，但不返回 localPath 或原始文件内容。

## Acceptance command

```text
npm run test:deeptutor-attached-source
```

Expected output: `ok=true`, `cases=18`, `routeIsolated=true`,
`sanitizedSnippet=true`, `sourceHandleBound=true`, `rawPathRedacted=true`,
`scopeBlocked=true`, `noMatchBounded=true`.
