# Gate3 属性修正静态签认

2026-11-12，结论 **ACCEPTED，维持 Gate3 原结论**。

本次仅按 root 授权静态复核 Git 属性修正。原 `GATE_3_REVIEW_FINAL.md` 原件及其 108 项独立运行结果保留。本次运行专项和 build 均为 0。

## 实际核验

新冻结清单位于 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase3-source-freeze-6eBOp6/freeze.json`。本 reviewer 重新逐文件计算实际 SHA256，80 source 与 466 out 全部匹配，差异为 0。

与已验收 1SFFDC 清单比较，唯一变化为 `apps/desktop/src/main/xiaozhi-agent/permissions/windows/.gitattributes`。

```gitattributes
*.cs -text whitespace=cr-at-eol
*.exe -text
```

该文件 SHA256 从 `ea3ee95719e2ae857549510f28375c3247f82dc351c4d7eda3b6ee8504fbcbc1` 变为 `4541989d6ff350d0fa21c7880d2481fffe1b1b8a35d46221d5016432306cf300`。其余 79 source 和 466 out 的字节与已测版本一致。

新 source 列表 SHA256 为 `caaa666f290ef76559b80e471de0653b947b922257239e5175b6d7529c199dd1`。out 列表 SHA256 保持 `b06680146509d4086c94d7671a4c05ebd3e42262ee80a60e9103551b7d9f2671`。实际 helper 仍为 `d0d1a92473cd017ef5e56a3d37940e21fc3c4f3b1a69cdf41ea1c3d217d9e56a`，47104 字节。

本 reviewer 在 `D:/WorkProject/EduProject-harness` 亲自运行 `git diff --cached --check`，exit 0。原始输出位于 `attributes-addendum/independent-staged-diff-check.log`。

另外使用 `git hash-object --no-filters -- <file>` 和 `git ls-files --stage -- <file>` 比较三个 C# 源码及实际 generated helper，四个 staged blob 均与已测工作树原始字节一致。

| 文件 | raw/staged blob |
| --- | --- |
| NativeSandbox.cs | `bd2b2e04096d781479a4dd49940fca7c0ac92aa2` |
| PlatformInfo.cs | `ec09851f881b53f0977e45fba93b34deaa2c1a38` |
| TrustedRuntimes.cs | `47ea86c2e72d14be6283ce8cd5d955f7a10a14ed` |
| generated/xiaozhi-sandbox.exe | `d7e400534c0c42290b84885e9817b66ac1ae0649` |

## 初始失败与归档

初始 staged diff check 将保留 CRLF 的三个 C# 文件行尾 CR 报为 2525 条 trailing whitespace。原失败日志保留在 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase3-staged-diff-check-initial.log`，副本位于 `attributes-addendum/staged-diff-check-initial-failed.log`。

`whitespace=cr-at-eol` 明确 Git 对这些保留字节的 C# 文件采用 CRLF 行尾识别规则，`-text` 继续保留已测字节。实际产品、编译物和 out 身份与原验收一致。

新 freeze、副本、唯一 delta、逐文件验证结果与 writer 门禁日志位于 `attributes-addendum`。本次签认结束后交 root 提交及正常整合。
