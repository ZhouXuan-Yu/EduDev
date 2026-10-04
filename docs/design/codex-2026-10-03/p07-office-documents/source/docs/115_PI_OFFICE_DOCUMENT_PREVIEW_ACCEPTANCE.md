# P07-B1 本地 Office/PDF 正文预览验收

日期：2026-10-04。合同114；M02/M10本地只读预览。**B1有限切片通过，完整P07-B、Codex全目标未完成。** 下一B2正式Pi读取工具与必要脱敏/来源；B3真实受控Office导出与Office/WPS/A4仍待。

## 1. 实际交付与复用

直接复制Hana0.449.0 `lib/document-extract/{index,types,anydoc-loader}.ts`，只加来源/no-check头，原body不改；Apache-2.0原LICENSE及四文件源/输出hash在vendor目录source-manifest.json，复用脚本可验证。AnyDoc精确0.1.2/MIT，原文档解析及格式检测由此库负责，不手写DOCX/PDF/XLSX/PPTX解析器。[官方源码说明](https://github.com/firecrawl/anydoc)确认本地转换/扫描PDF无OCR。

新增shared document.v1严格request/result键、实际bytes/格式/输出上限和安全错误；Electron utilityProcess单请求单进程调用原Hana模块，worker入口被构建，native库external。host固定入口与15s deadline；取消/超时kill，stderr只消费有界计数，不传UI/模型，不继承API凭证环境，仅SystemRoot/WINDIR/TEMP/TMP/LANG。worker再核安装包0.1.2，格式限定四类；上限50MiB原文件/1MiB提取正文。UTF8输出替换字符失败不作为可靠正文。

既有workspace grant/Hana resolver、links/hardlink保护、持有文件句柄的前/后版本及授权租约重验保持；Office解析后再次核文件版本。沿既有files.v1 typed preview/cancel与8个作业槽，Office IPC总deadline16s、其他旧请求10s；slot等真实work结束再释放。没有新数据库表、preview缓存或自动资产导入，不写教师文件/原库，不给模型发送正文，不变Pi native指纹。

原Pro FileTree/原OSS Tabs及现有Markdown复用，Office正文显示“本地提取正文，版式以原文件为准”；扫描、损坏/密码、不可解码、空、超大、取消/超时、不可加载明确中文错误。外部图片/链接不加载/跳转，HTML脚本不执行；不是Office编辑器或完整原页排版。已有文件模式、草稿和阅读锚点保持。

## 2. 门禁与真实实例

命令工作目录 `D:\WorkProject\EduProject\apps\desktop`，每个运行已取得终态exit0；脚本输出报告不是终态的替代。

| 精确命令 | 最终结果 | 原始证据/范围 |
| --- | --- | --- |
| `npm run build` | build3 exit0，tsc通过 | p07b1-build3.log；renderer index-CualzS98 |
| `npm run test:renderer-components` | 79/79 exit0 | p07b1-renderer-final.log；组件状态，非Office原生解析证明 |
| `node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify` | 4原source/license exit0 | p07b1-source.log，源body保持 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes exit0 | p07b1-pro.log；原Pro闭包未改，非Codex官方同源 |
| `node scripts/xiaozhi-agent/pi-document-protocol-smoke.mjs` | 17/17 exit0 | p07b1-protocol-final.log；严格schema、ID、路径、bytes、macro拒绝、体量/parser/警告/诊断键 |
| `node scripts/xiaozhi-agent/pi-office-document-ui-smoke.mjs` | 23/23 exit0 | iJFcl1/report.json、p07b1-ui-final.log；实际Electron utility/native/typed/UI/文件 |
| `node scripts/xiaozhi-agent/pi-workspace-files-smoke.mjs` | 22/22 exit0 | Cdo0No/report.json、p07b1-files-boundary.log；旧实际权限/版本/取消/槽/超时 |
| `node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs` | 25/25 exit0 | ONKzTP/report.json、p07b1-files-ui.log；旧文件/面板/授权/归档/重启真实路径 |
| `npm run test:smoke` | 207/207、ok=true、exit0 | p07b1-smoke-final.log；重新build后同源码兼容门禁 |
| `git diff --check` | exit0 | p07b1-diff-check.log；CRLF提示不是错误，保留宽脏树 |

23项实际证明：通过页面选择合成教研目录/真实grant，凭证排除；真实DOCX中文段落/表格、XLSX37/8值、PPTX中文两页、带正确文字映射的PDF中文/第二页；真实扫描PDF需本地OCR；缺文字映射的中文PDF明确失败；50MiB+实际文件解析前拒绝；损坏失败；旧UTF8；actual native1366×768和1920×1080文件正文/聊天控件可达且截图保存；typed取消、实际文件改变拒绝旧版本；无模型公开消息；原生子进程实际退出；已经spawn的utility取消与15秒deadline kill（测试**刻意hold dispatch**，不称native parser真实卡死）；超时后下一正常解析成功；全部生成原文件hash不改；无renderer错误；普通重启恢复授权并重新提取真实文件。

实例在预览期间禁main fetch、browser HTTP route，未改系统VPN/网络。这证明本地预览不需要模型/网络调用，不等于P08实际无VPN国内provider验收。输入由本机bundled Python docx/openpyxl/pptx/reportlab库生成，**这些只生成测试文件，不是产品Python依赖或正式导出实现**。中文正常PDF用本机SimSun嵌入文字映射，另保留CID缺映射真实反例；扫描输入使用公开设计参考图，无学生原图。完整fixture/DB/key/私有JSONL不归档，只安全报告/截图/源码/日志及hash。

## 3. 失败与实际限制

- 初轮AGU4sB已过13项，新的测试错误访问snapshot.items；实际契约是projection.turns，修正测试，不改运行代码。
- O7BPiI已过16项后deadline测试仍用外部修改前的UI条目，真实changed拒绝正确；测试改为点击刷新再读取，未削弱版本断言。
- O7Blof已过20项后重启误点击已恢复为打开的文件切换，等待不可见条目超时；测试按实际面板可见状态切换，保留原重启断言。
- 初版CID PDF真实AnyDoc输出替换字符；不能用英文marker命中冒充中文可读。保留反例并增加text_unreadable fail closed；正常中文字层和缺映射文件分别实际验收。替换字符检查只发现这一类问题，不能宣称检测所有乱码/公式错误。Hana扫描分类的原regex机制未改，解析器的能力边界仍在。
- 旧unsupported测试原输入为假PDF，现在PDF已成为支持格式；改为相同假bytes的.bin继续检查真正未知格式metadata。新的真实PDF/扫描/损坏/中文失败独立测试覆盖新路径，不把假PDF当Office可用证据。
- npm安装`--ignore-scripts`实际新增2包，完整安装audit提示8漏洞（4moderate/4high），未执行自动audit fix，不把其他已有依赖改动归因本轮。无提交/推送/上传/修改系统网络。

实际win32原生文件 `anydoc.win32-x64-msvc.node`8321024B，完整native包npm声明8321924B，主包41713B；MIT原LICENSE固定v0.1.2保存在third_party，SHA256 `03a9e7657aac6536fb6458bd220347c4e7f85bd0a51d8d9e8528530b7a682ade`。实际开发out的Electron utility加载成功；**Windows安装包/asar解包/依赖missing与升级全矩阵未验**，P08保留。npm安装体积不是最终安装包体积。

## 4. 下一步/压缩恢复

四根→67§1/2/5/8/9→35最新→109/114/本文。**冻结116 P07-B2正式Office读取工具合同**：先核当前source_read/教育脱敏工具边界与AnyDoc真实Document/块/格式定位API，不捏造页码。复用本B1实际bytes/版本/utility界限，经同Pi loop/Hana once/registry/必要教育脱敏与取消/预算，追加独立native能力不改旧身份；typed必要回执/本地预览来源→自然DeepSeek任务/权限/迟到/旧native续问/两native实例。新工具完成后B3沿现有产物/教师确认/来源谱系，真实DOCX/PDF/XLSX/PPTX导出和Office-WPS-A4。B父项不勾，再C/D/E、全D1–D7、P08。R1/R2同款来源仍67，未知官方Skills/设置参照未答，不凭本轮推测完整Codex页面已一致。

原字节归档位置 `docs/design/codex-2026-10-03/p07-office-documents/artifacts.json`；61份公共原始artifact与8个runtime/native文件hash，全部归档字节回读匹配。只登记实际公共输出与来源，manifest不是额外验收。四根、26/28/35/67已同步真实状态与116下一合同；设计基准open_in_codex返回queued，不宣称用户面板已实际打开。
