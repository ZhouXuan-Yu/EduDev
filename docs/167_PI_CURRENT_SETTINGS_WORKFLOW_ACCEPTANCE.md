# 当前构建设置、工作区与冷恢复验收

2026-10-04；合同166，根《测试样例说明书》分层规则保持。整体active / NOT_ACCEPTED。

## 1. 本轮改动与固定构建

复用原 `pi-settings-workspace-ui-smoke.mjs`、原 `acceptance/build-root.mjs` 和 `evidence.mjs`；设置、Hana搜索/SkillRow、HeroUI导航和聊天组件均未重写。脚本不再硬编码日常out；新增安全构建/脚本指纹、清空环境凭证后保存配置的实际SDK请求观察、当前官方模型、v2技能、侧栏搜索/重命名、真实已运行会话归档及冷恢复。没有生产代码、迁移、IPC或依赖变更。

同一 `pi-skill-capability-build4`：323文件 / SHA `a5b2c8e939a50555fb2c01a63241d85a7dc888d1ab586812335e6ba7b90d8c96`，renderer `index-DDPZxs9s.js`，前后指纹不变。最终测试脚本SHA `574059fa4402037c7787efc6f5f968581790b898f428967732b7e139240ea0b4`。

## 2. 精确执行与最终结果

在 `D:\WorkProject\EduProject\apps\desktop`：

```powershell
node --check scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs
$env:OMNI_EDU_TEST_BUILD_ROOT='test-results/xiaozhi-agent/pi-skill-capability-build4'
node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs
```

最终 `test-results/xiaozhi-agent/pi-settings-workspace-ui-mwZl43/report.json`：**32项 / success true / Node exit0**。日志 `pi-current-settings-ui-4.log`。未删除首次失败；这是一次最终正向C，不是连续3次通过。

实际检查内容：

- 主进程环境密钥/模型为空；从可见模型设置保存Windows密文，输入框清空。独立SQLite验证配置不含原密钥；普通读取的cache与typed强制fresh官方读回明确分开。
- 当前官方 `deepseek-flash`、`deepseek-v4-pro` 出现在原设置和会话模型菜单；切换会话模型不改变保存默认。**本轮实际请求仅Flash，不把Pro菜单切换当Pro推理测试。**
- 原六设置入口、Hana NFKC/多词搜索及空搜索、实际工作目录授权/记忆保存和撤销、原技能完整预览、4个内建v2、教师技能导入默认关闭、启用/撤销/新版本编辑保关闭。
- 显示偏好原布尔契约、真实本地storage失败反馈、未知schema回退、返回工作区和冷恢复保持原会话/密文配置、无启动工具重放。
- 合成归档文件夹由typed接口准备，设置阅读实际公开历史。另一个**真实模型会话**从原侧栏完成搜索/教师重命名/归档取消/确认归档，保存历史不删，生成新会话；最终冷重启仍读到回复和教师标题，原native字节保持。
- 实际本地备份文件生成/完整性验证；取消、非备份目录错误、secondary frame权限拒绝、chooser错误、运行中busy均正确。**导出/verify不是恢复到新目录/安装包恢复验收。**
- 实际保存的密钥驱动原SDK回复 HTTP200；第二轮运行中菜单设置→返回保同run→教师停止。该请求原fetch返回 `AbortError`、signal.aborted true；projection为 `interrupted`、error“已停止本轮”。主动取消不当HTTP成功，也不当凭证失败。
- 六页各在两个原生内容尺寸1366×768/1920×1080实际测量并留图，共12组；所有main/body横向无溢出、780px阅读宽、关键控件/返回可达；实际查看models-1366与skills-1920。截图2049×1152/2880×1620来自DPR1.5；不是与Codex参考同DPI像素叠图。
- 合成原文件SHA不变，renderer pageerror为空。最终构建指纹不变。

