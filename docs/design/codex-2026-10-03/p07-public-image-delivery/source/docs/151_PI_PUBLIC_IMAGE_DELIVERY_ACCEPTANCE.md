# D3-C正式公开图片交付验收

日期2026-10-04；合同150。本切片正式闭环通过；整体Codex体感/harness目标继续，三元暂停。不把浏览器140/141及WEB_CONNECTIVITY旧证据重新计为本轮测试。

## 1. 实际交付

教师从现有附件入口发送公开合成PNG，原Pi调用office_list_attachments→office_view_public_image。工具内部复用原ask_teacher/typed回答/现有教师确认卡，等待明确“公开图片，无学生信息，同意本轮分析”选项；确认前没有图片请求。用途和当前附件session/ID/revision/version/hash/真实message-run、未归档状态在读取前后与最终provider请求前重新核验。只当前run有效，后续run和冷启动重新确认。学生原图仍147本地OCR校正脱敏。

固定原image utility增加model-image.v1私有分支，调用149固定的Hana450原prepareSingle/normalize和Pi1.0.2原resize/format函数，主进程不解码。不引入辅助视觉API、第二Agent循环、新依赖/表/IPC或累计运行预算。Pi模型注册仅当前已知图片能力且非stale时允许image，实际工具还要求fresh官方目录；旧fresh缓存缺modalities补刷新，不能按名称猜能力。

原Pi唯一stream/context/onPayload链复用：无当前授权的历史image在模型上下文中替换为本地历史提示，摘要不带图片，native磁盘旧image字节不改。最终payload只允许已捕获且本轮确认的user inline PNG/JPEG/GIF/WEBP，拒绝任意远端图片。原hook先执行、最终变更后再检查。图片token用原Pi estimateTokens，base64传输字节另设单请求护栏，避免把5MB图片误当数百万token压缩。

image_delivery事件分别prepared/submitting/received/failed/interrupted，源只在有效provider响应后加入。原ChatTool/ChatToolGroup/Sources与确认卡保持；没有vendor组件body/CSS修改。停止后迟到响应不记received，准备成功不等于已看图，已经收到的有效回执不被后续失败覆写。独立public-image.v1 native身份增量，旧模型/技能/OCR/绑定身份不变。

## 2. 本轮命令及证据

工作目录D:\WorkProject\EduProject\apps\desktop。各脚本只owned测试目录/profile；用户窗口33640及其标准out保持。

| 精确命令 | 本轮结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-public-image-build` | 最终build3.log exit0；typecheck/main/preload/renderer，index-CBvToq2h.js |
| `node scripts/xiaozhi-agent/pi-public-image-native-smoke.mjs` | mCQfiH，13/13 exit0；真实Electron Store、捕获文件、原utility/原Hana-Pi；模型目录/确认为明确fixture，不算真实API/UI |
| `node scripts/xiaozhi-agent/pi-public-image-ui-smoke.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data` | 最终MmeMRW，13/13 exit0；正式renderer/原Pi/官方DeepSeek、本地附件及确认、拒绝/停止/冷恢复/两native尺寸、旧0.80.3副本不改原DB |
| `node scripts/xiaozhi-agent/reuse-hana-model-images.mjs --verify` | exit0；原模块/两适配函数/许可SHA保持149固定值 |
| `node scripts/xiaozhi-agent/pi-image-capabilities-smoke.mjs` | j3DunB，8/8 exit0 |
| `node scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | Vd1xl5，11/11 exit0；原压缩与官方元数据边界fixture |
| `node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs` | NhTrtb，6/6 exit0；Pro五源及既有依赖版本/体积核源 |
| `npm run test:renderer-components` | 79/79 exit0 |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-public-image-build'; $env:OMNI_EDU_E2E_DIAGNOSTICS='1'; node scripts/electron-smoke.mjs` | pi-public-image-main.log，207/207、ok=true、exit0 |
| `node --check scripts/xiaozhi-agent/pi-public-image-ui-smoke.mjs`、`git diff --check` | exit0；Git仅既有LF/CRLF提示 |

正式视觉fixture沿149 LanGoJ同一900×480公开自造图，未改图降低难度。最终严格JSON核验码VISION87444673、左3红方块、右2蓝圆、真实标题全部匹配；捕获实际官方HTTP200、user image_url/MIME/SHA，原native含真实toolResult image，旧native整字节prefix及原session_file保持。公开分段说明≥2，不输出隐藏推理。输入框发送后清空。

再次查看第一次请求不带旧原图；教师拒绝后本轮零image请求/零received。冷启动保留native与真实receipt、删除测试原文件仍能用原capture副本，但必须新确认后才实际HTTP200。停止真实pending卡不发图且不可继续旧上传；固定真实utility产出消息被测试挂起后点实际停止，owned child退出、迟到字节不继续发送。供应商错误项是明确503 transport fixture，正式状态failed/no received；不是实际DeepSeek故障证明。

13项native另覆盖严格getter不执行/任意路径拒绝、text/unknown/cached-only无确认、原worker解码、摘要/旧图隔离、远端图片拒绝、5MB估算、错误/迟到响应、真实DB冷读与确认后capture变化拒绝。1366×768/1920×1080控件可达；实际查看question-1366及receipt-1920截图，原150%系统缩放，不称同DPI整页像素一致。

## 3. 保留失败与限制

native YwgEBw/88MRhw两次验收脚本猜错attachmentStartHash参数，0检查失败；核原签名(id,prompt,selections,rows)后mCQfiH13通过，没有改生产路径掩盖脚本错。正式UI首次Node直接导入extensionless TS失败，改esbuild读取真正共享常量；ESYybd模型查目录后只文字询问，未执行工具。工具description/system明确“工具内等待确认、调用不代表上传”，随后5Y7d2U确认卡/两尺寸3项通过，但实际视觉漏读核验码末位3，严格失败保留。图未裁切/未改fixture；用户任务要求逐字检查到末位、仍不透露答案，最终MmeMRW13通过。一次通过不保证所有图片OCR/视觉准确，教师仍可核对，不把provider received等同事实正确。

本轮没有学生原图上传、扫描PDF/手写公式准确率、正式图像统一计数/缩略图D4、跨run持久goal E、完整D1–D7同DPI/未知Skills设置参照、实际关闭VPN或Windows安装验收。147间歇旧无凭证外键问题本轮主207未复现，根因仍未确认。用户进程33640/Omni-Edu Agent/handle27464762/Responding=True保留，未修改真实profile/凭证/正在运行标准out。

## 4. 组件和源档案

HeroUI Pro MCP本轮ChatTool/ChatToolGroup文档真实返回已保存pi-public-image-pro-docs.json；原Pro五源核验6通过。沿既有Finesse0.20.0闭包，无新可调用Finesse接口，不声称使用Codex官方专有同源码。公开过程仍67原R1/R2及§1/2/5/8/9，不伪装隐藏思考。

source-only显式白名单档案p07-public-image-delivery保存当前源码、149原Hana/许可、Pro文档和安全报告/门禁；不包含DB/native、图片base64、原文件、key、profile、依赖或binary。未commit/push/派子agent。

## 5. 下一唯一动作

四根→67§1/2/5/8/9→35→150/151，冻结D4实际查看计数/来源与缩略图：区分本地预览、模型准备、实际provider接收与有效视觉回答；取消/拒绝/失败不计已查看，多个图/重复请求/冷恢复有真实计数及当前版本，复用原Pro/Codex映射。不把工具开始、一次HTTP成功、目录/OCR文字冒充已查看图片。再E持久goal与全D1–D7/P08无VPN/安装/最终八组，完整目标active。
