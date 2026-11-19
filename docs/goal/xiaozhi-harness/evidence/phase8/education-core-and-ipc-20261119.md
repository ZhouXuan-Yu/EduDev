# 教育核心流程与 IPC 契约复验

当前验证使用 Office 优化与普通文本脱敏的冻结包，481 个 `out` 文件指纹 `24bcc61fbb0e86c38338382d0a506bbee42beb17d84b737fc6559b473ce58ea7`。教师资料和账号数据均用独立合成夹具，付费模型 0。

| 交付路径 | 实际结果 |
| --- | --- |
| 资料正文检索 | Windows 实包从资料库导入、检索正文、打开带原版本的命中来源，2/2。通过真实导航、检索输入、选择关键词、打开命中来验证。两个网络拦截计数及 renderer 错误均 0。 |
| 题库选择与检索 | `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-question-search-continuation.mjs` 13/13。生产题库上下文、连续读取和实际合成 SQLite。原检索仓库及触发器 17/17，向量端使用受控夹具。 |
| 组卷 | 真实 SQLite 组卷模板、选题快照、审批、分值和冷启动读回 26/26。原 Node 测试的禁止调用 Electron 标桩补足未使用模块导出后按原断言运行。 |
| PPT 及文件交付 | 实包 Electron 运行原 `office-generator`，DOCX/PDF/XLSX/PPTX 实际生成并由独立解析器校验中文、尾页、表格及取消/清理。12/12。PPTX 863880 字节，SHA-256 `bd33c5f6ffac304915d493c57b575464a017997324863870967cc90690a1aeff`。 |
| 文件输入输出 | 原 Hana 受控文件读取、实际写入、版本及冲突专项 14/14。单独验证五类实际资料导入和冷读 6/6。 |
| IPC 契约 | Pi 生命周期实际 handler 5/5，原组卷 registrar 验证 foreign sender、请求和取消护栏。当前实包在资料视图执行 typed preload 检索与双向 Word 归档，能力中心独立真实操作确认权限投影。 |

原普通 Node 全套教育 runner 被 Electron API 环境及源加载阻断；改用相应的真实检索、题本、组卷、打包 Office 和文件流程取得本页证据。各报告保留该全套 runner 的失败和范围，不计为通过。此页不评估真实模型教育质量或语义索引全量效果。

原临时目录 `%TEMP%/edu-qg-education-ccd5e514`。PPT 系列报告 SHA-256 `bfd3adcf5bba21ac7d254174cd69cd485e658d19f8dca819296fb7b904087dac`，资料检索报告 `25b9f4bcb25a1181c5c1b0181f7b0387f3cf7fdd522a6c32d25fe7b90de7c2c9`，组卷日志 `6aaea92d3b8ff0b14dcf5aa38af5ba06dee514ed49fa2c4492fa0325c7b6b7ec`。
