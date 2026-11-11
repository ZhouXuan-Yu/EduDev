# Word后台表示升级与历史来源

## 本轮合同

M02/M03/M05。前轮恢复真实向量世代并推送main，属于progress。当前已导入221份，其中148份Word大部分仍为v1，已有两遍AI任务冻结旧来源。直接重用前台重整会删除重建resource_chunks，后台自动升级须保持已有题和付费回执的原来源。

复用现有OOXML utility Worker、MaterialWordRepository、目录AI调度、SQLite writer、Word proof/native输入和原UI。增加Word解析历史快照表，当前表继续表示最新，已有来源按documentSha读历史。原件版本/隐私/摘要检查继续执行。后台升级只允许全文wordText、资产身份及逐题角色/范围兼容的v1→v2，保留全部resource_chunks和题序；变化超出范围则保留旧表示并呈现待核。原生批次和题目验证携带其冻结documentSha，不静默改绑最新版。

目录原调度每tick最多准备一份已授权Word，允许等待中的AI同时使用已冻旧表示。成功后后续题自动使用v2，旧单位不自动重发或改结果。失败使用已有资源错误与待核结果，暂停/退出可取消本地准备，未知/已派发模型请求沿原规则处理。当前grant预算与已用次数不重置。新增Word历史表/元数据索引，未增加业务真源、云授权、依赖或IPC。teacher_resources/body/chunk事实保持原行。

预期修改material-word-repository及域内升级比较、folder-ai准备与取消、已有AI读取/Native host的digest选择、db中原parse桥、错误提示和定向测试。前端沿原批次状态/错误与Word来源入口，添加明确Word升级失败提示。SQLite增量幂等，已有表历史逐次保存，升级写入在原writer事务内。保留失败/取消旧表示，版本历史随SQLite备份，原图/原件和正式题不删除。

验收为原页/正文/题序/原单元回执保持，旧v1来源在升级后可冷读并通过实际native验证，新输入采用v2局部警告规则。范围变化、源变化、取消、并发重复准备、旧源伪造/历史损坏不自动发布。真实当前目录通过原UI运行后台升级，并有新Word题实际入库/检索进展，保留既有自动题的读图/语义资格。build、246组件及本轮相关Word/目录/native定向回归，按本轮改动验证，不重复全套验收或逐页改书。

性能记录实际迁移文件/耗时和当前库before/after事实SHA，范围内有上界的本地Worker调度，不阻塞模型出字。普通安装/约10GB/全面自然质量仍OPEN，完整Goal ACTIVE。回滚使用正常revert，先保留匹配新历史表/表示的代码与数据备份，不将v2 JSON改标v1。历史数据和二进制资产不上传Git。

## 实际结果

当前范围保持221份、328203104B，目录继续归档暂停。147份旧Word通过原后台调度自动升级，当前148份均为word-ooxml.v2，新增147份旧表示历史快照、JSON合计10533581B。没有逐文件点击重建。历史与最新表示均认证原件版本、documentSha和原图身份，旧冻结AI输入和已有题按其原摘要读取。

2026-11-11T12:31:34Z启动至12:37:41Z核对全部完成，中间包含一次验收控制器错误关闭和冷启。221行teacher_resources全行SHA保持32034ce9fc2ed0ceabb9d207fcc26ecc6c8edf656e72ad16c9dd94d2cccb105b，1312行resource_chunks全行SHA保持b37d0efdfff17443313506b68dafb5818966baef0ae4367a13434ade5c1ee08a。旧矢量题question_19c064f8-f39d-4c9f-aaef-5f3dea18de6f全行SHA升级前后均为4616e83b0bc32bbd4f0cd93ec7d0a9a43ec01090ffa3818165642f4a93db9640。

实际冷启后从题本检索旧题，按角色题图显示1240×688；其冻结v1来源b6fe8921…仍指向历史，最新v2为63ff4142…。原有自动单摆题仍可通过改述检索，实际UI1472ms。本轮没有重新导出已经验证的试卷。

升级后的闵行区2018学年原Word第2题经原资料页授权新范围，批次aibatch_82d8a914-d3a0-4be7-9fa2-08a4a035fa1d，冻结最新v2摘要。两次真实DeepSeek均返回HTTP成功，答案B、开尔文基本单位，已保存question_a63cde9f-1384-48a3-83f8-bdd397f7c8d4，状态ai_needs_review。后台原目录继续运行，局部迁移和新输入链路通过，整批自动质量未通过。

这道新题的source_warning已消失，但原索引仍保留shared_context与separate_answers。实际题前是考试说明，文末有独立答案区。下一修复须版本化处理考试说明归属和独立答案角色，保留真实公共条件与原答案，继续利用已有响应，避免重发同题。当前没有通过清除疑点或教师补正确认为自动定稿。

## 定向验证

