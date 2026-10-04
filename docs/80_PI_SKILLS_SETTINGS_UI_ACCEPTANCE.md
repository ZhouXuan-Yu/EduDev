# P05-B3 正式技能管理验收

日期：2026-10-03。合同：docs/79；M10/M01。P05技能框架既定范围完成，完整Codex视觉、办公文件生成、联网、实际无VPN安装仍须P06–P08。三元题组暂停。

## 1. 实际交付

- 小智标题栏“技能”进入正式管理页：四内建、本地目录导入、完整原文预览、明确启停、编辑教师说明发布默认关闭的新版本、归档及再导入。输入选中标签使用Hana SkillBadge结构，发送后清空；有效目录改变时移除失效选择。
- 新shared管理契约、独立main精确字段/版本/大小验证、受控原生目录chooser、三条IPC和typed preload贯通。公开目录只投影name/title/description/origin/version/enabled/archived，不暴露宿主路径或原包内容。preview等待初始化；stale导入在打开chooser前拒绝；全局运行/预约/chooser互斥沿B2。
- 编辑/关闭在下一实际任务按当前authority隔离旧技能说明、工具结果、推导及实际压缩摘要；原JSONL、公开对话、原源及不可变版本保留。源失效错误指导检查或在技能管理关闭，不能用新建会话绕过损坏全局源。
- 沿Pi0.80.3唯一循环、Hana0.449.0来源适配、binding4与目录metadata schema1；没有新表或新依赖，没有改本地优先/教育事实/权限/教师确认规则。

## 2. 现成源码与必要适配

Hana `desktop/src/react/settings/tabs/skills/SkillRow.tsx`、`components/input/SkillBadgeView.tsx/.module.css` 与实际 `settings/Settings.module.css`技能规则由独立guarded提取脚本生成。四输出源/output SHA见 `src/renderer/components/office/hana-skills/source-manifest.json`，Apache-2.0 LICENSE保留；组件输出6813bytes不是installer增量。移除platform/store/i18n/Tiptap依赖，使用教育公开props、中文操作、显式预览/归档/键盘焦点和官方HeroUI Switch。

HeroUI MCP已返回Modal/Switch文档，使用现有安装包实现。真实实例发现入口 `@heroui/react/styles` 含未编译的`@apply`，项目无Tailwind处理器，Modal进入普通文档流。直接复用安装包 `@heroui/styles`3.2.2官方编译 `dist/heroui.min.css`，MIT声明与source/output SHA保留在 `heroui-pro/heroui-oss-source.json`；410637bytes、SHA256 `4d7cc0ccc2b0ac66df4d38a60ffdfbdcce14f30a449cc4cf7f63299e90e27059`。替换入口源CSS，保留Pro与项目样式导入顺序，无新增依赖。实际版本Switch必须包含`Switch.Content`，已按安装源码修正。

Finesse固定来源及参考在third_party/finesse，用于状态、密度、可达性；用户docs/67截图优先。以上不是Codex官方同源组件，管理面板通过不代表完整一比一视觉。

## 3. 精确命令与证据

命令cwd均 `D:\WorkProject\EduProject\apps\desktop`；相对report/log基于此路径。最终构建之后所有UI/重启实例保持out固定，无重叠build。

| 命令 | 结果 | 证据及范围 |
| --- | --- | --- |
| `npm run build` | exit0 | `test-results/pi-skill-settings-build-final2.log`，最终renderer index-DZgkmW9c；CSS模块类型和Switch.Content修正后构建 |
| `npm run test:renderer-components` | 79/79 | `test-results/xiaozhi-agent/pi-skill-settings-renderer-final.log`；最终out阶段独立重验 |
| `node scripts/xiaozhi-agent/pi-skill-management-api-smoke.mjs` | 15/15 | `test-results/xiaozhi-agent/pi-skill-api-6DKl16/report.json`；真实host/SQLite旧测试库副本/初始化、严格入参、公开投影、取消、stale、源坏关闭、main-frame与chooser锁 |
| `node scripts/xiaozhi-agent/pi-skill-host-lock-smoke.mjs` | 9/9 | `test-results/xiaozhi-agent/pi-skill-host-lock-hEFcYA/report.json`；实际host管理/启动/chooser互斥 |
| `node scripts/xiaozhi-agent/hana-skill-ui-source-audit.mjs` | 4 Hana UI + 1官方CSS | `test-results/xiaozhi-agent/hana-skill-ui-source-audit.json`；源/output字节一致、官方CSS不含@apply，静态来源证据 |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | 16/16 | `test-results/xiaozhi-agent/hana-auto-source-audit.json`；SDK10+tools6来源一致 |
| `node scripts/xiaozhi-agent/pi-skill-settings-ui-smoke.mjs` | **25/25，success=true，exit0** | `test-results/xiaozhi-agent/pi-skill-settings-ui-jiulSs/report.json`与`pi-skill-settings-ui-final5.log`；正式Electron/main/typed preload/实际DeepSeek（报告model=deepseek-flash） |
| `node scripts/xiaozhi-agent/pi-skills-ui-smoke.mjs` | 12/12，success=true，exit0 | `test-results/xiaozhi-agent/pi-skills-ui-wJ1doF/report.json`与`pi-skill-settings-builtin-ui-final.log`；官方compiled CSS后内建选择/知识检索/发送清空/双视口/重启/真实续问/源坏零请求复验 |
| `node scripts/electron-smoke.mjs` | 207/207，ok=true，exit0 | `test-results/xiaozhi-agent/pi-skill-settings-smoke-final4.log`；最终固定out旧教育主路径，脚本反馈/失败捕捉修正后通过 |
| `git diff --check`（repo cwd） | exit0 | `test-results/pi-skill-settings-diff-check-final.log`；四份协作文档/架构/台账/设计更新后重验；另20个本轮源码/脚本/合同/验收文件空白及冲突检查0错误 |

