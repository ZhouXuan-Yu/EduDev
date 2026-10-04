# P07-B3c 实际 WPS 与办公版面交付合同

日期2026-10-04；M09/M10；承接118/120完整Office要求与125正式20项。上一轮属于进展：正式Pi工具/教师修改确认/四格式保存打开、谱系与真退出恢复已有新代码和实际证据。本轮直接验实际办公引擎和版面，不重走凭证或无限复验B3b。

## 1. 当前事实与完成定义

125已验真实小智/Pi/DeepSeek20、独立读取中文修订/数字/PDF A4及AnyDoc正文；未验实际WPS的文档分页、表格行高/换行、幻灯片布局。图谱未找到未入图的generateOfficeDocument，回读当前精确领域文件，不以旧snippet作为实现证据。

当前机器有用户WPS进程4428/66568。实际安装路径带空格：`D:\WPS\WPS Office\12.1.0.28505\office6`；历史无空格路径不存在。KWPS/KET/KWPP ProgID存在，64位CLSID视图缺失，32位ClassesRoot真实LocalServer32为wps.exe `/prometheus /wps|et|wpp /Automation`。必须根据真实32位注册启动现成COM，不能据有ProgID便宣称可用。

本轮教师可见目标：当前小智确认生成的DOCX/XLSX/PPTX在实际Office/WPS打开，中文及表格未丢、版面可读；PDF多页A4/中文/长文尾部真实。不要求原文档像素还原，不引云转换、付费SDK、Codex CLI或第二循环。

## 2. 冻结实现与隔离

- 先只读核原WPS进程PID/创建时间与窗口句柄，不读用户文件名或正文。32位独立PowerShell辅助调用现成WPS COM API，记录Application HWND对应实际PID及空文档集合；若返回原PID、无法证明新实例、初始非空，直接拒绝该实例，Release接口，不隐藏/关闭/设置用户app。
- 实测空文字/演示应用HWND=0：补核注册命令、激活开始时间之后唯一新的`/prometheus /wps|wpp /Automation -Embedding` server及空集合，才确认为owned。表格HWND映射实际et.exe，不误限定成wps.exe；已存在PID一律不可使用。probe1/2失败保留，probe3三应用实际隔离/原用户PID保持通过。
- 只有新且可证明归属的空Automation实例才打开owned合成文件，尽可能只读、禁加入最近文件、不用云转换。只关闭本脚本打开的文档；Quit仅新owned PID且已无文档，不能Quit用户WPS或杀未知进程。所有迟到结果和观察超时依真实句柄复查，不凭超时重启。
- 原文字/表格/演示API直接读取实际内容、表格数字/文字和分页布局，并用实际应用导出PDF/幻灯片图作视觉验收。COM原生输出不是库模拟；不往正式教师目录/数据库写测试数据。输入原字节/hash保持，QA输出只明确test-results目录，原生保存不覆盖input。
- 先验125公开合成四文件的原字节及hash，再验已有119长文/100行表或从现有正式生成器创建明确owned长内容夹具。数字/数值文字/公式字面量均保持，不用新手写OOXML/PDF生成器。若DOCX/XLSX/PPTX版面问题，只调整docx9.8.1/ExcelJS4.4.0/PptxGenJS4.0.1已有配置及中文字体、宽高/分页；不改Pi、教师确认/来源、安全边界。
- documents技能用于渲染→逐页图检查→修正，原SDK生成是被测产品，不用bundled作者库替换产品writer。运行QA解析/渲染使用bundled Python；若render_docx缺LibreOffice，保留日志并优先实际WPS渲染证据，不能安装或使用云服务冒充实际WPS。
- 不新增服务/表/IPC或schema；若仅generator排版变更，仍保持v1内容契约、旧native能力身份和既有文件。测试辅助在scripts领域，不向renderer露COM/文件系统。每次修后生成新owned文件，不篡改先前已确认产物。
- 实际压力渲染发现PptxGenJS按ASCII空格分词，长中文cell当成一个word，原autoPage低估行高；固定标题框也被多行文字顶出页面。复用已随Pi安装的MIT包`@earendil-works/pi-tui@0.80.3` Unicode换行/宽度工具，显式锁成直接依赖以免依赖嵌套路径；只导入dist/utils.js，不启动终端或原生控制。既有依赖代码在Windows包中已存在，安装体积与新布局实测记录127；标题/行高和PPT原autoPage仍由现成Office库实现，原数据文本/数字不裁剪。

官方API依据：[WPS Workbook.ExportAsFixedFormat](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/et/Workbook/member/ExportAsFixedFormat)、[WPS Worksheet.ExportAsFixedFormat](https://open.wps.cn/documents/app-integration-dev/wps365/client/wpsoffice/jsapi/et/Worksheet/member/ExportAsFixedFormat)。网页JSAPI不代替本机COM可用性；参数与效果须实际实例确认。

## 3. 具体验收

1. 原用户WPS PID/创建时间/窗口句柄保持；新Automation实例身份与输入路径均owned，返回既有实例拒绝，无用户app配置变化。
2. 125原DOCX/XLSX/PPTX在实际WPS引擎读取标题/段落/表格值，与已确认文件逐字一致，实际只读打开/关闭/hash不改。
3. 实际WPS导出/渲染逐页检查：DOCX A4/中文/表格/页尾，XLSX长段落/表格值和打印分页，PPTX中文文字/长表autoPage/标题、内容不越界或裁切；不以文件头/zip/纯提取证明。
4. 长文/100尾行、不同行列长度、换行与长中文scalar，实际引擎与图片确认末尾无丢失；所有页或幻灯片都渲染，有布局问题修现成库配置再验原目标。
5. generator若改，build/renderer79/原Pro32/Hana源verify、实际四格式生成专项及必要正式用户实例；关键教师路径有变化才运行对应UI，最终主smoke207与git diff --check。若仅QA辅助/文档，限定必要实例，不无意义再跑全部provider。
6. 每个失败、passed/failed/skipped、实际WPS/库/模拟边界及精确命令记录127，公开档案原字节/hash，不含DB/env/JSONL/key/用户原文件。旧配置/教师业务数据/native绑定保持。

## 4. 收尾与继续

只有真实WPS版面及此前B1/B2/B3b证据共同足够才能勾完整B；若本机真实能力不足，明确缺项并做可执行替代验收准备，不把库解析勾成WPS。安全替代不能改变目标范围。

每轮结束更新四根/26/28/35/67，记录真实进展和下一唯一操作；之后C国内联网与真实引用、D附件图像/产物、E持久goal、全D1–D7及P08实际无VPN/中国API/Windows安装仍active。三元题组暂停；不提交/push/派子agent/改系统网络或注册表，不上传合成或真实资料到WPS云。
