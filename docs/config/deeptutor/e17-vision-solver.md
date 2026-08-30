# E17 Vision Solver / GeoGebra 配置与运行边界

## 已落地

Omni-Edu 注册 `analyze_geometry_figure` 只读草稿工具，复用 vendored DeepTutor v1.5.11 的 Vision Solver 设计：一次视觉分析、无可用命令时最多一次修复、GeoGebra 命令白名单与教师预览。

- route：`error_analysis`
- context：`attachment_metadata`；当前学生必须由宿主先绑定
- 输入：可选本地 `analysisId`、脱敏 `questionText`、模型草拟的命令/约束/几何关系
- 输出：`omni.vision.solver.v1`，包含状态、合法命令、`ggbScript` 草稿、facts、unknowns 与 nextActions
- 原图策略：原始图片、绝对路径、附件正文不会进入模型结果或 sidecar 事件；默认 `originalImageUploaded=false`
- 写入策略：工具不修改错题图片分析、不写学生档案、不写题库；仅产生可审阅草稿

## 安全规则

1. 没有本地错题图片时返回 `no_image`，不伪造图形。
2. 只有 `ShowAxes`、`Point`、`Segment`、`Line`、`Circle`、`Polygon`、样式与有限变换等白名单命令可以进入 `ggbScript`。
3. 外部 URL、脚本/执行/文件命令、分号/大括号和疑似隐私文本被拒绝；拒绝项不会原样回显。
4. 点坐标赋值只允许受限的 `A = (x, y)` 形状；已知命令的圆括号会做一次安全语法修正。
5. 所有结果都标记 `requiresTeacherReview=true`；图中自由点不能被解释为题干事实。

## 验收

```powershell
npm run test:deeptutor-vision-solver
```

该 smoke 覆盖 12 个用例：有效命令、圆括号修正、脚本/URL 阻断、隐私文本移除、无图结束、HostTool round-trip、缺少学生绑定与 no-write。

当前仍未完成：真实 vision provider、教师人工几何标注一致性、原图显式同意后的安全裁剪上传和最终 GeoGebra 渲染组件；这些不能由本地 deterministic smoke 代替。
