# P07-B2 正式 Office 读取工具验收

日期：2026-10-04；合同116，M02/M10。B2有限切片已通过，真实读取/脱敏/引用/停止/旧会话与兼容门禁完成。完整P07-B和Codex全目标尚未完成。

## 1. 实际交付

新增 `office_read_document`，直接注册在Pi0.80.3原循环、Hana0.449.0原执行registry/run-once与预算/取消机制；没有第二个agent循环。继续使用Hana原document-extract三文件及AnyDoc0.1.2，不新增依赖、解析器、表或IPC。唯一新增native能力 `xiaozhi.education.office-document.v1` 追加在旧身份之后，旧创建/controls/memory/skills/office-text指纹不改；未知版本或撤掉已有能力明确configuration失败。

参数严格相对path/startLine/lineCount，仅DOCX/PDF/XLSX/PPTX。main-only stat→原preview→stat重验授权目录、真实文件版本与当前run，不依赖目录面板256项展示上限；没有对renderer开放stat接口。原50MiB输入/1MiB解析输出保持，模型默认60行、最多100行/16000字符；越界失败，超长单行明确partialLine。明确定义读取后发生文件/权限/run变化时丢弃正文。

正文调用既有教育邮箱/手机号/证件脱敏，再本地替换现有学生档案中的已知姓名，长名称先处理；标题同样脱敏。姓名列表、原始路径及完整原文不进入公共回执。模型仅得到必要脱敏片段、真实文件版本和提取行位置。公开来源行只来自实际safe receipt；同名文件使用脱敏相对路径区分。**这不保证识别所有未知个人信息、OCR/公式错误或乱码。**

AnyDoc本版本没有通用原页定位，引用明确为“提取正文第x–y行（原页码未定位）”，不把行号推算成PDF页、幻灯片或工作表位置。扫描/损坏/缺文字映射/超大失败均返回原工具 `isError:true`，经过Hana实际失败适配，而非仅在details写success=false。

文件预览与模型读取共用8个实际utility进程槽，只有实际exit释放；取消发生在spawn前仍在后续spawn kill。worker仅继承必要系统变量，不拿API凭证；固定入口、15s deadline、stderr安全边界保持。关闭/选择目录/归档在异步读之后再次核验。原Pro32来源闭包、FileTree/Tabs/过程组件保持；本轮只有工具中文标签/安全来源接线，没有另外画一套聊天页面。

## 2. 精确门禁

命令均在 `D:\WorkProject\EduProject\apps\desktop`，git命令在仓库根。计数不得跨不同范围相加充当一个用户闭环；每项最终命令需exit0。

