# P07-D2-B 本地附件入口与预览验收

日期：2026-10-04。合同132§3、136；模块M01/M10。仅完成D2-B，本地预览不是模型读取。D2-C发送与历史、D3实际读取/学生本地OCR/公开图视觉、D4真实查看回执仍待。

## 1. 实际交付

正式“+”调用native具体文件picker，工作目录选择独立保留在原权限菜单。attachment-coordinator沿production-host choosing同步预留owner，允许已有实际Pi绑定选择工作目录外的具体附件；不改变workspace/native身份或相邻文件权限。选择文件→原有只读副本与实际SQLite→typed preload→原Pro卡片，本地图片/文本/Office预览及移除均接真实数据。选择去重、部分失败、取消、8项上限、跨会话与重启由实际事实驱动。

附件v1 choose/list/remove/preview/thumbnail/cancel严格校验schema/session/requestId/必要selection，descriptors拒绝getter/symbol/额外path或bytes；主窗口主frame独有。8个宿主作业槽与deadline/AbortController，取消回执可提前返回，但未实际结束的native picker/读取仍占作业与owner；关闭/停止取消，归档后迟到picker不导入。新图片在副本意图/草稿登记之前真实解码，不以签名/IHDR成功充当解码成功。

图片用Pi0.80.3原resizeImage/Photon0.3.4在固定image-worker utility内解码、EXIF与缩略；没有main同步nativeImage/新图像算法或第二智能体循环。image-size2.0.3只在decoder之前检查header尺寸；4MiB输入、单边8192、1600万像素、缩略192px/256KiB base64、15秒期限。文档与图像共用从原document-host提取的local-utility-host：同进程8实际子进程、实际exit才释放、早取消后late spawn仍kill、环境只允许SystemRoot/WINDIR/TEMP/TMP/LANG。主进程renderer IPC不能提供worker路径或图像bytes。

本地预览不是上云同意，Pi blockImages:true和教育隐私仍保持。D2-C之前，待发送附件保留、页面明确提示；普通消息UI及host均阻止在有草稿附件时静默发送纯文字。**手动上下文整理不受此普通发送限制**，文件仍是草稿；运行中的原文字队列、输入清空、停止均保持。下一必须直接完成132§4，不把这个临时限制当最终交付体验。

## 2. 复用与依赖

沿此前实际Pro MCP chat-attachment/prompt-input/modal docs及CSS查询，使用本地实际Name/Preview/Remove、独立ChatAttachmentGroup API。5个Pro附件原源byte-identical；PromptInput.Attachments、HeroUI Modal与既有Markdown直接接数据，仅增加office数据/状态/尺寸适配，不修改本轮Pro源体。Pro仍SEE LICENSE/付费许可边界，不能称MIT或Codex官方同源。Finesse当前无新增可调用接口，沿67已核0.20.0设计闭包/R1/R2与§1/2/5/8/9。

Hana0.449原四文件名片段与SHA再次核源；原model-image-preprocess也使用Pi resizeImage，但其云端policy未复制为本地预览策略，不宣称整个Hana bridge已接入。

新增精确直接image-size2.0.3（此前已有transitive同版）：MIT/纯JS、118文件/95,250 bytes；npm install --save-exact --ignore-scripts为up to date，841包，报告既有8项audit finding，无强制audit fix。现有Pi目录包含nested依赖127,212,985 bytes；已有Photon0.3.4 Apache-2.0为7文件/2,265,687 bytes，不因本轮增加另一份图像原生addon。image-worker和现有Photon WASM必须随Windows包保留，开发运行已验，正式安装包仍P08。源验收6项eJs7OS含依赖许可、尺寸和SDK/WASM hash。

## 3. 真实实例、失败与门禁

全部测试在owned合成资料/配置目录，未操作真实teacher DB/profile/凭证/WPS窗口。Native picker返回路径由测试主进程替换dialog结果，renderer/IPC/SQLite/独立worker/实际原库/实际UI为生产实现；不能把这个适配说成自动操作了系统原生文件选择器。没有真实教师/学生文件上传、系统DNS/代理/VPN更改、commit/push或子agent。

最终附件UI fVx03J **24/24**：实际PNG/JPEG/GIF/WebP解码缩略图/本地图片；文本与docx正文；公开metadata无path/bytes；去重与不支持/损坏图片部分成功；待发送普通消息UI与host阻止丢附件；remove/CAS旧版拒绝；8项上限/跨会话；取消native chooser无迟到登记；副窗口拒绝/子frame无可用authority；实际image utility取消、正式preview-close及时kill、15秒期限与后续正常恢复；正常重启ID/缩略图恢复；原bytes不变/renderer无错误。两native content size 1366×768/1920×1080四张实际截图，最终卡片1366和预览1920已目视检查。局部可达与原源复用不代表全页像素一致。