报告沿旧脚本的`boundaries`有“归档创建UI未声称”的旧概括，它只适用于typed文件夹夹具；后追加的真实会话UI创建归档已由明确检查与原动作代码证明，不能据此声称文件夹创建也经过UI。

本轮只改验收脚本/文档，不新增build/renderer79/main207；165同构建79/207属于前轮证据，不伪称本轮重跑。仓库收尾 `git diff --check`另记最后结果。

## 3. 首次失败全部保留

| 目录 | 结果 | 实际原因 |
| --- | --- | --- |
| 8EIKNy / log1 | 1项后失败 | 脚本误把普通settings read的source=cache当目录失败；强制fresh读回才source=official，生产无需改 |
| YVtPo7 / log2 | 31项后报告失败 | 脚本误要求主动停止的请求也必须HTTP200；原记录status null保留，后续安全观察确认AbortError/已取消，不改旧报告 |
| g3AIBC / log3 | 26项后失败 | 脚本误把错误码cancelled当轮次status，正式projection使用interrupted；实际停止正确，fetch AbortError/aborted true，生产无需改 |
| mwZl43 / log4 | 32项通过 | 原契约对应断言、实际取消与HTTP成功分别记录，并补侧栏真实重命名/搜索/归档 |

三处属于测试误判，不声称修复了凭证或停止产品故障。排查的猜路径、相对cwd误写/rg通配Windows错误及不可用组件名menu也保留，后续应先查实际inventory和API。

## 4. 发现的具体产品缺口与复用核对

真实页面、SQLite与提示保存共同显示自动标题仍是 `/skill:teaching-office 这是合成办公连接验收。不要调用工具`。`db.ts`普通append前40字与`attachment-send-state.ts`原子发布trigger前40字均有该行为。本轮教师手动重命名/归档保持，但自动标题缺口**未修复**。

已通过项目graph搜索/trace核对设置与消息调用；db.ts图索引片段偏移已过时，回退实际函数定位后读取，不把错位snippet当行为。Hana本地 `core/llm-utils.ts`确有 `summarizeTitle`，依赖一次真实LLM+摘要配置；Pi1.0.2原 `_expandSkillCommand`严格以第一空格拆name/args，原命令/native展开应保持。下一切片按这两条标题路径冻结原子/旧数据合同，不能仅删界面字符串或覆教师标题/历史。

HeroUI MCP Sidebar官方当前文档已读取，menu不在该API名称中；未复制或重写原组件。Finesse读取本地固定SKILL与ai-console/product-ui参考；无可调用Finesse MCP，不虚构接口调用或ChatGPT专有同源。

## 5. 运行状态与边界

起始日常63652响应；后续收尾已不在，原因未知，本轮没有关闭该PID的命令。owned测试均单独profile并在finally关闭。盘点无日常窗口后按既有启动授权启动原out，**未build、替换out、注入测试或改日常凭证**。新59252初始WindowStyle Hidden导致原窗不可见；只对本轮新建59252的`Omni-Edu Agent`窗口21430590恢复显示，native读回VisibleTrue；进程响应及最终out指纹见收尾记录。不能把旧PID继续写成存活，亦不把启动当D AI验收。

日常out仍旧323/SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981，技能v2/前轮Office错误分类尚未进入日常二进制。C32不是日常旧配置/用户相同输入人工确认、真正关闭VPN、安装包、备份恢复或全Codex页面完成。原NET/IMG用户问题继续open，缺官方Skills/模型/权限设置参考图独立等待。

## 6. 下轮唯一继续位置

四根→67§1/2/5/8/9→35→本167。**冻结自动标题普通消息+附件原子发布的一致性合同**：复用已核Pi命令语义/Hana标题实现，保原prompt/native identity、教师自定标题、旧数据和原子性，先真实普通/附件/教师改名/重启证据再改。随后继续D1–D7剩余设计/完整最终八组及P08 Windows安装与备份恢复；无VPN/D人工由实际环境验收。整体active，三元暂停，无子agent/commit/push。