生产修改集中于apps/desktop/src/main/assets/material-word-repository.ts、word-upgrade-compatible.ts、material-folder-ai.ts、material-ai-repository.ts，以及src/main/db.ts中的原Word解析/来源桥。src/renderer/components/product/MaterialFolderAiPanel.tsx补充原批次错误提示。新增两个定向脚本，三个旧fixture仅补齐生产已有表，保留原断言。共享契约、preload、原件/正文目录、依赖清单与题库业务真源沿用。

命令工作目录为D:/WorkProject/EduProject-kb-isolation/apps/desktop。TypeScript源码脚本使用node --experimental-transform-types。以下最终定向共122组通过，组件246通过，build包含tsc --noEmit。

| 脚本 | 通过组数 |
| --- | --- |
| scripts/education/kb-word-background-upgrade.mjs | 7 |
| scripts/education/kb-folder-word-upgrade.mjs | 5 |
| scripts/education/kb-folder-ai-boundaries.mjs | 18 |
| scripts/education/kb-word-question-boundaries.mjs | 29 |
| scripts/education/kb-word-question-repository.mjs | 6 |
| scripts/education/kb-native-dispatch-boundaries.mjs | 3 |
| scripts/education/kb-native-ledger-boundaries.mjs | 20 |
| scripts/education/kb-folder-pdf-publication-boundaries.mjs | 23 |
| scripts/education/kb-word-proof-repository.mjs | 11 |

各脚本均以node --experimental-transform-types运行，相关旧断言均保留。新增验证包括超大单题不阻断全文警告范围升级、历史摘要缺失/损坏、未知历史AI来源明确source_changed、提交点取消、原件变化、并发表示CAS、暂停、已付费回执冻结、仅重试同一未计费本地失败。受控调度回执覆盖机制，实际DeepSeek结果单独记录。

本地证据根D:/WorkProject/EduProject-kb-run/flow-1gb-20261111，word-background-before.json、after.json、historical-source.json、live.json、provider-result.json及对应PNG。日志为word-background-boundaries-complete.log、word-folder-upgrade-final-corrected.log、word-folder-existing.log、word-source-existing.log、word-history-questions.log、word-history-dispatch.log、word-history-ledger.log、word-background-pdf.log、word-history-proofs-final.log、word-background-components.log。没有上传原资料、数据库、模型密钥或原生二进制包。

## 性能与保留失败

最大旧JSON实际179617B，对应原件3940458B，重新解析166.3ms，内容兼容比较2.20ms。解析沿原utility Worker，比较沿现有主进程，实际更大单文件和长期负载尚未量化。历史JSON本轮增加约10.05MiB，内容寻址图片复用。组件、索引和AI费用没有因本地迁移新增模型请求，新题验证单独2次。

初版兼容比较逐题完整读取，遇超大题抛too_large，已改为认证除警告外的原结构、锚点、数字、角色和资产完全相同，新增相应回归，保留第一次失败。旧proof回归曾发现缺历史来源错误码变化，已恢复明确source_changed并保留原断言。一次定向命令遗漏--experimental-transform-types，修正命令后5组通过。验收控制器对已经running的批次点击不存在的resume控件而超时关闭应用，保持原控制器失败记录，改用当前运行状态恢复后冷启成功，未改生产授权或重发未知请求。

npm audit当前28项，8high/12moderate/8low，延续已有依赖，本轮无新依赖。完整自然质量、PDF局部失败、自动分类、重排多候选、规模、普通Windows安装和迁移继续OPEN。回滚按正常Git revert并保留SQLite/文件备份；存在新表示和历史引用后应保留摘要读历史的兼容层，旧二进制直接降级未验收。

## 主线整合与最终冷启

功能2997aa9正常整合协作者af6a403至6024428，无冲突。协作者生产改动为资料原件按钮CSS折行，其他为验收脚本与证据。整合后npm run build和npm run test:renderer-components再次通过，246/246。最终main构建SHA为2103c2a77b8df9ecc9db2f8dfccf1dd81d78bab7866d24a379c8d8743eede38f，实际冻结至runtime-2103c2a77b8d/out，未混用其他工作树产物。

等待实际请求结束42965ms后通过原UI暂停，outcome_unknown前后均18，dispatched0，再正常关闭旧实例。此前错误点击resume导致的控制器关闭新增1项unknown，保留该项，没有自动重发。最终冷启保留148份v2/147历史、221资料/1312分块和原题SHA，旧付费单元input/first/final三个SHA均与冷启前一致。实际题本仍可读旧v1来源图，语义UI1414ms，向量同世代ready1314/pending0/failed0。1366×768与1920×1080路径可操作，1920页面无横向溢出，renderer错误0。

最终本地证据为word-background-integrated-build.log、integrated-components.log、integrated-live.log、integrated-cold.json、integrated.json和graceful-pause.json。新控制器工具会话77223、PID175064，Electron177648、inspector60408，端口以cdp.json为准。原UI恢复folder AI后继续原授权范围，目录归档继续暂停。下一轮先核对run-state.json和实际进程，不重复实例。完整Goal继续ACTIVE。
