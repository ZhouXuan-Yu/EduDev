# 教师 PowerPoint 动态放映验收合同（2026-10-23）

## 教师结果

辅导教师把已审教学页追加到自己的课件副本后，能在本机 Microsoft PowerPoint 中打开放映，看到内嵌动图实际变化，并能进入独立静态讲解页；原始课件和源 HTML 保持不变。

## 当前失败

- `pi-science-powerpoint-playback-LXxDhC` 前 3 项真实通过：PowerPoint 打开、原生渲染、教学文字/备注与答案隔离。
- 唯一失败为自动化进程无权对 owned `PPTFrameClass` 放映窗调用 `SetForegroundWindow`。
- 该失败不得解释为动画失败，也不得由静态 PNG 或导出帧冒充放映。

## 修改边界

- 只调整验收脚本的 owned 窗口置顶/截图生命周期。
- 不使用 `PrintWindow`、不修改幻灯片 XML、不改系统前台策略、不激活无关窗口。
- 仅对本次 PowerPoint 进程创建、标题包含本轮 owned 文件名的放映窗临时 `HWND_TOPMOST`；截图结束或异常时必须恢复 `HWND_NOTOPMOST`。
- WPS、真实投影、教师人工操作和 VPN-off 仍单独验收。

## 完成定义

1. 放映窗真实可见且尺寸有效，截图来自当前桌面，不是全白占位图。
2. 间隔截图的 diagram 区域平均像素变化大于既有 `0.2` 门槛。
3. 可切到第 3 页静态讲解页并核 PowerPoint COM 当前页。
4. 原课件 SHA-256 前后不变，异常路径也恢复窗口层级。
5. 保留旧失败 `LXxDhC`；软件通过只关闭 PowerPoint 自动化放映，不关闭 WPS、投影或真人验收。

## 本轮结果

- Microsoft PowerPoint `16.0.20430` 上 `pi-science-powerpoint-playback-topmost4-20261023`：8/8。
- 动画区域两帧平均像素变化 `2.4690852583129`；合并课件副本 `2.2954918914268507`，均高于 `0.2`。
- 真实桌面截图显示放映窗、动画前后帧和静态讲解页；截图已逐张查看。
- owned 放映窗临时置顶后，在窗口退出前恢复；PowerPoint/Python 相关进程为 0。
- 原课件、原 HTML 和已有课件副本哈希保护通过。
- 旧失败 `LXxDhC`、`topmost-20261023`、`topmost3-20261023` 保留；WPS、投影、真人、VPN-off 和安装仍 OPEN。
