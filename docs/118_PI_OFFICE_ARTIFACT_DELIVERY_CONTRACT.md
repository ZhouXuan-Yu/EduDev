# P07-B3 受控 Office 产物交付合同

日期2026-10-04；M09/M10（依赖M01、既有M02本地正文），承接116–117与109完整B。最终教师结果：同一Pi/Hana智能体读资料→拟教学办公内容→审阅/确认→真实DOCX/PDF/XLSX/PPTX产物→打开、版本/来源可核，取消和重启不重放。**本合同覆盖完整B3，生成基础通过不能勾B3或完整Codex。**

## 1. 当前证据与直接复用选择

graph定位exportDocumentArtifact→createDocumentBuffer→createDocxBuffer/createPdfBuffer、旧IPC/renderer导出与document_artifacts；snippet行号过期返回错误函数，fast重索引后仍存在旧条目，以当前db.ts/index.ts/contracts.ts实读为准。旧PDF只slice前48行、手写CID字体/单页，无ToUnicode和真实表格；旧DOCX手写ZIP/XML，只有段落。两者不能作为B3可靠交付，也没有XLSX/PPTX。旧入口在新完整路径验收前保持，不能为通过删除旧产物。

Hana0.449.0/Apache plugins/office只有读取与html-to-pdf，不提供可直接copy的DOCX/XLSX/PPTX生成器。`desktop/src/office-pdf-helper.cjs`已核hidden BrowserWindow/sandbox/javascript=false/printToPDF/A4/真实窗口销毁；直接AST提取其delay/withTimeout/waitForPageAssets/renderJob，原body保持，只注入main-owned BrowserWindow以隔离session/取消和阻断网络。不复刻PDF writer。Hana字体注入绑定其产品themes，当前项目沿本地Windows SimSun/系统字体，不复制Hana人格/UI字体资源，不把缺字体静默归为成功。

其余格式使用官方现成生成库，不手写ZIP/XML：docx9.8.1/MIT（npm主体8996242B）、ExcelJS4.4.0/MIT（21825509B）、PptxGenJS4.0.1/MIT（2605307B）。精确版本来自本轮npm registry，只说明主体解包体积，安装后记录实际新增依赖和disk/native影响。它们是Node JS库，依赖external交给现有Electron部署；无新的Python/LibreOffice/云端服务。Windows安装包仍需P08实际验证。旧宽lock保留，不自动audit fix；本轮无commit。

