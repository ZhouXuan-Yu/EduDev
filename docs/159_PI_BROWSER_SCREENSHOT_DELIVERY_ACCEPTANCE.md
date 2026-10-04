# M01/M10 自然联网与浏览器截图交付验收

2026-10-04；合同158，根测试样例说明书NET-01/NET-02。本轮是实际进展；整体目标继续active/NOT_ACCEPTED。无子agent、提交、push、系统网络修改或日常凭证修改。

## 1. 实际交付

- 原Electron/Hana安全浏览器截取真实页面，前后核ready/current/revision/URL；使用Hana450原browserScreenshotExt/browserScreenshotFilename函数，原body不改，许可证与SHA固定。截取取消、变页、空图不发成功回执。单图4MiB/16Mpx是传输/读取保护，无累计运行配额。
- 新可选`xiaozhi.browser-capture.v1`引用（原文件名、内容SHA、尺寸、页面URL/时间）沿原工具details、Pi真实tool_end、publicItems SQLite消息元数据持久化，不加表或第二事实文件。旧captured-only记录不补造截图；原Pi1.0.2唯一循环、自动压缩、教育权限保持。
- 主frame typed preview只接会话/截图身份，核真实完成tool与本会话run历史、归档状态；使用已有approvedFile/fileVersion/fd读与SHA/PNG尺寸校验。模型/renderer不能传任意路径、URL或bytes。冷预览不启动浏览器/请求模型或重放操作。
- 原Pro ChatTool/ChatAttachment与既有OSS3.2.2 Modal/Button直接绑定本机图；有加载、失败、本地重试、关闭。图片完整contain、不当模型已看图；学生原图/截图均未借此自动上传。新组件只接线，不改原组件源码。
- 完整NET-01与NET-02提示词从说明书原文发送，没有指定工具名或泄漏客观答案。真实官网通知正文已包含全部日期，无需改原reader或硬编码业务答案。正确区分正文落款2022-03-25、网页发布日期2022-04-21、2022秋季学期实施；生成日期2022-04-08是另一字段，不混同。

## 2. 组件与源码证据

原Hana源`lib/session-files/browser-screenshot-file.ts` SHA `14c737f36feb548eae57a357f1c1a0546525d49177f23605a11296cfe958f989`；精确两函数输出`42e29a9ff051d12eccd57e9450e40860196abda43bbc80361d6f50d50dcf7215`。提取/verify脚本、原source URL及Apache2沿vendor manifest。完整Hana registry采用其人格session真源，因此仅取能直接复用的原命名机制；小智使用既有会话publicItems与owned文件真源，不搬入第二人格/JSON权限体系。

实际调用HeroUI MCP chat-attachment/chat-tool/modal文档；source endpoint对Pro chat-attachment返回Component not found（该接口OSS源范围），原结果保留[接口记录](design/codex-2026-10-03/browser-capture-pro-reference.json)。按项目允许的本地原源fallback，chat-attachment五文件与`D:/WorkProject/HeroUIPro/herouipro-v3/src/components/chat-attachment`逐一SHA相同；复用既有主题、工具/CSS和OSS包，不新增依赖。既有Finesse技能与ai-console/product引用用于细过程回执、可查证产物、常驻停止，不伪称新的Finesse MCP或Codex官方同源码。许可证边界沿原heroui-pro README，未发布。

官方通知当前网页和本机实际工具回执支持日期：[教育部原通知](http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)。web open HTTPS曾redirect-loop失败；本机真实受控HTTP读取成功是当前工具事实，不能用搜索缓存替代。只合成请求与公共网页，没有学生资料。

## 3. 精确命令与结果

工作目录`D:/WorkProject/EduProject/apps/desktop`。所有正式C使用同固定隔离`test-results/xiaozhi-agent/pi-browser-capture-build1`：323文件SHA `4ddacc05613d99a89c112b9bc2feeed43efbad99eb0cf3afd228967d3b0db903`，renderer `index-DDPZxs9s.js`。正式日常out仍前轮build4，不把隔离成功说成日常更新/验收。

