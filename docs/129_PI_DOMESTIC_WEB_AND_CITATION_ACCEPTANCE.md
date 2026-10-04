# P07-C 国内联网与真实来源验收

日期：2026-10-04。合同128，M10/M04。**有限C通过，总目标继续active**；三元题组暂停。下一先冻结130附件/图像合同，之后D/E/全D1–D7/P08及未知官方Skills/设置参照。不能以本轮宣布完整Codex体验或实际无VPN通过。

## 1. 实际交付与复用

- 正式主宿主新增`office_web_search`/`office_web_fetch`，直接复用Hana0.449.0 AnySearch原8函数、web-reader和限流处理；沿Pi0.80.3原registry/once/取消/预算执行，没有Codex CLI或第二模型循环。Hana Apache-2.0来源及本地快照hash由现有manifest记录。
- 独立`xiaozhi.education.web.v1`追加能力，不改旧创建/control/memory/Skills/Office身份或native prefix。新版旧会话真实继续通过；关闭联网仅移除未来工具，旧历史和原能力记录保留。
- 独立`app_settings:xiaozhi.web.v1`存启用/系统或阿里公共DNS及revision，原CAS/owner拒绝busy与旧版本；不增表、不碰provider sealedKey。typed主frame保存设置及来源打开。默认系统解析；教师显式选择阿里解析，不自动fallback，不改系统代理/DNS/VPN。
- 取网每跳校验并固定公网连接IP；只公开GET及固定匿名搜索POST，无隐式代理/任意上传/网页脚本。实际查询先标准脱敏与本地已知学生名替换；编码URL中凭证/身份拒绝。1MiB传输、12k必要正文、最多10结果、原超时取消与一次执行保持。
- 公开事件仅安全标题/URL/实际observedAt/read或search、错误码/空结果，不含查询、正文、args、远端原异常或隐藏推理。教师点击仅可打开本会话实际记录来源，main再次校验URL/DNS后调用原shell；网页不能通过正文取得执行权限。
- 实际Pro MCP查chat-source/chat-tool/dropdown/switch；直接用已复制的Pro ChatSource/ChatSources/ChatTool/Group和HeroUI/Hana设置原语。右栏实读来源优先、默认3条、原“查看全部”折叠；原Pro5文件byte-identical，本轮没有新依赖或手写替代组件。Finesse沿67既有0.20.0闭包和ai-console，本轮无可调用Finesse接口，不假称重新取得源码；也不称Codex官方组件同源。

## 2. 真实网络与页面证据

最终公开probe：系统模式AnySearch/Bing/MOE均`permission_denied`，保持私网/虚拟地址保护。阿里模式匿名AnySearch返回3个真实结果（含教育部通知）；cn.bing实际200/搜索标题/99138字符，MOE主页302→HTTP。既有Cloudflare诊断模式AnySearch有结果，Bing301→主页，不能当Bing成功检索。应用设置只提供系统/阿里两项，没有新付费账户或凭证。

