## 2026-11-03 已批准最终设计与有限实施交接

用户已最终确认当前UI。实施先读 [最终交接书](UI_FINAL_HANDOFF.md)、[可结项Goal](../../goal/UI_FINAL_IMPLEMENTATION_GOAL.md)、[36项验收](UI_FINAL_ACCEPTANCE.md) 和 [设计指纹](UI_FINAL_BASELINE.json)。以下旧“待视觉确认”仅保留历史，不得触发重新设计。生产实现仍需真实验收。

# 小智 UI 规范与审阅入口

## 2026-11-01 V2 最终设计交付

入口：[设计总览](ideal/handoff.html) · [完整可交互HTML](ideal/index.html) · [差距与证据](UI_GAP_AND_DECISIONS_V2.md) · [项目Skill](../../../.agents/skills/edudev-design/SKILL.md) · [开发Goal](../../goal/UI_DESIGN_IMPLEMENTATION_V2.md)。本轮用户已要求同步交付Skills和Goal；正式业务实现仍由另一AI负责。输入框、底部工具栏及弹层原样保留，资料库和组卷深化，课堂预演为独立新增提案。最终检查见ideal/VALIDATION.md；下文旧25/44、待整理Skills与D09待确认均为历史记录，不覆盖V2。

## 2026-11-01 当前审阅：完整 HTML 设计

用户已确认此前布局方向和设置日常/高级分层，并明确本 Agent 只负责设计，正式代码由另一 AI 实施。当前入口改为 [完整 HTML](ideal/index.html) 与[审阅说明](ideal/README.md)：覆盖全部业务入口、对话六态、工作台、设置与文件预览。25 项离线检查通过，44 张截图，0 页面错误/外部请求；不等于正式业务验收。待完整视觉确认后才整理最终 Skills 与 Goal，本轮未改其文件，也未改正式应用源码。以下为上轮归档，保留原证据与当时的待确认状态。

## 2026-10-31 归档

2026-10-31。状态：用户已确认设计方向；布局样张待视觉接受；设置分层提案未确认。正式 UI 仍为原实现，本轮不是页面重构交付。

单一规范入口：[项目Skill](../../../.agents/skills/edudev-design/SKILL.md)。细节保存在其references，不在多个文档复制数值。用户已确认条目与待确认项见[台账](../../../.agents/skills/edudev-design/references/decisions.md)。

## 本轮交付合同

- 复用空闲分支codex/workbench-ui-20261031；不改正式renderer/main/preload/vendor，不改数据、路由和权限。
- 建立Skill、页面/交互/验证契约和三个代表性离线样张。样张数据显式标为合成；设置高级分层标待确认。
- 保持现有原页面兼容；没有本轮生产性能变化，无迁移。撤销本轮文档/样张提交即可回退，不碰业务数据。
- 通过结构校验、引用检查、样张交互/布局检查后依既有授权提交至main。原Electron/模型测试不在本轮冒充已重跑。

## 查看样张

打开 [review/index.html](review/index.html)，顶部“对话首页 / 学生工作台 / 设置提案”切换。可选择合成学生、切换页内标签、展开高级区域、点击文件提示打开/关闭右栏；没有业务IPC与网络请求。所有按钮只演示所标明行为，不生成教学结果。

样张用于结构、密度和文字审阅，使用应用自有HTML/CSS，不是HeroUI原厂渲染对照，也不是正式业务界面。接受布局后必须用实际HeroUI最小切片重建并再次截图。

## 调研取舍

- 本地design-process负责需求与结构；heroui-react-pro、heroui-pro-design-taste负责组件边界。使用skill-creator组织渐进引用和结构验证。
- [HeroUI官方主题](https://heroui.pro/docs/react/getting-started/theming)：核对实际组件版本、样式顺序和主题影响；MCP已在调研轮成功返回Sidebar、PromptInput与Theming。
- [finesse-brief](https://github.com/mouse-lin/finesse-brief/blob/main/skills/finesse-brief/SKILL.md)：借鉴任务/对象/来源/空态；不套其网页前提和固定提问轮数。
- [finesse-ui产品界面](https://github.com/mouse-lin/finesse-skill/blob/main/skills/finesse-ui/references/product-ui.md)：借鉴审查方法，不采用强制色调/大圆角/暗色对等/装饰引擎等与本产品冲突规则。
- [Vercel界面审查](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md)：后续用于键盘、焦点、表单；不能替代教师视觉验收。
- 用户提供D:/Edge_down/SKILL.md为V0.1草案，引用的配套references未在该位置找到；本轮原创补齐本项目契约，不执行第三方安装脚本，不覆盖AGENTS.md。

## 验证

实际结果：skill-creator/scripts/quick_validate.py通过；5个Skill本地引用均存在；review.js/check.mjs语法检查通过；`node docs/design/system/review/check.mjs`最终13项通过、0页面错误、0网络请求。报告 [review/evidence/report.json](review/evidence/report.json)，含样张源码SHA256；双尺寸、840/700窄窗、草稿保留、学生上下文、右栏提示/显式打开/Esc焦点恢复、高级区域键盘操作、reduced-motion均在离线Chromium实测。

911×512测试仅近似1366×768在150%下可用CSS面积，不是原生Windows缩放或IME验收。Skill结构与引用检查不等于独立模型行为评测；未派发子Agent。未运行正式Electron/真实provider、本轮未修改生产源码，旧门禁失败不宣称消除。

首轮失败保留于review/evidence/report-first-failure.json和first-failure.png：侧栏尚处于8px入场位移时，边界测量失败；测试改为等待实际动画完成，仍检查完整边界，重跑通过。截图禁用过渡并等待临时提示消失，避免将旧选中态过渡误认为最终状态。

可读性格式整理曾给空提示节点加入空白，使`:empty`失效；已清除提示节点及空输入框的空白并复验通过，失败报告保留于review/evidence/report-formatting-failure.json。失败截图直接捕获页面，不依赖正常提示消失，避免二次超时遮蔽原错误。

正式页面尚未实现D01–D08全部行为；设置D09仍待确认，不会以继续任务当作对此选项的批准。正式视觉接受及真实HeroUI切片留待用户审阅这些样张后执行。

提交前npm audit --json仍exit1，45项（8 high、29 moderate、8 low、0 critical）；无依赖变更和自动升级。原始审计报告保留于本机TEMP/edudev-design-skill-audit.json。不把本轮规范与样张交付计入正式功能AT。
