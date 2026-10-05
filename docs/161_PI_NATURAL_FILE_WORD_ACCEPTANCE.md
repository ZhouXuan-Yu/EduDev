# FILE-01–04 自然办公文件与可编辑 Word 验收

2026-10-04；[合同160](160_PI_NATURAL_FILE_WORD_ACCEPTANCE_CONTRACT.md)。本轮有限 C/WPS 通过，完整目标仍 active/NOT_ACCEPTED。

## 实际结果

- FILE-01 原文提示词：通过真正 `office_read_attachment` 读取随机码/37分钟/8道及来源；发送输入清空，历史附件正文可预览。答案文件没有发送或放入授权目录。
- FILE-02：原目录真实 list/read；未授权合成兄弟目录被公开拒绝，随机正文未泄露，也没有成功读取回执。本次模型在调用前拒绝（0个工具），不伪称 host 执行失败。原协调器权限/撤权/恶意路径门禁另有 A 证据。
- FILE-03 原文先拒绝再重新发送确认：diff 对应实际文件，拒绝后 SHA 不变；新教师任务重新实读/新审阅/新确认，批准后只替换课堂37→41，随机码/其他字节不变；SQLite state/before/after SHA 与同 callId 原生结果一致。
- FILE-04 原文：实际四周目标/任务/负责人空栏；拟内容审批前没有文件，批准保存 `4周教研计划.docx`，正式 artifact/大小/hash 与磁盘一致。独立 python-docx 精确核全部26段及2个真实表格（各5行）；生成稿无外部资料源，如实记录 sources=[]。
- 1366×768和1920×1080确认/拒绝及实际文档面板可达，已实际查看两尺寸对应截图。冷重开保持 native 前缀、同一正式产物、相同DOCX SHA，打开没有新工具或模型请求。
- WPS12.0（本机现有安装）通过已有严格 COM 所有权脚本：只新建 owned 进程58208，原有各进程 PID/start/HWND 保持。打开原稿读取全文/表格；独立副本负责人单元格实际编辑保存，再打开及 python-docx 验证编辑标记。原产物未变。原脚本默认仍三格式，新增 Formats 与 EditDocxCopy 只用于测试。
- WPS 实际导出2页A4 PDF，所有核验标记存在、页外字形0，两页PNG实际查看。内容完整；第4周负责人行分到第2页，因此不宣称所有分页样式完善或Word像素还原。Microsoft Office应用未实测，PDF/XLSX/PPTX不由DOCX替代验收。

## 真实发现与修复

旧工具 description/system 的“拒绝后不要重复”被模型理解成永久禁止，第四实例 mKhVje 的新教师原文任务直接被拒绝。本轮仅调整 `text-change-coordinator.ts` 两个工具说明、`pi-session.ts` 文本/复制/Office提示：同轮不得自动重试；教师再次发起任务须当前版本、新审阅、新确认，旧批准不复用；uncertain先只读核验。保留原Pi唯一循环、Hana作用域、宿主CAS/路径/权限/批准逻辑，无新表/IPC/依赖。

新固定 `pi-natural-file-build2`：323文件 SHA **0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981**；renderer仍index-DDPZxs9s.js。日常PID62244/handle28246872/RespondingTrue、标准out SHA3b81b5e6a608ae849d7daf11c4d7aecff2f52d508bb2407493386f5b8b9952d6均保持，不覆盖正在使用的构建或真实配置。

## 命令与证据

工作目录 `D:/WorkProject/EduProject/apps/desktop`；所有正式 C / 主冒烟使用隔离 build2。

