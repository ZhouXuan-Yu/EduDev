---
name: edudev-design
description: Design and review EduDev desktop pages using the user-approved navigation, progressive disclosure and HeroUI boundaries. Use for Xiaozhi UI changes, page simplification, screenshot review and interaction design; not for unrelated runtime or backend work.
---

# 小智项目 UI 设计

本 Skill 管理界面决策，不授予提交、上传、安装或数据操作权限。用户当轮要求优先。

设计交付版 V2：先看 [HTML 总览](../../../docs/design/system/ideal/handoff.html) 与[差距证据](../../../docs/design/system/UI_GAP_AND_DECISIONS_V2.md)。执行开发时读[分阶段 Goal](../../../docs/goal/UI_DESIGN_IMPLEMENTATION_V2.md)，从最新主线核对；不能按旧截图盲改。交付版不等于用户已通过全部视觉和生产验收。

**受保护区域**：现有 `OfficeComposer` 输入框、底部工具栏及其弹层整体保留，含配置、交互与外观。HTML 中的 composer 仅为布局表达，不能复制替换实际组件。

## 先识别确认状态

先读 [决策台账](references/decisions.md)。其中已确认的是设计约束，不代表正式页面已经实现；待确认项不能自动升级为产品要求。旧截图、旧 page-contracts 和现有 CSS 是迁移基线，不覆盖新的用户决定。保留功能及业务真源，并不要求保留重复的可见入口。

## 按任务读取

- 视觉、布局与 HeroUI 接入：[视觉与组件边界](references/visual-system.md)。
- 页面重组与去冗余：[页面契约](references/page-contracts.md)。
- 聊天、工具、正文、审批与跨页状态：[交互契约](references/interaction-contracts.md)。
- 实施与截图验收：[验证与反例](references/verification.md)。
- 组件选型、代码边界和任务切片：[实施映射](references/implementation-map.md)。

## 工作方式

1. 在修改前核对当前 Git、实际启动路径及本轮涉及的消费者。现有主进程权限、Pi、SQLite/文件真源、草稿与恢复遵循根目录工程合同。
2. 定义页面的用户目标、唯一主要行动、首屏必需内容和可渐进披露内容；每个拟删除入口写明功能的新去向。不要用删除业务模块实现精简。
3. 对有争议的视觉或结构先出标明身份的样张；没有批准的设计变化保持提案。已确认项不重复询问。第三方 Skill 是参考，不替代台账。
4. 最小页面切片实施，应用布局与组件内部样式分开。根据当前可用的官方文档核对组件 API；访问受限时使用用户已有的本地源码，不要求新凭证。
5. 验证真实交互、布局与业务保留，再按仓库授权交付。样张检查、工程检查、正式 Electron 验收、教师视觉接受分别报告。

## 审查输出

给出可定位问题、教师影响、最小修复和实际验证；交付列出修改范围、前后截图、失败与未验证项。无相关变化时不运行无关全套回归。不得以“高级感”、文件数量或自动化通过数代替视觉接受。

## 组卷专项更新（用户已确认）

先读 [组卷V3需求与边界](../../../docs/design/system/ideal/QUESTION_STUDIO.md) 和决策D14。完整题目选题必须占主区；输出用途不得包装成三个同质工作流；题篮/编辑/预览共用题组，返回与恢复要实测。参考卷的命题结构和卷面模板独立复用。原型中示例OCR/AI及浏览器存储不得搬入正式业务当作完成实现。
