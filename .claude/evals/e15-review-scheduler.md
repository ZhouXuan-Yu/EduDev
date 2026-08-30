# E15 Review Scheduler Contract

## First-principles contract

间隔复习的唯一事实是“知识点 + 有序的显式正确/错误证据 + 明确的参考时间”。调度器必须是纯函数：相同输入产生相同队列，不能读取 renderer 状态、当前机器时区或模型自由文本。

## Required behavior

- 复用 DeepTutor `learning/scheduler.py` 的按知识类型间隔序列：memory `0,1,3,7,14,30,60`；concept `3,7,14,30`；procedure `3,7,14`；design `14,28` 天。
- 正确答案推进间隔；连续两次正确额外推进一级；错误答案回退一级并清零连续正确计数。
- 到期判断使用 epoch seconds，队列排序稳定：优先级、模块顺序、知识点 ID；不依赖本地时区。
- 显式 timezone 只用于展示/边界元数据，不改变同一 epoch 的 due/not-due 结果；切换时区不能丢任务。
- review queue 不建立第二学生数据源；应用关闭/重启后必须从持久化 `learning_records` 重新计算，缓存或 sidecar 内存丢失不能改变队列。
- malformed type、负数时间、超大 outcome 数组和未知字段必须 fail-safe、bounded，不抛出未处理异常。
- scheduler 不写业务表；正式掌握度写回仍遵循 `save_mastery_state` confirmation。

## Adversarial cases

1. 正确/错误序列与 DeepTutor 参考序列一致；
2. 同一输入在 UTC、Asia/Shanghai、America/New_York 下队列 ID/due 状态一致；
3. 空输入、未知类型、负时间、超大数组安全收敛；
4. 相同 due 时间的排序稳定；
5. 原有 mastery policy smoke、AI harness、observability、production build 全部回归。

## Evidence gate

`npm run test:deeptutor-review-scheduler` 必须输出 20 个断言、确定性和 timezoneInvariant；`npm run test:deeptutor-review-recovery` 必须真实关闭并重开 SQLite 后保持 queue fingerprint；随后运行 `npm run test:deeptutor-mastery-policy`、`npm run test:ai-harness`、`npm run test:ai-observability` 和 `npm run build`。
