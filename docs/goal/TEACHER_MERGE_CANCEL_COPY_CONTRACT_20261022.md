# 教师课件合并取消文案合同（2026-10-22）

## 状态

`LIMITED_ACCEPTED`。本切片只修正老师取消已有课件选择后的界面反馈，不改变PPT合并机制。

## 教师可见问题

当前合并链在老师取消原生PPT选择器后，界面显示“已取消读取”，容易被理解为文件或来源读取失败，而没有明确原课件是否被修改。

## 第一性判断

- 取消发生在合并目标选择阶段，不是源课件读取失败。
- 老师需要立即知道原课件未修改、没有生成新副本。
- 普通导出取消仍应显示“已取消导出，未写入文件。”
- 文案必须由当前操作格式决定，不改变后端错误码或权限。

## 修改边界

- 只改`ScienceClassroomExport.tsx`在`cancelled`结果下的公开错误文案。
- `pptx_merge`显示“已取消合并，原课件未修改。”
- 其他格式显示“已取消导出，未写入文件。”
- 不新增IPC、SQLite、依赖、文件写入、模型调用或审批。

## 验收

1. 真实Electron点击“合并到已有课件副本”。
2. 原生选择器取消后显示准确文案。
3. 工作目录文件列表与开始前完全相同。
4. 原课件和源HTML哈希不变。
5. 正常合并仍生成6页副本、可定位、可在冷启后保留。
6. build、真实Electron和diff通过。

## 证据

- 当前构建：`da005f9311a36b95a0c57f2411a7c6484bd9a393886a8df1bc7804e0ef7ebc85`，373文件。
- 当前正式Electron：`apps/desktop/test-results/xiaozhi-agent/pi-science-merge-ui-nB4HEw/report.json`，5/5。
- 6页PPT副本SHA256`e8ab48e8af986fe6186c5c388822cd8a41d208b74714d5f43fa78bd436592c5c`。
- 源HTML`f519f945...`与目标课件`c7dc2bca...`哈希在取消与正常合并后均保持不变。
- `merge-1366x768.png`实际显示“已取消合并，原课件未修改。”
- 前一批`pi-science-merge-ui-1JLycX`保留，其中文案仍为“已取消读取”。

## 边界与下一步

静态文件合并、PowerPoint `InsertFromFile`、取消零写入和冷启已验证。PowerPoint/WPS动态放映、投影、真人教师及无VPN安装仍OPEN。
