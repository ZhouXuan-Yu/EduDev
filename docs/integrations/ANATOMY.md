# Anatomy 科普绘图接入合同

## 当前教师备课交付（后续用户要求）

已增加“导出课件PPT”“导出动图”“在文件夹中显示”。PPT内嵌动图并含静态讲解页，HTML继续用于小智内交互；当前结果和老师操作以 [教师PPT说明](ANATOMY_TEACHER_PPT.md) 为准。下方初始“GIF后续”属于历史切片范围，不覆盖本次交付。

## 2026-10-20 用户追加：HTML 内嵌演示优先

选型：以自包含HTML为主要演示产物，SVG作静态图；GIF录制/分享后续按需，不引入额外录屏/编码依赖。首个HTML演示为逐部件装配/高亮，播放暂停、进度拖动、前后步、复位和真实部件名称；明确结构演示，不假称温度/受力等物理仿真。无自动播放，支持键盘与减少动态效果。

延用science工具的几何数据，宿主固定模板生成HTML，禁止模型写JS。SVG始终作为img数据展示，模板脚本只操作离屏XML与img，不将模型SVG注入活动DOM；iframe仅allow-scripts、无same-origin/IPC，CSP禁止网络/外部资源/弹窗/表单。保存后工作区只提取有界SVG数据重新生成受信模板，不直接执行任意本地HTML。共享文件预览契约新增science_demo/html字段，复用现typed入口；审批前零文件、拒绝/停止不写、版本/hash/CAS/重启/撤销继续保持。普通文本工具不得写html/svg。MIT许可随原build插件复制入产物。

验收新增：实际Chromium嵌入HTML播放/暂停/拖动/键盘/复位、零外网、脚本/外链注入无效；真实DeepSeek→HTML审阅→演示交互→确认保存→文件面板交互→冷启，以及拒绝不保存。SVG已见证的缺陷/44部件失败保留，不以机械绿测替代图形/含义检查。

2026-10-20 用户明确要求安装、用于科普绘图并接入小智；本片优先于原H09-C，主Harness Goal仍ACTIVE。模块M09/M10/M12，沿Pi唯一Loop、现技能管理、文本产物审阅与文件回读，不执行模型任意JS或自动上传。

## 首轮合同历史：当前缺口与交付（HTML追加合同在上方覆盖范围）

全局Codex已有Anatomy源码技能；小智四个内置教育技能与独立权限链，不自动发现全局目录。现文件工具只支持md/txt，故仅复制SKILL.md不能完成绘图。新增内置“科普绘图（Anatomy）”说明，复用上游几何核心；office_create_science_figure接受声明式部件/镜头/文本，主进程生成独立SVG，通过现change→typed审阅→教师确认→授权目录原子保存→回读/撤销链。预览用img隔离，模型不提供脚本、外链或原始SVG；普通文本工具不能借此写SVG。教师可要求重新绘图，原批准不复用。

先交付SVG科普图，完整Anatomy开发技能和交互示例仍在本地供开发使用；小智本片不声称可执行上游任意Node脚本、WebGL/3D/PDF或发布社区。明确这些边界，不把普通文本冒作图片、不要求生图API密钥。

## 版本、兼容与文件（初始SVG切片记录）

上游https://github.com/wheresryan22/anatomy 固定1482e8469b0a9e0d8cc18ea2740a01423d29ae80，MIT；先核源码再复制核心与许可/哈希，记录实际文件体积。无新npm包，Windows使用已有Node/Electron，无运行时GitHub/CDN依赖。原全局安装保留，比较后不静默覆盖。

新增shared绘图输入契约、main确定性renderer与vendor核心、适配skill目录增量添加（兼容原4项/旧版本/禁用选择），在现text coordinator注册并走H04manifest；main-only受信SVG提案，普通工具不允许SVG，renderer审阅卡展示本机SVG预览；现preload审阅契约与SQLite表复用，不做DDL或真实数据迁移。旧工作目录/拒绝/取消/冲突/重启/撤销语义保持。

## 验收与回滚

实际DeepSeek漏列部件（44而非45），因此补充声明式repeat(count,dx,dy,dz)：宿主展开40–80个实体，重复组lit只强调首个，其余mid；不执行任意循环代码。原展开数组仍兼容。技能目录总量从32增为33，为旧满目录保留新增内置项的位置，不删教师技能；其余大小/深度限制不变。x/y/z明确为包围盒最小角，分离平面排序、穿插/循环遮挡拒绝，文字按真实页宽折行。完整学科正确性仍需教师审核。

参数越界、恶意标签/外链/路径/原始SVG、未知部件拒绝；输出可独立打开、无网络请求。原4技能目录升级保留教师状态；确认前无目标文件，拒绝/停止零写入，批准后实际SVG/hash一致且冷启回读，重复/竞争不覆盖。主路径从小智可见技能与真实DeepSeek指令进入，审阅预览、确认、打开/回读、拒绝分别留证据。构建/type/renderer/专项与关键路径smoke、diff；真正执行的命令/数量/未验范围独立记录。

