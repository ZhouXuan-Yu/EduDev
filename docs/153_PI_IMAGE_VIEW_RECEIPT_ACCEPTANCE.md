# P07-D4图片查看计数、来源与缩略图验收

日期2026-10-04；合同152。有限切片A/C证据通过，整体仍NOT_ACCEPTED/active：日常已保存配置、用户反馈同输入复测、人工确认、无VPN/安装及完整Codex视觉/Skills设置参照均未关闭。本轮未维护真实profile或标准out，用户33640保持；三元暂停。

## 1. 实际改动与组件

PublicImageDelivery增加optional attachment:{id,revision,version}，只main实际capture准备时写入，原通知/事件/投影/重启保留；无表迁移、新IPC或依赖。只received且严格有效确切引用计数，按每turn ID/revision/version去重。重复同图调用和重试不翻倍，不同图/版本独立；准备/正在发/错误/停止/拒绝/列表/OCR文字/本地预览不计。received表示模型确实收到图片并有效响应，不保证模型答案正确。

每turn在最后收到图片的真实工具组后出现一次“已查看N张图像”；原ChatTool展开后直接复用usePiAttachments原ChatAttachment/Group、本地thumbnail/preview/Modal/取消和epoch。当前history元数据必须精确匹配引用；缺失不按标题猜。旧无版本回执显示历史说明，不补造计数/缩略图。图像已接收与本地预览文案明确分开，原分段说明、来源和工具细行保持；无隐藏思考或计时器假过程。

原附件缩略图默认cover会裁图，新增仅viewed容器contain覆盖，显示全图，vendor body/CSS未改。真实缩略图失败在查看展开区显示原错误及重试入口，重试只受控本地IPC，不增加计数/模型请求。官方Pro list/chat-attachment/chat-tool文档本轮实查保存；原五源核验6通过，Finesse沿既有闭包没有新callable接口，不称Codex官方专有源码相同或整页像素一致。

## 2. 当前构建及准确证据

工作目录D:\WorkProject\EduProject\apps\desktop；全部只owned测试数据/旧副本或明确原owned测试目录冷重开，无真实教师/学生图。

| 命令 | 本轮结果/范围 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-image-views-build` | 最终build4.log exit0；index-Ge0jlXMa.js，未改用户out |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-image-views-build'; node scripts/xiaozhi-agent/pi-public-image-native-smoke.mjs` | UmbbDW19/19 exit0，实际Electron SQLite/原utility+版本引用/去重/不同版本/错误/旧字段/accessor/原权限边界；目录和确认fixture是A层 |
| `node scripts/xiaozhi-agent/pi-public-image-ui-smoke.mjs test-results/xiaozhi-agent/pi-browser-ui-uY2Gak/data --views` | 最终6KtrwS17/17 exit0，最终build4；前一build2 0VlLe5同17亦保留，不当最终SHA |
| `node scripts/xiaozhi-agent/pi-image-views-history-ui-smoke.mjs test-results/xiaozhi-agent/pi-image-views-ui-0VlLe5/data --reopen` | 3RKCVo4/4 exit0，真正同一owned data冷重开、received历史1/1/2、完整contain缩略图、零网络、原DB SHA不变；最终build4 |
| `node scripts/xiaozhi-agent/pi-image-views-history-ui-smoke.mjs test-results/xiaozhi-agent/pi-image-views-ui-0VlLe5/data --expect-changed` | nkZTS5 4/4 exit0，明确文件复制版本变化拒绝用例；显示实际changed/重试/零图，历史真实计数保留，不算正向预览通过 |
| `node scripts/xiaozhi-agent/pi-image-views-history-ui-smoke.mjs` | 最终HIWLXt4/4 exit0，真实151旧无版本回执复制件；诚实说明、不根据标题猜图、零网络、源DB不变 |
| `node scripts/xiaozhi-agent/pi-attachment-entry-source-smoke.mjs`，`node scripts/xiaozhi-agent/reuse-hana-model-images.mjs --verify` | Bp8yy7 6/6、Hana原源/函数/许可SHA核验exit0，无新增依赖 |
| `npm run test:renderer-components` | 最终renderer4.log 79/79 exit0 |
| `$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-image-views-build'; $env:OMNI_EDU_E2E_DIAGNOSTICS='1'; node scripts/electron-smoke.mjs` | 最终main4.log 207/207、ok=true、exit0，build4；build2旧207另保留 |
| 新脚本 `node --check`、根 `git diff --check` | 收尾实际结果，以命令日志为准，不把LF/CRLF提示当功能失败 |

