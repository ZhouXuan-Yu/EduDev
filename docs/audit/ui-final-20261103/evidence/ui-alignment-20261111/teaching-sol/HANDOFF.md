# 20261111 教学源码交接

## 状态

SOURCE_STABLE_FOR_ROOT_BUILD。精确 6 份 TSX 和 4 份新增 CSS module 已稳定，供 root 冻结统一构建。当前 A14/A19 的新实现仍等待 root/Terra 的新构建与真实运行验收。

## 教师可见结果

- 教学文件和整包目录在未选对象时全宽，空详情保持隐藏。整包与课堂入口收纳到标题旁的紧凑导航。文件详情有明确返回列表入口。
- 备课本与讲义首屏优先展示真实目录。原新建 ID 一次打开原表单，选择对象显示原编辑能力，返回目录保留挂载与本地草稿。
- 题本首屏展示真实题目。更多筛选、相似题、分类管理、创建内容按需显示，01–04 装饰编号移除。原 source 候选、教师补正、来源核对与题篮回接接线保留。
- 课堂要求使用官方 TextArea 的 fullWidth、rows=4 与独占一行的应用 grid。原课堂大纲、确认、预演、修订和成果操作接线保留。

## 静态检查

命令为 node apps/desktop/test-results/ui-alignment-20261111/teaching-sol/static-check.mjs，最终 exit0。

| 检查 | 结果 |
| --- | --- |
| TSX 解析 | 6 文件通过 |
| 新 CSS 解析与边界 | 4 文件通过，无 token 声明、slot/BEM/global/important 覆写 |
| CSS module 类引用 | 全部存在 |
| 旧定位属性 | 205 个 data-testid/testId/testPrefix 属性全部保留 |
| 原命名函数 AST | 73 份逐一对照通过，摘要见 handlerDigests |
| Effect 与 guard 调用 AST | 14 处一致 |
| 宿主服务调用 AST | 56 处一致 |
| 受保护业务组件 JSX AST | 20 处一致 |
| 原定位对应的事件与 disabled 属性 AST | 186 处一致，显式入口变化见 allowedEntranceChanges |
| 完整生产写集 | 10 文件，files 数组包含累计全量路径和 SHA256 |

讲义 5 处状态文字替换单列于 messageOnlyHandlerChanges，函数比较只对这五条确切文案做归一。新增 show 函数只管理教学内容的 view/visited，完整 AST 见 addedHandlers。原删除、归档、来源与版本、权限、dirty、恢复、迟到响应、保存和失败 handler 的业务表达式保持原 AST。

## QA 接入

MIGRATION.md 末节列出确切新入口。ui-final-paper-number-live 在原 source-candidates 前打开 question-notebook-filter-toggle，在填写原分类名称前打开 question-notebook-category-toggle 内确切“分类管理”按钮。教师补正、原题号、来源核对、分类关联、题篮与原断言继续运行。原新建题目表单通过 question-notebook-new 或区内 question-notebook-create-toggle 打开。

备课本和讲义保留读取后自动选首项，新增 editorOpen 仅控制展示。课堂已访问内容保持挂载。题本新建 ref 根保持挂载，有新题草稿或保存中时禁止收起，原 QuestionEditBoundary 的启用条件与原 useQuestionEditGuard 调用保持一致。

## 本轮验证边界

本 writer 仅执行静态检查。官方 build/tsc、246 组件、style9、GUI 和性能测量由 root/Terra 按新源码另行验证。此前 root 提供的 R2 源23dd7f及其通过结果仍对应不可变 R2out。当前实现的 runtime、窄窗布局、操作态、冷启和正式业务通过状态待新构建确认，现有断言与通过数量维持原门禁。

首次静态比较记录了新增 show 函数和 CRLF/LF 的 JSX 文本差异，已将新增函数单独列出并按换行归一重比。检查脚本首次根路径多上溯一级已修正。上述属于静态工具修正，未修改业务断言或官方测试。

回滚使用本表十文件的限定补丁，并统一重建。新增 CSS 只撤销本轮四文件，现有业务数据与其他 writer 写集按原所有权保留。source-before.json 保存六份修改前源字节与 SHA，static-check.mjs 可重跑复核。

## 全路径 SHA256

| 文件 | SHA256 |
| --- | --- |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingArtifactsWorkspace.tsx | 893016df918a6aa68941d56fb3aa426562fbb81abcff51e964cbe66c705edc04 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/TeachingDeliveryWorkspace.tsx | 340b1a6273b3fb4f8c8b7258b8fceb735e5cf92abe9808fec02e20e14d74fd95 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeacherNotebookWorkspace.tsx | f63b979c271076859fd406f93b6d38ed94d2168e307435a1ce0dca32cc15b751 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/TeachingBookWorkspace.tsx | c60180a84265db38c8a5ff2effaef46506e68af54f5e75e3216ee3a556a8bc53 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/QuestionNotebookWorkspace.tsx | aff2d8475cbf074c80385e689354afb3b6517d5685a181ff6ee9a41a2e22813a |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/components/product/ClassroomWorkspace.tsx | 21fad6252282f93de91f1db7ab73de3fc78e422e3799aa5814be6a7cb29d2e15 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-catalogue-alignment.module.css | 1458c5b4e5c5eec4edca14f9509a4f77c557d07ea75e5894f79f2bc42e8ed231 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-editors-alignment.module.css | 43a1f868ec0870dc85e463add9d5c294afe7254ec1ef34abb51924c0cfcd3d47 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-question-alignment.module.css | 553110d3dead9b7c7ab17034e9a8d35d891dec09a8629d23fb16ff2c1c1963b8 |
| D:/WorkProject/EduProject/apps/desktop/src/renderer/ui-system/teaching-classroom-alignment.module.css | 830b2ed7304fcf19853dc5a20dcc1e0312a2d02e95c8dad62c29d99b25b4bbd7 |
