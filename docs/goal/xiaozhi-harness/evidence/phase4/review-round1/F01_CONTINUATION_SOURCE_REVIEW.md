# G4-F01 续聊生命周期核对

对应 `source-freeze-final-amiiIk`，37 source/466 out 已独立逐文件核对，差异为 0。此记录为源码推导，运行尚未释放。

原片段检测、敏感元数据占位和导入快照绑定的定向修复已见源码。F01 在同一会话正常续聊与冷启重建处仍需闭环。

- production-host.ts 第 1075–1076 行在每个 Run 结束时 clear 并删除 private context。
- 第 331 行只向验证服务提供当前 active Run 的 context。
- 第 1025–1028 行仅在本次实际工具结束时 capture 返回文本。
- pi-session.ts 第 272 行复用或打开既有 SessionManager。第 832–833 行对 office_read_text 做既有 sanitize，普通教师私有正文可保持原字节。第 1210–1211 行仅在新 tool_execution_end 事件调用 capture 回调。
- 当前相关源码未见对既有 JSONL/session projection 中可验证的 private read 结果重建指纹。

由此，Run A 读取教师私有正文后正常结束，同会话 Run B 直接把历史中的原样片段用于 skill_create 时，当前 Run context 可以为空。应在同一已知来源隐私边界内补齐可信历史重捕获或可核会话级指纹及冷启重建。

最小复验包含真实两 Run 续聊以及关闭/冷启后续聊，B 不重新执行文件读取，Creator 复制 A 的合成私有片段。检查 native 历史确有该结果，发布包/元数据中敏感原文为 0，通用方法仍可发布。

当前 Bloom 行为应准确描述为 NFKC/空白规范化后的 UTF-16 code-unit 窗口。WINDOW=24，源 stride=8，候选 stride=1。任意连续 31+ 规范化 code units 可包含一个源对齐 24-unit 窗。短于 24-unit 的源不索引，24–30-unit 的部分片段覆盖依对齐而定。该索引存在保守碰撞拒绝语义。32 MiB 懒分配和 clear 后释放引用的测试不能证明上述历史重建已经完成。

本记录已发 root 和唯一 writer。原 37 文件原件位于 `final-candidate/reviewed-source`，完整身份位于 `final-candidate/writer-freeze.json`。
