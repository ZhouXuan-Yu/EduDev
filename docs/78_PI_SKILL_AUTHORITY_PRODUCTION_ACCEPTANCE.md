# P05-B2 技能授权隔离与生产接入验收

日期：2026-10-03。合同：docs/75、docs/77；模块 M10/M01。**B2范围通过；B3管理页面、完整P05和整个目标尚未完成。**

## 1. 本轮交付

- 复用已验的原生记忆隔离，抽取 `native-authority-epoch.ts`；原 `native-memory-epoch.ts` 保留兼容门面。记忆和技能分别保存授权/交付标记，共用实际main RUN。任意一类撤销先合并两类累计排除编号，再Pi原生branch/append；旧JSONL、公开历史、SQLite事实与已完成文件效果不删除。
- 新 `native-skill-epoch.ts`：严格校验旧审核内建skills.v1，以首次实际main RUN之前的祖先迁移交付边界；相同权限保留上下文，权限变化隔离原说明、工具结果、推导和压缩摘要。没有可证明RUN的非空旧历史拒绝，不猜安全位置。空旧历史不杜撰调用。skills.v2独立身份、off-branch未来/非法marker拒绝。
- 新 `managed-skill-runtime.ts`：main冻结实际启用目录及完整包hash，仅必要UTF-8说明与有界md/txt/json/csv经已有教育脱敏后复制到私有模型资源。脚本/二进制不暴露。Pi原生解析、目录、命令展开与Hana会话source/pointer继续复用；read仅完整登记路径。原包不覆盖，教师新版本即使正文相同也有新authority。
- 私有模型缓存必须在Pi解析之前通过完整包、文件数、大小、路径/hash校验，已有变化不覆盖，未登记`.gitignore`也拒绝。普通/摘要请求、原生补充指令、工具前后都校验有效目录与缓存，500ms观察中断，失效同一宿主保持关闭。
- 正式 `session-state` 初始化增量技能目录表，`production-host` 使用该有效目录，提供main-only管理方法。原生目录选择全生命周期、管理动作、任务启动预约和实际运行全局互斥；取消、关闭、CAS失效不产生有效版本。
- 正式公开snapshot仅返回启用技能的教师可读说明，typed错误/技能隔离事件经既有投影和Pro ChatTool显示。私有path/bytes不进入公开catalog。绑定v4在执行前保存，新reader接受1/2/3/4、拒绝未来版本、setter不能降级。
- 无新增依赖；继续Pi0.80.3/Hana0.449.0已有许可证与Windows打包方式。Hana提取/指针清单未新增，本轮静态SDK10+工具6 hash均一致。

## 2. 精确验证与证据

命令工作目录 `D:\WorkProject\EduProject\apps\desktop`。真实API使用已有ignored `.env.local`，报告不输出密钥；资料均合成。执行顺序是初始build/部分边界与UI → 缓存校验加强 → 最终build → 固定out正式UI/旧历史UI/主smoke，期间不重建out。