回滚新技能入口/绘图工具与本片差量，保留已保存产物与审计；不删除真实数据、不重放旧批准。全局“科普绘图使用”偏好按用户本轮要求记录到指定memory扩展，项目稳定事实写Wiki/集成文档。未授权发布、push、社区上传或付费服务。

## 演示选型与使用

|形式|教师使用|交付选择|
|---|---|---|
|自包含 HTML|暂停讲解、拖动进度、前后步、高亮部件；文件保存后可离线打开|默认交互演示，聊天审阅和文件面板均内嵌|
|SVG|打印、文档配图和静态阅读|保留；需要静态图时明确要求 `.svg`|
|GIF / MP4|GIF用于已有PPT，不能拖动；MP4后续|已新增GIF与内嵌GIF课件导出，参见教师PPT说明|

使用入口：通过项目根目录 `启动小智.cmd` 或 `apps/desktop` 下 `npm.cmd start` 重新构建启动，选择教学工作目录，技能菜单选择 **科普绘图（Anatomy）**。示例指令：

> 用科普绘图技能，给初中生做一个散热片结构的 HTML 演示，解释底板、散热肋片和接触空气的面积；提供播放暂停、进度拖动和部件高亮，先让我预览，确认后保存为散热片.html。

在审阅卡内播放/暂停、拖动“部件进度”、用方向键或前后步讲解，“查看全貌”复位。确认保存后点“打开文件”可重新交互；拒绝不生成文件。保存的 HTML 为独立文件，不依赖CDN、GitHub或模型密钥，浏览器直接打开可演示；生成阶段仍需要已配置的模型API。播放不是默认自动开始，文档隐藏时自动暂停。

当前小智接入的是上游核心支持的确定性等距结构图及宿主逐部件高亮模板，输入为box/cylinder/repeat、展开40–80实体和单一强调。并非完整上游任意交互脚本、通用动画引擎或物理仿真；复杂学科表达仍需教师核查。全局Anatomy开发技能保留完整上游源码和示例。离线演示不等同于已完成小智无VPN/联网/图片识别的原验收。

## 本轮实例验收结果

已安装固定MIT上游1482e8469b0a9e0d8cc18ea2740a01423d29ae80，新增“科普绘图（Anatomy）”技能与office_create_science_figure。Pi唯一Loop，box/cylinder/repeat→宿主SVG/HTML→现typed审阅→教师确认→原子保存/回读/撤销；无DDL/新npm依赖。用户追加选型为离线HTML内嵌演示优先，支持播放暂停、进度/键盘、前后步、全貌；SVG静态备用，GIF/MP4未做。结构演示非物理仿真；教师仍核查科学含义。HTML固定脚本、SVG作img、opaque sandbox/CSP隔离，保存文件重建模板而不执行任意HTML。

最终隔离构建f43820f2e46d0e7f4c5bc4db27bde288e3c1180b1f2a9d7aee6864bf655c2bf2，372文件，83合同源码收尾hash一致，许可/manifest打包字节一致。真实Electron/Pi/DeepSeek G5k6xX 8/8、6次deepseek-flash HTTP200、2启动、0renderer错误；实际预览交互/双尺寸可达/确认精确写入/文件面板重开交互/拒绝零写入/冷启无重放。HTML浏览器6/6、SVG浏览器3/3、绘图13/13、技能目录25/25、旧v1迁移10/10、协调器8/8、文本基础20/20；renderer234/234、同构建legacy207/207、type/build通过。legacy仅兼容旁证。截图已逐张看；精确命令、报告和失败边界见apps/desktop/test-results/goal/harness-anatomy-html-20261020-reviewed/{progress.json,commands.ps1}。真实保存的独立示例见docs/integrations/examples/anatomy/散热片.html。

e45NqM/qUUVYo机械绿但视觉/几何错误，orQJXZ严格44≠45，均保留；修正最小角坐标、遮挡排序、repeat精确展开。BXNRYz首次HTML播放观察超时，独立浏览器通过但同场另有Electron兼容验收；G5k6xX显式检查文档visible并使测试窗口前台后通过，未将原失败算成功，也不将并发遮挡推断为已证实唯一根因。两个旧host/API源码脚本因Node24 JSON import attribute加载失败不计通过。

仅本切片LIMITED_ACCEPTED；Harness Goal ACTIVE。H08整体/完整H09/H10/H07国产公网认证及原NET/IMG/FILE/日常无VPN/安装/OfficeWPS/人工仍OPEN。日常out未替换，统一启动器npm.cmd start会重新构建源码；测试目录不作日常启动入口。无提交/推送。下一步回到H09-C主题差异与E_EVENT_UI状态、证据入口和键盘核验。


独立示例：[散热片HTML](examples/anatomy/散热片.html)、[静态SVG](examples/anatomy/散热片.svg)、[真实小智保存后截图](examples/anatomy/xiaozhi-saved-open.png)。示例来自实际通过的G5k6xX审批保存文件，provenance.json记录来源和SHA256；没有复制学生资料。
