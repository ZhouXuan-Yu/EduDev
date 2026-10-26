# 教师练习观察去重合同（2026-10-23）

## 目标

辅导教师在错题练习核对卡与已保存练习中只看到一次“教师观察”语义。输入框已经提供字段标签，正文中的“教师观察：”前缀由系统在最终练习正文统一生成。

## 当前证据

- 构建 `81fe955716f95a21a56d5aad896c69521b6919d433711a6135f220014fb9f9d4`，373 文件。
- `education-journey-wLTprd` 的 9 项业务检查通过，8 张双尺寸浅暗截图已生成并实际查看。
- 截图中的输入字段和最终练习正文出现“教师观察：教师观察：先核对单位与正平方根。”。

## 修改边界

- 只在共享练习文本规范化、练习核对卡、传统题组库和既有题目旅行断言中去除字段标签前缀的重复。
- 不改变题目、答案、解析、教师原意、顺序、角色、题目来源、学生绑定、审批、SQLite、typed IPC、权限或 Pi Loop。
- 历史 SQLite 记录不改写；渲染旧记录时兼容去除重复前缀。
- 新保存的 `teacherObservation` 与 `contentMd` 使用同一规范化结果，确保界面、工具回读和最终练习文件一致。

## 完成定义

1. 输入“教师观察：先核对单位与正平方根。”后，核对卡文本只显示“先核对单位与正平方根。”。
2. 最终 `teacherObservation` 保存为“先核对单位与正平方根。”，`contentMd` 只有一处“教师观察：”标签。
3. 旧数据即使已含前缀，题目来源和传统题组库也不显示双前缀。
4. 练习边界测试、真实 Electron 错题少练、双尺寸浅暗视觉、renderer 组件、build、`git diff --check` 通过。
5. 软件通过不替代真人教师对难度、错因和是否适合布置的判断。

## 本轮结果

- 最终构建 `ec43f1a794063b0b09ecea7b275473a79184feb08d5e1f4adb53cdd3956178a5`，373 文件。
- 聚焦边界 `pi-practice-observation-boundaries-wCIKbD`：19/19。
- 真实 Electron/DeepSeek 错题链 `education-journey-kL9aYy`：12/12、3 次启动、8 张双尺寸浅暗截图、0 renderer 错误。
- 同一构建资料备课 `pi-teacher-materials-current-25qvTy`：5/5、7 次真实 DeepSeek HTTP 200、源日常 DB 不变、附件级联草稿、完整稿审阅保存和冷启重开通过。
- 最终练习 2 题，正文恰好 2 个“教师观察：”标签；保存正文不存在 `教师观察：教师观察`，观察正文不以 `教师观察到的` 开头。
- renderer `240/240`，build exit 0，`git diff --check` exit 0（仅既有 LF/CRLF 警告）。
- 已有课件复用 `pi-science-merge-ui-Yzcar3`：5/5，当前构建生成并重开 6 页副本，源 HTML 与原课件字节不变。
- 失败 `HTSEAv`、`TB90ak`、`nrLUpN`、`IilJql`、`R9eoPk` 与领域总套件 `PUX7Al` 的既有 math worker timeout 均保留。
- 状态仅到 `SOFTWARE_ACCEPTED`；独立教师判断、真实学生图片、动态放映、投影、VPN-off、安装和真人读屏仍 OPEN。