| 命令 | 结果 | `test-results`证据 | 证明范围 |
| --- | --- | --- | --- |
| `npm run build` | exit0 | `pi-skill-authority-build-final.log` | 最终TypeScript、main/preload/renderer打包；不是UI通过 |
| `npm run test:renderer-components` | 79/79，exit0 | `pi-skill-authority-renderer.log` | 组件状态；此后renderer未再变更 |
| `node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs` | 22/22，exit0 | `xiaozhi-agent/pi-skill-authority-G2lesB/report.json` | 真实Pi/JSONL、双向撤销/摘要/重启/版本/安全边界、必要脱敏、native自定义展开/read、观察器与缓存；SDK stream为合成，非provider/管理UI |
| `node scripts/xiaozhi-agent/pi-skill-host-lock-smoke.mjs` | 9/9，exit0 | `xiaozhi-agent/pi-skill-host-lock-p2gDYE/report.json` | 实际host、旧测试DB副本、初始化、chooser/启动预约/管理全局锁、取消/CAS/关闭；确定性启动屏障，非provider |
| `node scripts/xiaozhi-agent/pi-memory-scope-state-smoke.mjs test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` | 15/15，exit0 | `xiaozhi-agent/pi-memory-scope-state-Psb6Dc/report.json` | 新旧副本、v4绑定兼容/不降级、原业务与源hash不变 |
| `node scripts/xiaozhi-agent/pi-skills-management-state-smoke.mjs` | 25/25，exit0 | `xiaozhi-agent/pi-skills-management-state-yP0Fag/report.json` | main目录/版本/旧副本/磁盘/CAS，当前state已暴露生产目录方法 |
| `node scripts/xiaozhi-agent/pi-memory-epoch-smoke.mjs` | 17/17，exit0 | `xiaozhi-agent/pi-memory-epoch-TC34qB/report.json` | 共享隔离提取后的记忆边界最终复验 |
| `node scripts/xiaozhi-agent/pi-skills-boundary-smoke.mjs` | 14/14，exit0 | `xiaozhi-agent/pi-skills-boundary-sB2Yft/report.json` | 固定内建A兼容门面保留 |
| `node scripts/xiaozhi-agent/pi-queue-boundary-smoke.mjs` | 9/9，exit0 | `xiaozhi-agent/pi-queue-boundary-CWsRpS/report.json` | 既有追加/消费兼容边界 |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | 16/16，exit0 | `xiaozhi-agent/hana-auto-source-audit.json` | SDK10+工具6静态来源一致，非运行证明 |
| `node scripts/xiaozhi-agent/pi-skills-ui-smoke.mjs` | 12/12，exit0 | `xiaozhi-agent/pi-skills-ui-3IuhjF/report.json`、`pi-skill-authority-ui-final.log` | 正式Electron/main/typed preload、真实DeepSeek、选择/预览、知识库随机核验代号与37分钟、自动read、输入及选择清空、双视口、重启/真实续问、源变化零请求/中文失败 |
| `node scripts/xiaozhi-agent/pi-skill-existing-ui-smoke.mjs test-results/xiaozhi-agent/pi-skills-ui-BWnPWg/data` | 7/7，exit0 | `xiaozhi-agent/pi-skill-existing-ui-kNrp5W/report.json`、`pi-skill-existing-ui-final.log` | 明确隔离旧A v3/v1副本，从真实导航续问未在新prompt透露的旧随机事实；v4/v2与旧RUN交付迁移、原字节前缀、重启再次真实续问、RUN唯一、全部源文件hash不变 |
| `node scripts/xiaozhi-agent/pi-memory-auto-ui-smoke.mjs test-results/xiaozhi-agent/pi-memory-scope-ui-R8nC5O/data` | 9/9，exit0 | `xiaozhi-agent/pi-memory-auto-ui-vntqtL/report.json`、`pi-skill-authority-memory-auto-ui-final.log` | 最终生产技能资源与既有记忆同用：旧B3b1真实授权读取、实际自动compact、清空后的原摘要隔离、重启、owned进程异常退出/主动页面回答恢复/重复不新增、源字节保持；提前阈值65536是E2E策略，官方能力不改 |
| `node scripts/electron-smoke.mjs` | 207/207，ok=true，exit0 | `pi-skill-authority-smoke-final.log` | 固定最终out主桌面冒烟；旧教育路径，不当新技能管理闭环 |

初始原生21项G7ZXaM、正式UI12项NhjRXS均通过并保留；最终22/3IuhjF含缓存加强后的独立复验。旧memory-auto测试仅将当前生产绑定预期3改4，随后真实9项复验通过。最终report以success/checks及进程exit共同判断。新代码/脚本及本轮合同/设计95文件空白/冲突检查exit0（初次检查脚本漏括号，修正后独立重验，非应用失败）；仓库diff门禁以本轮最后工具记录为准。

## 3. 兼容、恢复与实际限制

- 生产第一次初始化注册固定审核内建；SQLite仅保存schema1/revision授权metadata，不存第二份模型正文。旧A可安全追加升级；unknown版本关闭。目录中未发布/竞争遗留版本不扫描、不授权、不自动删除。
- 源/缓存变动失败，关闭失效项仍可用main管理；错误不覆盖原文件，未提供自动放宽权限。旧SDK-only未带main RUN的非空历史不能安全迁移到可变Skills，会明确拒绝；新建会话可继续。
- 当前main管理方法还没有typed IPC/preload和正式设置页面。**不能说教师已经能导入/编辑/启停，不能将合成SDK撤销当作正式页面撤销。** B3须从教师点击导入到真实provider、旧摘要撤销、重启连贯验收。
- 全局技能关闭/修改后，模型上下文在下一任务初始化按当前authority隔离；公开历史保留。启停不会自动撤销已完成复制效果，也不会带来新文件/联网权限。
- 实际VPN关闭、安装包、完整Office生成/联网及完整Codex一比一视觉未验证。docs/67原图D1–D7和docs/35整体队列保持未完成；三元题组暂停。未commit/push，未修改系统DNS/代理/VPN或真实教师库。

## 4. 下一继续位置：直接P05-B3

1. 先读docs/75的B3、docs/67过程/组件约束，复核已查的HeroUI Modal/Switch和本地Hana SkillRow/SkillBadge源码/CSS闭包，冻结简短B3纵向合同；不重复选择框架。
2. 新main-only preview先await初始化；共享管理schema → main精确校验/生产host → 原生受控目录dialog → typed preload → 正式技能设置/标签。公开状态不带宿主path或包bytes；编辑/预览留本地，启用后只授权必要脱敏文本。source错误文案改为当前全局启用文件的实际恢复操作，避免误导新建会话能修复同一失效源。
3. 教师导入默认关闭 → 预览 → 明确启用 → 原生自定义技能/引用read/真实DeepSeek → 编辑新版本默认关闭 → 原说明/tool/真实compact摘要隔离 → 关闭/再启用/重启；并发/CAS/取消/活动锁/源变动与双视口实例。不得用直接SQL改状态替代用户操作。
4. B3通过才勾完整N05B/P05，再P06 D1开始截图校准/同款过程与设置，P07正式教育办公联网，P08实际无VPN/安装/最终实例。总目标active，不做每轮token成本优化。
