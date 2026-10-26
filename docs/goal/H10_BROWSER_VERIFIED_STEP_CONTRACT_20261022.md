# H10 已验证网页步骤的后续只读动作合同

## 最终同构建证据

`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373上，`pi-daily-network-copy-D4UQf0`与`fG3tZB`各5/5；navigate后snapshot/screenshot均复用同一web步骤和冻结URL，换URL、交互和写效果的反例仍拒绝。任务计划边界17/17、浏览器准入4/4、renderer240/240。

此前`R1PbZP`保留为首次verified-step拦截失败；后续`C0qnOS`证明模型仍可能给human步骤填写无意义target，现只规范化移除`kind=human`的`target`，其他步骤字段和严格校验不变。该兼容不等于允许human步骤代替网页准入。

## 问题证据

`pi-daily-network-copy-R1PbZP` 第二次运行中，内置浏览器已经真实完成 `navigate` 和 `snapshot`，同一 `web` criterion 也已通过；随后 `screenshot` 被 `task_blocked`。原因不是截图实现失败，而是任务状态把整个 `office_browser` 标为`external_effect`，并在步骤 `verified` 后拒绝同一步骤的后续观察动作。该失败导致模型尝试补计划并最终没有截图。

## 第一性目标

截取刚读取的同一页面属于同一网页核验步骤的本地观察，不应强迫教师或模型重建计划。网页导航、输入、选择、按钮和按键仍属于外部效果，必须在未验证步骤中经过准入；步骤已验证后只能追加无外发效果的观察动作，且资源必须沿用该步骤冻结的同一URL。

## 冻结范围

- 修改`tasks/plan-runtime.ts`：识别当前工具和动作是否允许在已验证步骤后追加。
- 修改`tasks/task-state.ts`：只在显式`safeAfterVerified`时放宽 `verified` 拦截；资源、criterion、run、call和steps映射校验不放松。
- `office_browser`仅允许`snapshot`、`screenshot`、`show`、`tabs`、`wait`、`scroll`在已验证web步骤后追加。
- `navigate`、`click`、`type`、`select`、`key`、`close`及其他外部动作仍不得在已验证步骤后追加。
- 普通`safe_read`/`local_cache`可在同一已验证只读步骤后追加；写效果仍拒绝。
- 不新增表、IPC、依赖、数据迁移、第二AgentLoop或网页权限。

## 验收标准

1. Task state 专项证明：已验证的read步骤可用新call ID追加同资源安全读取；换资源、换工具或写工具仍拒绝。
2. Browser admission专项证明同一web resource的snapshot/screenshot连续准入；换成其他URL仍拒绝。
3. 日常配置副本真实Electron运行，浏览器navigate后snapshot与screenshot在同一计划步骤完成，产生`browserCapture`。
4. 两次同构建运行均通过NET-01搜索/两正文和NET-02浏览器/截图，且源日常DB不变、owned profile删除、0 renderer错误。
5. 原`R1PbZP`失败报告保留，不改写为通过。

## 边界

本片只修“已验证网页步骤后的同页只读观察”。VPN-off、网页交互写效果、安装包、真人和Office/WPS放映仍保持独立门禁。
