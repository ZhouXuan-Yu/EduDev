# 20261111 教学 smoke QA 入口适配交接

## 精确QA diff合同与冻结

本次唯一修改脚本为 D:/WorkProject/EduProject/apps/desktop/scripts/electron-smoke.mjs。教学生产11文件保持冻结，已逐项比对static-check.json，SHA变化0。原失败日志 test-results/ui-alignment-20261111/smoke-current.log 保留，原1201行隐藏创建按钮超时继续为该次真实FAIL。

QA冻结SHA256为 33b71da21a95fa43bf6b5b36818a11d718653f2f145f8e98c62c5da20113beb0。

修改前QA SHA256为 ba7360806a230b500d8ccb7e404751881a081df4153afcf9bd1e617320ab854a，原源文本保存在smoke-adapter-baseline.json。脚本检查和精确diff验证记录在smoke-adapter-check.json。

## 全面消费对照与适配

| 消费 | 当前真实入口 | QA差异 |
| --- | --- | --- |
| 题目新建、来源选项、空题干验证和实际创建 | question-notebook-new | 在首次读取来源选项及空题干点击前增加1次真实点击 |
| 分类创建、重命名、并发冲突、删除和恢复 | question-notebook-category-toggle内确切“分类管理”按钮 | 在首次分类名称填写前增加1次真实点击；原已删除分类的内层展开操作保留 |
| 高级筛选与原始候选 | question-notebook-filter-toggle | 原smoke无相应调用，确认无需额外展开；搜索、仅看收藏和分类chips均在原可见主区 |
| 相似题 | question-notebook-semantic-toggle | 原smoke无对应调用 |
| 备课本创建与后续笔记CRUD | teacher-notebook-new | 原空态等待后增加1次新建点击，原笔记补充披露、CRUD、删除恢复继续按原操作 |
| 讲义创建与全部章/页/块/来源/导出/归档 | teaching-book-new | 原初始空态等待后增加1次新建点击；后续归档测试前已有的新建操作保留 |
| 讲义整块与选区patch审核 | teaching-book-block-cancel | 两次提案保存并完成原零正文写入/版本断言后，分别增加1次原取消按钮点击，退出本地编辑，再审阅已持久提案的应用/撤销。全部patch数据及1→7原版本断言保留 |
| 讲义直接修改成功反馈 | teaching-book-success | 原等待中的旧实现术语迁移为当前已批准的确切“内容块已更新。”，等待函数、位置、时长及相邻version6与正文readback断言保留 |
| 重启后的讲义和题本 | 原列表行与可见题目卡 | 原重启验证只消费列表和题目卡，入口保持；原启动/关闭、数据库/文件/版本/来源断言保留 |

新增动作均使用可见控件的正常click，分类触发使用完整data-testid加exact按钮名。原全部selector保持原字面和匹配语义。新增取消操作仅结束本地输入，已保存的patch候选仍按原ID应用和撤销。

## 静态验证

node --check apps/desktop/scripts/electron-smoke.mjs 实际exit0。

精确对照脚本先移除新增6次入口点击，再将1处提示文案恢复，所得脚本与修改前全文归一换行后逐字完全相同。由此覆盖原assert、数据、等待、重启、统计、环境和失败路径的保留。

| 保留项 | 修改前 | 修改后 |
| --- | --- | --- |
| assert调用 | 459 | 459 |
| waitFor/waitForFunction/waitForTimeout/waitForLoadState调用 | 199 | 199 |
| launchApp调用 | 3 | 3 |
| 原报告passed/total | 207/207 | 207/207 |
| 教学生产源码变更 | 0 | 0 |

本轮仅完成QA静态适配，实际GUI和完整smoke由root在新R2冻结构建执行。207为保留的原完整验收集合，当前尚无本次完整运行PASS。等待文案差异与两次显式取消已在上表完整列出，供root review。

## 20261111 当前冻结补充

当前 smoke SHA 与四处新增同步 UI-ready 屏障详见 HANDOFF-chapter-ui-ready.md。当前精确 QA manifest 为 chapter-ui-ready-static-check.json 的 files 数组。原 199 等待目标和 459 assertions 保留，当前额外就绪等待 4，等待调用总数 203，46 处异步真谓词保持。实际短 Electron original FAIL 与 UI-ready PASS 的 DB/报告/截图均已留存，完整 207 交 root 复验。
