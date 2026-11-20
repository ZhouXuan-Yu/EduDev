# PDF 裁题迁移后的原页与原图

备份还原会把原件映射到新目录。已归档 PDF 和待开展的模型任务都通过了同一个文件身份校验。历史任务记录的物理标识不可跨目录复制，因此原件字节一致、题页仍完整时，应用也会拒绝查看和组卷。

## 修复

- 历史 PDF 页与归档题读取显式进入只读认证。当前物理标识与任务记录不同时，复用全文件 SHA 验证器，重查资源 ID、内容版本与当前物理标识。
- 仍逐项复核 OCR 页版本、第一稿与终稿、原页位图、裁剪区域、题号归属、题文版本、题图摘要和隐私。题页、题目与图册在异步读取结束后再核对原件标识。
- 待派发任务、教师编辑、后台裁图补核和独立配答验证继续按生产门禁运行。原件、记录的标识、归档题和冻结回执保留原值。本轮无数据库迁移，撤销提交即可回退。

## 真实桌面对比

对同一历史题库用生产 `relocateBackupDatabase` 重定位两份隔离副本，在教师组卷入口分别按「电功率」「欧姆定律与电功率」选择两道已有人工校对的物理题。

| 证据 | 旧版 | 本轮 |
| --- | --- | --- |
| 历史 OCR 与 AI 页文字 | `source_changed` | 同一 OCR 页回执可读 |
| 可组卷原题 | 0/2，来源不可用 2 | 2/2，来源不可用 0 |
| 题图与确认 | 停在组卷来源校验 | 3 个原图摘要、题目对应页和裁图预览一致。集中确认后，重启仍可读回 |
| 单次组卷耗时 | 504 ms，停在缺额 | 927 ms，包含题页、裁图与完整选题校验 |

相同长度地改动 PDF 原件或 PNG 裁图，应用均拒绝确认试卷及读取受影响图像。各自恢复后原题、原图与正式确认可读，迁移后的编辑仍复现文件身份拦截。整个旅程未增加 AI 批次调用计数，读库比较确认原始题行和冻结批次行逐值一致。耗时来自不同工作量的单次真实试验。

## 验证与继续位置

- `npm run build -- --outDir test-results/build-pdf-relocation`。已核对基线与协作者主线的差异仅是协作状态、证据及采集脚本，桌面构建输入一致。
- `npm run test:renderer-components` 253/253。`kb-ai-page-boundaries.mjs` 250/250，包含已归档 PDF 的原件替换、隐私、写入拒绝与原回执保护。`kb-native-dispatch-boundaries.mjs` 17 项及 2 组迁移回归，`kb-native-ledger-boundaries.mjs` 20/20。`kb-structure-book-boundaries.mjs` 17 项与旧配答 36 项，`kb-backup-boundaries.mjs` 4/4。
- 对同一冻结构建运行 `node scripts/electron-smoke.mjs`，207/207。`paper-basket-office-boundaries.mjs` 通过，覆盖受控题库的原图交付与来源失效拦截。
- 从 `apps/desktop` 设置 `OMNI_EDU_TEST_BUILD_ROOT` 指向测试构建。执行 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-paper-grade-electron.mjs --pdf-relocation`，旧构建使用 `--pdf-stamp-baseline`。两次复制都从已有的 `test-results/kb-grade-search-after-electron.log` 定位本地测试库。
- `npm audit --omit=dev --audit-level=high` 发现 23 项存量通告，其中 8 项 high。依赖未改动。

同一旧验收库有 3,082 道规则初稿均缺学科、年级和知识点，其中 2,995 道缺答案、2,725 道缺解析，2,833 道有题号歧义。该副本只有 18 道已定稿或人工编辑的自然题，尚不足以支撑三套正式试卷。下一轮用真实资料检查结构题转入后台定稿的环节，验证分类、选项和原答，保留低置信度隔离。配对答案册迁移、完整换机与导出、独立检索指标和约 10 GB 混合导入继续按原验收标准推进。
