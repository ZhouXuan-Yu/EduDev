# 存量目录批量升级旧版结构

原目录恢复将可读的旧版发布结果计入完成。教师需要逐份请求重建，才能把新引擎的段落和题目修复用到旧题库。目录归档与结构引擎版本此前共用同一个完成判断。

现在在资料工作区打开处理队列，对应目录会显示「升级 N 份旧版结构」。该数量按当前版本的原件去重。后台沿用现有队列和最多 4 个活动项的门槛，支持暂停、恢复和失败重试。普通目录恢复继续复用已发布结构。需要人工检查的结构仍标作部分完成。

## 修改与回滚

| 文件 | 改动 |
| --- | --- |
| `shared/material-document-structure.ts` | 统一可读历史引擎清单 |
| `shared/material-import-batch.ts` | 定义升级动作和目录数量 |
| `main/assets/material-import-batches.ts` | 在现有目录请求中返回可升级数量 |
| `main/assets/material-structure-recovery.ts` | 给队列添加默认值为 0 的升级标志，按当前原件版本排队并核对新代发布 |
| `main/assets/material-structure-repository.ts` | 为明确请求的旧引擎结果建立新解析代，复用当前代的在途工作 |
| `renderer/components/product/MaterialImportPanel.tsx` | 在现有目录卡片显示升级动作 |
| `scripts/education/kb-batch-structure-boundaries.mjs` 和 `scripts/education/kb-structure-upgrade-electron.mjs` | 覆盖 SQLite 迁移、版本、并行批次与真实桌面入口 |

SQLite 采用增量列迁移。旧行的升级标志默认为 0。回滚代码前，应在处理队列等待升级结束，或暂停并等待已分派项收尾。回滚保留新增列、原始文件、已保存的结构代和教师数据。

## 修改前后与验证

真实上海数学 PDF 在隔离库以 v14 的部分完成结果起步，导入同一文件的两个目录路径。原逻辑只复用旧发布。新入口显示 1 份，点击到 v15 发布用时 14.875 秒。第 6 题从缺答案恢复为原印答案 C，可打开第 7 页出处。第 5 题由教师在界面修订，升级后逐字段一致。旧代 8 页的结构、图像记录、哈希和原文件 SHA-256 保持一致。应用重启后仍可读取队列和题目。

另对已有 221 份原件的归档快照做 SQLite 只读测量，按加列后的默认值判断出 7 份可升级。9 轮各 100 次同库查询，目录计数中位耗时由 0.174 毫秒增至 0.325 毫秒。该数值只衡量 SQLite 计数。

| 检查 | 结果 |
| --- | --- |
| `npm run build` | 通过 |
| `npm run test:renderer-components` | 253/253 |
| 模块边界与结构仓储 | 2 个脚本通过，其中目录边界 14 项 |
| 真实 PDF 桌面专项 | 通过，1366×768 操作及 1920×1080 冷启读回，0 个渲染错误 |
| Electron 综合冒烟 | 207/207，同一构建 |
| 网络与模型 | 桌面专项无网络派发 |
| `npm audit --json` | 27 项依赖告警，6 项 high，0 项 critical |

以桌面模块为工作目录。模块专项使用 `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs --test scripts/education/kb-batch-structure-boundaries.mjs scripts/education/document-structure-repository.mjs`。真实样本使用同一 loader 执行 `scripts/education/kb-structure-upgrade-electron.mjs <隔离的旧版样本库>`。本次实际主进程构建 SHA-256 为 `750255dfa61ddc6642b3c505eb92808a1dd3ddcb85fbfddcee72f6aaa7389d41`。本地证据在 `E:/EduDev-kb-batch-upgrade-20261121/kb-batch-upgrade-wRFhVS/report.json`。

本次通过存量目录升级专项。大批实际升级吞吐、自然题质量、独立留出检索、三套正式卷、约 10 GB 混合资料和独立换机继续按 KB-A01～A10 验收。