真实Pi/DeepSeek合成UI最终rsEirD **6/6**：独立权限菜单、实际回复完成且input空、已有实际Pi绑定对话选目录外文件且workspace不变/不发附件任务、手动compact准入并保留草稿（短上下文摘要成功未断言）、真实teacher wait中禁文件/stop可达、原follow-up文字队列/input空/停止后interrupted无交付。早期ujP54s/Yz47x4为5项成功，最后增加compact准入并缩小普通发送guard到prompt；不重复凭证维护，不把此env-based隔离链当真实profile修复新证明，实际凭证结论仍135。

Office预览l0Pmrq **23/23**：共池抽取改动后实际四格式AnyDoc/PDF、两native、坏/扫描/无法解码/超大文件、取消、真正utility取消/15秒期限、重启、原bytes与无上云。最后renderer取消信封修改不改变文档宿主；该验收不是新增Office/WPS布局证明。

失败保留：build2 React19 useRef必须给initial value；build5 ES2020 lib不提供Object.hasOwn，改兼容hasOwnProperty.call，不改tsconfig来绕过。UI7kJePL在19项后取消失败：selected preview request错误携带selection去调用严格cancel，测试同样传了额外字段；宿主拒绝正确，页面关闭只丢画面却没有及时终止实际工作。现tracked请求和previewRequest只保存三字段取消信封，测试同时验证额外字段拒绝及正式关闭按钮实际kill；最终24通过，不放宽strict校验。UI0xuR早期19项成功不覆盖这条新失败路径，不能用它掩盖缺口。

工作目录D:\WorkProject\EduProject\apps\desktop，Node24.19。build和UI/out占用串行，多个独立owned UI运行期间未重写out。各报告无skipped项；未验证范围另列。

| 精确命令 | 结果 | 证据 |
| --- | --- | --- |
| npm run build | exit0 | p07d2b-build-final.log；renderer index-CKw3Alzb |
| node scripts/xiaozhi-agent/pi-attachment-entry-ui-smoke.mjs | exit0，24/24 | fVx03J/report.json、p07d2b-ui3.log |
| node scripts/xiaozhi-agent/pi-attachment-entry-live-smoke.mjs | exit0，6/6 | rsEirD/report.json、p07d2b-live-final2.log；实际官方API/Pi |
| node scripts/xiaozhi-agent/pi-office-document-ui-smoke.mjs | exit0，23/23 | l0Pmrq/report.json、p07d2b-documents-ui.log |
| node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-attachment-entry-boundary-smoke.mjs | exit0，10/10 | 67AmUU/report.json；严格边界、实际槽逻辑/owner/归档，transport/store doubles，不是native proof |
| node --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-model-settings-host-lock-smoke.mjs | exit0，6/6 | DLe7i2/report.json；原设置owner兼容 |
| node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs | exit0，6/6 | eJs7OS/report.json；Pro原源、依赖/许可/hash |
| node scripts/xiaozhi-agent/reuse-hana-inbound-filenames.mjs --verify | exit0，4原片段 | p07d2b-hana-source.log |
| npm run test:renderer-components | exit0，79/79 | p07d2b-renderer-final.log |
| npm run test:smoke | exit0，ok=true，207/207 | p07d2b-main-smoke-final.log；最后产品源码/build，renderer index-CKw3Alzb；前次207亦保留 |
| git -c core.safecrlf=false diff --check | exit0 | p07d2b-diff-check.log；文档收尾后最终核验 |

## 4. 下一唯一动作

四根→67§1/2/5/8/9→35→132§4，直接 **D2-C**：严格可选附件selection、无附件旧hash/native保持、带附件持久准入/command身份、教师message-run-submitted全部绑定后才能执行、失败/崩溃恢复零重放、公开历史来自ledger/副本、本地历史预览与实际DeepSeek发送/空composer。完成后D3实际文件工具/学生本地OCR+教师校正脱敏/明确公开图Pi原视觉，D4真实查看回执；再E/全D1–D7/P08无VPN/Windows安装/未知官方Skills设置参照/最终八组。

公共不可变p07-attachment-entry-ui/artifacts.json只选择安全报告/日志/合成截图/文档和source/runtime hash，禁止DB/WAL/profile/Local State/原native JSONL/私有选中文件/worker-bootstrap/env/key；旧档案原字节保持。全目标active，三元题组暂停；不能以本轮24/6结束完整Harness目标，也不重回已过凭证/Office/基础无限验收。