上述25项从实际页面开始，覆盖内建只读预览、取消/非法包零写入、教师导入默认关闭/本地原文、1366×768和1920×1080可达、启用/CAS、原生自定义展开/实际受限引用read/随机事实与41分钟、手机号脱敏/脚本不暴露/发送清空、真实手动compact与usage、编辑v2关闭/旧说明与真实摘要隔离、v2启用/关闭、真实重启/跨会话、归档/再导入v3默认关闭、等待教师提问时全局修改锁、损坏源零模型请求、页面关闭后真实provider恢复、全部原源hash保持。源文件含合成手机号的完整原文仅在本地预览，实际模型context不含号码。

原生chooser返回值由测试持有main注入，未声称人工点击Windows目录对话框。随机代号未在发送prompt透露，实际toolResult含完整引用代号；回复可省略代号中文前缀，断言同时核真实工具结果、回复随机部分和课时，不伪造模型输出。截图settings-1366x768.png/settings-1920x1080.png在同一report目录，已实际查看。

最终主smoke以final4的ok=true与进程exit0为准；不得用此前成功或外层PowerShell exit0覆盖final2/final3失败。

## 4. 失败保留与修正

- SveWtM：5项后Modal页内流，修复官方compiled CSS；VtFqFW：7项后Switch没有交互Content，按实际安装源码修复。均实际产品问题，保留日志/截图。
- dQPxzr：7项后点击visually hidden input被实际switch-content覆盖；uzy6YW：9项后点击Dropdown Label被真实menuitemradio覆盖。测试改为可见Content及真实菜单项，不使用force click。
- ufcDuJ：10项后要求回复完整中文代号前缀失败；实际原生read完整成功，模型回复随机部分及41分钟。修正事实断言并全流程独立重验，最后jiulSs25全部通过。
- 最终out主smoke final2/final3在旧讲义导出成功提示超时，均保留日志。进一步查到测试会等待不存在的error节点30秒，且catch把activeApps中Electron对象解构成页面，错误清理异常发生在exitCode=1之前，可能导致Node仍退出0。修正为终态DOM一次读取成功/错误，先设exitCode并遍历app.windows记录失败；未改讲义业务源码。同固定out final4成功。不能只依据外层/Node exit0忽略失败正文，也不能从本次结果推断所有历史讲义超时都由同一原因造成。
- 查找临时猜测docs67/78与audit脚本名称失败，按实际文件清单恢复；不将查找失败归因应用，不将未运行的audit记为通过。

## 5. 当前技能实际支持矩阵与下一条

| 技能/动作 | 当前真实能力 | 后续范围 |
| --- | --- | --- |
| 备课资料整理、知识查证、题目分析、教学办公文稿 | 四审核内建说明，原生渐进/显式展开，既有教育只读工具、教师澄清/计划/审批复制；返回可核对正文草稿 | 新Office文件生成、联网工具与对应真实产物另归P07 |
| 教师本地自定义技能 | 明确导入/启用的版本化说明与登记UTF8引用，必要文本脱敏；真实native read、模型执行、撤销/摘要隔离和重启通过 | Skill不会授予额外任意文件读写、shell、脚本或联网权限 |
| 来源失效/目录并发 | parser前完整包检查、入口/工具/摘要/观察器校验、全局锁/CAS；损坏仍可从页面关闭恢复 | 不自动覆盖源或执行包脚本 |

P05-A、B1、B2、B3共同完成既定技能框架范围。**下一第一动作P06：读docs/67第1/2/5/8/9节与docs/35，冻结D1校准/现成组件闭包合同；记录实际DPR/窗口/zoom/字体与原图未知元数据，做区域测量，再P06a真实工具组/细行/时长与P06b壳/面板、P06c模型设置。** 不能把现有管理弹窗或静态hash当Codex同源/完整视觉完成。P07正式办公联网/P08实际无VPN安装和最终实例继续，总目标active。未commit/push、未改系统DNS/代理/VPN或真实教师资料。
