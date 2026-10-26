# 教师文件栏拖拽命中区合同

## 第一性目标

文件栏宽度只用于分配“文件导航”和“正文阅读”的可用空间。教师最常做的是打开讲义、备课稿或课件后连续阅读；拖动分隔线不能让老师反复寻找 1px 细线，也不能把时间花在判断“这里到底能不能拖”。

HeroUI Pro 的原始分隔线保持 1px 视觉宽度，并提供 8px 透明命中区。问题在于相邻文件面板在绘制顺序上盖住了这个命中区，导致鼠标落在细线附近时被 `pi-file-panel` 截获。修复只让当前小智文件工作台的拖拽把手位于面板之上。

## 冻结范围

- 只修改 `apps/desktop/src/renderer/components/office/pi-workspace-files.css` 中 `.pi-shell-files .app-layout__resizable > [data-slot='resizable-handle']` 的层级。
- 不改变原始 HeroUI Pro Resizable、面板尺寸、最小/最大宽度、持久布局、文件权限、文件内容或 Agent 行为。
- 不新增 IPC、SQLite 表、依赖、模型调用或第二 Agent Loop。
- 自动化测试使用真实鼠标悬停与拖动，不通过键盘或直接改 localStorage 绕过质量问题。

## 验收标准

1. 在 1366×768、1920×1080、浅色与暗色四种组合中，教师都能用真实鼠标把文件面板拖到约 360px。
2. 隐藏文件树后，`pi-file-preview` 正文宽度不少于 330px；文件列表、刷新、关闭和发送按钮全部可达。
3. 拖拽后必须等待最终布局稳定再读取宽度，不能把过渡中的中间帧当作成功或失败。
4. 测试报告记录四种组合的最终 `panelWidth` 与 `readingWidth`。
5. 同一构建连续两次完整 32/32 通过，0 renderer 错误、0 远程请求。
6. `npm run build`、`npm run test:renderer-components`、`git diff --check` 通过，测试结束后 Electron/PowerPoint/WPS 进程为 0。

## 保留失败

- `pi-files-ui-TTu3HI`：测试在拖拽结束前读取面板，宽度仍为旧值而失败。
- `pi-files-ui-Dq65HM`：隐藏文件树后下一帧未完成，正文宽度取样过早而失败。
- `pi-files-ui-RqLsSX`：真实悬停被文件面板子树拦截，证明 1px 分隔线命中区存在产品级缺陷。
- `pi-files-ui-xeghZa`：加入稳定等待后仍无法拖动，进一步确认必须修复绘制层级。

这些报告不改为通过。最终同一构建证据：

- `apps/desktop/test-results/xiaozhi-agent/pi-files-ui-epp8uJ/report.json`
- `apps/desktop/test-results/xiaozhi-agent/pi-files-ui-0lU3GY/report.json`

## 边界

本片只证明正式 Electron 中的本地文件栏交互。真实教师使用、教学文件内容质量、VPN-off、安装包以及 PowerPoint/WPS 动态放映仍各自验收，不用本片替代。
