# H10 日常配置副本联网验收合同

## 最终同构建复验

当前最终构建`4dfb959f3ed9e60d38f6f0313c64293bcf47441cd1fb8c1cf9f3dee2ff75ee40`/373文件与冻结构建副本逐文件一致。`pi-daily-network-copy-D4UQf0`与`fG3tZB`在该构建上连续两次5/5，继续满足下方全部标准；此前`d8ec197c...`的两轮5/5保留为前一构建证据。

同构建还完成公开图片`z19EBM`、`DnmrJ6`各13/13与自然文件`6rw96n`14/14，renderer240/240。失败`R1PbZP`、`oprbps`、`C0qnOS`及图片`wGFxRF`全部保留。H10整体仍`NOT_ACCEPTED`，VPN-off、安装、真人和Office/WPS放映仍OPEN。最终进度见`apps/desktop/test-results/goal/h10-current-build-closeout-20261022/progress.json`。

## 目标

在已完成“日常保存配置 + 旧会话”副本验收后，继续使用同一份真实保存配置验证公开教育资料搜索、两篇实际正文读取、内置浏览器和本地截图。测试只运行于 owned 日常 profile 副本，源日常profile不启动、不写入。

## 冻结范围

- 复制范围沿用`H10_DAILY_PROFILE_COPY_CONTRACT_20261022.md`。
- 运行最终`out/main/index.js --user-data-dir=<copy>`。
- 清除DeepSeek/OMNI_EDU环境覆盖及测试Pi开关。
- 使用当前已保存的provider、模型、联网开关和auto DNS。
- 不修改系统DNS、代理、VPN或hosts；VPN-off保持独立未验。
- 新建的测试聊天、截图和事件只属于副本；报告前删除owned profile。

## 验收标准

1. 应用从副本恢复已保存配置，联网开启且DNS为`auto`。
2. `NET-01`实际执行公开搜索，并读取两个不同来源网页正文；最终答案至少包含官方通知正文落款`2022-03-25`、网页发布日期`2022-04-21`和`2022年秋季学期`，引用真实URL。
3. 至少一个官方正文来自toolResult中可独立回读的正文，不能只用搜索摘要。
4. `NET-02`实际在内置浏览器打开官方页面，读取DOM正文并生成本地截图。
5. 新测试聊天不修改源日常数据库；源DB SHA前后一致。
6. 报告与最终截图不显示真实旧会话标题；owned profile在报告中只记录“已删除”。
7. renderer无错误，固定构建SHA不变，测试结束相关进程为0。

## 边界

本片证明当前联网、可用代理/网络环境下的日常保存配置和真实公开网页链路。它不是VPN-off、DNS故障、安装包、真人教师、Office/WPS或完整H10验收。
