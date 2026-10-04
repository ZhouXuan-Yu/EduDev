# DeepSeek 密钥导入与无法对话修复验收

日期：2026-10-04；合同122，用户报告“DeepSeek凭证不可用”“API密钥未通过验证”“显示上次读取的官方目录”。**源码修复、隔离真实页面及实际配置修复已完成。** 当前运行的用户窗口未被强制重启；使用新默认模型请新建对话，已有会话绑定不静默改写。

## 1. 根因与实际配置结果

用户授权的本地调试密钥请求DeepSeek官方`/v1/models`返回HTTP200；小智实际OmniEduAgent配置仍保存另一个旧密钥，官方实测HTTP401。旧默认`deepseek-v4-flash`不在本次官方目录。页面将缺失默认置空、保存因无model禁用，刷新又继续使用旧凭证，因此重新输入正确密钥也缺少独立验证入口。

本次官方实际目录返回`deepseek-flash`（DeepSeek-V4.1-Flash）与`deepseek-v4-pro`（DeepSeek-V4-Pro）。默认选择前者；不从旧截图或Claude角色映射猜模型名。目录为本次调用证据，未来以官方实际返回为准。

实际数据根`C:\Users\ZhouXuan\AppData\Roaming\OmniEduAgent\OmniEduData`已通过原ModelSettingsService/state revision CAS保存`xiaozhi.provider.v1` revision1、默认deepseek-flash与**实际Windows safeStorage加密凭证**。前后已记录running为0；只以OPEN_READWRITE打开现有库操作该配置键，未调用整库初始化、migration或run recovery。原legacy与其他app_settings行逐项保持，未改教师文件/业务/历史/native模型绑定。

使用实际修复后的加密配置解析凭证，请求官方chat/completions、deepseek-flash、最大128输出token和不含个人数据的短连接文本：**HTTP200、非空回复**。安全报告`apps/desktop/test-results/local-credential-repair/report.json`仅保存布尔结果、配置版本、模型及HTTP状态，不含密钥/密文/正文；helper已终态。该连接检查不是在用户真实教师会话发送任务，也不称已操作当前用户窗口。

## 2. 源码与操作流程

复用原DeepSeek官方目录请求、原全局配置owner/Windows codec、HeroUI Button/TextField/Input与Hana设置布局。本轮调用HeroUI Pro MCP查看button/text-field官方文档后使用既有组件，无新聊天模板/依赖/代理网络栈。

新增typed `verifyXiaozhiCredential`及严格主frame `xiaozhi:settings-verify`：只接受schemaVersion/apiKey，拒绝自定义URL/provider/root/未知键/内部控制空白；只裁剪粘贴首尾空白。验证用本次输入密钥读取官方目录，返回安全模型能力，**验证不保存凭证或provider配置**。活动run/关闭/配置作业沿同一owner阻止并发修改。

设置页单独“验证密钥”，不依赖旧默认模型；成功显示可用候选和“尚未保存”提示。原默认缺失时明确提示，候选只在表单，点击保存才用于新对话；保存复用认证和加密CAS，提交后清空密码框。失败保留旧配置，鉴权/网络/本机存储问题分别反馈。已有会话继续原模型，不静默迁移。

用户操作路径：小智→设置→模型与连接→输入密钥→验证密钥→选当前官方模型→保存→新建对话。实际配置已修复，无需重复输入同一密钥；若仍停留于旧窗口，可退出并重新打开小智加载本轮主进程代码。

## 3. 验收命令、计数和边界

cwd `D:\WorkProject\EduProject\apps\desktop`；下列均实际exit0。

| 命令/操作 | 结果 | 原证据 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/pi-model-settings-boundary-smoke.mjs` | 19/19 | zUKOfS/report.json、p07b3b-settings-boundary.log；strict输入、401保配置、edge trim、非主frame、原全局边界 |
| `node scripts/xiaozhi-agent/pi-credential-recovery-ui-smoke.mjs` | 9/9 | IXGvT3/report.json、p07b3b-credential-ui2.log；实际隔离Electron/官方API/Windows safeStorage/Pi |
| `npm run build` | exit0 | p07b3b-build3.log；renderer index-DnZh9vBJ |
| `npm run test:renderer-components` | 79/79 | p07b3b-renderer-final.log |
| `npm run test:smoke` | 207/207、ok=true、exit0 | p07b3b-smoke-final.log；在所有固定out实例终态后重build |
| `git diff --check` | exit0 | p07b3b-diff-check.log |
| 原service实际配置修复与最小连接 | success=true、encrypted=true、HTTP200 | local-credential-repair/report.json；非教师UI/整库迁移 |

隔离UI9：旧凭证实际401/不可用旧模型提示；错误候选实际401且原配置不变；正确候选含edge空白独立200且未保存；明确保存实际Windows加密/legacy保持/清框；1366×768与1920×1080控件可达；secondary BrowserWindow不能调用验证；无环境key重启从密文读取；实际正式Pi/DeepSeek完成且composer空；实际running时验证busy。截图只在提交清框后保存，并查看1366截图核对合法模型、masked凭证与真实控件；不称Codex一比一最终设计验收。

首轮dhxEoM通过5项后测试side-window异步executeJavaScript缺await，finally提前销毁窗口导致等待；改`return await`，原主frame拒绝断言保留。确认其测试profile后只终止owned Electron PID28404进程树，未结束用户窗口。失败报告/日志与最终9项均保留，不把首轮5项算通过全部。

无密钥字面量进入源码/版本文档/报告，无系统代理/DNS/VPN改动；本机网络下官方成功不等于已执行P08关闭VPN现场或Windows安装包验收。

## 4. 下一步

本故障已完成，返回120正式Office工具与教师审阅接线，底座17项另见121；之后实际Office/WPS版面。完整Codex体验、联网/附件/持久目标、D1–D7/P08仍继续，不能以凭证恢复和主207结束整体目标。

公共原字节证据与本轮Office基础共存于`docs/design/codex-2026-10-03/p07-office-artifact-foundation/artifacts.json`：75条原文件与10个runtime hash均核验；真实配置报告只安全布尔/版本/模型/HTTP状态，未归档真实数据库、密文、env或私有会话。
