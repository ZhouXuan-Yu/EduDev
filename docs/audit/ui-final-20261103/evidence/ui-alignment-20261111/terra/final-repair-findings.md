# 教学布局修复复验

PID 50220，build 7f26bc6581d54dcda07a52d7473e5060ad6914604cc3e559798633739bbcb503，真实 renderer 来自 after-teaching-repair-out。截图为 CDP CSS 视口，DPR1、visualViewport scale1，PNG尺寸与DOM一致；逐项见 repair-teaching-viewport-manifest.json。

- PASS（本轮范围）：教学文件真实空态单列，1366网格/目录1062/1062px，1920为1616/1616px，800为684/684px；标题 computed 20px。截图 repair-teaching-files-*.png。
- PASS（本轮范围）：教学文件、备课本、讲义、题本四项实际点击后各自 aria-current=page，选中项为2px蓝色下划线、radius0；第五项组卷进入专用页面后原五项导航 isVisible=false。五项真实hover均有背景反馈，键盘Tab/Shift+Tab实测均有2px蓝色focus-visible轮廓。
- PASS（本轮范围）：组卷显示原四个标签：找题与选题、整理与编辑、我的练习与试卷、模板；真实两题题篮修订3仍显示已保存。800宽题目列表鼠标滚轮后内部 scrollTop=206（内容502、视区296），可滚动。截图 repair-teaching-paper-*.png。
- 未重测已知讲义未保存草稿问题，交由下一修复构建。此记录不覆盖全业务、真实模型、教学质量或后续产品验收。

## 监听边界
渲染器 console.error/pageerror 监听从本次重新连接页面时开始，期间捕获 0 项；应用启动至首次附加、用户中断及本次重新连接之前存在观察间隙，不可宣称全程零错误。主进程stderr/启动探针由root单独汇总。
