# D3-B 本地OCR、教师校正与真实Pi读取验收

日期：2026-10-04。合同146；M03/M10。总目标仍active；三元题组暂停。当前浏览器、Pi1.0.2自动上下文、无累计预算和cache已140/141，本轮不把历史浏览器实例重新计数。

## 1. 本轮实际交付

教师从小智原“+”选图片→原附件预览→本地识别→查看原文/校正→拒绝、重试或确认→发送→同一个Pi原生loop按已发送附件实读必要脱敏校正文字→实际来源/公开过程/最终答案。没有第二agent loop或Codex CLI依赖，没有学生图片上云。

现成源码复用：原RapidOCR识别/方向/预处理和ONNX CPU、原Hana入站/AnyDoc/captured授权及本项目原Pi registry/once/取消，原HeroUI Pro附件五文件、现有OSS3.2.2 Modal/TextArea/Button。MCP实际核三组件文档；Finesse当前无新增可调用接口，保留67旧闭包，不宣称Codex官方同源码或整个页面像素已一致。

新增shared/xiaozhi-ocr.ts严格receipt/decision、attachment-ocr-state.ts增量SQLite、ocr-host.ts固定本地执行、python/omni_edu_ocr/worker.py薄适配；原coordinator/main-frame IPC/preload/hooks/原Modal贯通。OCR与原文档/图片原生进程共8个实际child槽，只在实际退出释放。固定最小环境、45秒单次期限、4MiB/8192边/16M像素/输出上限，不是累计任务运行预算。

`xiaozhi_pi_attachment_ocr`保存真实source version/hash/engine及原始/教师修正文字、revision，状态processing/review/approved/rejected/interrupted；冷启动processing→interrupted，不自动识别/批准/上传。拒绝与校正CAS，读取前后现source/current run/SQLite message-run/submitted授权。批准后仍先原教育脱敏，再必要最多100行/16000字符。真实来源明确“教师校正文字…（图片未上传）”，本地预览/识别不是模型看图。

批准文字提交后作为本轮历史不可变；需要更改时从原“+”重新添加同图，生成新附件事实并校正，保留先前已提供的版本。当前不提供同一已提交OCR版本原地撤回/覆盖历史；这项限制不可被称作完整跨轮编辑权限。扫描PDF、手写/公式自动正确性与公开图Pi视觉未交付。

新增native `xiaozhi.education.attachment-ocr.v1`能力身份，只附加，不改creation/模型/记忆/技能/原read身份、旧JSONL和绑定。唯一SDK、模型能力、自动压缩及无累计预算保持。

## 2. 原引擎实测、许可证与Windows独立运行

原PsOcr/Windows.Media.Ocr的8v4Ggn同1400×400三行PNG不变，144/145明确OFFICE→OFF ℃ E、内容3/4。RapidOCR3.9.2原SDK在socket连接禁用下，同图中文/英文OFFICE/731928/37四项全部通过。没有修改fixture或字符归一化制造通过。

RapidOCR3.9.2 Apache-2.0、onnxruntime1.30.0 CPU MIT；独立Python3.12.14测试venv，PyInstaller6.22.3（GPL带分发例外，仅构建）。requirements-windows.lock.txt锁精确传递依赖。未修改Codex/Conda共享运行时；冻结后的omni-edu-ocr.exe自带Python，不需要用户或Codex安装Python。实际Node/主进程最小环境spawn与正式UI已运行。

三原模型共31,749,509bytes：PP-OCRv6_det_small、ch_ppocr_mobile_v2.0_cls_mobile、PP-OCRv6_rec_small。SHA与上游MODEL_LICENSES原文一致；模型声明使用snapshot f65c7da00e72c19c258245e8e0e5f33af14488be，不能把main当安装版。RapidOCR根license SHA3e0af25fdd06aa9586ae97adb00ea927ebe5a3805ac77d2d3a81ce5f55693333；model notice SHAc5fd0e8603d3df743355b546121e6fe0f4ef8ff455c5a85c1681fd3ae520e153。

开发运行时`.local-ocr/dist/omni-edu-ocr`，576文件/270,805,763bytes；OCR host按编入应用的manifest逐文件size/SHA核验，renderer/model不能指定可执行路径。worker再检查SDK精确版/三个模型SHA/输入协议；固定本地路径与禁连接，没有运行时下载/cloud fallback。缺runtime/缺模型的真实副本已拒绝。开发runtime约258.26MiB，不是安装包体积；打包必须带resources/ocr-runtime，完整Windows安装/所有分发许可/真正无VPN仍P08未验。

## 3. 精确验收命令与结果

cwd均为`D:\WorkProject\EduProject\apps\desktop`，下载/冻结命令见python/omni_edu_ocr/SOURCE.md。所有真实数据/图片/DB/native/密钥仅ignored测试目录，未写入公共设计档案或真实教师profile。

