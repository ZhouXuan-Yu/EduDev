# 最终讲义草稿有限复验

PID 187760，入口 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\after-draft-out\main\index.js，build 9777433d115fb66d48a1586446a9696eadf3cacce08fab04988411964f668f61；原绝对 data/profile 重用。native JPEG 909×601：draft-final-native.jpg。未发送模型请求；仅通过UI写入隔离QA讲义。

- PASS：原丢稿路径：QA合成讲义-UI验收编辑说明为“QA草稿保留-验证”，返回列表提示未保存修改，重新进入同书保留该文字。
- PASS：dirty时依次尝试新建、切换另一本、刷新、教学主导航，页面提示先保存或明确放弃，仍是同一本且草稿文字保留。该保护通过阻止动作并显示说明实现，非要求按钮本身disabled。
- PASS：返回列表明确点击“放弃未保存修改”，重新进入说明恢复原值“本地界面验收合成数据”。
- PASS：将该QA讲义说明改为“QA保存版本2-验收”并保存，UI提示信息已保存、列表显示第2版。只读SQLite确认对应id teaching_book_531b0d02-60fe-4d25-8862-3aaec304575d、draft、version2、说明一致。第二份QA合成讲义-切换验收为draft/version1。数据为隔离QA，无用户资料。
- PASS：新建讲义输入“QA未保存新建草稿”后返回，再次点击新建仍保留该标题；随后明确放弃该未保存草稿，没有新建第三本。仅验证当前运行会话。
- 首页：问小智图标 lucide-message-square，新建对话 lucide-plus；1366×768 CSS下应用外框720×178、border1px rgb(227,229,235)、radius16，截图 draft-final-home-readback.png；此为本次受限回归，不替代历史三尺寸全页验收。

## 范围和错误
截图 draft-final-dirty-list.png、draft-final-qa-list.png；SQLite只读查询结果及首页计算值见 draft-final-readback.json。自动化监听自附加CDP起观察，之前存在间隙；根启动器 observed-errors.json 当时报告 attachedBeforeMain=true、consoleErrors=[]、processEvents=[]、dropped=0、httpAttempts=0，仅该观察文件覆盖范围。主进程 stderr 有一次 Chromium Network service crashed or was terminated, restarting service；不可合并或过滤成0，也不能单凭它归因UI。未复测全业务或三个完整journeys。