正式C17从“+”发送149同自造公开图，不调图降低难度：图内完整VISION87444673、3红2蓝左右与标题严格JSON，实际官方DeepSeek image_url HTTP200和原Pi image body，旧native整prefix/绑定不改。确认前零已查看；收到后1且只有一入口，实际原Pro缩略图加载、分别点击Modal完整图、预览无新增模型请求，1366×768/1920×1080截图。

拒绝新轮零原图和零新计数，冷重启原native/receipts保持且删原文件仍从capture预览，重新看图需新确认；等待及真实utility产出后停止不送图，声明503 fixture不received。最后两图本轮分别确认，严格两份完整码/图形/左右（第二码VISION2E1F965E）、计数2/独立thumb/实际Modal，历史不串。最终尾部两尺寸截图是多图结果，503失败仍由此前断言和保留history证明，不能把尾图当503视觉截图。

6KtrwS记录build files/总SHA、实际script SHA、声明C层/humanAccepted=false/之前失败；history最后三报告记录build、前失败、指定截图SHA及buildUnchanged。仅17项不是3次稳定重复通过；A19/79/207不是日常D或无VPN安装E。此处不把模型自报、manifest或源码存在当完成证据。

## 3. 保留失败及纠正

首build用findLast但项目lib ES2020，typecheck失败，改原reverse/find而非改全局target。vvSKdQ正式4项后测试evaluateAll未显式传Node count，ReferenceError；修真正参数，最终17通过，失败不删除。首次报告未记录构建SHA，后续明确null，不能补造过去的版本证据。一次错误根cwd语法检查找不到脚本，改desktop路径后检查。

history e8Wqvr/J8yjYv/c4sZO3在把0VlLe5 data直接fs复制后要求缩略图成功，0项失败保留。实际只读diagnostic显示current元数据/ref吻合，但thumbnail主IPC返回changed：复制改变capture实际文件版本，原hash/stat校验正确拒绝，不是API/模型错误。没有改权限/校验迎合测试。正向冷恢复改为明确旧owned原目录--reopen（不用户profile），原DB SHA仍完全不变；复制件另列--expect-changed拒绝用例并补真实错误/重试反馈。原失败不能重写为通过或当人工反馈已解决；真正备份/恢复重定位兼容仍P08。

最终实际查看0VlLe5 viewed-2-1366，发现cover截掉图形；修改后3RKCVo history-3与最终6KtrwS两尺寸用contain展示完整图；不是全页同DPI/全部键盘或手写公式验收。147旧外键根因未明，当前主207未复现不算修复。现有用户联网/图片反馈仍需相同日常版本配置输入和用户签认，根测试说明书/并行文档原记录保留。

## 4. 下一唯一动作

四根→67§1/2/5/8/9→35→109-E→152/153，查当前Pi/Hana现成持久任务/目标/继续源码并冻结P07-E合同。目标objective/state/步骤/证据/run关系需要真正本地事实，原update_plan不冒充跨run目标；复用prompt/followUp/steer/abort和原教师wait，明确暂停/停止/重启不重放写入，按真实交付审计而不是模型一句完成。再全D1–D7/未知Skills设置参照/P08实际无VPN/安装/最终八组及用户人工复测。完整目标active/NOT_ACCEPTED，不子agent/commit/push。

source-only显式白名单档案：docs/design/codex-2026-10-03/p07-image-views。含源码/Pro参考/安全报告与门禁，不含原图/base64、DB/native、密钥、profile、依赖或binary。
