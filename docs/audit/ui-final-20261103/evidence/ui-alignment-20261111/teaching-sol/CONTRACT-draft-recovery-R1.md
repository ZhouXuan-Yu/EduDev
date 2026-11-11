# 20261111 讲义草稿恢复 R1 精确合同

root 已在 build28115 正式结束后 release。本根因首次修复。基线为源58f7b987/build7f26bc65，原f8d9讲义说明返回后丢稿FAIL保留。

## 精确生产写集

| 文件 | 职责 |
| --- | --- |
| apps/desktop/src/renderer/components/TeachingBookWorkspace.tsx | 同对象重新进入复用挂载草稿；返回、换对象、新建、显式读取与导航保护；明确放弃出口；按保存范围接收回读；请求身份保护 |
| apps/desktop/src/renderer/components/teaching-book-draft-state.ts | 新增纯状态逻辑，保存七类表单初值、已加载字段快照、dirty比较和回读版本保留规则 |

新增纯逻辑文件计入累计清单第11项。实施期间static-check.json保持最后稳定版本，planned-manifest-draft-recovery.json记录确切扩展；源稳定后一次刷新最终files及SHA。

## 允许变化与保护

所有原宿主方法、服务载荷、版本参数、原效果前置guard和权限判断做AST逐项严格对照。loadBook、loadBooks、refreshCurrent允许加入对象/请求身份与字段级草稿保护。updateBook成功后readback新增明确的“接受已保存讲义信息”参数，宿主update载荷及原guard保持。

新UI入口与原manual refresh、归档筛选、预览重编译、行选择、新建、返回、内容块选择允许通过草稿保护适配。原保存/取消ID与各字段保持。内容块取消仍清理原编辑状态，辅助patch/选区dirty只在对应内容块编辑上下文有效。

保存后回读对未提交的其他字段保留输入和原CAS版本。失败或结果未知后的回读不会因字段碰巧一致就推断已保存。教师明确放弃仅清理本地输入，保留原失败反馈与持久事实。

纯状态检查、真实组件DOM交互回归、服务/效果guard AST对照在本writer完成。正式Electron及SQLite/readback与原QA讲义FAIL的真实复验由root/Terra在新冻结构建执行，本writer保持GUI/build/Git分工。