[阿里公共DNS官网](https://alidns.com/)明示223.5.5.5/223.6.6.6及DoH支持；本轮使用显式应用级`https://223.5.5.5/resolve`。实际正式工具读到[教育部通知正文](http://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html)，实收时间`2026-10-04T03:34:10.096Z`。搜索结果也可能含无关网页；来源区分摘要与已读正文，不能把摘要当已实读或保证所有结果质量。

正式Electron/Pi/DeepSeek自然任务`pi-web-ui-9uZomc` **15/15，exit0**：教师实际选阿里并保存→自然检索→读取教育部正文→引用两项事实；公开说明/工具/下一说明/最终回答顺序、空composer、独立native能力一次；1366×768/1920×1080来源/时间/常驻输入可达；真实点击后的来源/DNS/open选择（OS启动被拦截，未改用户浏览器）；伪造URL/副窗口/旧CAS拒绝；实际联网任务运行中拒绝改设置、停止终态；同profile重启保留来源/偏好/native原prefix、不重放；实际不存在公开URL失败有中文回执、无伪来源；实际Switch关闭联网后未来工具缺席、旧历史仍可读。三张最终截图已实际查看。

旧Office会话副本真实Electron/DeepSeek续问`pi-web-legacy-Dexx8J` **3/3，exit0**：先前无web会话能读；只增独立能力一次，原创建/绑定/native所有旧字节不变；旧saved/rejected/interrupted产物计数保持、不重放。只复制明确合成测试目录，非用户教师资料。

## 3. 精确门禁与边界

以下命令在`D:\WorkProject\EduProject\apps\desktop`执行，Node为当前bundled24.19（没有安装额外运行时）：

```powershell
$webNode = 'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
& $webNode --import ./scripts/office-agent/register-source.mjs scripts/xiaozhi-agent/pi-web-public-probe.mjs
& $webNode scripts/xiaozhi-agent/verify-web-reuse.mjs
& $webNode scripts/xiaozhi-agent/pi-web-boundary-smoke.mjs
& $webNode scripts/xiaozhi-agent/pi-web-ui-smoke.mjs
& $webNode scripts/xiaozhi-agent/pi-web-legacy-ui-smoke.mjs test-results/xiaozhi-agent/pi-office-artifact-ui-vWOfNs/data
npm run build
npm run test:renderer-components
npm run test:smoke
git diff --check
```

| 证据 | 最终结果 | 实际范围 |
|---|---:|---|
| Hana/Pro源码审计p07c-web-source-audit | 8/8 | Hana3源/Pro5源hash，不代替运行证明 |
| pi-web-boundary-7JFNQJ | 13/13 | 原adapter/reader/once/SQLite/投影；HTTP是MockAgent，不冒充真实provider |
| 正式自然任务9uZomc | 15/15 | 真实DeepSeek/匿名搜索/官方正文与正式页面 |
| 旧会话Dexx8J | 3/3 | 真实旧native副本续问/字节/产物保持 |
| renderer-final2 | 79/79 | 既有组件状态门禁 |
| main-smoke-final2 | 207/207，ok=true，exit0 | 包含最终构建；最终renderer index-CMajNv0Z |
| build5 | exit0 | 同最终产品源码，前端及typed构建 |

边界13含查询先脱敏、编码来源过滤、重复call零HTTP与不同args冲突、getter零执行、原HTML无脚本/chrome与正文脱敏、SSRF/auth/redirect、真实空envelope、429/503映射且原异常不公开、大小/binary、取消/旧run零执行、配置CAS/provider密文原值保持、本会话来源打开与严格schema、公有来源投影。原process5/模型边界19/Hana工具12/Pro闭包32亦已通过；不扩大成本为重复全回归。

## 4. 失败与限制保留

- 初始MockAgent补丁经`mock.dispatch`递归；改直接MockPool、消费async iterable请求body后13通过，未改产品安全检查或缩断言。临时诊断log已移除。
- SoGCs3在第二尺寸盲点折叠按钮收起正文；改按实际aria-expanded并等待动画，继续检查x/y可达。iHK3ic真实Switch缺`Switch.Content`导致不可切换，按原HeroUI API修组件；NL9blZ错误读hidden input的aria/直接点击被拦截，改真实isChecked与可见content点击。
- oescWH已15通过后截图发现右栏日期裁切；复用原ChatSources默认3条并竖排时间。FefUeb夹具把折叠DOM中的隐藏来源计入，改实际`:visible`计数后继续原完整测试。
- xwjMYj前11项通过后重启空白窗口失败，截图/报告保留。当时并行主smoke含重构建共享out，资源竞争仅是推测，未证明原因；确认构建完成后同一脚本最终9uZomc15通过，新增file资源错误记录，没有降低重启要求。后续UI实例与写out构建串行。
- 当前机器可能仍存在VPN/TUN/代理。公网IP连接与现时可达不等于实际关闭VPN；**P08无VPN、Windows安装包、任意网页/文件质量、完整Codex像素和所有功能、未知官方Skills/设置参考仍未验**。本轮没有强制重启用户原窗口、改系统网络、提交push、派子agent或上传真实教师数据。

## 5. 公开归档与下一项

公共原字节、安全报告/截图/日志和当前源码runtime hash保存在`docs/design/codex-2026-10-03/p07-domestic-web/artifacts.json`，排除.env/DB/profile/native JSONL/实际密钥及真实教师文件。B档案保持原样；失败报告和截图保留。四根、26/28/35/67记同一事实，diffcheck在文档收尾后执行。

下一唯一第一动作：四根→67§1/2/5/8/9→35→109-D，冻结130附件/图像纵向合同；图谱核Hana附件原服务/native chooser、Pi图像能力、现有本地OCR/脱敏与文件授权，选原组件/缩略图/查看接真实事实。学生图片仍本地，当前模型未核图像能力不得上传；之后E持久目标、全D1–D7/P08和未知官方参照，总目标保持active。
