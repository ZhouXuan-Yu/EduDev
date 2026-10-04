# P05-A 内建教育 Skills 验收与下一步

日期：2026-10-03。合同 docs/73。**A 内建纵向切片通过；完整 P05 和 Codex 体验目标继续 active。**

## 真实交付

- 四个真实 Agent Skills 文档：备课资料整理、教育知识查证、题目分析与练习草稿、教学办公文稿。Pi0.80.3原生解析、目录与显式 `/skill:` 展开；Hana每会话指针与来源身份两个完整模块直接复用，新增教育版本/路径/hash检查。
- 正式主进程启用 → 原有 typed snapshot IPC/preload → Pro PromptInput/OSS Dropdown技能选择和完整预览 → native模型/工具 → 来源回执/持久公开消息 → 重启续问，完整纵向接通。未新增IPC或SQLite表。
- 自定义 `read` 仅登记的技能说明，默认 builtin read/bash/write/edit均未开放；教师资料仍走既有受限工具。未知显式技能、任意/相对路径、额外字段拒绝。文件变化/缺失时停止；只有缺失的固定内建文档可在新宿主从审核字节重建，已有变化不覆盖。
- 原生 skills.v1 快照独立；原教育/controls/memory fingerprint及旧JSONL字节前缀保持。binding v3在实际模型/工具执行前写入；v1/v2/v3可读，MAX版本不降级，旧v1/v2 reader拒绝3。
- native队列仍唯一消费者。显式技能补充经SDK展开后，以固定SDK公开message格式关联原offered指令，只消费对应ID一次；不创建第二模型循环或自己执行技能脚本。
- 办公仅正文草稿及既有逐次确认复制，网络和DOCX/XLSX/PPTX/PDF生成尚未正式接入。题目分析不自动写题库，不启用暂停的三元题组。

## 精确验收

工作目录 `D:\WorkProject\EduProject\apps\desktop`；所有数据库/资料/源变化只在明确隔离测试目录，配置从忽略的.env.local读取，报告不含凭证。

| 命令 | 最新结果 | 证据 |
|---|---|---|
| `npm run build`（重定向至test-results/pi-skills-build-final.log） | exit0，最终源码构建；随后所有UI使用固定out，无重叠构建 | pi-skills-build-final.log |
| `npm run test:renderer-components` | 79/79，exit0 | pi-skills-renderer.log |
| `node scripts/xiaozhi-agent/pi-skills-boundary-smoke.mjs` | 14/14，exit0 | pi-skills-boundary-XVpJnN/report.json |
| `node scripts/xiaozhi-agent/pi-skills-ui-smoke.mjs` | **真实正式Electron/DeepSeek 12/12，exit0** | pi-skills-ui-BWnPWg/report.json；pi-skills-ui-final2.log |
| `node scripts/xiaozhi-agent/pi-memory-scope-state-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 14/14，exit0；旧副本/新库及v3防降级、原库字节不变 | pi-memory-scope-state-GSSBy1/report.json |
| `node scripts/xiaozhi-agent/pi-queue-boundary-smoke.mjs` | 9/9，exit0 | pi-queue-boundary-8GNtTr/report.json |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | 9个SDK闭包+6个工具，源/output hash 15/15 | hana-auto-source-audit.json |
| `node scripts/electron-smoke.mjs`（上述最终固定out） | ok=true、207/207、exit0 | pi-skills-smoke.log；隔离dataRoot为日志记录的NVjgpB |
| `git diff --check`（仓库根） | 文档收尾后exit0，仅Git自动CRLF提示 | 本轮工具记录 |

真实UI验证：选择及预览、1366×768/1920×1080选择与发送可达、输入清空、一条用户消息、技能选择接收后清空、知识检索、随机核验代号/37分钟材料约束、实际native完整技能展开、自动匹配真实read加载教学办公说明、公开目录无宿主路径、实际重启两轮与真实API续问、技能源改变在请求前失败/usage0/可见中文错误且不覆盖。

确定性14项另覆盖：旧native前缀、四个Hana pointer、未知技能零模型进入、无Skills adapter拒绝新历史、任意路径/extra/relative拒绝、read/重启失效、固定内建缺失恢复、原生补充一次消费、500ms观察器中断实际SDK等待流、同一失效宿主在恢复字节后仍禁止调用。模拟stream是边界证据，不能算真实provider。

源码/打包：无新依赖。两份Hana文件8676字节，仅增TypeScript no-check与Apache来源头，原逻辑不改；source-manifest登记源与output SHA。新增shared/catalog/runtime三个源文件合计10463字节；这只是源码体积。内建文档随main bundle提供，私有SKILL.md在应用目录生成，运行不从GitHub下载。Windows installer实际仍待P08，静态体积不代表安装增量。

## 保留失败和限制

- aGjKcw、STpZXf：边界脚本structuredClone整个SDK context，包含工具函数而抛错，被归类model_error；改为JSON可见模型输入投影。AMBQAk：JSON字符串引号转义断言错误，改读actual user text；随后14全部通过。
- XJDQwB：错误选用新版记忆测试库作为“初始空scope”副本，已有另一行导致count2。换回docs/72明确旧fixture，并新增v3测试；14全部通过，未删除或重置真实数据。
- 首轮真实KoqQXB 11/11通过；增加源码失效路径后的4T4Njt已过12项，但中文错误定位器.first命中侧栏隐藏preview，等待可见超时。限定实际office-conversation后，独立BWnPWg正式12/12通过。不是模型或宿主失败，不掩盖该失败。
- 当前预览样式/侧栏/右栏密度仍非Codex一比一；截图已实际查看，功能可达不等于同DPI视觉对齐。Pro组件来源不等于Codex同源。Skills管理、导入编辑及新Office产物尚未完成。
- Finesse固定SKILL.md及component-scope/product-ui/ai-console参考现在保存在third_party/finesse，MIT；用于后续同款设计与组件状态审查。用户截图/锁定样式优先于其通用美学规则，不旋转改变既定视觉。未将它注册为教师执行技能。
- 无真实教师资料、密钥打印、系统DNS/代理/VPN改动、commit/push。实际无VPN、百万容量极限、完整installer、旧安装器/Fallback仍未验证。

## 下一条第一动作

1. **P05-B**核Hana SkillManager外部发现/导入/编辑和SkillRow/Badge闭包，冻结教师授权、启停/CAS、会话冻结、版本变化/撤销隔离合同。不是扫描全局.agents或用户未授权目录，也不是仅四个内建说明即完成Skills。
2. 接通本地技能管理与输入标签，主进程/typed IPC/用户可见状态/真实工具/版本撤销/旧库/重启实例，完成后才勾P05。
3. P06重新读docs/67、原图与D1–D7，按真实DPR比较结构/字体/行距/工具过程组/侧栏/文件预览/模型设置。P07真实办公文件与联网，P08无VPN/安装/最终完整实例顺序继续。
