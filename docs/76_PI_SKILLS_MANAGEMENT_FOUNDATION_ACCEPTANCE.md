# P05-B1 本地技能管理基础验收

日期：2026-10-03。合同 docs/75；M10/M01。**B1 基础通过，完整 P05-B/P05 与总目标仍未完成。**

## 1. 本轮交付

- `skill-catalog-state.ts`：增量 singleton metadata 表、schema1、revision/CAS，严格校验名字/相对路径/版本/清单/额外字段/容量。目录 metadata 不保存第二份说明正文或执行脚本。
- `managed-skills.ts`：main-only 初始化、目录导入、预览、启停、编辑新版本、归档、有效原生资源描述。四个审核内建默认开启且不可编辑/归档；教师导入和编辑的新版本默认关闭。教师原选取文件与所有旧版本不覆盖。
- 先有界读取整个选定包，再写独立 UUID 版本，Pi0.80.3 `parseFrontmatter/loadSkillsFromDir` 解析。源在复制中变更、版本写失败或 CAS 失败不发布；遗留未引用目录保持无权限，不自动发现。失败重试另建版本。
- 路径/祖先/文件链接、Windows ADS/保留名、大小写冲突、深度/节点/文件/总大小校验；启用或预览重验整个版本清单。源损坏仍可关闭/归档，不能启用；缺失教师文件不从原源自动重建。metadata 不可将教师包标成审核内建，内建哈希始终与应用字节比较。
- 导入限 32 技能、64 文件、128 总节点、深度4、8MiB合计、1MiB单文件、32KiB说明。此轮只明确根部有 SKILL.md 的本地目录，ZIP/联网安装不提供。

## 2. 直接复用与实现限制

Hana0.449.0 Apache-2.0 `lib/skills/skill-package-installer.ts` 的 safe-name、target containment、独立错误类通过 TypeScript AST 提取直接使用，脚本 `extract-hana-skill-package-guards.mjs` 固定提取四个节点，source-manifest 记录输入/output SHA256。应用补有界读取、不可变版本和 SQLite CAS；没有复制第二个 harness 循环或 YAML parser。

主源码缺 shared/safe-fs。版本副本 safeCopyDir 会跟随链接且替换目标目录，未套用到不可变教育版本。未调用 upstream 联网/ZIP/覆盖安装路径。既有完整会话 pointer/helper 两份保留。

源码尺寸：managed-skills 14561 bytes，skill-catalog-state 5633 bytes，提取 guards 1064 bytes，合计21258 bytes。无新依赖；这是本地源码大小，**不是 installer 增量**。以后生产接入按Windows打包实际测量。

HeroUI MCP 已实际查清组件列表并读取 Modal/Switch 文档；settings-panel 不存在。Hana SkillRow/Badge 源结构已检查，正式 UI 仍下一步。当前没有修改 renderer，不声称新页面已交付或与 Codex 同源。

## 3. 精确验收证据

cwd：`D:\WorkProject\EduProject\apps\desktop`。

| 命令 | 本轮结果 | 证据 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/extract-hana-skill-package-guards.mjs` | 四个AST节点提取、exit0 | source-manifest 的源hash `c7a9d77fa9120f55be9ef9b8190d5617a62a37fae695848d9bd2cb1557e9e4c9` / output `2ee4c35545c879a0c87f927c1dd54a06e860a4d46f7d8ea6fe7731ddcb079884` |
| `npm run test:xiaozhi-pi-skills-management-state` | **25/25，exit0**，含tsc | `test-results/pi-skills-management-state-final.log`；`test-results/xiaozhi-agent/pi-skills-management-state-37k1mA/report.json` |
| `npm run build` | exit0，TypeScript + Electron-Vite | `test-results/pi-skills-management-build.log` |
| `npm run test:renderer-components` | **79/79，exit0** | `test-results/pi-skills-management-renderer.log` |
| `node scripts/xiaozhi-agent/hana-source-audit.mjs` | SDK10 + tools6，**16/16，exit0** | `test-results/xiaozhi-agent/hana-auto-source-audit.json`，仅静态来源证明 |
| `git diff --check`，仓库根；新增未跟踪文件另外查尾随空格 | exit0 | 仅Git既有LF/CRLF提示，无whitespace错误 |

原始第一次22项 NwRLlu；补上审核内建metadata栅栏后23项 mUcuWP；最终追加实际复制中修改源/磁盘写失败注入后25项37k1mA。三次均通过，报告保留。本轮未遇到应用验收失败；探查缺 safe-fs/不存在 tsconfig.node.json 和误猜审计脚本名称均改用实际文件，不推断整个Hana安装器可运行。

25项实际 SQLite/磁盘实例覆盖：初始/幂等、四内建原生描述、导入默认关闭/原源保持、内建同名冲突、启停、编辑新版本/引用继承/旧版本保持、并发/busy/CAS、损坏后的关闭/归档、再导入、重开、缺失关闭、无隐式发现、原生格式/UTF-8/各容量边界、实际Windows junction及祖先链接、非法持久路径/权限字段、未来schema、内建身份篡改、孤立版本、复制中来源变化、写失败/重试。脚本均合成资料；故障为可控注入，不冒称系统真实磁盘故障或真实provider故障。

旧数据库仅复制已明确的测试夹具 `test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db` 到本套件 old-copy.db。重复增量迁移保持学生/对话/公开消息/run/event/教育L2/L3事实hash，源数据库字节不变。生产 session-state 未注册新表/服务，binding仍v3，未做真实用户数据迁移。

## 4. 未完成与下一条第一动作

**B1未开放任何正式管理IPC/页面，未修改原生会话资源，未调用真实DeepSeek。** 本轮没重跑Electron主smoke或P05-A真实实例，因为正式调用/页面未改变；docs/74的真实12/主207仍为之前范围证据，不能拿来证明管理已完成。

下一条按 docs/75 B2 直接实现：独立技能 authority/native污染边界及 P05-A v1历史升级，保留Pi原生branch/append/shared main RUN；累积隔离 IDs 并与记忆过滤合并；有效文本脱敏/原生资源/受限read与所有模型/摘要/工具guard；正式宿主全局管理锁；v4 binding 防降级及原生实例验证。然后B3 typed API/原生导入选择/现成管理组件/Badge和真实DeepSeek，含关闭或编辑后的旧摘要撤销/双视口/重启。不要重新冻结泛用选型或提前开放UI启停。

之后 P06 按 docs/67 原图 D1–D7 完成截图精度，P07正式联网/Office文档产物，P08实际无VPN、安装与最终实例。总目标active；三元题组暂停。不 commit/push、不改系统网络、不动真实教师资料。
