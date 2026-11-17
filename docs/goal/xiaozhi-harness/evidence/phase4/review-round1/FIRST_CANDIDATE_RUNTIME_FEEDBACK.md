# 首候选运行反馈与示例校正

本 reviewer 读取 writer 的候选前定向报告，尚未亲自执行这些探针。原源码审查报告与 36 文件原件保留。

`xiaozhi-phase4-privacy-race-o94Mry/report.json` 实际 1/7。长私有源在 4096 字符后的 middle32、middle64、tail64，敏感名称、敏感声明和 await-cut 外部包替换均失败，正常通用说明通过。报告使用真实 Native office_read_text、Creator Tool、原 parser/文件和 SQLite，owner 为受控合成上下文。该边界与完整 production Pi 测试分别记录。

首源码报告以裸数字 `13800138000` 举例时遗漏了旧 managed parser/sanitize 的二次拒绝。Writer 初探该单例没有复现泄漏，原探针保留在 `xiaozhi-phase4-privacy-race-2TBYS4`。改用有效 `teacher-13800138000` 后实际复现 Draft 包/SQLite 敏感名称泄漏。后续定向验收采用真实失败的 prefixed 名称，并保留裸数字的原结果。

上述报告/日志副本位于本目录 `writer-before-evidence`。修复后的独立复验仍等待 SOURCE+OUT 冻结和 root 运行释放。