| 命令 | 证据 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-browser-capture-build1` | TypeScript/Electron/Vite exit0 |
| `npm run test:renderer-components` | `pi-browser-capture-renderer1.log`79/79 exit0 |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-browser-capture-build1 node scripts/xiaozhi-agent/pi-browser-native-smoke.mjs` | 首`pi-browser-native-XOx9FE`20/20；追加实际capture取消分支后`pi-browser-native-WN56o8`21/21 exit0，均原Electron/owned DOM协议夹具加公开公网 |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-browser-capture-build1 node scripts/xiaozhi-agent/pi-browser-delivery-ui-smoke.mjs` | `pi-browser-delivery-vsDjUj`13/13 exit0，官方DeepSeek-flash/实际匿名搜索与MOE网页、真实visible formal UI |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-browser-capture-build1 OMNI_EDU_E2E_DIAGNOSTICS=1 node scripts/electron-smoke.mjs` | `pi-browser-capture-main1.log`207/207，ok=true，exit0 |
| `reuse-hana-browser-capture.mjs --verify` / `reuse-hana-browser.mjs --verify` / `verify-web-reuse.mjs` | 新两原函数及原snapshot/wait、原搜索/reader/Pro八项SHA通过 |
| `git diff --check` | exit0，原LF/CRLF提示不是失败 |

C脚本SHA `a260e1df73d579c0210197eefbcaf155a61a79cc1641b7300da1dc975381774f`；完整两自然请求、来源/当前栏目、PNG实际hash/1629×1086/1023074bytes、本地预览、两尺寸、伪ID/任意路径、secondary frame、冷恢复、变文件拒绝/本地重试、invalid失败页、不上传/无伪来源均实证。

另从该实例native真实office_web_fetch工具回执只读核对：`发布日期：2022-04-21`、正文`2022年3月25日`、`2022年秋季学期`同时存在；不是答案碰巧含年份或依赖URL日期。实际查看[1366预览](../apps/desktop/test-results/xiaozhi-agent/pi-browser-delivery-vsDjUj/preview-1366.png)和[1920预览](../apps/desktop/test-results/xiaozhi-agent/pi-browser-delivery-vsDjUj/preview-1920.png)，原Modal/图像/关闭可达。非全页Codex同DPI匹配。

## 4. 保留边界与下一步

本轮[源码归档](design/codex-2026-10-03/p07-browser-delivery/archive-manifest.json)只显式源码/许可/文档/MCP和脱敏指标，逐文件SHA；原PNG/native/SQLite/profile/失败截图仍隔离目录本地保留，不复制入源归档或Git。源码归档不等于运行证据本身。

本轮C首次完整13通过，A首20过后只针对capture取消增加；没有同版本连续三次稳定性或日常签认。中途错误读取猜测不存在的文件名/错误工作目录、Pro source not found、request_user_input_async不能嵌套exec均保留事实与改法，不当产品实现已失败或用户问题关闭。工具架构图谱只有原browser host入口，新capture无节点时使用精确当前文件，不依赖旧snippet推断。

62244/Omni-Edu Agent/Responding=True日常窗口保持；不覆盖out、不改变真实profile。当前C环境凭证来自ignored .env.local/env，不能替代CFG-01已保存凭证的日常链路。NET-USER-001、IMG-USER-001仍在原问题表等待原输入/环境/用户确认，不因新的C旁证关闭；无VPN、安装、WPS/A4未验。

**下一唯一：按说明书FILE-01/02/03/04原文跑自然资料实读/严格随机答案、拒绝与确认写入、真实可编辑Word交付与冷恢复，先查现有Hana/Pi/正式Office实现，冻结缺口合同；然后CFG保存配置和Skills/设置同款/D1–D7/P08最终八组。** 已异步请求缺失Codex Skills/模型/权限设置截图，只影响精确视觉核对，不等待截图停下办公功能工作。截图自动视觉分析另需原公开图片明确用途/授权及真实provider图像回执，本轮不把本地预览当模型查看。
