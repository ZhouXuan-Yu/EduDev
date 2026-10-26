# 教师 WPS 动态放映验收合同（2026-10-23）

## 教师结果

教师可在本机 WPS Presentation 中只读打开已导出的课堂课件，看到内嵌动图实际播放，并切到独立静态讲解页。验收不能依赖 Microsoft PowerPoint 的通过结果。

## 环境边界

- 本机 `KWPP.Application` 注册为 WPS `12.1.0.29161`，可创建独立 COM 实例。
- 用户已有一个 WPS 后台进程；测试只能使用 `DispatchEx` 新建 owned 实例，并在结束时退出该实例。
- 不结束、激活或修改用户现有 WPS 窗口。

## 修改边界

- 新增独立 WPS 只读验收脚本，不修改生产导出逻辑。
- 只对 owned 放映窗临时置顶并真实桌面抓帧，抓帧后、窗口退出前恢复层级。
- 不使用静态 PNG、文件格式存在性、Microsoft PowerPoint 结果或模型自评替代 WPS 放映。

## 完成定义

1. WPS owned 实例打开实际 6 页 PPTX，原文件 SHA-256 不变。
2. 原生教学文字和备注可读，参考答案不上学生页。
3. 两个真实桌面帧的动画区域平均变化大于 `0.2`。
4. 可切到第 3 页静态讲解页。
5. 临时置顶恢复，owned WPP/WPS 实例退出，用户原 WPS 进程保持存活。
6. 旧失败和 WPS 放映失败均保留；投影、真人、VPN-off、安装不因本片通过而关闭。

## 探测结果

- 独立 `KWPP.Application` 实例可真实打开 6 页 PPTX；原生文字和备注检查 3/3 通过，用户原 WPS 进程未被激活或关闭。
- 依据 WPS 官方对象模型将 `ShowType` 设为 speaker，并从 `Application.SlideShowWindows.Item(1)` 取控制对象后，WPS 确实创建了标题为 `WPS Presentation Slide Show - [owned.pptx]` 的 `Qt5QWindowIcon` 放映窗。
- 桌面截图被另一个用户 WPS 窗口遮挡；Pillow window capture 为白屏，`PrintWindow(PW_RENDERFULLCONTENT)` 与窗口 DC `BitBlt` 也均得到空白/均匀表面。
- 因此当前只证明“真实 WPS 放映窗出现”，没有证明动画帧变化或静态页视觉。
- `wpp.exe /s <file>` 与 `<file> /s` 均只产生无可见窗口的 WPS prometheus/background 路由，不能据此证明放映。
- `playback4` 至 `playback7` 的全部抓取失败保留；本轮 owned 后台进程已按精确 PID 清理，用户原 `wps.exe` 进程保持存活。
- 状态为 `IMPLEMENTED_UNVERIFIED`，WPS 动态放映仍 OPEN。PowerPoint 通过不能替代 WPS。
