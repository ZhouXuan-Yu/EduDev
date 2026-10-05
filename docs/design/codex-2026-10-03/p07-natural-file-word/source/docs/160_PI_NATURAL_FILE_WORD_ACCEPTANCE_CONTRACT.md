# FILE-01–04 自然办公文件验收合同

日期：2026-10-04。M01/M09/M10；依据根测试样例说明书，不扩三元题组。完整目标仍 active。

## 教师可见结果与现状

现有附件实读、Hana/Pi 文件权限、文本 diff/拒绝/确认、Office 拟内容/确认生成、文件面板及冷恢复已经贯通 main→typed preload→renderer。历史定向测试不能替代说明书原始自然输入。本轮先验收现有实现，实际失败才改对应领域代码，不新增第二工具循环。

1. FILE-01 原提示词，03-资料实读.txt 随机码仅在本地附件；真实正文工具回执、37分钟/8道、发送清空、历史预览。
2. FILE-02 合成授权工作目录真实列表/实读；另一个未授权合成目录拒绝或真实可见授权，不能泄露其随机码。
3. FILE-03 原提示词先拒绝再确认；先看实际 diff，拒绝原 SHA 不变，批准后只替换37→41，码/其他字节不变，版本来源可查。
4. FILE-04 原提示词，四周目标/任务/负责人空栏，正式拟内容/确认/生成/文件面板/SQLite/hash，冷恢复无工具重放。复用现有 WPS COM 所有权脚本：只在新建 owned 测试进程中打开，核内容/表格，副本实际编辑保存后再打开，原产物不改。

## 改动与安全

- 新增自然 FILE Electron 验收脚本及独立 DOCX readback；复用 create-samples/build-root/evidence 和现有正式入口。
- WPS 脚本增量提供格式筛选（默认原三种）与可选 DOCX 副本编辑；不改已有用户 WPS 实例。
- 初始不改生产表、文件目录、共享契约/IPC/UI，不增依赖。发现缺口追加精确修复与门禁。
- 使用固定隔离 pi-browser-capture-build1（SHA4ddacc05613d99a89c112b9bc2feeed43efbad99eb0cf3afd228967d3b0db903）；日常62244/out/profile保持。测试 key 仅从已有 ignored 本地配置读取、不输出。
- 素材与答案只在 owned test-results，答案文件不发模型、不作为工作目录；原学生数据不读取/上传。首次失败保留，各报告记构建/脚本 SHA。
- 原 WPS 默认行为兼容；新选项仅测试入口，无迁移，失败保留现场，不安装 Office/改系统设置。

## 完成定义与边界

### 执行中冻结的实际缺口

第四个自然实例 mKhVje：FILE-03 拒绝正确、磁盘不变；教师再次发送原文，模型却将旧拒绝当永久禁止而不提出新审阅。当前工具 description 与 system 中“拒绝后不要重复”边界含混，虽然另句已允许新任务，实际未奏效。修复仅 `pi-session.ts` 与 `text-change-coordinator.ts` 的说明：禁止同 run 自动重放；新教师任务须实读新版本、创建新审阅/新确认，旧确认/拒绝不替代它。复制/Office提示同样明确该边界。宿主/CAS/批准逻辑不放宽，无新表/IPC。新固定隔离构建、renderer、专项及 main 门禁，原失败/旧构建保留。

真实官方 DeepSeek、正式隔离 Electron 自然输入，独立磁盘/SQLite/native readback、1366×768及1920×1080必要控件/预览可达，实际 WPS 可编辑副本与冷恢复，git diff --check。若生产改动，隔离 build + renderer + 专项 + main最低门禁。

本轮 C/WPS 为有限验收；不关闭日常用户原问题、人工签认、无VPN/安装或完整 Codex 同DPI/Skills设置。PDF/XLSX/PPTX不由DOCX代验；无子agent/commit/push。收尾更新四根/26/28/35/67/执行记录，下一 CFG 与缺失设置参照。
