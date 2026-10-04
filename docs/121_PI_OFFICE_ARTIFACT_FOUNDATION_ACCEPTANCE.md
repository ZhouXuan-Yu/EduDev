# P07-B3b 正式产物状态与保存基础验收

日期：2026-10-04。M09/M10；合同120承接118–119。**本报告仅确认状态、来源关系与实际文件提交底座，原Pi工具、typed审阅与教师页面仍待接入；完整B3/B及总目标未完成。** 用户报告凭证故障后优先执行122–123，下一继续120的正式接线。

## 1. 实际交付

新增shared `xiaozhi.office-artifact.v1`：严格四格式proposal、相对目标路径、office-draft.v1拟内容、最多16个本次源文件版本及可选父产物。Windows设备名、路径穿越、格式与扩展不符、未知字段和越界内容拒绝；本机凭证/排除目录/链接约束沿既有workspace权限服务。

新增领域office-artifact-state/service，复用原Pi文件mutation queue与现成生成器。增量三表`xiaozhi_pi_office_drafts`、`xiaozhi_pi_office_draft_sources`、`document_artifact_sources`；不删除旧表/数据。proposal与captured sources由同一SQLite语句和trigger原子写入；pending修改递增revision，旧确认失效。批准后生成真实buffer，再校验当前run、权限、源版本/完整hash与目标。

prepared持久实际bytes/hash，committing保存写入意图；同目录wx/fsync暂存、exclusive link安装、真实单链接/hash回读。committing/uncertain→saved revision CAS的SQLite trigger同时INSERT原document_artifacts与来源关系；不使用OR REPLACE，既有正式id冲突整句回滚。更新binary创建新文件/新artifact并记录parent，不覆盖旧版本。

恢复仅分类：未提交阶段interrupted、提交意图uncertain。uncertain只读核验目标精确hash；匹配才登记现存文件，手工竞争版本保留，不重新生成或安装。FS与SQLite不构成同一事务，不能把此机制说成跨文件系统原子事务。

DocumentArtifactType扩展xlsx/pptx，但旧export input仍三格式，旧writer明确拒绝不支持格式，避免fallback生成伪DOCX；App旧入口类型同步限制。PDF改为main动态import既有Hana适配器，Node基础无需加载Electron；实际Electron生成专项已复验。无新依赖、无新Office工具/IPC/页面，旧入口保留。

## 2. 精确命令与结果

cwd `D:\WorkProject\EduProject\apps\desktop`；下列成功命令均取得实际exit0。固定out实例终态后才运行会重build的主smoke。

| 命令 | 最终结果 | 证据与范围 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/pi-office-artifact-foundation-smoke.mjs` | 17/17 | f35qzG/report.json、p07b3b-foundation3.log；实际SQLite/FS/Pi queue/三库与四个真实child退出，不是教师UI |
| `node scripts/xiaozhi-agent/pi-office-generator-electron-smoke.mjs` | 12/12 | hEbv27/report.json、p07b3b-generation-final.log；dynamic PDF import后的实际Electron四格式/独立解析/中文尾部与A4/取消 |
| `node scripts/xiaozhi-agent/pi-text-change-foundation-smoke.mjs` | 20/20 | 84X1hk/report.json、p07b3b-text-foundation-final.log；原文本提交/恢复与生产session-state增量兼容 |
| `npm run build` | exit0 | p07b3b-build3.log；renderer index-DnZh9vBJ；包含凭证恢复源码 |
| `npm run test:renderer-components` | 79/79 | p07b3b-renderer-final.log |
| `node scripts/xiaozhi-agent/reuse-hana-pdf-renderer.mjs --verify` | 2文件/4原body | 原Hana body与许可证保持 |
| `node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify` | 4文件 | 原读取源保持 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32文件/182153bytes | 原Pro源保持；不是Codex官方同源声明 |
| `npm run test:smoke` | 207/207，ok=true，exit0 | p07b3b-smoke-final.log；最后同源码正常app迁移与既有用户路径 |
| `git diff --check` | exit0 | p07b3b-diff-check.log；宽脏树保留，无commit/push |

基础17覆盖：拟内容零文件/正式fact效果；教师revision后实际XLSX数值及文字公式；实际DOCX/PPTX文件；拒绝；同call幂等/不同payload冲突；确认前后源变化；新版本父来源/旧bytes；跨session；并发一次安装；已有目标及竞争创建者；Windows别名/凭证/hardlink；实际生成后的停止/撤权/取消；私有内容与来源损坏；正式id冲突trigger全回滚；prepared/intent/file/fact四个真实process.exit73切点恢复且零重放；uncertain竞争手工文件保护；旧隔离生产数据库全表行集、fresh两次迁移均不变。

PDF基础单独在Electron12中检验，本服务基础17的实际产物提交是DOCX/XLSX/PPTX；不能合并称四格式教师保存已验。解析库/文件readback不是实际Office/WPS打开或版面验收。

## 3. 本轮失败与修正

- build1发现私有类型输入缺字段与旧App入口被新增格式拓宽；缩小missing所需Pick并限定旧入口Extract，随后build2/build3通过。
- foundation2 AVuc51在16项后因旧库WITHOUT ROWID表不存在rowid而失败；改为读取全表行并排序比较完整行集，未减少任何业务事实断言；最终f35qzG17通过。早期yJquZc16通过保留，不算最终17。
- 凭证恢复9项及其夹具失败、真实配置修复单列123，不冒充Office正式工具验收。

## 4. 唯一下一动作

继续120§4/5.2：沿原Pi/Hana registry/once/teacher wait、独立office-artifact.v1能力、宿主全局owner与主frame typed review/revise/decide，接原Pro ChatTool/CodeBlock、现有Tabs/FileTree及真实教师编辑、拒绝、确认、保存、打开。实际DeepSeek自然任务/两native/源冲突/停止/真实退出恢复之后再B3c Office-WPS-A4。必须先更新执行合同与完成定义，不把底座17或主207当页面交付。

C国内联网、D附件图像、E持久goal、全D1–D7与P08实际无VPN/国内API/Windows安装继续；三元题组暂停，67原公开实时过程/组件设计仍为真源。

公共原字节归档：`docs/design/codex-2026-10-03/p07-office-artifact-foundation/artifacts.json`，75个许可/源码/报告/日志/合成文件及清框截图条目、10个当前runtime hash逐项核验。包含失败与成功；不归档数据库、私有JSONL、env、凭证/密文或教师数据。
