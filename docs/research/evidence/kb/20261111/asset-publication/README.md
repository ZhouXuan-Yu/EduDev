# 已关闭的题图错误发布阻断重试缺陷

2026-11-11，基线a100785931d2c1d4dd4706da9a59d7df847d1a9e。

## 失败与修复

生产QuestionAssets.put原来先将临时文件发布至不可变assetId，再验证PNG头部、尺寸和SHA。错误字节虽然被拒绝，坏文件已占用身份，后续正确重试仍失败。before.log用真实文件系统复现拒绝后正式目录仍有对应PNG。

本轮复用readMaterialOriginal与原图像形状/4MiB契约，在新文件发布前认证SHA、头部、尺寸及预算。异步操作前复制调用方字节和元数据，防止写入期间变动。有效既有资产的幂等复用继续沿原读口认证。同身份并发发布时短暂nlink=2采用最多10次读取、9次5ms等待，最终仍须单链接、SHA、尺寸和路径校验，冲突身份拒绝覆盖。

修改src/main/assets/question-assets.ts，增加scripts/education/question-assets-publication.mjs。沿用缓存/正式目录、临时文件、fsync、hardlink发布及原图库/归档调用。无新依赖、DDL、IPC或模型调用。

## 定向结果

执行根为D:/WorkProject/EduProject-kb-isolation/apps/desktop。

| 命令 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/question-assets-publication.mjs`，修复前 | exit1，坏字节已占用正式身份，before.log。 |
| 同上，修复后 | exit0，13组真实PNG/文件系统检查通过，after.log。 |
| 定向调用`originalQuestionBoundaries`，等价命令如下 | exit0，47组原图/提案/图库/归档相关回归通过，related.log。 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit0，无诊断。 |
| `npm audit --json --fetch-retries=1 --fetch-timeout=20000` | exit1，存量28项，8 high/12 moderate/8 low/0 critical，audit-summary.json，依赖和锁文件无改动。初次默认请求TLS失败保留在audit-network-failure.log。 |
| `git diff --check`及暂存区检查 | exit0。 |

```powershell
node --experimental-transform-types --input-type=module -e "
import './scripts/office-agent/register-source.mjs';
const {originalQuestionBoundaries}=await import('./scripts/education/original-question-boundaries.mjs');
const fs=await import('node:fs');
const os=await import('node:os');
const path=await import('node:path');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-asset-related-'));
let checks=0;
await originalQuestionBoundaries(async(name,action)=>{await action();checks++;console.log('PASS '+name);},output);
console.log(JSON.stringify({success:true,checks,output}));
"
```

13组覆盖失败后的正确重试、SHA错误、宽高错误、超过4MiB、取消、异步输入变动、有效文件幂等、双发布者被延迟收尾、持久外加硬链接、历史损坏身份、缓存提升及不同内容的并发冲突。最终同身份并发者均成功读取同一认证内容，冲突内容只有一位发布者成功，缓存/正式图片字节准确且临时文件清理。

验证使用生产QuestionAssets与真实PNG/文件系统，其他调用方的校验、授权和业务事实仍由其原实现承担。自然题图归属、OCR、模型和Office/WPS视觉质量本轮保持未验证。

## 成本与剩余范围

错误新输入从发布坏文件变为文件发布前拒绝，正确重试可成功。每次put最多额外复制4MiB，新增发布前SHA计算，既有最终落盘读取继续校验。正常单链接文件无显式等待，双链接窗口显式等待合计最多45ms，另计文件IO。真实吞吐/P95和整库内存峰值本轮未测。

历史已经损坏的身份仍须带来源证明的重建恢复，该能力待补齐。当前修复避免新错误输入污染身份。原图片字节、格式和业务事实继续兼容，正常revert并重建可回滚。

当前素材目录实际11文件、332294145B、约0.309GiB，见corpus-summary.json。用户随后明确取消40G实跑，改为约10GB，指定从网上获取上海初高中数学/物理练习资料，下载和后续实现继续推进。完整Goal保持ACTIVE。
