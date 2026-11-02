# U4-B · 当前卷内容的六类真实导出

2026-11-02。源码 `76f0f61` 对应固定 out `756bd2ae8df3568887c104b4a6253f9383fe812399468b777e92f9f4b64a34fc`；未重建运行中 out。实际执行根为 `D:\WorkProject\EduProject-sidebar\apps\desktop`，与 D 盘日常窗口分离。

命令：`node scripts/ui-goal-paper-instance-office-live.mjs --run-ui --live --from=latest-bui`。实际结果 **exit 0、success=true、13 项通过**；原始报告 `apps/desktop/test-results/ui-goal-paper-instance-office-live-Bw6XzY/report.json`、`pi-office-six.json`，日志 `test-results/ui-goal-20261101/u4b-office-attempt2-76f0f61.log`。可版本化的摘要、文件哈希、审批与对应 run 见 [结果](U4_B_OFFICE_DESKTOP_RESULT.json)。

## 实际链路

字节复制成功 B 桌面测试的数据，创建全新真实 UI 会话。通过原表单建立独立题篮、修改题干/表格/选项/小问及教师答案解析、核对当前修订、保存快照和教师确认。整个准备阶段无模型调用；没有用 SQL 或 typed API 创建题目、确认记录和审批。

用原“试卷保存文件夹”入口，首次授权本次输出目录。测试仅定向接管该原生选择器返回值；真实 UI 行为和宿主授权校验照常执行。这不是人工操作 Windows 目录选择器的验收。复制过来的原会话目录授权始终不改，也不向原目录写文件。

六轮逐一从现有 Composer 发出实际 Pi 请求；每轮等待同 run、同目标路径的真实待批准 Office 草稿，检查当前卷来源及编译内容，再点击原“确认保存”。随后等待持久终态、已保存成果及实际文件。没有自动重发、替换模型回复或绕过审批。

| 用途 | Word | PDF |
| --- | --- | --- |
| 学生卷 | 真实写入，ZIP/XML 独立读回通过 | 真实写入，PDF 独立读回通过，1 页 |
| 教师答案卷 | 真实写入，ZIP/XML 独立读回通过 | 真实写入，PDF 独立读回通过，2 页 |
| 答题卡 | 真实写入，ZIP/XML 独立读回通过 | 真实写入，PDF 独立读回通过，1 页 |

六份文件验证题号、分值、当前卷修改、混合块顺序、当前选项标签、A4 及答案隔离。学生卷无教师答案/解析；答题卡无题面或答案，使用当前甲/乙标签；教师卷保留参考答案尚未独立核验的说明。全题库、旧篮、另一题篮、旧快照、旧 owner 授权及原始测试数据/out 指纹不变，renderer/console 错误为空。

父任务实际查看了 PDFium 渲染的全部四页及待批准卡片：[审批](u4b-desktop/office-student-approval.png)、[学生卷](u4b-desktop/student-pdf-page1.png)、[教师卷第二页](u4b-desktop/teacher-pdf-page2.png)、[答题卡](u4b-desktop/answer-sheet-pdf-page1.png)。本次文本、表格、选项和教师内容可读且隔离正确；不据此声称 Word/WPS 原生排版、复杂公式或来源图片质量已通过。

## 原失败及 QA 修正

首次 `ui-goal-paper-instance-office-live-kHDRiy` 为 **0 项、失败、0 新模型台账**。旧 QA 以 workspace 对象存在作为“已有授权”，而正式 snapshot 在未绑定时也显示精确 `{label:'小智生成文件'}`。修正后仅接受这个无绑定显示值或缺省，并额外严格校验全新 ID、UI/host/SQLite 一致、无 workspace/output grant/command/run/message。原 owner 授权前后也独立取摘要。离线 5/5 含 15 个拒绝用例，Astra 限定复核接受后才进行上述付费重跑。旧失败未覆盖。

首次失败没有记录实际 IPC snapshot，离线测试明确采用生产源码对应的默认对象；成功轮新增真实 `freshSessionObservation`。不能把 QA 判断错误写成生产权限缺陷。前一份 prepared/wait 审核 JSON 保留各自旧 SHA，最终实跑 SHA 以本页实际结果为准。

## 接受范围与后续

本页接受这条受控文本题的真实六类输出闭环，不是全部 Goal 或教师质量接受。尚未覆盖自然扫描/复杂公式/来源图片的本次混合编辑交付、原生 Word/WPS 打开、完整取消/拒绝/失败/来源变化矩阵。内容正确性和同输入对照 DeepTutor/OpenMAIC 的质量不由此关闭。

实际 PDF 仍存在每个块重复“1题（续n）”、教师解析独占第二页、答题卡座位号换行等版式缺口；不把结构读回成功称为理想卷面。后续 U4-D 统一预览/输出规则时处理。当前“本会话最新确认卷”导出意图还需单独绑定用户所看快照，不能用本例只有一份新确认卷证明多卷并发意图正确。U4-C 仍需接通资料收录/核对后返回原篮的路径及参考卷复用。
