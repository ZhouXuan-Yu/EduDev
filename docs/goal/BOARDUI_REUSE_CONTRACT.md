# BoardUI 搜索过程复用合同

2026-10-15。用户在组件审查后明确指示“源码可以直接复用，这个是另一个ai生成的，你来复用参考”。按用户提供源码复用，保留目录原NOTICE与来源hash；本合同不声称上游另授予了MIT许可。

## 本片结果与范围

M10 / 飞书F06：把用户提供的WebSearch树线、来源展开、减少动效及展示组件接到现OfficeToolProcess。只读现projection，使用真实状态/来源/已记录耗时；显示明确错误和原工具详情。联网根因、12路调度、输入框重做及F07全部问题定位继续按主方案，不能将该视觉片验收扩写为这些功能已完成。

复制src/web-search下的展示TSX、类型、CSS、timeline及必要品牌模块到renderer/vendor/boardui-web-search，保留原NOTICE，建立manifest；替换唯一Remix箭头为已有lucide图标，不安装新依赖/字体。增补受控业务状态、稳定行ID、中文来源标签、typed IPC来源打开和原错误详情。禁止复制App/demo-data/字体/结束后回填和自动完成业务状态。

目标文件：新增vendor目录、OfficeWebSearchProcess.tsx/CSS；OfficeToolProcess仅加只读分支，混合教育/浏览器过程沿原视图。main、preload、SQLite及权限均沿原实现，无DDL/新IPC/第二AgentLoop。旧记录缺toolAttempt时仅按已公开的固定搜索/读取标签识别，未知工具回原视图。

## 兼容与回滚

保存修改前OfficeToolProcess当前字节/hash，不覆盖其已有教育/来源/图片/重试改动。旧projection只读兼容；原ToolStep作为详情保留。撤新分支及新增目录即可回退，不删除事件/正式产物，不使用reset覆盖其他未提交工作。

## 验收

1. 真实事件状态独立于动画行数；12条受控调用、全部显示仍running、混合成功/失败/空结果、停止与冷恢复无假完成；未知耗时不显示挂载计时。
2. 来源真实字段，沿原typed IPC打开；摘要/正文区分，URL不允许危险协议；展开/键盘/减少动效、失败详情和旧记录可用。
3. npm run build、npm run test:renderer-components、本片有意义的边界/实例测试；仓库要求关键路径smoke；git diff --check。
4. 实际Electron同构建查看1366浅/1920暗并测试来源展开/失败/冷恢复；控制fixture仅为展示实例，真实provider结果另标。不能由该fixture宣称联网已修好。

本片不调用真实学生素材、不修改用户配置/网络/密钥，不提交或push。每轮按真实完成和未验证范围更新状态。

## 本片实际结论

2026-10-15：**LIMITED_ACCEPTED，仅M10/F06展示复用。** 用户提供的6个展示文件已直接复制/适配，原NOTICE与原/适配SHA256保留。当前生产总架构仍为唯一Pi；无新增依赖、IPC、DDL或本片main变更。修改前OfficeToolProcess快照和最终证据在apps/desktop/test-results/goal/boardui-20261015。

冻结构建6c810e5802964b7262b4b6d36314ade02d60256608c3f376e9fae2b0a5d26ec9/366：类型/隔离编译exit0、组件217/217、新SSR边界8、原attempt边界5、真实Pi/DeepSeek桌面9、键盘/减少动效2、隔离legacy教育smoke207/207，最终退出码均收取0。按原vite配置仅重定向输出并单独tsc，未运行写日常out的npm run build/test:smoke串联；完整命令与日志保留。浅1366/暗1920和键盘焦点截图已实际查看。

真实例：首页403由真实adapter受控注入，备用教育部通知GET与模型响应真实，独立核对落款/网页发布/实施日期。失败保持失败、整体partial/answer:human；来源展开沿原typed IPC校验后真实shell.openExternal交接系统浏览器。刷新/冷启与原SQLite/native记录一致。未证明系统浏览器页正文或内置浏览器正常显示。

原合同验收1–4按以下边界接受：12行/仍运行/停止/未知/空结果为SSR状态反例，**未验真实12路调度和本片实时停止UI**；本片实际来源只有一个正文，不是飞书A06两来源搜索；图片交付/其他领域只保留原入口，不新增通过结论。原语义查询字段未公开时不编造搜索词。日常NET/IMG/FILE、无VPN、输入框/内联问题全量、安装/Office仍OPEN。

四份首失败/设置错误保留并写入progress.json；最终测试按callId定位多过程组、按原单工具回退检查、按实际系统浏览器交接检查，没有更改网络返回以填造成功。收尾发现并行pi-session/office-artifact-service更新，未编辑或覆盖；本片renderer构建后未变，结果仅属于冻结构建，不代表较新并行main功能验收。原Goal ACTIVE/H04 DOING，下一步遵循已读飞书S1。

## 2026-10-16 当前工作区复核补记

针对当前源码重新运行：`npx tsc --noEmit`（exit 0）、`npm run test:renderer-components`（217/217）、`node scripts/xiaozhi-agent/boardui-search-renderer.mjs`（SSR 边界 8/8）。专项报告：`apps/desktop/test-results/xiaozhi-agent/boardui-search-renderer-qP9Uyz/report.json`。

本次没有创建新的冻结构建，也没有重新运行 Electron/真实 DeepSeek/真实站点；因此它只补充当前 renderer 源码的类型与受控展示边界证据，原 LIMITED_ACCEPTED 范围和真实联网 OPEN 项保持不变。
