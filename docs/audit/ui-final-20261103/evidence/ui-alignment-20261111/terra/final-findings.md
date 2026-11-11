# 组合构建首批发现（进行中）

PID 172252、build f8d943a741e9cdd44cfc5ade1df7a5aab745817ed09f9246a9e2b41478900818；native窗口句柄8851350，JPEG 909×601。

- FAIL 教学工作台→教学文件空列表：1366×768 实测容器1047px，grid-template-columns 400.297px 622.703px，空目录仅400.297px，右侧仍占622.703px；截图 final-teaching-default-1366x768.png。CSSOM同等特异性 ._workspace_1bc2t_1 ._columns_1bc2t_9（源 teaching-catalogue-alignment.module.css:9，单列）与后出现 ._workspace_5l1pc_5 ._columns_5l1pc_77（源 teaching-files.module.css:39，双列）匹配；computed证实后者生效。相同层叠问题使标题26px（旧 teaching-files.module.css:22），而新 alignment规则为20px。具体匹配见 final-teaching-cascade.json；不要将空数据与此几何差异混同。
- FAIL 顶层五项教学导航：当前教学文件按钮 computed 背景 oklch(0.94...)、圆角24px、下边框0，视觉是胶囊；参考是蓝色下划线。应由 ProductSpaceShell/WorkbenchPageNavigation 应用层处理，保留键盘与真实路由，不更改官方组件内部。
- 备课本原生table键盘：从搜索框 Tab→刷新→显示已删除→QA行按钮，Enter打开“备课本信息”；有限路径 PASS，未使用旧 ListView箭头假设。
- 受保护输入组件：1px #e3e5eb、radius16外框，textarea和权限按钮/menu 字体、字号、行高、padding/radius/color与before采样一致；菜单尺寸尚需等待动画自然稳定重采。

## 补充完成与局限
- 首页外框 720×178、1px rgb(227,229,235)、radius16；textarea/按钮/菜单对应 font/line/padding/radius/color与before采样一致。菜单自然动画后两次稳定 300×378.75，首项288×61.6875、transform none；中间帧保留 final-composer-computed.json，序列 final-menu-stable.json。
- 学生搜索：1366下外框216×43.25，input高41.25、padding9px 0、min-height0；原型外框约42.58，R2 60px已明显缩小。
- 课堂：教学工作台→课堂设计与预演，真实空态输入框1366下1062×96，scrollHeight96，较r1的181×56/scrollHeight96改善；未创建课堂或请求模型，原型有合成课，状态不可直接等同。
- 已用真实UI创建QA合成备课本与讲义并返回列表，列表行从搜索框按Tab经刷新、显示已删除后到行按钮，Enter分别打开编辑页。只读SQLite分别回查 active/draft、version1。备课本已保存项说明未保存修改后返回再进入，在当前页面内保留草稿；新建备课本输入后返回再打开也在当前页面内保留；仅证明同一运行会话。讲义已保存项说明修改后返回列表无提示，重新打开恢复旧值且未保存文字丢失，FAIL：需要明确提示或保留草稿，不可静默丢失。
- 题本创建折叠草稿尝试自动化超时，重连后发现编辑框仍有测试文字，已手动清空并收起；无法证明完整折叠重开路径，CANNOT_VERIFY。
- renderer/console：本轮未建立覆盖启动至关闭的连续监听，不能推断零错误。startup 438ms before-main-import、42079ms after-main-import、43478ms window-created；stderr一条 Chromium Network service crashed/restarting，不能归因UI。
- 三视口截图大小在采集时由DOM和PNG双核对，清单 final-viewport-manifest.json；native JPEG另列。记录数据为隔离QA，未发模型请求。
