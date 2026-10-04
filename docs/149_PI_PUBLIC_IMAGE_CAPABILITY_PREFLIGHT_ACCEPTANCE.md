# D3-C能力与原生视觉前置验收

日期：2026-10-04；合同148。**仅前置链路通过，正式小智图片授权/入口/回执尚未完成；完整harness目标继续。** 学生原图本地OCR校正规则不变。

## 1. 当前原源与实际能力

- GitHub官方release API本轮200：Pi `v1.0.2`，发布时间2026-10-04T00:56:36Z；Hana `v0.450.0`，2026-08-22T02:02:53Z。仓库正确为`earendil-works/pi`和`liliMozi/openhanako`，不是最初猜测的badlogic/liliys地址。直接查原源，不从本地0.449副本推断latest。
- 正式官方`/v1/models`本轮200：`deepseek-flash`/DeepSeek-V4.1-Flash、input_modalities=text/image；`deepseek-v4-pro`/DeepSeek-V4-Pro、text。两者context1048576/output393216。本地每轮输出4096仍独立；没有模型/工具/累计token运行预算变化。
- [官方Vision](https://api-docs.deepseek.com/guides/vision/)与当前SDK实际源码一致：ChatCompletions图片放user content image_url。Pi1.0.2原openai-completions转换把toolResult中的image移至紧跟的user消息，工具call/result仍配对，无需第二视觉循环/Responses迁移。
- 当前Pi `_normalizePromptImages`已经调用原`processImage`并受autoResize/model inputLimits控制。**Hana旧“Pi不resize prompt”的注释不再代表当前版本**；正式接入prompt时只复用Hana格式校验，然后交原Pi处理，避免两次压缩。tool图片可以用原Hana prepareSingle+Pi resize/formatDimensionNote。
- 原Hana发送预检对unknown允许尝试、可转辅助视觉模型；本项目不直接照搬这两项：未知/旧cache/stale不能新增上传权限；只当前DeepSeek能力，无自动辅助API或学生原图上云补救。

## 2. 实际改动

shared可选inputModalities及官方目录严格投影：只text/image、必须text、不能空/重复/未知。缓存仍schema1与同原路径，保留能力数组；旧cache缺字段为未知，容量与旧兼容保持。原目录限时/大小/TTL/移除规则不改。未修改正式Pi input=text/blockImages=true、表/IPC/UI/真实profile或正在运行out。

固定原Hana v450模块完整复用，只有SDK import/header适配；两个原适配函数AST精确提取，Pi原resizeImage/formatDimensionNote保持。新dependency=0，原Apache2源与LICENSE/SHA写入manifest。原module SHA `e3cb6d0d4376305ffb77d85aff00b20239397388dd3a8063f98370fc0d9a0cb9`，适配后`1e2b174c88732744434802cbf3d5f5d7157851652c6c6758de745088688f831f`；原函数桥SHA `c3ceac10b4f9420cb06593a2fe2420eb9b4cda74915d8b5be29a4ccccff87070`。固定SDK四包1.0.2/MIT已存在，没有安装全局CLI。Windows打包/分发仍P08待验。

## 3. 命令与真实证据

工作目录：`D:\WorkProject\EduProject\apps\desktop`。

| 精确命令 | 本轮结果 |
| --- | --- |
| `node scripts/xiaozhi-agent/reuse-hana-model-images.mjs`，随后同命令`--verify` | 生成/核验均exit0，完整原源与函数body/许可SHA一致 |
| `node scripts/xiaozhi-agent/pi-image-capabilities-smoke.mjs` | 04JovG，8/8 exit0；text/image、unknown、错误、旧cache、冷读、移除、offline stale |
| `node scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | 3KTJel，11/11 exit0；原native canonical/摘要失败/官方移除兼容。边界fixture不是实际压缩复验 |
| `node scripts/xiaozhi-agent/pi-public-image-preflight.mjs` | 最终LanGoJ，10/10 exit0；原Pi/真实官方DeepSeek/自造公开合成PNG/两native、prompt及工具图片 |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-image-build` | pi-image-build.log exit0，typecheck与隔离main/preload/renderer build；renderer index-ih2qhlIf.js |
| `npm run test:renderer-components` | pi-image-renderer.log，79/79 exit0 |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-image-build'; $env:OMNI_EDU_E2E_DIAGNOSTICS='1'; node scripts/electron-smoke.mjs` | pi-image-main.log，207/207、ok=true、exit0；使用owned测试profile，没有关闭用户窗口 |

真实视觉用两张900×480自行生成PNG，各有只存在于图内的随机验证码、左3红方块、右2蓝圆。最终要求纯JSON并严格比对code、整数3/2与left/right，不能随机码包含数字造成计数假通过。官方目录和原SDK实际onPayload只投影model、user image MIME/SHA；实际视觉回复与工具一次调用证明内容到达。原native保存真实image，完整native/base64只留owned私有test-results，不公共归档、不把模型返回当教师事实。

## 4. 保留失败与边界

最初查询Pi时用了CommonJS require.resolve查ESM-only pi-ai，ERR_PACKAGE_PATH_NOT_EXPORTED；改官方ESM import.meta.resolve。猜错源码openai-completions位于providers，实际api路径；图谱当前model-capabilities为空，精确当前文件补读。首次新预验脚本SyntaxError（native调用缺右括号），未发生API请求；补括号/node --check通过。第一次PmycC9视觉10通过且实际答对，但计数断言使用全串数字正则存在误验风险；改严格JSON字段后LanGoJ重新真实请求10通过。原失败不修改vendor绕过。

本轮没有正式上传确认页面、同源授权撤销/迟到传输/冷恢复图片隔离、教师真任务、扫描PDF、正式已查看计数或全页同DPI验收。真实用户窗口33640/Omni-Edu Agent/27464762/Responding仍保持；正式out未重写。当前联网旧完整验收仍是WEB_CONNECTIVITY_RECOVERY，并非本轮重测或无VPN证据。

## 5. 下一唯一动作

四根→67§1/2/5/8/9→35→148/149→冻结正式D3-C交付合同。优先复用原ask_teacher/typed question与Pro现成确认组件；工具只接受已submitted当前附件ID/revision，核message/run、capture版本/hash、当前会话、明确公开/无学生信息声明与必要用途，fresh官方图片能力。再同唯一Pi scope/once/cancel和原worker/native图片转换；构建provider交付与返回分开的真实receipt，未发/失败不记已查看。旧native图片在新run/撤销/切文本模型/摘要中不得自动重传，不能只flip blockImages/input；授权不能从summary继承。学生图继续本地OCR校正脱敏。最后D4/E/全D1–D7/P08无VPN安装/最终八组。

本轮源/原许可/安全报告的source-only档案：`docs/design/codex-2026-10-03/p07-public-image-preflight`；不含DB/native/原图/key/真实profile/依赖与binaries。完整目标active，无子agent/commit/push。
