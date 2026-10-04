# P05-B3 正式技能设置交付合同

日期2026-10-03；M10/M01，接docs/75、78。完整Codex体验和docs/67 D1–D7保持；三元题组暂停。

## 本轮教师结果与代码范围

从小智标题栏进入技能管理：四审核内建与本地教师包，预览完整原文、明确选择目录导入（默认关闭）、启停、编辑自定义SKILL.md产生关闭的新版本、归档/明确再导入。选择目录只由main原生dialog提供，不接收renderer路径；目录修订CAS和全局运行/预约/chooser锁沿B2。实际输入标签与模型有效目录一致。

新增shared管理输入/result/catalog/preview契约和main独立边界验证/公开投影；main ipc注册→typed preload→独立PiSkillSettings/复用SkillRow/SkillBadge；不大段堆App/db/index。公开metadata无目录、hash文件清单或私有bytes，教师本地preview只返回选中说明。启用仍只授予必要脱敏文本，不增加任意读写/脚本/联网权限。

参考实际Hana0.449.0 `desktop/src/react/settings/tabs/skills/SkillRow.tsx`、`components/input/SkillBadgeView.tsx/.module.css` 和实际 `settings/Settings.module.css` 的技能规则，记录源/output hash、Apache-2.0。展示structure/CSS保留，移除platform/Tiptap/全store/i18n依赖，改本项目props、显式键盘可达预览和HeroUI Switch。HeroUI MCP已取Modal/Switch完整docs，现有@heroui/react直接用官方实现，Pro PromptInput/ChatTool沿已移植源；不声称是Codex官方源码。Finesse采用固定教育工作台tokens和状态检查，用户截图优先；本轮管理面板不等于完整D1–D7。

## 修改与兼容

实例发现当前renderer没有Tailwind编译插件，@heroui/react/styles下的@apply源样式未被转换，Modal落入页面正常文档流。复用安装包@heroui/styles3.2.2提供的官方compiled heroui.min.css（MIT，410637bytes，源/output hash登记）替换原入口；现有Pro与项目样式导入顺序保持。此修正涉及OSS组件全局基础样式，必须固定out重跑主桌面207项与本轮实际双视口，不能靠TS通过判断。没有新依赖；增加本地官方CSS源输入，真实installer大小另验。

- 表/不可变包/v4/native双epoch均沿B1/B2，无新表、新依赖或权限范围。preview先await初始化。所有IPC精确字段/整数revision/name/document32KiB验证；非法或来自非main frame不调用管理/chooser，错误只返回固定码。
- 导入/启用/编辑/归档前核renderer声称修订，取消零metadata写；错误/原生chooser期间全局锁释放必须正确。已有源变化仍可关闭，中文恢复文案指导检查启用技能或关闭该项；新会话不能修复全局损坏包。
- 教师包原源与旧版本保持，晚到/stale命令不发布，不递归删除文件。不做在线商店/ZIP/自动下载/系统全局扫描。新绑定禁止旧reader降级，异常工具恢复仍原生安全分支。
- loading/empty/成功/取消/错误/源失效/保存新版本关闭/任务活动锁/CAS重载反馈；退出编辑不修改文件。成功动作刷新有效输入目录，失效选中标签清空，不静默使用旧说明。

## 完成定义与实例

main边界专项检验精确入参、权限、公开投影/初始化/chooser全生命周期锁；build、renderer79、原生授权必要复验、固定out桌面smoke、git diff --check。

正式Electron/真实DeepSeek实例从页面导入合成技能→本地原文预览/默认关闭→明确启用→选择输入标签/发送清空→native自定义展开与受限引用read→实际摘要→编辑新版本关闭→旧说明/结果/摘要隔离→新版本启用和真实执行→关闭/重启/跨会话/归档再导入。检查model context、JSONL原字节、SQLite/源文件readback；并发/stale/原生取消/运行锁与双视口、source坏而关闭可恢复。不能直接SQL更改状态冒充用户路径，合成stream不当provider。

B3全部通过才勾完整P05-B/P05；否则按真实状态记录缺项继续。之后P06依docs/67从D1校准开始，P07办公联网，P08实际无VPN安装与最终实例；总目标active，未commit/push。
