# P07-B3c 实际 WPS 与办公版面验收

日期：2026-10-04。合同126；模块M09/M10；承接118完整B3、120/124正式审阅和125。**本轮完成B3c，结合既有B1/B2/B3b可勾109的有限Office部分B。整个Codex对齐目标仍active，下一C国内联网；D/E、完整D1–D7、P08和未知官方参照未完成。**

## 1. 真实变化与复用

只改main `office-generator.ts`现成库的排版，不改旧入口、教师确认、来源谱系、共享v1结构、表、IPC、原Pi/Hana唯一循环或数据上传权限。DOCX沿docx9.8.1；XLSX沿ExcelJS4.4.0；PPTX沿PptxGenJS4.0.1；PDF沿原Hana四函数及实际Chromium。原Pro/HeroUI组件与设计67不变。

- PPT原库按ASCII空格分词，长中文cell被当作整词，autoPage低估行高；固定标题框且默认垂直居中使长标题越出页面。复用Pi `wrapTextWithAnsi`的Unicode/grapheme换行边界，保留其终端trim过的原始空格；不手写分词或幻灯片分页。明确换行交原PptxGenJS `autoPage`，段落使用原单列表，长表重复表头，续页通过公开`newAutoPagedSlides`补章节标题，正文与标题垂直置顶、间距分开。
- XLSX标题/章节合并全列，整体列宽限制为80或110，六列以上A4横向；中文字体、真实数值/文字、实际print area保持。原库行高按Pi测量并留余量，表格边框让列可辨；长全宽段落超过行高时用9pt紧凑样式，不裁正文。仍超限明确`too_large`、不返回任何输出buffer，不将字节上限或行高上限通过截尾处理。
- [Microsoft官方Excel规格](https://support.microsoft.com/en-us/excel/excel-specifications-and-limits)列出409pt行高限制。本产品按409拒绝仍不适合的极端换行cell。此边界有真实generator拒绝实例；未承诺任何输入都能在单元格中无限增高。
- Pi TUI原本随coding-agent嵌套安装，显式直接精确锁`@earendil-works/pi-tui@0.80.3`/MIT，不依赖安装目录布局。只导入`dist/utils.js`→get-east-asian-width1.6.0，不导入终端入口/原生控制。实际utils37850B，SHA256 `0ef2a6ac0c39bb69caa1a4912f0443ed68d7cc58b98df7ab0b0c2b9fcada43a4`；直接包含nested marked18.0.5为2239025B，get-east-asian-width14592B。npm新增3包约2253617B；既有Pi嵌套包未删除。MIT归属见原package.json与原依赖license；Windows打包影响仍交P08实际安装验证。

## 2. 实际 WPS 隔离与引擎边界

本机WPS 12.1.0.28505（COM Version12.0），目录`D:\WPS\WPS Office\12.1.0.28505\office6`。调用本机注册的KWPS/KET/KWPP现成COM，不使用JSAPI网页模拟、云转换或修改注册表。32位PowerShell辅助仅打开owned合成test-results和125公共合成产物；输出限定本仓库test-results，不读取真实教师文件。

激活前记录用户WPS PID4428/66568及创建时间/HWND；拒绝既有PID或非空集合。Excel按实际HWND→et.exe核归属；Word/PPT空实例HWND0时必须同时核唯一新注册Automation server、激活后创建时间、原CLI及空集合。只关闭脚本打开的文档，Quit只新owned且集合已空的应用；无DisplayAlerts、用户窗口可见性、代理/DNS/VPN/系统设置改动。所有最终实例输入SHA保持，原用户两个PID/创建时间/HWND保持，收尾仅原两进程存在。

documents技能用于实际渲染→页图→修改。canonical `render_docx.py`两次实际运行均缺LibreOffice `soffice.exe`；收尾发现首次日志未在test-results，再次确认得到`p07b3c-docx-lo2.log`与真实exit1。未安装LO，不把失败说成通过。实际WPS通过原Document/Workbook.ExportAsFixedFormat及Presentation.SaveAs导PDF，再用PDFium渲染所有页；原产品PDF另外标为Hana/embedded Chromium，不冒充WPS生成。未测试Microsoft Word/Excel/PowerPoint客户端本体。

## 3. 实例与门禁结果

| 实例 | 数据/引擎 | 结果 |
|---|---|---|
| baseline `wps-render1` | 125合成教师修订原DOCX/XLSX/PPTX，实际WPS | 1/1/3页，原文字/表格41与8和源hash保持；5页图片已看 |
| 长标题/八列表 `office-layout-qtZZb0`→`wps-layout4` | 标题/章节各约115字、932字段落、8×8长中文/数字37/文字008，实际WPS | DOCX5、XLSX10、PPTX11页；26页图、所有尾marker/页外glyph0、实际COM与独立原数据核验通过；layout3/4同原输入全部PNG hash一致 |
| 长文/100行 `pi-office-generation-nh7TH4`→`wps-long1` | 18段长中文、100行、公式字面量、两章节；实际WPS+原Hana PDF | WPS DOCX8/XLSX11/PPTX29，原产品PDF10页A4，共58页图全部核过；末行100/最终段/完整数据、真实数字、无公式及源hash保持 |
| 千字/空格/换行 `office-layout-TlEVvi`→`wps-mixed1` | 996字段落、中英文原双空格、手动换行、无空格英文长词、37/008/=1+1 | 实际WPS DOCX1/XLSX1/PPTX4页；6页图已核，字号可读、末字可见、原空格与数值类型保持；极端cell31换行超过行高明确too_large |
| 真实自然DeepSeek UI `pi-office-artifact-ui-vWOfNs` | 原Pi/Hana→修改/拒绝/确认/保存/打开/源冲突/停止/双native/真实kill与只读恢复 | **20/20**，包括1366/1920可达。随后仅新增不影响此普通输入的密集段落9pt排版分支，另用mixed实际WPS核验 |
| 最终嵌入式生成 `pi-office-generation-LMTjkz` | 实际Electron/四现成生成库/原Hana隐藏窗口与独立解析 | **12/12**：四格式、中文/末行100/尾部/A4/数字与公式文字、无网络与遗留窗口、缺字体/取消/真实held print deadline |
| renderer /来源/最后主门禁 | 既有组件、原Pro与Hana来源、最终同功能源码build+主smoke | **79/79**；Pro32/182153B；Hana PDF2文件4body、读取4源文件；最终`test:smoke` **207/207 ok=true exit0**；`git diff --check`0 |

最终三个压力组90页、baseline5页：**95页实际图像检查**（85WPS页+10原产品PDF页），未发现当前夹具中的裁切、越界或标题/表格重叠。接触图逐页总览，裁切风险页另原尺寸看。普通办公字体样式仍是产品Office模板，未宣称像素还原任意资料或Codex官方同源UI。

`verify-office-wps-content.py`独立核实际WPS Word全文/所有表格与DOCX原字段；Word手动换行原生VT映射LF，仅此映射不删空格。实际Excel全部UsedRange与OOXML逐cell比对，真数字/字符串前导零/公式字面量及无formula。PPT段落顺序与字符、原生表格跨页分片所有字符计数（含原空格）保持；其行序/布局另由页图核，计数本身不作为排列证明。

PDFmarker检查只消除排版CR/LF及允许marker数字旁由提取器推断的空格，不全局删除普通空格；页外glyph只是边界证据。`wps-layout2`曾marker全部通过但实际Excel单元格底部裁切，已据图片修行高，因此绝不把纯文本提取当版面通过。

## 4. 精确命令与失败保留

工作目录`D:\WorkProject\EduProject\apps\desktop`。QA Node/Python为bundled runtime；产品门禁用已有npm Node。每个长运行均消费实际terminal exit，未把启动成功当完成。

```powershell
& 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/xiaozhi-agent/pi-office-layout-fixture.mjs
# 最终压力qtZZb0来自第四次；此前生成文件、实际report及后续改进日志保留
& 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/xiaozhi-agent/pi-office-layout-fixture.mjs --mixed
& 'C:/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe' -NoProfile -ExecutionPolicy Bypass -File scripts/xiaozhi-agent/pi-office-wps-acceptance.ps1 -Mode render -OutputRoot 'D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/wps-layout4' -SourceRoot 'D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/office-layout-qtZZb0'
& 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/xiaozhi-agent/verify-office-wps-content.py test-results/xiaozhi-agent/wps-layout4 test-results/xiaozhi-agent/office-layout-qtZZb0
& 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/xiaozhi-agent/verify-office-wps-render.py test-results/xiaozhi-agent/wps-layout4 test-results/xiaozhi-agent/wps-layout4/markers.json
# 同样命令换wps-long1/pi-office-generation-nh7TH4及wps-mixed1/office-layout-TlEVvi
npm run build
npm run test:renderer-components
node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify
node scripts/xiaozhi-agent/reuse-hana-pdf-renderer.mjs --verify
node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify
npm run test:xiaozhi-office-generation
npm run test:xiaozhi-office-artifact-ui
npm run test:smoke
git diff --check
```

最终日志`p07b3c-main-smoke-final.log`、`p07b3c-generation-final.log`；renderer `index-C7YrpuTD.js`保持，实际main/runtime hash记录公共artifacts。正式UI20发生在最终密集段落小分支前，此区别已如实列明，不将整个API、包安装、无VPN或所有输入边界混算通过。

失败记录不删除、不改原要求：probe1空app HWND0归属拒绝；probe2 Excel真实et.exe而检查误限wps.exe；probe3修后三应用隔离通过。render-readback1 XLSX标题因合法换行误判；layout1实际PPT35/35/700页外glyph与尾行缺失，Excel缩字号。fixture2引用不存在autoPagedSlides而非实际`newAutoPagedSlides`，随后TypeScript发现PresSlide原声明addText:Function与Slide声明不同，改按现成接口类型；build1失败/build2通过。layout2图片发现Excel底部裁切，layout3/4调整Pi列宽测量和行高后全末行可见。mixed-content1把Word VT误当段落CR，按真实原生手动换行映射后content2通过。LO缺失实际日志`p07b3c-docx-lo2.log`；offline npm first ENOTCACHED，随后普通npm精确安装成功；未更改registry或用户配置。

## 5. 下一唯一动作

四根→67§1/2/5/8/9→35→109-C；冻结128国内联网与真实来源合同。图谱追原Hana AnySearch/web_fetch、Pi注册、主进程安全取网/必要脱敏、真实source回执/取消失败、原Pro来源行和出处打开。先比较现成匿名来源的实际可达性，不能把存在接口或当前代理环境成功勾成无VPN；不写新第三方凭证/开付费服务，不改系统网络。继续C之后D附件图像/真实产物、E持久goal和全D1–D7/P08中国API/实际无VPN/Windows安装。三元题组暂停；不提交push、不派子agent。公开档案只原字节合成产物、图、源码许可和安全报告，排除.env/DB/native JSONL/key/cipher与真实教师文件。
