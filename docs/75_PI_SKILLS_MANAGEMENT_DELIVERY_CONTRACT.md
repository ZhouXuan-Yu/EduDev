# P05-B 教育 Skills 管理交付合同

日期：2026-10-03。M10/M01；接续 docs/73–74。总目标和 docs/67 的 Codex 页面基准保持。三元题组暂停。

## 1. 教师可见完成结果

小智设置中管理四个内建技能和明确选取的本地教师技能：预览完整说明、启停、导入、编辑自定义说明、查看版本、归档。导入默认关闭，启用才允许模型使用必要脱敏内容。技能选择和输入标签接同一有效目录。技能不授予 shell、脚本执行、任意文件读取或写入权限。

冻结时 P05-A 已有内建选择、预览、原生加载/展开/受限 read、失效中断与真实实例，缺可变管理真源、版本撤销/摘要隔离、管理 IPC/页面和管理真实实例。当前B1/B2已分别按docs/76/78验收，正式有效目录/隔离/v4已接；B3管理IPC/页面和真实管理闭环仍缺。本合同不是完成证据。

## 2. 按依赖顺序实施，不能跳过

1. B1：本地目录 metadata/CAS 与不可变文件版本，受控目录导入、预览、编辑、启停、归档；实际 SQLite 和磁盘边界验证。先保留为未开放的主进程基础，不改变已验生产 P05-A。
2. B2：启用目录冻结 → Pi 原生资源与受限文本 read → 独立技能 authority/污染边界 → 原生 branch/append 撤销旧说明、工具结果和派生摘要；与记忆 blockedRunIds 合并过滤保护段。管理动作和所有任务全局互斥，所有模型/工具/摘要交付逐次校验，源失效中断。
3. B3：typed IPC/preload → 正式技能设置和 Hana SkillRow/Badge + HeroUI 对话框/Switch → 导入原生选目录 → CAS/状态 → 实际 DeepSeek/Electron/重启实例。完成前不得勾 N05B。

B1 单独验收只是基础，不能用数据层 smoke 冒充教师闭环。每步记录真实结果和下一继续位置；B3 通过后才做 P06 的 D1–D7。

## 3. 真源、文件和边界

- 新 `xiaozhi_pi_skill_catalog` 表：singleton、schema_version=1、revision、payload_json。payload 仅技能来源类型、名字、标题/描述、当前版本目录、enabled/archived、文件大小/hash 清单；说明和引用文件留本地。单 SQL CAS 更新完整目录，未知 schema/额外字段/重复名字/目录/路径拒绝。
- 目录只由 main 创建：指定 dataRoot 下 `skills/versions/<技能名>/<主进程随机UUID>/<技能名>/`。旧版本保留，原选取源不修改。先完整复制和校验，再 CAS 发布 metadata；中途失败/竞争留下的未引用目录不成为权限、不被自动发现；不递归删除源或真实历史。
- 最多 32 技能，每包最多 64 文件、深度 4、合计 8 MiB、单文件 1 MiB，SKILL.md 32 KiB。只导入根部恰有 SKILL.md 的明确目录，不扫描邻居/祖先；不自动联网安装、ZIP/仓库或系统全局技能。目录/任一祖先与文件 symlink/junction 拒绝，检查 Windows 大小写/保留名/ADS/相对路径。目录总节点有上限，空深层目录也计入边界。
- 导入经 Pi0.80.3 `loadSkillsFromDir` / `parseFrontmatter` 校验，名字遵循原生小写 kebab-case；来源说明不能自称工具权限。外部默认关闭，即使 frontmatter 声明默认启用也无效。同名覆盖拒绝；归档自定义包可通过明确再导入产生新版本。内建不能编辑/归档。
- custom read 最终只支持有效登记的 bounded UTF-8 md/txt/json/csv 文本引用；包内脚本和二进制可本地保留但不执行/上云。runtime 文本经现有教育脱敏边界，原本地正文可预览。enable 是必要技能文本使用授权，不等于上传包/整目录。

## 4. 来源复用与必要适配

- Hana0.449.0 Apache-2.0 `lib/skills/skill-package-installer.ts`：提取独立目标目录 containment 和禁止 symlink 校验；补有界遍历/Windows 路径/源前后验证，保留 source/output hash 与来源登记。
- 不搬缺失 shared/safe-fs 的整安装器依赖闭包；版本副本 safeCopyDir 的递归行为会跟随链接且覆盖旧目录，与不可变教育版本不符。实际 package 字节先有界读取，再写全新 UUID 目录，Pi 负责唯一格式解析。
- Hana 会话 source/pointer 两文件已直接复用；后续 SkillRow/SkillBadge 复用独立显示结构和 CSS，主机/翻译/Tiptap 依赖改为 typed callbacks 和现有主题。原生 Pi 负责展开，不新写第二模型循环/扩展器。
- HeroUI MCP 已查目录：没有 settings-panel，实际用 Modal/Switch 或 Pro Sheet。源码访问限制时用本地相同组件闭包；不声称 HeroUI 是 Codex 官方源码。Finesse 固定参考与截图优先。
- 无新依赖，许可证和 Windows 安装影响限新增本地代码/用户包；新增字节测量写验收，不用源代码大小冒称 installer 增量。

## 5. 原生历史升级与恢复（B2 必须完成）

- 保持既有 legacy/controls/memory fingerprint 与原 JSONL 前缀，不把管理 revision 偷换成这些指纹。
- skills.v2 独立版本快照与技能 authority；binding v4 在首次新交付前设置，新 reader 兼容 1/2/3/4 并防降级，旧 reader 拒绝 4。B1 不升级 binding 或开放可变运行资源。
- P05-A skills.v1 没有技能污染标记。核实固定内建 identity 后，保守以第一次 main RUN 前叶子为旧技能交付边界；未改目录可继续，改变 authority 时隔离该后缀。不靠未来工具 empty 或删单条消息代替隔离。
- 记忆与技能权威独立校验，共享 main RUN 身份、累积 blockedRunIds，避免技能撤销污染记忆授权。当前运行锁住管理；重启/异常未配对工具按已验原生安全边界恢复，实际已完成文件效果与公开历史保留。

## 6. 完成门禁与回滚

B1：真实 SQLite 初始/并发/CAS/未来 schema/重开、内建/自定义 source/hash/路径/边界/损坏/源不覆盖和孤立目录不发现，显式旧数据库副本增量且业务事实不变；build、renderer 门禁。正式入口未改变，不宣称管理闭环。

B2/B3：正式页面导入→预览→默认关闭→启用→真实工具/回复→编辑新版本→关闭→原生旧工具和摘要隔离→重新启用/重启；并发/运行锁/取消/源失效/跨会话/CAS/源字节不变；1366×768、1920×1080；旧 SDK 副本和 binding 防降级。之后固定 out 主 smoke、diff。真实 provider 与确定性测试分别报告。

回滚：B1未注册生产目录，无需迁移真实库；未来接入可关闭管理入口，但新 v4 历史禁止交给旧 reader。保留所有文件版本/原始包/公开消息与教育业务事实。无 commit/push/系统网络配置变化。
