# After 首批实机对照（进行中）

实际窗口 PID 50944；入口 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\after-verified-out\main\index.js；build bd67227ac593b4aaa8fb5f16ef4c9cc9d7961b63334268963c77d544d7d48edd；相同 data/profile 路径复用，归档证明见 after-runtime.json。after-window-visible.png 为 Sky 窗口截图。首批截图为真实页面 CDP CSS 1366×768 模拟，DPR1、zoom1；非物理窗口尺寸验收。原型审阅条36px、Electron菜单44px分别排除。after 页面导航后等待真实恢复结果；资料/题目/学生是隔离数据中的合成内容，不要求等同原型演示数据。

## 立即反馈
- FAIL（选题首屏对齐）：原型 reference-paper-1366.png 在四标签下呈现左知识点树、简洁搜索/来源按钮/筛选以及题目和右侧题篮；after-paper-two-find-1366x768.png 虽已恢复标题、四标签和三列，顶部多一整行来源操作，筛选区额外两行与多项操作占据首屏，首题底部操作落出视口；原型同尺寸可见完整第一题及第二题开头。建议只在不丢失现有业务入口前提下压缩来源操作与筛选区，将低频项渐进披露，并按真实题的完整内容对齐；不可填充示例题。
- FAIL（选中学生首屏对齐）：after-student-selected-1366x768.png 选中后沿用七项入口及原始档案生命周期/时间线大块，信息密度和原型 reference-student-selected-1366x768.png 的六标签、简短档案主体不同；应保留真实功能与权限，整理入口层级及首屏，不复制演示学生数据。
- 首页：左栏已测232px、header60px，与原型几何接近；logo颜色与轻量快捷入口已有改善。输入框镜像边框仍不同，受保护组件处理等待用户单项决定，不将其当可直接修复项。
- 资料库、设置已呈现新的树/列表和分层结构；首批截图已落盘，尚未完成逐控件、尺寸、交互验收，不给整体 PASS。
- 持久数据：after 实际恢复 1 TXT、2 题修订3已保存和合成学生；未新增数据。

## 错误和证据边界
- 主进程启动：根任务提供 mainimport 43569ms、window 43996ms；before 5734/6462ms；启动 stderr 有一次 Chromium Network service crashed or was terminated, restarting service。该信息由根启动记录提供，暂不归因于 UI。
- renderer/console：最初监听在 CDP session 超时重置时丢失，无法证明启动到现在无错误；后续另行分 scope 记录。超时发生于把 role=tab 的标签误当 button 定位，不是产品标签失效；重连后以正确 role=tab 实际进入。
- 超时重连后尺寸曾重置为1360×900，相关截图已改名为 *-1360x900.png；现有 *-1366x768.png 已重新设置并核对 viewport。

待继续：三尺寸、四标签键盘/dirty、hover/focus 和 Composer computed 对比；尚无总体验收结论。

## 后续检查
- 四标签：从找题右方向键移动焦点，Enter激活整理；再右方向键+Enter分别进入“我的练习与试卷”和“模板”。属于手动激活模式，均可到达。
- dirty：整理页将第1题分值从1临时改成2后，四个标签（含当前项）disabled，界面“会话与组卷配置 · 有未保存输入”，未直接在标签旁说明是分值。正常点击“放弃分值修改”后两个值均恢复1，四标签重新可用，篮仍2题修订3。建议在禁用导航附近给出与分值对应的明确处理提示；未保存修改未写入。
- composer：after textarea仍14px/20px padding 4px 12px 48px radius12，与before一致；权限按钮14px/20px padding0 12 radius24；权限菜单300×378.75 radius24、首项padding8 10 radius16，同before对应值。祖先字体仍 system-ui；详见 composer-computed-after.json 与 composer-computed-before-reference.json。位置随外壳变化，不等同组件外观完全一致。保护边界优先，未改控件。
- 实际 hover/focus：资料库导航 hover背景rgb(234,234,236)，键盘 focus-visible 为2px蓝色轮廓；这是单控件检查，不等于全页面交互验收。
- 视口：after-viewport-manifest.json 为5页各3尺寸的DOM、visualViewport、DPR和PNG IHDR绑定；均对应目标尺寸。早先撤回的尺寸误判不计入产品FAIL。
- after-observed-errors.json 限第二次CDP重连以后的观察范围；启动和断连间隙无法由此推断。主进程stderr实际一条Network service crashed/restarting，root正单独调查，不能归因UI。

## 补充明确修复点
- 组卷：不只顶部区域偏高；after 第一题的“参考答案与解析”“题目来源与保存版本”各占一整块高圆角披露卡，与原型题内紧凑文字披露不同，造成首屏密度低。建议保留原有可操作披露和来源链，仅调整容器密度、间距和呈现，不删除信息或破坏可访问性。
- 学生：选中后仍出现 02/03 步骤标记和四列“当前问题/阶段目标/家长关注点”旧布局，与原型简短档案/按需切换不一致。建议去除装饰序号并整理真实详情层级，保留生命周期、记录等业务入口。
- 设置：日常布局已接近原型，但联网资料部分仍包含较长的旧式独立说明、网络解析项，导致段落与原型首屏结构不一致；应以渐进披露收纳真实配置和说明，保留实际保存/权限语义。
- 800×768 下，组卷筛选区及固定题篮占据多数高度，首题操作不在首屏；不能仅凭截图断言其不可达，仍需滚动实操。

教学工作台 A14/A19 首屏补充见 teaching-firstscreen-findings.md：备课本/讲义默认展开创建表单，题本筛选堆叠，课堂输入区域 181×56px；课堂样例与真实空态不等价。
