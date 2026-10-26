# 教师工作目录显示名称合同（2026-10-22）

## 状态

`LIMITED_ACCEPTED`。本切片清理教师界面中的内部目录名，不改变目录授权、真实路径或业务数据。

## 教师可见问题

课件合并和文件面板截图仍直接显示英文内部名称`workspace`，而周围界面统一使用“教学工作目录”。对辅导老师而言，这既不一致，也像开发环境术语。

## 第一性判断

- 老师选择的自定义目录名应保留，例如“六年级数学教研”。
- 仅测试、临时或内部名称`workspace/workspaces/workdir/work-dir/工作区`需要映射。
- 映射只发生在renderer展示层，数据库中的原始标签、真实路径和权限版本不改。
- 文件树、顶部上下文说明、资料范围和设置页需要使用同一规则。

## 修改边界

- 新增纯函数`teacherWorkspaceLabel`，最多显示200字符。
- 接入`PiWorkspaceFiles`、`PiWorkspaceContext`和`PiSettingsWorkspace`。
- 不新增IPC、SQLite、依赖、文件权限、模型调用或业务写入。
- 不根据目录路径推断教师学科或内容。

## 验收

1. `workspace`、`workspace-2`、`工作区`显示为“教学工作目录”。
2. 空标签显示为“教学工作目录”。
3. 老师自定义“六年级数学教研”保持原样。
4. 真实Electron授权一个名为`workspace`的目录后，数据库raw label仍为`workspace`，界面显示“教学工作目录”。
5. 文件树仍能列出文件，顶部上下文与文件列表使用同一显示规则。
6. renderer组件、build和diff通过。

## 证据

- 当前构建：`dde1e30018a6a8edd0a4954faa8ff941a026d79d448ed627a0bf745fb6a3ed0f`，373文件。
- `apps/desktop/test-results/goal/teacher-mainline-workspace-label-20261022/report.json`。
- `workspace-label-dark-1366x768.png`：raw label为`workspace`，教师界面显示“教学工作目录”，实际文件仍列出。
- renderer组件240/240；build与diff通过。
- 修复前截图`failed-workspace-header-raw.png`保留。

## 边界与下一步

本片不改后端标签，也不验证老师真实目录命名习惯。下一主线仍是目标教师用真实资料、真实错题和已有课件完成三条工作流；只修复真实试用暴露的阻塞。
