# Reference / before 首批对照（实际页面，非最终验收）

- Electron PID 176432，实际入口 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\before-out\main\index.js；build 48a7b62b86afeada90ad4deb6c796037456af404278975b2ef570396d7b49062。renderer 起点据根任务为 87a7f9d，完整 before 源码含并发 KB 改动，不能声称整棵源码等同该提交。独立 data/profile 见 before-runtime.json。桌面真实窗口已由 sky 激活，见 before-window-visible.png。
- 采集的是 1366×768、1920×768、800×768 CSS 视口的实际渲染截图，CDP 视口模拟，DPR约1、visualViewport.scale=1；不是已确认物理窗口尺寸。reference 含 36px 审阅条，before 顶部菜单区实测 44px，比较应分别扣除。未插样式、未强制伪态、未禁用动画。

## 首页主要差异（1366）
1. 标志原型黑色 rgb(35,36,39)，before 蓝色 rgb(0,47,167)；品牌字同22px，原型权重600 / before 700。原型左栏232px，before 248px；选中项原型浅蓝底、before白底。
2. 主标题原型27px/37.8px，before 27.32px/38.248px，字体族分别 Segoe UI/Microsoft YaHei 与 ui-sans-serif/system-ui；标题区y约192.45 vs191.33，比较时还需扣除各自顶条。副标题文字不同。
3. 轻量入口原型透明、无边框、圆角8px，before浅灰背景、有边框、圆角999px；字号14px vs13px。入口视觉应在外层布局审查，不能借此更换受保护组件。
4. 原型 composer 镜像边框可见，before 实际 wb-input-frame computed border 为0px、radius 0；原型外框宽720、高197.48，before wb-input-frame宽772、高196。外框缺失为具体可见差异；该镜像非产品规范替换件，OfficeComposer/工具栏/弹层保护优先，任何修复需先确认 CSS 责任和保护边界。

## Composer 基线（点击请求批准菜单后采样）
- textarea：原型16px/27.2px、padding 2px 0、radius0；before 14px/20px、padding 4px 12px 48px、radius12px。字体族不同，before 祖先至 edu-shell 均继承 system-ui，不能把此差异归因于某一行 CSS 而不进一步查层叠。
- 请求批准按钮：原型13px/20.15px，padding 7px 6px，radius8px；before 14px/20px，padding 0 12px，radius24px。打开后的正常交互状态，不是强制伪态。
- 菜单：原型 289.33×401.35、padding7、radius16；before 300×378.75、padding0、radius24。菜单首项原型14px/21.7px padding10 radius8；before14px/20px padding8px 10px radius16。完整颜色、祖先和矩形见 composer-computed-before-reference.json。差异只做记录，不能为了对齐审阅镜像覆盖受保护组件。

## 组卷
原型标题“出题与组卷”，首屏四个标签“找题与选题 / 整理与编辑 / 我的练习与试卷 / 模板”，主区题目、知识点与右侧题篮；before 初始标题“找题与组卷”，先显示会话及新题篮表单，缺原型四标签。真实 UI 保存本地空题篮后显示找题/整理/预览等及 0 条结果，见 before-paper-saved-*.png；无真题是合法空态，原型八题为合成演示，不是待补数据。创建动作未调用模型。

## 其余页面先行线索（1366）
资料库加载曾显示“正在读取资料…”，单独保存 loading；真实终态为0份资料，保存 empty。before 筛选区与三条折叠分组占首屏，原型为左目录树+列表。学生页 before 未选学生即显示七个标签，原型优先选学生，示例学生不可视作生产数据。设置 before 以“模型与连接”起始，原型先有“设置”页标题及日常/高级分栏；这只是首屏差异，不代表功能缺失。

## 待办与限制
尚无 after；不得把 before 标为 after。三视口已覆盖 home/paper，后续仍需现场操作验证尺寸、正式状态和完整交互；现有对照使用浏览器视口模拟，不等同物理窗口验收。资料库/学生/设置、菜单仅首轮，不作总体 PASS。

## 补充：1920×1080 与空题篮
- 已新增真正 CSS 1920×1080 首页和已保存空题篮组卷截图及 geometry-1920x1080.json；先前 *-1920.png 文件是 1920×768，不可当作 1080 证据。均为 CDP 视口模拟，物理窗口尺寸另验。
- 原型空题篮整理页显示“还没有选题”和交付设置，预览与导出按钮禁用；before 真实保存 0 题后可进入整理和预览，预览明确显示 0 题及尚未确认、未导出的提示。两者交互状态不同，是否要求一致需结合真实业务契约核验，未尝试保存或导出空卷。

## 合成资料导入尝试：未确认
已确认候选文件为 test-results/acceptance/suites-ppBoAK/samples/03-资料实读.txt，说明标注合成，SHA256 2EDAD48F7B84D2078D2FBD64EEA801B9440419D7CED07538D599171648396C45。点击真实“添加资料”后没有得到可操作的系统选择器，before 页面显示“停止收录”且当前列表仍为0份；sky 截图同时出现来源不明的另一处 PNG 收录画面，窗口归属尚未确认。未输入候选路径、未选择或确认文件，立即停止此导入尝试；不能宣称合成文件已导入或非空场景已建立。见 before-library-import-unresolved.png。

## 真实非空题篮（受控合成文本）
使用用户指定的 ui-final-paper-paste-live.mjs 文本，通过原 UI 粘贴、预览识别原题号 2 / 12、勾选题目边界、明确保存本地资料；资料库显示 1 份 TXT（245 B），题本显示 2 道。逐题在编辑界面检查题干/选项及答案 B、解析，并勾选对照原资料后保存，UI 显示教师已编辑、可作为组卷候选。返回原题篮后从真实候选逐项添加，UI 显示 2 题、修订 3、已保存。预览仍提示当前题篮修订待核对，不等同正式试卷确认或导出。合成源文本 SHA256 df3acdfb70687300dbf9a8ec24fb481a676ff344a7c1a03358f8aba74aa7820e，输入副本 teacher-paste-input.txt；应用实际数据根 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\before-runtime-68U2XG\data，不能迁移路径作为换版验证。无 SQL 写入、模型调用或虚构题库结果；仅简单样例，不外推教学质量。
此前文件选择已由 UI 显示“已取消添加资料”，0份资料；运行在 E2E_DIALOG_MODE=1 导致选择被拦截，未发生合成文件选择，不能算真实文件导入。

## 补充选中学生与非空状态
真实 UI 新建本地合成档案“验收合成学生”（初二；UI 显示默认数学、0 条记录），已保存并选中；原型使用标注为演示的林同学，内容不对应，只比较结构。已记录 1366×768、1920×1080、800×768 三种 CSS 视口的选中学生、1 TXT 资料库及 2 题题篮找题/整理/预览。均属视口模拟，记录/资料/题目均为 QA 合成，不代表教师生产数据。before 窗口与数据保持运行，等待根任务安排冻结归档及切换。
