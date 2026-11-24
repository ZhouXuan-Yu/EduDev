# 10 成熟方案依据与适配边界

核查日期：2026-11-24。以下为官方资料；“小智采用方式”属于结合项目约束的设计判断，不是官方对小智的要求。网页版本会变化，实际组件 API 以项目锁文件为准。

| 来源 | 已核实模式 | 小智采用方式与边界 |
| --- | --- | --- |
| [WorkBuddy 任务管理](https://www.codebuddy.cn/docs/workbuddy/Task-Management) | 卡片展示标题 / 状态 / 时间，可以回到原任务继续 | 任务突出真实下一步；不照搬其状态枚举或一任务一会话关系 |
| [WorkBuddy 结果查看](https://www.codebuddy.cn/docs/workbuddy/Results) | 当前任务内以结果区查看产物、网页、文件和变更 | 成果入口保留来源任务；不新增另一套存储 / 版本系统 |
| [WorkBuddy 系统设置](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Setting) | 分类、项目搜索定位；设置独立窗口，关闭不终止主任务 | 借鉴清楚分类和不丢工作上下文；不强制小智改原生窗口，不照搬即时生效 |
| [豆包记忆 FAQ](https://www.doubao.com/legal/memory_faq) | 用户可管理记忆；关闭、删除及其效果存在区别 | 展示实际教学偏好和范围，避免开关吞掉不同语义；小智保存 / 生效仍按自身接口 |
| [HeroUI 组件目录](https://heroui.com/en/docs/react/components) | 基础与 Pro 共享主题、tokens 和 API | 使用同一体系；记录真实来源；不要求每个基础控件都必须收费 Pro |
| [HeroUI Select](https://heroui.com/en/docs/react/components/select) 与 [Accordion](https://heroui.com/en/docs/react/components/accordion) | 提供 Indicator 和受控交互状态 | 替换默认黑三角、保持键盘与状态；新文档不能作为升级项目依据 |
| [Fluent 2 Drawer](https://fluent2.microsoft.design/components/web/react/core/drawer/usage) | Drawer 承接相关补充信息；复杂流程宜专门界面；避免多个遮挡 Drawer | 保持按需右栏、对象明确、关闭保护编辑；不引入 Fluent 库 |
| [WAI-ARIA 模态框模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 模态焦点管理、Tab、Escape 与关闭后合理归还焦点 | 按模态 / 非模态分别实现，不用所有面板都锁焦点 |
| [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) | 指针目标 24×24 CSS px 最小规则，含间距等例外 | 沿官方控件尺寸、检查图标点击区；24px 不是统一按钮大小 |
| [WCAG 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | 状态消息可被程序识别，不必夺取焦点 | 保存 / 等待 / 错误及时可理解，适当状态播报，不全弹成模态框 |

豆包桌面设置外观的直接参照是用户提供截图。本次联网核实其记忆说明，未声称逐页体验了最新豆包客户端。WorkBuddy 的权限 / 模型 / 默认策略不作为改变小智底座的依据。

本包的 18 页覆盖、28 项验收、窗口矩阵、200ms / 500ms 局部反馈目标与收敛规则是项目执行合同，不冒称来自上述产品或 W3C。

## 项目一手依据

- [根 AGENTS](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/AGENTS.md)
- [设计 Skill](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/.agents/skills/edudev-design/SKILL.md)
- [决策台账](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/.agents/skills/edudev-design/references/decisions.md)
- [旧有限 Goal](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/docs/goal/UI_FINAL_IMPLEMENTATION_GOAL.md)
- [旧 36 项门禁](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/docs/design/system/UI_FINAL_ACCEPTANCE.md)
- [当前页面合同](https://github.com/ZhouXuan-Yu/EduDev/blob/10d0d2a9242a82cb8b3a6138a1ee0fd08afbc947/apps/desktop/src/renderer/ui-system/page-contracts.ts)
- [历史截图索引](https://github.com/ZhouXuan-Yu/EduDev/blob/db9056a6633b1fad14f652840810ae889c65c1ca/docs/ui-audit/20261124-1848/PAGE_INDEX.md)

以上 URL 固定提交用于追溯，执行仍以现场最新主线与已授权工作树为准。
