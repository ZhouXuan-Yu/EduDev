# P07-B3a 四格式生成基础验收

日期2026-10-04；M09/M10，完整合同118，承接117。**仅生成基础通过，正式教师审阅/工具/产物保存尚未接线，B3及总目标不勾完成。** 旧exportDocumentArtifact在新完整路径通过前保留；旧PDF48行截尾/DOCX手写结构尚在旧入口，不能把新生成器实例说成原页面已修复。

## 1. 已交付、直接复用与边界

新增shared `xiaozhi.office-draft.v1`：title120字符、sections1–20、heading120、paragraphs每节最多20/每段1000字符、table1–8列/1–200行/每格120字符或有限number；整份JSON最多256KiB，输出最多16MiB。严格未知字段/version、稀疏数组、非有限数、公式对象、非法XML控制/孤立surrogate拒绝；正常中文/emoji可进入schema。结构不含模型路径/任意HTML/脚本/图片/URL资源/命令；将这些写在文字里会作为文字保留，不作为资源加载或Excel公式执行。

现成库：[docx Packer](https://docx.js.org/api/classes/index.Packer.html)9.8.1、[ExcelJS](https://github.com/exceljs/exceljs)4.4.0、[PptxGenJS](https://gitbrent.github.io/PptxGenJS/docs/api-tables/)4.0.1，均MIT/精确锁定，不手写ZIP/XML。实际顶层包本地bytes分别11679250/22107375/2605307，npm解包声明8996242/21825509/2605307；两种体积不同，不称最终Windows安装包大小。首次install新增93包/审计839包；只有JS生成模块和既有Electron依赖，不新增Python/云端/LibreOffice产品服务。三库和两个scoped override许可证保存在third_party。

PDF从Hana0.449.0 `desktop/src/office-pdf-helper.cjs` AST提取delay/withTimeout/waitForPageAssets/renderJob四个**原body**，Apache原LICENSE与源/输出/每函数body hash，verify同时核原body。只把renderJob导出并注入BrowserWindow构造器；原printToPDF与正常destroy负责真实PDF。静态结构映射全部转义，CSP禁资源/脚本，独立内存session只允许main固定input.html请求、拒绝导航/新窗口/download/权限，javascript=false/no preload/sandbox/hidden。字体使用本机SimSun/Microsoft YaHei，Windows两种字库均缺时配置失败，缺字库夹具未修改OS字体。临时目录/两固定文件只在main-owned根，finally逐个unlink/rmdir，不递归删除用户目录；取消/超时关闭实际window并丢弃结果。

DOCX采用库Document/Paragraph/Table/Packer，A4与中文字体；PDF真实分页/重复表头，修新路径的48行截尾。XLSX每section一个sheet，真实number与纯string、A4 printArea、段落wrap；不解析公式对象、不加载输入工作簿。PPTX采用库addText/addTable/autoPage，段落单独slide、表格原库分页，完整语义值保留。没有宣称复杂公式/原版式像素还原或全部极端内容可视布局已验，尤其XLSX行高和PPTX换行仍须B3c实际Office/WPS检查。

main生成器只返回buffer，不调用旧export DAO/不写教师目录，不注册工具/新IPC/表，也不修改旧Pi身份。新增独立构建入口office-generator.js供宿主/隔离实例调用；typed正式用户链在下一120。raw Error cause仅main内部，正式工具/IPC下一阶段必须仅映射safe error code，不能把cause/私有暂存路径公开。

## 2. 精确命令、结果与范围

命令cwd `D:\WorkProject\EduProject\apps\desktop`；每个已通过命令都取得实际exit0。主smoke自行build，固定out实例全终态之后才执行。

| 命令 | 结果 | 原证据/实际范围 |
| --- | --- | --- |
| `npm run build` | 最终font build exit0 | p07b3-build-font-final.log；renderer index-Bpg_2XBD（UI未改） |
| `node scripts/xiaozhi-agent/pi-office-draft-protocol-smoke.mjs` | 17/17 exit0 | p07b3-protocol-final.log；strict guard，不是Office打开证明 |
| `node scripts/xiaozhi-agent/reuse-hana-pdf-renderer.mjs --verify` | 2文件/4原body exit0 | p07b3-pdf-source-final.log；源body/许可证保持，非UI证据 |
| `node scripts/xiaozhi-agent/pi-office-generator-electron-smoke.mjs` | 12/12 exit0 | IWDeHt/report.json、p07b3-generation-font-final.log；实际Electron四库/hiddenwindow/FS/独立解析器 |
| `npm run test:renderer-components` | 79/79 exit0 | p07b3-renderer.log；UI兼容，没有新教师生成入口 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes exit0 | p07b3-pro-source.log；原Pro未改，非Codex官方同源 |
| `node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify` | 4源/license exit0 | p07b3-read-source.log；原提取源保持 |
| `node scripts/xiaozhi-agent/pi-office-document-tool-ui-smoke.mjs` | 17/17 exit0 | P5M6v8/report.json、p07b3-read-compat.log；原正式Office读取真实DeepSeek/两native/共享8utility/停止重启 |
| `npm run test:smoke` | 207/207、ok=true、exit0 | p07b3-smoke-font-final.log；此前同轮主207也通过，字体检查新增后以最后这次为准 |
| `git diff --check` | exit0 | p07b3-diff-check.log；只有既有LF/CRLF提示，宽脏树保留，无commit/push |

实际生成：DOCX10864B左右（库时间戳导致不同轮hash变化）、PDF约69KiB、XLSX约10KiB、PPTX约740KiB；精确最终bytes/hash以IWDeHt/report为准。独立python-docx/openpyxl/python-pptx/pypdf仅测试读取，不是产品生成依赖；真实检查：中文/marker/最后段落/100行最后一行，DOCX真实表格和A4尺寸、XLSX两sheet/number37/`=1+1`为s类型且无f单元格、PPTX28张slides与完整尾表、PDF10页，每页A4 MediaBox且中文可提取/尾部存在。PDFium额外渲染原PDF第1/10页PNG，并实际查看尾页中文/最后一行和最后段，不以zip文件头充数。

取消和deadline实例刻意hold原printToPDF dispatch的返回promise，通过真实hiddenwindow毁掉时reject；证明窗口实际销毁/无晚buffer/暂存清理，**不称实际Chromium印刷卡死**。正常生成是真实Chromium printToPDF。主fetch全面阻断；app启动的官方/models异步发现单独计数，UbdmZ6/uHQkcv为1、最终IWDeHt为0，实际生成其他fetch均0。不能把所有app后台尝试归为生成联网，也不能把此局部测试称VPN关闭现场。Private renderer CSP/session静态资源边界保持。

## 3. 真实失败及必要修正

- build1按新库实际types修正PptxGenJS属性（无presentation.lang/theme.lang，paraSpaceAfter，table cells需{text}）；没有改库源码。build3因TS lib不提供ErrorOptions，改main私有Object.assign cause，不升级整库TS配置。所有失败日志保留。
- MBXaCJ：Playwright main evaluate的eval无dynamic-import callback，测试改为独立CJS bootstrap从真实ESM入口import库与正常app，不改生成器/原应用入口。OcoWxo/9A3yI5：AST移植原函数依赖漏path namespace；补原node:path import，原body不变，保留明确失败。
- jme6hp：PPTX table margin按错误单位给4，自动分页首空页使原库addTable报错。按库布局改0.07/不指定总h，让原autoPage处理100行；不手写分页或弱化尾行断言。
- VZND5P：openpyxl真实paperSize为int9，测试错期待string；核实际类型后改精确int9，A4断言不去掉。ZrA9lp过6项后把app后台模型发现算生成fetch，已明确分类并仍完全阻断真实网络，生成fetch必须0；并未允许网络或放宽已生成内容断言。UbdmZ6/uHQkcv11项通过后补真实字体缺失失败fixture，最终IWDeHt12项通过。
- 初audit12（6moderate/6high），新链路ExcelJS→uuid/PptxGenJS→image-size问题用父依赖范围限定override uuid11.1.1/image-size2.0.3/MIT（兼容exports已核）修复，四格式实例在override后复验；final audit回8（4moderate/4high）、五个新Office名字均不在vulnerabilities。旧8未修，不运行全局audit fix。实际install/audit/版本证据保留；不据此称整个项目无漏洞或Windows打包通过。

当前WPS注册可用，进程4428/66568已在使用；本轮未操纵/隐藏/关闭用户WPS或宣称独立WPS打开完成。WPS/Office实际打开、Excel行高/打印可读与PPT布局、安装字体/asar/打包依赖仍在B3c/P08验证，不能用独立库解析代替。

## 4. 公开原证据归档

`docs/design/codex-2026-10-03/p07-office-generation/artifacts.json` 保存76项公开原字节与9项当前运行时hash，逐项SHA-256复核通过。包括失败/成功日志、审计版本事实、safe报告、最终合成四格式文件与PDF第1/10页PNG、源码/原许可证/118/本文/67/35；不包含API密钥、数据库、私有Pi JSONL、原始教师资料、测试profile或bootstrap。归档是证据保存，不增添教师操作或WPS验收结论。

## 5. 下一唯一动作与整体范围

四根→67§1/2/5/8/9→35→109/118/本文。**冻结120 P07-B3b正式产物/审阅接线合同**：图谱/实际源码核现有artifact DAO/typed主frame/原approval wait/renderer原Pro review，再定增量private draft表及正式artifact类型、谱系记录/兼容恢复；原Pi registry/Hana once/budget、office-artifact.v1独立追加、当前授权与确认revision→新生成器→exclusive版本提交/actualreadback→原来源/审阅/文件面板真实打开。旧export在新完整链通过前保留，不在db.ts/App.tsx继续堆业务，未知图谱行号不能当当前行为。

随后B3c：自然真实DeepSeek四格式/教师修改确认或拒绝/停止/冲突/新版本来源/两native可达/真实故障退出与不重放、实际Office-WPS-A4。完成这些才完整B3/B，再C国内联网、D附件图像、E持久目标、全D1–D7与P08实际无VPN/自有中国API/Windows安装/最终八组。原R1/R2公开实时分段和现成组件真源仍67；整体目标active。生成基础不能代替教师可用功能，不能回到读取/文本A无限重验。
