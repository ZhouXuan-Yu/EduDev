# 小智附件发送与历史：D2-C验收

2026-10-04，合同138。此报告只说明附件持久发送/历史，不说明模型读取文件或图片。

## 实际交付

strict optional selection → main私有版本/SHA身份 → 单语句SQLite ledger触发器原子提交用户消息/run/submitted/command/session → 唯一Pi执行 → 原Pro附件历史/本地副本预览。无附件旧hash与native身份不改。未知运输返回保留command用于确认，明确失败刷新草稿并显式重试；已提交后的错误仍返回已接受run，不能重复发消息。附件单独发送可用，发送后输入和草稿清空。

## 已完成证据

- `node scripts/xiaozhi-agent/pi-attachment-send-native-smoke.mjs`：最终6qsrQk，14项、exit0。实际native sqlite3/Store，SQL中途回滚、私有版本、重复command、跨会话/归档拒绝、原源删除、post-commit失败回执，两阶段actual OS终止及两次重启零重放。初次NY5zIC13保留。
- `node scripts/xiaozhi-agent/pi-attachment-send-ui-smoke.mjs`：最终lT0MOE，14项、exit0。实际正式Electron界面/官方DeepSeek/Pi，text+两附件、附件单独发送、composer清空、确切message/run绑定、旧native保持、重复command无新请求、两native尺寸原Pro历史/图像预览、原源删除、跨会话、重启、stale selection零部分提交及重试保留新输入、teacher-wait停止。真实main PID60324终止exit1，launcher65800；最终脚本exit0，无此owned profile遗留Electron。history-1366与preview-1920图实际查看，其余两尺寸图由同脚本生成。
- `npm run test:renderer-components`：79/79，p07d2c-renderer.log，exit0。
- 最终产品build4与`npm run test:smoke`：p07d2c-build4.log / p07d2c-main-smoke.log，exit0、主207/207、ok=true。后续140改变执行配额，必须另记本轮最新门禁，不沿用此构建作为其验收。

原Pro五文件沿136–137未修改，无新依赖。隐私证据：实际native transcript不包含选中文本正文/私有名称，模型仅获附件数量和未读取声明；原文件/图像保持本机。native迁移已在同真实库重复执行保持旧facts；独立literal pre-C数据库副本验证尚未执行，不冒称双旧库验收。

## 保留失败与边界

UI d2vjxW因测试把正常updatedAt变化当native身份变化而失败，改为验证稳定sessionfile/model/schema/session身份。acYhGc报告有14通过，但旧helper只杀Playwright launcher、真实main仍在；定位owned orphan后清理，不能用该轮证明主宿主崩溃恢复。最终改为app.evaluate(process.pid)杀actual main，并确认脚本终止。所有失败报告保留。

未维护真实教师profile、未上传教师原文/学生图、未验OCR/模型附件读图。完整附件D3/D4、E、D1–D7/P08以及未知参照仍待完成。

## 下一步

用户最新要求优先合同140：完成真实浏览器，参考Hana最新原源与Pi1.0.2；正式运行取消配额，自动压缩与稳定前缀/真实DeepSeek命中指标。D3/D4排在此后，不反复重新验凭证与入站底座。未commit/push/子agent。