官方依据：[docx Packer/OOXML](https://docx.js.org/api/classes/index.Packer.html)、[ExcelJS](https://github.com/exceljs/exceljs)、[PptxGenJS tables/auto paging](https://gitbrent.github.io/PptxGenJS/docs/api-tables/)、[PptxGenJS nodebuffer](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/)。文档可能随版本更新，实际安装types/API和生成文件为验收依据。

安装后audit指出新链路ExcelJS→uuid旧版buffer边界问题、PptxGenJS→image-size旧解析死循环。只对这两个新父依赖精确override为uuid11.1.1/image-size2.0.3（MIT/CJS和ESM exports已核），不跑全局audit fix或改旧无关依赖。当前Office结构严格不接受图片/公式对象/任意文件；四格式及实际库API须在override后复验，不能以静态“patched”替代。旧8项audit另留安装/打包治理，不混称本轮已清零。

## 2. 完整纵向切片及顺序

### B3a 本地生成基础（本轮首先实现，非最终完成定义）

shared office-draft.v1严格结构化教学文档：title、sections（heading/paragraphs/table）、有限正文/行列/安全scalar；无任意HTML/脚本/URL加载、文件路径/命令或公式对象。用同一内容映射现成库生成四格式，保留所有获准文本/表格，不截尾；数值型单元格真实number，字符串以文字写入（不得解释为Excel公式），PPT表格原库autoPage。DOCX/PDF A4中文/分页/表格，XLSX真实sheet/value/print area，PPTX真实slides/文字/表格；不是原文档像素还原或OCR/公式自动正确。

main Office generation领域调用库和Hana原PDF helper；工作目录固定main-owned隔离目录，PDF只内部暂存输入/输出，generated buffer不写教师目录。Chromium静态HTML全部文本转义、CSP/独立内存session/network blocked/javascript=false/show=false/no preload、拒绝任何页面导航/新窗口/权限。取消/超时关闭实际窗口，后续迟到输出丢弃；产物大小限16MiB。Node库本阶段不在renderer运行，不得到API凭证。若生成失败明确错误，不降级为伪PDF或静默失去表格。

本阶段无新DB/IPC/tool/可见入口、不会修改旧export route。来源LICENSE/原body hash、库版本/安装体积/Windows影响、真实四格式读取/中文/长文尾部/A4/表格/公式字面量/超限参数/取消网络与窗口生命周期实例写119。只基础验收不是教师用户路径；下一B3b须继续同本合同，不能跳C或反复重测B3a。

### B3b 原产物事实、教师确认与正式智能体接线

先冻结下一具体增量表/IPC与兼容合同，再实现：复用既有document_artifacts作为正式导出事实，类型增量支持xlsx/pptx；新私有office draft ledger保存会话/run/call、受控内容/源引用与版本、拟格式/文件名、revision/state、生成器版本/实际hash、结果关系。源谱系显式关系表或字段，不能只在聊天文字留来源。新增表必须增量幂等、旧库副本/全新库验证；待审/执行不确定/已保存以真文件和DB事实恢复，不重放写操作。

office_create_document/受控更新草稿进入原Pi registry/Hana once/budget teacher wait；追加独立office-artifact.v1能力，不改旧snapshot/controls/memory/skills/office-text/office-document身份。模型只能在授权会话提出结构化拟内容，老师可本地编辑/拒绝/确认本次revision；原资料/正式已确认产物禁止自动覆盖，新增exclusive安装与精确版本readback。明确需要更新的办公内容通过新版本、父子来源关系产生，不能随意覆盖原binary。文件修改/来源更新/撤权/停止时本次确认失效；源版本未知需明确描述，不能伪造。

main-frame typed IPC只session/draft/revision/action，路径由main grant/安全文件名决定，不接renderer绝对目录/内容来绕确认。旧dataRoot/排除根/links/hardlink/Windows别名、全局作业owner和mutation queue保持；不自动上传/私有摘要/原学生图片。必要教育脱敏仍复用117，不增加隐私权限。生成buffer私有暂存不等于正式保存；DB/FS非同事务需uncertain+只读核验，手工版本冲突不覆盖。

### B3c 同款组件和真实用户验收

继续67 R1/R2公开说明→真实工具→教师审阅/确认→后续说明→真实产物，使用已接原Pro ChatTool/CodeBlock/Tabs/FileTree/Button。新增组件需要时先HeroUI Pro MCP/Finesse官方能力与本地fallback核源/许可/CSS/依赖，不另画新聊天模板。实际本地正文、来源与拟内容可查看/编辑，拒绝零正式文件，批准保存一次/实际打开，失败/partial/retry/cancel/restart状态和输入可达。

自然真实DeepSeek从已授权合成资料开始，四格式新产物真实打开/引用/修改新版本、教师拒绝/编辑确认、call幂等、源变化/冲突、关闭归档/跨会话、取消、真实故障退出/重启不重放、SQLite/文件readback和两native1366×768/1920×1080。DOCX/XLSX/PPTX另做真实Office/WPS打开并核内容/表格；PDF实际A4分页/中文/尾部，不用文件头或zip存在代替。当前注册表有本地WPS路径，但打开能力和独立实例还未验证，不能据此勾验收。

## 3. 收尾与恢复

每个实质阶段build/renderer79/原Pro32/原Hana源verify、专项实例与旧兼容，关键正式路径主smoke207、git diff --check；准确区分库/底层/WPS/provider/用户UI证据与未验。原报告/失败和许可归档，不存.env/DB/private native JSONL/用户原文件。四根+26/28/35/67每轮记录本轮真实状态、下一唯一动作。119先记录B3a生成基础，后续按B3b/B3c继续，不勾完整B或整个目标。

无提交/push/第三方资源变更/系统网络变更/子agent。C国内联网、D附件图像、E持久goal、全D1–D7和P08实际无VPN/国内API/Windows安装/最终八组仍保留；总目标active，三元题组暂停。
