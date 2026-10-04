# P07-C 国内联网与真实来源交付合同

日期：2026-10-04。M10/M04；总目标仍 active，三元题组暂停。126–127有限 Office B已验收；本轮先正式联网纵向链，再继续附件/持久目标与完整桌面体验。

## 1. 当前证据与方案选择

- 正式 Pi host 两处 networkAllowed:false，模型不能调用现有 Hana web_search/web_fetch。共享公开来源只有 title，页面不能打开网址或查看读取时间。
- 直接复用 Hana0.449.0 Apache-2.0现有 AnySearch 8原函数及 web-reader，原 Pi0.80.3/Hana registry/once/取消/预算；不接 Codex CLI，不另写模型循环。
- 当前系统DNS三公开域名被私网/代理虚拟地址保护拒绝；显式 Cloudflare模式匿名AnySearch实际返回教育部官方2022课程方案URL。该环境证据不证明无VPN。
- 阿里公共DNS官网 https://alidns.com/ 明示223.5.5.5与DoH支持；实际https://223.5.5.5/resolve?name=api.anysearch.com&type=A返回200/公开A。只新增可选应用级国内解析，默认系统DNS；不改系统DNS/代理/VPN，不默默fallback，不新开付费服务/注册账户/改凭证。
- 原Hana Bing浏览器方案需要浏览器实例/DOM执行；当前cn.bing搜索301至主页，不能当成功搜索。优先已有匿名API，失败真实反馈，不伪造缓存/来源或切换付费服务。

## 2. 修改边界

- 新Pi web工具factory复用Hana adapter，严格schema、每次传输前必要脱敏（含本地已知学生名），网页/摘要不可信；公开GET和固定匿名搜索POST，禁止凭证、私网、任意上传、脚本执行。DNS逐跳校验并绑定实际连接IP，1MiB传输/12k正文/最多10结果/30秒/原取消。
- 独立xiaozhi.education.web.v1能力快照追加；创建/control/memory/Skills/Office旧身份与native原prefix保持。主宿主注册两个真实工具，原registry/once与工具预算；重复call不重复网络，冲突拒绝。
- app_settings增量独立web配置键/CAS，不增表或迁移，不碰原provider sealedKey；默认启用教师请求的公开工具/系统DNS，可显式关闭和选择阿里公共DNS。设置typed main-frame，原全局owner拒绝busy/CAS冲突；每轮读取配置，修改不改旧历史事实。
- 来源只投影标题、经过校验的公开URL、实际observedAt和read/search类型；不投影正文/查询/args/原异常。失败码、无结果真实展示。typed打开仅本会话实收来源URL/主frame，校验公网DNS后原shell.openExternal，教师显式点击才打开。
- renderer复用现成Pro ChatTool/Group、已有HeroUI/Hana settings primitives/Dropdown/Switch；不另设计新卡片。

## 3. 验收与恢复

- 原source审计、真实匿名搜索/国内官方正文读取（记录DNS模式/失败）；隐私、严格schema、SSRF/redirect/大小/取消/失败码/空结果/一次执行/CAS/副窗口边界有独立测试。
- 实际正式Electron+DeepSeek自然查询→工具→来源和时间→公开分段回复；两native1366×768/1920×1080控件可达、实际来源打开（拦截OS launch但校验main所选URL）、composer清空；停止/重启不重放，来源历史保留。
- npm run build、test:renderer-components、相关专项、关键用户路径test:smoke、git diff --check；不得把mock/当前代理可达称无VPN或完整Codex对齐。任何剩余项在验收报告逐项标未验，下一轮继续C，不能直接跳D。
- 无不可逆数据变更；旧无web配置默认值可读，旧事件无URL仍title显示。关闭web只取消未来能力，不删除历史或写旧快照；已停工具无迟到公开回执。

## 4. 完成定义

以上纵向链与真实国内来源通过后，有限C完成；真实无VPN部署仍P08独立门禁，D附件/E持久goal/全D1–D7/官方参照缺口和总目标保留。不提交、不push、不派子agent、不动用户WPS/真实教师数据。
