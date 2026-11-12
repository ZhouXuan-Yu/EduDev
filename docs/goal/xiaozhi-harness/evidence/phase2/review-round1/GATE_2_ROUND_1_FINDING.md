# Gate2 第一轮新增发现

## 第一轮结论 REJECTED

结论依据已实际验证的G2-F04 P1，修复后需重新冻结并独立复验。

2026-11-12。源码HEAD eefb674及Phase2冻结候选，受审55文件字节与hash见同目录reviewed-source-hashes.json及source/。本轮尚未完成Gate2全部测试，原预审G2-F01/F02/F03的修复待最终测试确认。

## G2-F04 P1 Artifact外部依赖从数据根解析

native-stat-executable.ts第66–70行使用compileFunction执行已验bundle bytes，并传入createRequire(filename)。filename位于retained artifact目录。build-capability-artifacts.mjs以packages=external打包，当前bundle顶层包含ipaddr.js和undici两个npm依赖。

root明确授权后，本审查只运行最小独立TEMP loader探针，未改out、未构建、未执行应用或真实模型。数据根位于仓外自有TEMP。

当前机器仓外直接加载成功，依赖实际从C:/Users/ZhouXuan/node_modules解析。两次先前预期MODULE_NOT_FOUND的断言失败，原脚本保留，纯净新机器缺依赖情况未验证。

决定性反例为相同已验artifact SHA256 0c327b73170a428d809b7239406b2e53ef931887a88826a01ad025ad96036831，在另一自有TEMP dataRoot/node_modules放置无害ipaddr.js/undici代理。这些代理仅设置全局合成marker并转发真实可信包。loader成功返回同一artifact hash，两个marker被实际执行，require.resolve指向TEMP代理路径。

此结果证明artifact哈希验证没有限制npm依赖来自可信应用环境，数据目录中的同名模块可影响主进程所加载的代码。本发现按P1处理，未声称执行恶意代码或证明系统级权限提升。

最小修复为由可信应用module root提供明确依赖解析，或把必要依赖实际纳入不可变bundle。不得以retained数据目录决定npm搜索路径。回归应使用仓外dataRoot并加入同名无害marker模块，确认marker计数0，且精确V2 artifact冷启仍可执行。

## 实际证据

- 命令 node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate2-loader-probe-40387a75fb284314af5efe6283700c4b/loader-probe-v2.mjs，exit0。
- 报告及原/修订探针脚本保存在该目录report.json、loader-probe.mjs、loader-probe-v2.mjs。
- report.json记录loader SHA、实际外部依赖解析路径、同hash marker执行及两次错误假设失败说明。
- 两次失败的精确命令和实际断言输出另存探针目录failed-assumptions.log。受测loader SHA256为de4720b3f14c5106807ef290c2fb078b3ca15f7353a5aaabc61fb0540871bfdd。

G2-F04已发送root及唯一writer，等待定向修复和重新冻结。其余正式脚本和应用测试继续等待OUT_FROZEN。
