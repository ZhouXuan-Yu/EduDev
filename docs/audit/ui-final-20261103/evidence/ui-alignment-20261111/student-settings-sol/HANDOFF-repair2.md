# 学生搜索框定向修复 2

生产源已冻结，单文件摘要位于 repair2-static-check.json，files 数组仅含本次 CSS 路径与 SHA256。root 可依 initial static-check.json、repair1-static-check.json、repair2-static-check.json 顺序按 path 覆盖摘要。首轮与 R1 的源码、失败、交接和静态证据继续保留原身份。

## 实际证据

Terra 的 r2-student-geometry-cssom.json 记录实际搜索父框 216×60、padding 10px 12px，输入高 38px、padding 0。matchedRules 中通用 input/select 提供 min-height 38px，应用目录模块提供父框上下各 10px 的 padding。参考父框为 216.333×42.583、padding 0px 11px，输入高 41.25px、padding 9px 0px。

原型 tokens.css 的本地规则为 body 15px/1.55、搜索父框 padding 0 11px、输入 padding 9px 0。该行高只应用于本次应用自有学生搜索输入。

## 精确修改

唯一生产文件为 apps/desktop/src/renderer/ui-system/student-settings/student-workbench.module.css。

- .directory :global(.search-box) 的 padding 改为 0 11px。
- .directory :global(.search-box) > input 的 min-height 为 0、height 为 auto、padding 为 9px 0、line-height 为 1.55。现有字号沿用。

其余规则逐字保留。实测 profileFacts 的两列均为 386px、起点为 x534/x944，继续保留该已确认几何。App、领域 handlers、官方控件、其他 writer 文件沿冻结版本交给 root 汇总。

## 静态结果

4 项静态检查 PASS，限定单文件 git diff --check exit 0。

1. 与 R1 前像的预期替换逐字相同，变化局限两条搜索规则。
2. PostCSS 解析及应用自有选择器边界通过。
3. 去掉两条搜索规则后，其余样式文本与 R1 相同。
4. 现有 nativeComponentBoundary 处理后保留本模块完整文本。

本次前像 repair2-before-student-workbench.module.css 的 SHA256 与 R1 manifest 中该文件相同。新 SHA256 为 58f01faa135ff122dc627199c3f8740200f36139e0cf477bb9f531e96d4a0549。

几何验证等待 root 合并构建及 Terra 实机 computed/readback。输入自然尺寸按现有字号、原型行高与 padding 计算，父框沿原应用边框布局，由后续实测记录最终亚像素尺寸。性能、正式构建、246 项组件和样式隔离由 root 统一验证。

回滚仅需恢复本次单文件前像，再由 root 重新构建。R1 的其他生产内容与历史证据按原范围保留。
