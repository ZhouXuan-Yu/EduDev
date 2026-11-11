# 候选图片缓存缺失的归档恢复

2026-11-11，本轮基线a5f6b5159e500e4e565711c397c5a16e15fa27cb。完整Goal ACTIVE，规模按用户最新要求约10GB。

## 本轮交付合同

模块M03/M05。教师在归档事务回滚、正式题图已保存且候选缓存缺失时，仍能在原待确认入口查看同一题图，重试完成归档。现有OriginalQuestionRepository.review/decide与OriginalMultiRepository.review/decide均复用QuestionAssets，前端和typed IPC继续走这些入口。

当前read(image,false)只读候选缓存，即使已存在SHA及尺寸完全一致的正式图也直接unavailable。promote随之失败，pending记录无法恢复。将修改QuestionAssets的缓存缺失读取，并在现有定向脚本补齐回归。无表、目录格式、IPC或依赖迁移。

仅在候选文件或其目录ENOENT时尝试正式存储，沿原readMaterialOriginal验证路径、单链接、文件身份、SHA、4MiB及PNG尺寸。已有候选损坏、可疑链接和身份冲突继续返回失败。读取图片沿用原业务引用权限，确认仍依原件、会话、草稿及事务门禁。从候选转为正式存储时，在异步前冻结元数据，防止调用方变动使图片改绑其他身份。

完成依据为真实PNG/文件系统修复前后证据，以及原确认入口的事务回滚→候选缓存缺失→预览→再次确认→SQLite/文件冷读。覆盖单图和多图，取消、损坏、错误SHA/尺寸、缺少两份数据与可疑链接保持明确失败。按影响范围进行构建、类型及相关测试，保留终态和未验证边界。

正常revert代码及对应测试可回滚，无业务数据回写。历史已经损坏的正式题图自动重建和完整自然质量、检索、约10GB及安装迁移继续待完成。

## 已实现结果

QuestionAssets.read仅对候选ENOENT复用正式题图，通过原readPublished处理发布者暂时双链接收尾，并最终执行同一严格readMaterialOriginal。promote在异步前保存元数据快照。正常缓存与正式读口使用原检查，新增恢复不会写入候选文件，也不会自行确认pending题目。

修改生产文件apps/desktop/src/main/assets/question-assets.ts，补齐原scripts/education/question-assets-publication.mjs与original-question-boundaries.mjs。复用原单图/多图coordinator、事务、权限、原件、业务writer与文件认证，无新表/IPC/依赖/模型调用。

## 验证终态

执行根为D:/WorkProject/EduProject-kb-isolation/apps/desktop。

| 命令或入口 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/question-assets-publication.mjs`，修复前 | exit1，已存正式图片而候选不存在时read(false)报unavailable，before.log。 |
| 同命令，修复后 | exit0，21组真实PNG/文件系统检查通过，after.log。新增8组覆盖恢复、缺少两份数据、候选损坏、SHA/尺寸不符、硬链接、并发收尾、取消和元数据变动。 |
| 原originalQuestionBoundaries定向入口，完整命令如下 | exit0，49组通过，related.log。新增单图/多图两组从coordinator的review/decide进入，注入afterWrite失败并验证SQLite回滚，移除候选缓存后原入口可预览、重新确认，冷读图片和正式事实一致。单图还验证原件变化继续source_changed，多图确认重复执行仍仅创建一题。 |
| `npm run test:renderer-components` | exit0，246/246，components.log。 |
| `npm run build` | 最终exit0，内置`tsc --noEmit`、main/preload/renderer构建通过，build.log。 |
| 初次独立typecheck及初次build | exit2，read/readPublished互相调用触发TS7023。已显式标注Promise<Buffer>，保留typecheck-initial-failure.log及build-initial-failure.log。最终build的内置typecheck通过。 |
| `npm audit --json --fetch-retries=1 --fetch-timeout=20000` | exit1，存量28项，8 high/12 moderate/8 low/0 critical。audit.json与audit-summary.json，依赖和锁文件未变。 |
| `git diff --check` | exit0，收尾暂存区亦核对。 |

```powershell
node --experimental-transform-types --input-type=module -e "
import './scripts/office-agent/register-source.mjs';
const {originalQuestionBoundaries}=await import('./scripts/education/original-question-boundaries.mjs');
const fs=await import('node:fs');const os=await import('node:os');const path=await import('node:path');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-asset-recovery-related-'));
let checks=0;
await originalQuestionBoundaries(async(name,action)=>{await action();checks++;console.log('PASS '+name);},output);
console.log(JSON.stringify({success:true,checks,output}));
"
```

验证涵盖生产文件存储、原确认coordinator、SQLite及重开数据库。底层原件/栅格由既有受控fixture提供，当前测试未运行真实Electron点击旅程、OCR/provider、自然题内容质量或Office/WPS导出。完整Goal和KB-A01～A10继续按原标准推进。

## 性能与回滚

修复前候选缓存缺失即unavailable，修复后同一已认证正式图可继续预览和提交。正常命中候选的文件读取与SHA检查沿用原过程。仅缺失时增加一次正式图片认证，单图仍受4MiB预算限制，正式发布双链接窗口复用最多10次读取、9次5ms等待，另计文件I/O。无整库扫描、OCR或模型重跑，真实P95、整库吞吐和内存峰值本轮未测。

可正常revert本轮代码并一致重建。没有数据库/索引格式变化，正式图字节和既有来源保持兼容。回滚后缺候选缓存的pending题再次无法预览或提交，已确认题继续由原正式读口读取。历史正式图片损坏仍需来源证明后重建，本次恢复继续拒绝损坏字节。

## 资料获取与主线

首批930项已结束并完成网络中断重试，当前下载按SHA去重981份、1052583789B，其中含作者初中物理60份PDF。尚有12份源站失败保留记录，约10GB未达成。 获取进程及网络中断重试已终结，exit0。源站404单列。最新来源数量、字节及任务状态保存corpus-status.json，原337份快照及来源说明继续保留在[上轮记录](../shanghai-corpus/README.md)。资料在仓库外，本提交仅含状态及来源元数据。约10GB尚未达到，当前自然质量/留出检索、正式组卷和安装迁移继续待完成。