| 命令 | 实际结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-natural-file-build2` | build2.log，tsc/Electron/Vite exit0；build1也保留 |
| `npm run test:renderer-components` | renderer1.log 79/79 exit0；后一次Office提示只改main、不改renderer |
| `node scripts/xiaozhi-agent/pi-text-change-coordinator-smoke.mjs` | 8ORE03 8/8；实际原Pi源码+模拟stream/owned SQLite，A层非真实provider |
| `node scripts/xiaozhi-agent/pi-office-artifact-coordinator-smoke.mjs` | FFsefR 8/8；版本/拒绝/取消/撤权/原生身份，A层 |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-natural-file-build2 node scripts/xiaozhi-agent/pi-natural-file-ui-smoke.mjs` | GQqHCP 14/14 exit0，官方DeepSeek-flash/Pi真实正式Electron/C |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-natural-file-build2 OMNI_EDU_E2E_DIAGNOSTICS=1 node scripts/electron-smoke.mjs` | main1在学生表单成功反馈wait超时，没有完成；保留log/当时诊断图。原代码/同构建顺序复跑main2：ok=true，207/207，Node exit0。首次原因未证实，不称稳定性修复 |
| `C:/Windows/SysWOW64/WindowsPowerShell/v1.0/powershell.exe -NoProfile -File scripts/xiaozhi-agent/pi-office-wps-acceptance.ps1 -Mode render -OutputRoot .../GQqHCP/wps-render -SourceRoot .../GQqHCP/wps-source -Formats docx -EditDocxCopy` | 实际WPS success=true，原进程身份保持；exit0 |
| bundled Python `verify-natural-word.py` / `verify-office-wps-render.py` | 全部正文/表格及WPS编辑冷重开、2页A4/页外字形0/标记完整 exit0 |
| `reuse-hana-browser-capture.mjs --verify` / `verify-web-reuse.mjs` | 原函数和既有网页/Pro源SHA通过，非新UI同源证明 |
| `git diff --check` | exit0；只有原LF/CRLF提示，diffcheck.log保留 |

C脚本 SHA600cbedcdfaffb50e158b10ecae445add8f7f1fa681b655356222d1053c6070d；WPS脚本95a1fc69e7f733a326468f5b3b6071c11703824a7d5e3d8f3bfb2003e2c353d5；独立readback18d4ae315d021de9a38af8d5e92530e2c2cdb7d8555cf6c4fb25805380abdd4c。DOCX SHA2b8af9420a7538996964fc59ab2bfc0dfc7053654451cb1b4ecd85c47b4b5b34。

## 永久保留的首次失败

1. KwXDKJ 2项后超时：测试在首次运行已绑定后才选择目录；实际页面明确 workspace_locked。改测试为首次请求前授权，不放宽正式锁。
2. gnqkcD 3项后：模型在工具调用前直接合法拒绝，脚本错误地强求失败工具。按原样例允许的公开拒绝验，无成功工具/无正文泄露，记录实际0工具。
3. HnL8oG 4项后：正确拒绝是 isError=true，模型回执不暴露内部changeId；脚本错强求成功回执与ID。改以SQLite callId对应真正 outcome/hash，不改生产回执。
4. mKhVje 5项后：真正新教师任务被旧拒绝永久拦住；生产提示修复后同原文GQqHCP通过，旧模型回答/截图/native本地保留。
5. 主main1学生反馈wait超时保留。PowerShell重定向后Get-Content的0不当Node通过；main2明确捕获LASTEXITCODE且核ok/207。

以上旧C使用旧4ddacc…构建；不同构建复验不称连续3次稳定。命令路径/Node摘要括号误写已纠正，非用户功能根因。所有本轮素材/DB/native/profile/图与WPS文件在owned test-results，source-only归档只白名单源码/文档/脱敏指标，见[清单](design/codex-2026-10-03/p07-natural-file-word/archive-manifest.json)。

## 下一唯一继续位置

**CFG-01/02：现有设置正式导入/验证/保存→实际对话→冷重启；使用owned配置副本与可见页面，不能以env凭证或目录缓存成功替代。** 随后缺失Codex Skills/模型/权限设置截图的精准核对、全D1–D7/P08实际无VPN安装与最终八组/日常人工。NET-USER-001、IMG-USER-001及人工签认仍开放；本轮有限C/WPS不能关闭整体。无子agent/commit/push、无日常profile修改。