| 命令 | 实际结果 | 原证据与范围 |
| --- | --- | --- |
| `npm run build` | build5 exit0 | p07b2-build5.log，renderer index-Bpg_2XBD；之后主smoke再构建同源码 |
| `npm run test:renderer-components` | 79/79 exit0 | p07b2-renderer-gate.log，组件状态 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32文件/182153bytes exit0 | p07b2-pro-gate.log，原Pro闭包hash；不是Codex官方源码 |
| `node scripts/xiaozhi-agent/reuse-hana-document-extract.mjs --verify` | 4源/license exit0 | p07b2-source-gate.log；原body保持 |
| `node scripts/xiaozhi-agent/pi-document-protocol-smoke.mjs` | 17/17 exit0 | p07b2-protocol-gate.log；strict协议，非解析证明 |
| `node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs` | 6/6 exit0 | aKGKBM/report.json、p07b2-boundary-gate.log；实际Pi native增量/原prefix/移除及未知能力fail closed、原Hana once、严格参数与脱敏 |
| `node scripts/xiaozhi-agent/pi-document-read-safety-smoke.mjs` | 8/8 exit0 | pU2eY5/report.json、p07b2-safety-gate.log；实际FS/Hana权限/版本，解析transport double，非provider证明 |
| `node scripts/xiaozhi-agent/pi-document-host-boundary-smoke.mjs` | 4/4 exit0 | p07b2-worker-gate.log；实际host逻辑/transport doubles，8槽等exit/late-spawn取消/strict包 |
| `node scripts/xiaozhi-agent/pi-office-document-tool-ui-smoke.mjs` | 17/17 exit0 | b27lxm/report.json、p07b2-ui-final2.log；实际Electron/DeepSeek/Pi/utility/UI/FS/本地原生历史 |
| `node scripts/xiaozhi-agent/pi-office-document-ui-smoke.mjs` | 23/23 exit0 | tYtMQS/report.json、p07b2-preview-ui.log；同轮B1原生预览兼容、15s held-dispatch deadline、中文四格式与失败 |
| `node scripts/xiaozhi-agent/pi-workspace-files-smoke.mjs` | 22/22 exit0 | qRevNY/report.json、p07b2-old-files.log；原权限/版本/typed主frame/槽/取消 |
| `node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs` | 25/25 exit0 | F4sO2t/report.json、p07b2-old-files-ui.log；真实旧面板/会话隔离/归档撤权/重启 |
| `$env:OMNI_EDU_E2E_PI_HISTORY_MODEL_APPROVAL='1'; node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | 13/13 exit0 | whNl7Q/report.json、p07b2-old-model.log；真实DeepSeek旧copy审批/同历史模型切换/停止/重启、旧身份不改/零额外效果 |
| `npm run test:smoke` | 207/207、ok=true、exit0 | p07b2-smoke-final.log；所有固定out实例终态后执行，同源码重新构建 |
| `git diff --check` | exit0 | p07b2-diff-check.log；宽脏树保留，不提交/推送，CRLF提示不当错误 |

实际17项：通过页面授予合成教研目录；自然教师请求让真实DeepSeek分别调用四格式工具、得到实际37分钟/8题并归纳；真实模型toolResult历史没有合成已知学生名/手机号/email；真实safe sources/提取行引用和公开说明→实际工具→后续说明分段。actual native1366×768、1920×1080本地正文对照/输入可达并截图。同native后续只读第2–3行，原header/snapshot/office能力和整个旧字节prefix保持；300文件目录中明确路径实际读取成功并引用相对来源；扫描/损坏/缺映射/超大有真实failed回执，没有虚构正文。

随后真实模型读取占1个utility，再发8个真实preview：实际仅8个native child被fork，第9个busy，env无KEY/TOKEN/SECRET；composer停止实际模型任务，取消preview并等待全部child实际退出，零晚续问。该并发/停止夹具刻意hold postMessage dispatch，**不称真实native parser卡死**。所有原文件hash不变；重启保持interrupted、不重放，下一自然读取成功。私有JSONL仅本地断言，不能归档或展示正文。

## 3. 失败、证据与界限

- 新boundary夹具TWaBMK过3项后stateRoot未创建；lY53S过3项后误以为未发生assistant轮次的SDK会立即持久化JSONL。修夹具mkdir及实际SDK prime（该基础测试用deterministic assistant stream、不声称真实provider），不改变产品/原native prefix断言；ZKm7y9及最终aKGKBM六项通过。失败报告保留。
- 实例y3Nkho14项、ZyTMXT15项均实际exit0；随后改main-only stat和相对路径来源、加明确路径及真实共用并发断言，最终b27lxm17项才覆盖最终源码。旧通过不冒充新路径验收。
- 本地手动preview允许教师查看原文件正文；模型读取单独脱敏。截图姓名/号码/邮箱均为明确生成的测试数据，不是用户原资料。Python/docx/openpyxl/pptx/reportlab仅造夹具，不是产品导出依赖。
- 本轮没有系统VPN关闭现场、Windows安装包/asar/Office-WPS-A4验证；没有宣称全页像素一致或Codex官方组件源可取得。模型实际运行的来源/文字不能代表模型永不误判；未知姓名和其他敏感信息仍需要教育治理后续实例。
- 公共归档只允许报告、日志、截图、源码、许可证和runtime hash；不归档DB、.env、私有JSONL、原Office输入或字体。manifest是可核对证据，不是额外测试。

## 4. 下一动作与压缩恢复

四根→67§1/2/5/8/9→35最新→109/116/本文。**下一冻结118 P07-B3产物合同**，先核当前文档导出领域/产物DAO/主进程与Python worker真实调用链，以及Hana可直接复用的Office生成/编辑来源、许可证与Windows打包影响；选定现成方案后贯通受控DOCX/PDF/XLSX/PPTX拟产物→教师审阅/确认→版本与谱系→实际文件打开/错误/取消/重启恢复，最后Office/WPS/A4实例。没有这些不得勾完整B。

C国内联网/D附件图像/E持久goal、P08实际无VPN/国内API/安装/最终八组、全D1–D7与未知官方Skills/设置截图继续保留。设计真源仍67原R1/R2、公开真实分段与组件映射；不重新选引擎、不把Office preview/读取冒充导出，不无限回到已验文本A/阅读。总目标active。

公共原字节档案 `docs/design/codex-2026-10-03/p07-office-document-tools/artifacts.json`：80份报告/截图/日志/源码与8个runtime/native hash，全部归档字节回读匹配。四根及26/28/35/67已同步真实状态和118下一继续位置；设计基准继续固定用户原图、公开真实时序、原Pro组件与明确未验项目。
