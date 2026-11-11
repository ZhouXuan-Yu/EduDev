# R2 实机修复复验（部分）

PID 58540，入口 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\after-repair-out\main\index.js，build 0607f3a43694137cd30fc770d1c7d56c427cca84d995aa14c8d72371a6307792，原data/profile复用。原生窗口 PID→HWND 2758170→Sky标题核对，r2-native-window-confirmed.png；首次误选宠物窗口截图 r2-wrong-window-not-evidence.png 保留且不是证据。用户已批准输入外框但本构建未包含，故 NOT_RUN，不计R2失败。截图尺寸及 DOM/PNG 核对见 r2-viewport-manifest.json。

## 结果
- PASS（有限视觉切片）：paper 1366 首题完整和第二题开头可见；紧凑来源/答案披露及搜索筛选改善。800同样首题操作可见；实际点击题目来源显示教师资料、原题号2与内容版本。更多筛选可展开原题号、题源及原有业务入口。真实题篮保持2题修订3；未做整卷确认。
- PASS（有限视觉切片）：学生选中首屏展示六标签、简洁档案；更多档案操作可展开打开目录、导出、归档及完整历史，未执行这些操作。空字段为真实空态。
- FAIL：学生搜索框实际高度60px，原型约42.58px。R2 input高38px，computed padding0、min-height38px来自 app styles.css 全局 input/select（约536行）；父 .directory :global(.search-box)（student-workbench.module.css:56）padding 10px 12px，覆盖通用 .search-box 水平padding，使38+20+边框约60。建议仅审查该应用自有搜索容器和输入层叠，维持官方控件保护及键盘焦点。
- 学生资料网格：实测 dl宽796，computed grid-template-columns 386px 386px；四子项 x=534/944/534/944，dt/dd分别 block、宽386；并未观察到学科 x=623。获胜 grid 规则为编译的 ._profileFacts_xv8ec_184，源码 student-workbench.module.css:184；完整 CDP CSS matched rules 和逐节点几何见 r2-student-geometry-cssom.json。截图印象与实际DOM不一致，不能据此判列宽失败；这是该一帧/该数据的测量，不等于全响应式验收。
- 设置：联网资料由独立标题、说明、开关和解析/保存组成；还须与原型逐项及窄屏滚动验证，未判整体通过。
- 资料库：同一 TXT 在1366/1920/800可见，800目录收纳为“目录与标签”；尚未验全部筛选和故障状态。

## 日志/范围
启动 startup.json: before-main-import 152ms、after-main-import 53446ms、window-created 53814ms；前次after分别约43569/43996ms。stderr 一次 Chromium Network service crashed or was terminated, restarting service；不能归因UI。renderer/console仅在连接监听期间记录，启动前/断连间隙未知，不宣称全程零错误。未新增模型请求或数据。

800px 设置滚轮/Tab、资料目录toggle及题目来源键盘焦点结果见 r2-narrow-interaction-scope.md；均限指定控件，R2 GUI暂停等待最终构建。