| 命令 | 终态证据 |
| --- | --- |
| `test-results/xiaozhi-agent/rapidocr-env/Scripts/python.exe scripts/xiaozhi-agent/rapidocr-source-probe.py test-results/xiaozhi-agent/pi-local-ocr-preflight-8v4Ggn/synthetic.png test-results/xiaozhi-agent/rapidocr-probe.json` | exit0，同图4/4，3行；连接API明确禁用 |
| `node scripts/xiaozhi-agent/pi-attachment-ocr-native-smoke.mjs` | 最终m7an4W，10/10 exit0；真实Electron SQLite/独立exe/批准拒绝/严格getter参数/脱敏/旧事实/冷恢复/跨会话/hash/缺runtime/缺原模型 |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-ocr-build` | 最后build3 exit0，index-ih2qhlIf.js |
| `node scripts/xiaozhi-agent/pi-attachment-ocr-ui-smoke.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data` | 最终oS1Mij，11/11 exit0；正式Electron/官方DeepSeek/原Pi/原Pro、旧0.80.3副本及原DB SHA不变 |
| `npm run test:renderer-components` | 最终pi-ocr-renderer-final.log 79/79 exit0 |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-ocr-build'; $env:OMNI_EDU_E2E_DIAGNOSTICS='1'; node scripts/electron-smoke.mjs` | 最终pi-ocr-main-final2.log 207/207，ok=true，exit0；中间失败保留§4 |
| `node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs` | 最终dnNtiL，6/6 exit0，原Pro五附件源byte-identical |
| `node scripts/xiaozhi-agent/reuse-hana-browser.mjs --verify` | exit0，原snapshot/wait SHA一致 |
| `node scripts/xiaozhi-agent/reuse-hana-cache-prefix.mjs --verify` | exit0，原cache source SHA一致 |

正式UI的独有随机核验码只在教师校正文字中，实际官方DeepSeek toolResult及最终回答包含它和37/8。对应native新增历史不含原图base64/原始未确认OCR/合成学生姓名、电话、邮箱。原native byte prefix/绑定路径保持；公开原Pro读取项有真实来源，未伪造图像查看。取消发生于真实exe已经spawn后，实际child exit、状态interrupted、无迟到校正批准；冷恢复approved事实不变且原图片删除后可实读captured副本。

两真实native内容尺寸1366×768/1920×1080；最终oS1Mij两图均实际查看。修正后Modal居中、24px原组件padding、按钮16px横padding/正确背景，标题/编辑/确认/关闭可达；截图夹具原文仅合成数据，不是同DPI整个Codex页面比较或教师人工验收。

## 4. 失败和修复，不抹去证据

- 首次PyInstaller误用`--collect-metadata`，参数失败；原工具支持的是`--copy-metadata`，第二次freeze exit0。
- native aDkmZ2在第6项后测试误将前端summary当private row，缺sessionId使get null；真实DB approved/interrupted都正确。改测试读取实际state row后gKnPPR9，追加真实缺模型副本后m7an4W10全过，未修改产品迁就断言。
- 正式UI jHPLG7完成8项后，Playwright VM不支持dynamic import callback；改测试process.getBuiltinModule绑定原Node spawn，r5D2eE11全过。
- r5D2eE截图发现Modal标题贴顶/按钮无背景，实际CSSOM证明base reset盖住components，padding0/background透明。Vite合并Pro/OSS时首次注册layer顺序反转。renderer/index.html仅预声明原Tailwind层序properties/theme/base/components/utilities，未改vendor源码或手写替代组件。最后build3/oS1Mij11新增实际padding/背景/边界断言；两最终截图正确。
- build3主smoke首次pi-ocr-main-final.log旧教育无凭证路径出现`SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`，不能宣称全绿或归因样式。正式OCR/API11和native10不受此错影响；同build第二次带既有metadata诊断207全过。未证实该间歇旧路径根因，作为后续稳定性风险，若重现先诊断原checkpoint/run持久顺序，不恢复三元题组业务开发。
- 猜测不存在的两个docs名称/浏览器runtime脚本名产生读/启动失败；真实文件定位后browser verify exit0。独立native命令分开核验，不能用最后命令exit0覆盖前面的失败。

## 5. 最终构建与来源收尾

首次正式npm build与隔离build3比对325文件，只有main/index.js不同；精确差异为验收期间web-tools.ts错误分类的另有改动，不回滚或覆盖它。按当前源码再做隔离build4，web边界2BmCtG13 exit0；正式OCR/Pi实例Ehpu4X11 exit0，主smoke pi-ocr-main4.log207/207 ok=true exit0，最终两图再实际查看正确。正式out与隔离build4的325文件SHA逐个完全相同，renderer仍index-ih2qhlIf.js。原oS1Mij11/build3/main-final2通过是前一构建证据，最终以上Ehpu4X/build4/main4为准。

`npm run build`标准构建exit0，pi-ocr-build-compare.json明确success=true/mismatches=[]。收尾git diff --check exit0（已有CRLF提示不等于空白错误）；无Electron窗口活着时才生成正式out，保持未知/用户进程，不强杀。随后沿既有启动授权打开正式默认profile最新out，不注入测试data/E2E/API key，不维护凭证；窗口实际进程状态见根2.Memory收尾记录。

公开设计档案由archive-local-ocr.mjs只保存35个source/docs与原license/model notice/SHA及MCP参考，无DB/native/profile/图片/识别正文/API key/270MiB运行时二进制。完整runtime分发/安装验收仍P08，不因当前dev exe成功略过。

首次正式启动PID30784用了隐藏启动状态，进程存在但主窗口handle一直0，不能称可见交付。精确核其owned PID/可执行/本轮out参数后只终止该owned树，再以正常窗口启动交互桌面；未终止未知/用户旧进程。可见新PID/标题/handle实际记录在根2.Memory，后续启动用户需操作的桌面应正常可见，后台辅助进程才隐藏。

## 6. 继续位置与未验边界

下一四根→67§1/2/5/8/9→35→130/132/141/143/146/147，直接冻结D3-C：公开图片的明确用途/授权、当前官方DeepSeek能力与Hana/Pi媒体实现，优先复用原预处理和SDK，不以另一个HTTP探针200假冒实际Pi视觉。学生原图继续本地OCR/校正，已完成链不反复回炉。

随后D4真实查看回执/计数/版本来源、E持久goal、全D1–D7/未知官方Skills设置参照/同DPI设计、P08实际无VPN/Windows安装/最终八组。完整目标active；没有子agent/commit/push，未声称隐藏推理展示或Codex组件源码身份。
