# C01 教师备课本与笔记 CRUD

## 来源与边界

直接参考 vendored DeepTutor `services/notebook/service.py` 的 Notebook/NotebookRecord 结构和记录类型；Omni‑Edu 不复制 JSON 文件存储，而是把备课本落到同一份本地 SQLite 数据库，并通过 Electron main/preload IPC 暴露。

- 表：`teacher_notebooks`、`teacher_notebook_records`
- 记录类型：`solve/question/research/chat/co_writer/tutorbot/guided_learning`
- 版本：备课本和记录均使用整数 `version` 做乐观并发控制
- 删除：软删除（`status/deleted_at`），可恢复；默认列表隐藏已删除项
- 数据边界：数据默认仅保存在本机；metadata 为 JSON 且有长度上限
- IPC：`notebooks:create/list/update/delete/restore`、`notebooks:listRecords/addRecord/updateRecord/deleteRecord`

## 验收

```powershell
npm run test:deeptutor-notebook-crud
```

专项 smoke 14/14 覆盖创建、记录写入、版本冲突、删除/恢复、删除后拒绝写入、记录软删除与全量回读。

下一步 C02 会把 DeepTutor Notebook Analysis/Summarize 的按需选择与摘要语义接到这个存储，不会把所有笔记常驻注入普通问答。
