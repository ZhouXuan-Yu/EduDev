# 飞书 S1：真实联网、浏览器与流式链路合同

2026-10-15。M10/M12，F01/F03；先诊断和真实实例，再修改证实的缺陷。上一轮BoardUI复用是进展；本轮开始只读复核无日常Electron存活，不把其当作用户已验窗口。

## 教师可见结果与链路

从正式“问小智”输入自然任务：公开简短说明→真实搜索→两个来源正文→有出处的回答；页面在终态前能看到真实文本增量。现Pi→journal→typed IPC→projection为唯一链。再实际浏览器导航、快照与页面截图，失败有准确可操作提示，不出现永久白屏。

## 本轮范围

先新增专项实例脚本，冻结当前源码输出到自有test-results，保留旧失败。观察实际provider响应增量、事件与页面出现时刻，网络仅观察URL/状态/耗时/错误分类，不记录密钥/请求正文。测试仅用公开教育资料及隔离data/profile，不复制用户整个资料库，不改系统VPN/DNS或凭证。

若实例发现缺陷，预期仅修改原office-network、Hana adapter外层、web-tools/shared错误、browser-host/proxy/status及直接对应renderer；不另建AgentLoop/事实真源。HTTP拒绝不能混成权限或私网拒绝；真实search失败不得用固定结果顶替。现有SSRF逐跳校验、固定连接IP、来源成员检查、内容脱敏/审批保持。复制原Hana纯解析/搜索能力时保留来源/许可，不修改vendor来隐藏诊断。

当前pi-session/office-artifact-service有并行教育改动，默认只观察，未证实本链路缺陷前不编辑；需要改其精确边界时先比对本轮快照，保留无关更新。无预设DDL/IPC；必须加公共字段时版本兼容、同步preload/UI/旧历史。

## 验收与恢复

1. 正式真实provider增量至少两段在运行中可见，记录delta→DOM→终态时间；不是逐字动画或只统计native事件。停止后无新正文/效果，旧内容与冷启一致。
2. 实际搜索及两个来源正文、URL/时间/摘要正文区分；以预先固定教育部通知日期及实际正文人工核对，不用模型自评。任何站点/供应商失败保留，不加入通过分母。
3. 实际内置浏览器可见正文/快照/截图；私网/非法地址拒绝，失败显示与原错误相符，停止有界；来源打开的现系统浏览器交接独立说明。
4. 新/旧记录与SQLite/native读回，刷新/冷启无重做。真实VPN运行/未关闭情况只按本环境记录，无VPN仍需独立验收。
5. type、原配置隔离构建、renderer组件、专项反例与正式桌面；关键路径原smoke使用同隔离构建，git diff --check。保存退出码/构建与脚本hash、第一失败及重测。

回滚只撤本片差量，不删除真实资料、已提交回执、journal或教师确认。完成本片不等于全部飞书S1、12路调度/H04整体或Goal完成；下一继续位置按真实失败与飞书优先级更新。

## 首次真实失败与精确修复边界（修改前补充）

正式8a7854构建/uNiBhh：真实回复502增量、95次运行中DOM增长、停止与冷恢复通过；搜索/正文/浏览器均permission_denied，web.enabled=true且auto；实际工具网络还未发出（只有模型HTTP200）。系统lookup对api.anysearch.com及www.moe.gov.cn均返回28.0.0.x与fdfe:dcba:9876::IPv6组合。现自动解析只识别198.18/15，故组合被原非公网保护拒绝。不是凭证或模型不支持联网。

修复仅识别这类**完整配对**作为系统虚拟解析候选：至少一个IPv4（198.18/15或28/8）与一个fdfe:dcba:9876::/48，且没有任何其他答案；然后改用既有固定国内DoH，重新验证所有实际公网地址并固定连接IP。绝不把虚拟/ULA地址当公网、不允许单独ULA或混入真实私网/公网的答案触发，不修改显式system策略（仍拒绝、明确dns_blocked）。原198.18全虚拟回退保持。28/8单独公网结果不因猜测篡改。只修改office-network.ts及相应边界脚本，使用实际DoH/网络重验结果判断后续问题。

外部研究工具429未取得官方页面正文，不以搜索摘要确定代理产品/配置；这里只按本机实际DNS组合和固定IP安全回退设计。第一份实例测试自己对失败纯文本错误地JSON.parse，测试须兼容失败文本并保留原报告；不能将该SyntaxError当产品根因。


## 实际交付与下一步

## 2026-10-15 当前：S1双栈虚拟DNS修复，真实联网与日常配置验收

本线程当前按已读飞书F01/F03推进；Master/Goal ACTIVE、H04 DOING。先冻结FEISHU_NETWORK_STREAM_CONTRACT.md，再保留8a7854/uNiBhh首失败：auto/enabled下搜索/正文/浏览器均权限拒绝，工具网络尚未发出；流式/停止/冷恢复原已通过。系统实际返回28.0.0.x与fdfe:dcba:9876::配对，本机clash-verge/mihomo进程存活；不凭此修改系统代理。

只改原office-network的完整配对识别，继续用原固定国内DoH取得真实公网IP并校验/固定连接。真实私网/混合/单独ULA继续拒绝，显式system仍拒绝，28/8单独公网结果不猜成代理。Pi/Hana/typed IPC/SQLite/教师与来源边界保持，无新依赖/DDL/第二循环；主进程其他并行教育代码未编辑。

冻结b7fabbd461828bd356a90db1b3d654c19c33e5316d5b35ecf777e329764c9a9c/368：正式Pi/DeepSeek iueWOd 5/5 exit0（真实搜索→教育部/西藏政府两正文→实际内置浏览器/PNG→停止→冷启）；真实回复481增量、71次运行中DOM增长，首DOM早于终态。17 DNS边界、15 web边界、组件217、隔离legacy smoke207均exit0。标准npm run build及type也exit0。

实际默认日常profile、原加密DeepSeek配置/auto DNS，在相同固定b7候选上的pi-daily-network-ui-EXQIYv 4/4 exit0，搜索两正文、实际内置页与截图、刷新readback通过；只通过UI创建公开政策对话，不种业务夹具、不改凭证/资料。隔离及日常各3项独立读回核验通知落款3月25、网页发布4月21、秋季实施/两URL及原PNG大小/hash。不是模型自评，答案语义仍保留人工范围。

日常共享out的5e9754测试先过3项后因测试错误假定纯web树失败；实际是update_plan+web混合组沿原视图。随后另一构建把out换为c95a17，恢复脚本SHA门禁正确拒绝，未覆盖或放宽。最终用不可变b7候选+真实日常profile重验，**不声称当前共享out/安装包已验**。首失败、测试路径/loader/定位错误均保留。固定build测试期间不变；收尾并行source漂移apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts，原样保留，不把本片结果归到它们的新代码。

证据/命令：apps/desktop/test-results/goal/feishu-net-stream-20261015/{progress.json,progress.md,commands.ps1}；实际浅1366/暗1920与原浏览器截图已查看。用户原图/文件、无VPN、当前共享out/安装/Office、完整12路、旧领域golden失败与H05–10仍未完成。下一步优先飞书F07：提问/审批/教师回答按callId回原位置并真实恢复验收，再S2安全12路；不可退回“等登录”或因本片通过关Goal。无commit/push。
