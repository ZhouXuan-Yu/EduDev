# P07-B2 正式 Office 读取工具交付合同

日期2026-10-04；M02/M10，承接114–115，设计67§1/2/5/8/9保持。B2目标是真实教师任务调用同一Pi循环读取授权Office必要正文、公开真实回执与可核对引用，不是仅多一个本地预览。

## 当前事实与直接复用

Hana0.449原提取三文件与AnyDoc0.1.2/MIT已经真实utility/UI通过，继续复用，不新写解析器/agent loop。图谱定位了Pi session与sanitizeProblemText，但后者snippet行号过期返回了别的函数；已回到当前db.ts实读。正式session保留旧创建/control/memory/skill/office-text指纹，现只有文本文件工具。store.sanitizeProblemText无studentId时只移除email/phone/id；新文件内容还须本地已知学生姓名移除。

AnyDoc index.d.ts实际toDocument不支持PDF，Document没有通用原页位置。B2不以Markdown标题或段落数捏造PDF/幻灯片/工作表定位。真实正文引用采用文件版本+“提取正文第x–y行”，明确原页未定位；它是解析内容位置，不是原文件页号。后续有真实定位API再增量支持。

## 交付清单

1. 新主进程office-document-tools领域，参数只相对path/startLine/lineCount；沿createWorkspaceFiles/Hana authority/readable resolver的main-only stat→preview→stat获取明确指定文件的实际版本，同B1 utility正文/前后版本重验，不受目录256项展示上限挡住已指定文件。没有新stat IPC。源原文不广播，严格DOCX/PDF/XLSX/PPTX/50MiB/1MiB解析；默认最多60行、最多100行/16000chars模型必要片段，超长行明确partial，不静默作为全文。startLine越界、坏参数/额外键拒绝。
2. 显式复用store通用脱敏；在main从现有学生档案获取真实已知displayName/realName并作本地姓名替换，姓名列表不入模型/日志/公开回执。标题亦脱敏；文件/外部文字是数据，不授权限。无新数据真源/学生上传/原文入压缩索引。
3. teacher grant+current run在每个异步边界与回执前重验；取消/失效零晚结果。read only不新增审批卡，不写文件。公共事件只显示真实工具状态、脱敏来源标题与提取行位置，不展示原JSON/body/hash。必要模型回执版本/locator正文不能替代原资产来源谱系。
4. 直接注册office_read_document进入原SessionExecutionRegistry/Hana run-once/原budget/tool dispatch；不加循环。追加独立office-document.v1能力（tools/workspace/parser），在全部旧指纹后，不改旧entry。旧有能力未知/损坏/移除/目录变更fail closed；旧native副本继续加载/相同origin身份，模型切换也保持此新增能力。
5. utility宿主新增真实全局8-worker限额（文件preview与tools共享），slot等实际exit释放；取消在spawn之前也在spawn事件kill，不能先返回cancelled后漏掉原生子进程。严格busy失败/固定入口/15s deadline/最小env原规则保持。
6. UI沿原ChatTool过程与来源，工具中文标签；本地文件面板可人工对照真实正文，不新增伪按钮。自然DeepSeek多资料任务需逐段说明→真实读取→公开来源→后续说明/最终归纳；不把最终回复按计时器拆成过程。

## 修改与兼容/回退

新增office-document-tools及本地教育文件脱敏adapter；production-host注入main-owned工具/当前run/现有resolveFileWorkspace；pi-session增量能力及原registry wrapper；shared projection工具label，必要shared document busy与host真实并发/late spawn处理。无新表/IPC/依赖/真实数据迁移，无renderer目录/执行路径注入。旧snapshot指纹字节保持；新增marker后若回退而原生文件已有此marker须明确configuration，不能悄悄读错历史，可复制隔离恢复旧branch并人工确认，不修改真实历史。

## 完成定义与实例门禁

build/renderer79/原Pro32/Hana原4文件hash、strict工具/脱敏/版本/取消/once/native增量与旧prefix专项；真实DeepSeek/Electron教育任务读取四真实格式、中文表格/两页、提取行引用和本地preview一致，跨run同历史续问/旧native副本与目录权限；扫描/损坏/无法解码/超大工具失败不虚构成功。真实utility并发/迟到spawn/timeout/停止/原bytes/重启。关键用户路径主smoke207和git diff --check；117记录精确命令、失败、通过、未验、公共原字节归档。

完整B3仍是受控DOCX/PDF/XLSX/PPTX导出/编辑产物/教师确认/Office-WPS-A4；完成B2不能勾完整B/Codex。C/D/E/P08及全D1–D7、未知官方Skills/设置参考保留。四根/26/28/35/67按真实本轮状态更新；下一B3前冻结118，若B2未过则下一仍B2明确缺口，不改定义。
