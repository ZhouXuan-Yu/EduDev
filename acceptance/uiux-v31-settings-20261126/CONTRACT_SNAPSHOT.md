# 工程合同快照

text-contract-snapshot.zip保留92份源Markdown/CSV/JSON/TXT的原始字节与相对目录；逐文件摘要在PHASE0.json的contractFiles。此快照只包含文本，图片/HTML原型仍在用户提供的完整工程包，不能把文本ZIP称作完整视觉包。

本地contract目录保持可直接读取。版本库使用ZIP保存原件：部分源Markdown含有意的双空格换行，首次直接暂存导致diff --check失败；没有删改冻结原文，也没有给门禁加豁免。失败日志留在staged-diff-check.log；代码及普通报告仍完整执行Git空白检查。

恢复时在本轮目录中解压到contract，再逐文件核对PHASE0.json的SHA256。实际执行进度只维护EXECUTION_STATE.md及acceptance-matrix.json，不修改contract内的初始模板。
