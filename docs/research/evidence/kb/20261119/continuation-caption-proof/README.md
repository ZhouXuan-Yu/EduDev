# 跨页题的题干与图注归属

本轮对应 M03/M05。老师整理含独立题图的跨页题时，题干可跨页保存，图注随原图保留。出题、检索和原件读回继续使用已授权的完整题文档。

## 根因与修改

续页下划线规则曾要求完整 OCR 续页文本出现在题干末尾。题文恢复同时按独立图块的归属把图注留在图文证据中。两条校验因此无法同时通过。保留式旧响应的纯文本抽取也会把图注附在题干末尾，导致候选题文与已经分离图注的结构不一致。

`material-ai-page-fragments.ts` 按同版本续页裁图的冻结块顺序检查各图的字面标签。图文混组继续按正文核对。每个独立图块的本地 OCR 必须和该块原标签一致，同时两遍题文的插图字段须按顺序保留这些标签。

`material-ai-continuation-text.ts` 用完整续页文本比对独立 OCR，再根据已确认归属核对无图注的题干末尾。原有空格线证据仍须留在题干。空格线与图注跨界的证据进入待核。

`material-ai-page-content.ts` 对旧响应仅在尾段和冻结续页逐行对应且图注可查时做临时解析投影，原始模型响应和 OCR 文本继续完整保存。两页来源、版本、原 PNG 与裁图区域沿既有链路保存和复核。

## 验证

同一带两图测试在 `f5d9453` 首项发布失败，修复后使用现有任务执行器保存完整题文档。新增默认质量模式用例走两遍独立字面转录，通过原 SQLite 和冷读校验核对两图的标签、题干、小问及两页来源。使用受控扫描布局与模型回复，云端请求 0。错字、漏标签、对调标签、混入下一题、篡改坐标和换页证据均继续拒绝。旧整段续页和本地复查恢复使用原路径。

| 命令或范围 | 结果 |
| --- | --- |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-figures-boundaries.mjs` | 跨页独立题图 10/10，套件内跨页通用 12/12，AI 页面 248/248 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-continuation-text-boundaries.mjs` | 续页文字及原空格线 10/10 |
| `npm run build` | 整合工作台主线后通过 TypeScript 和 Electron 构建 |
| `npm run test:renderer-components` | 整合后 253/253 |
| `node scripts/electron-smoke.mjs` | 使用同一整合构建，207/207，退出码 0 |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-book-document-journey.mjs --folder-pairs --figure-crops --continuation-figures` | Electron 7/7。用排印生成的试题 PDF 和答案 PDF，真实运行目录导入、OCR、版面、裁图、答案册配对与重启读回。测试保留旧响应协议，设置 `OMNI_EDU_AI_SOURCE_READING=0` 和 `OMNI_EDU_AI_BOUND_ANSWERS=0`。8 次受控响应，云端请求、重启后重调及渲染错误均为 0 |

首次桌面测试在展开文件夹批次前没有打开处理队列，未发起模型请求。更新验收脚本，通过当前可见的处理队列操作后成功。带双标签的质量模式由上表专项验证，桌面回归样本的续页图无印刷标签。

单独计时续页文本核验，分别预热并运行 1000 次，同一含双图注输入的 P95 为基线 0.0147 ms、修复后 0.0177 ms。基线拒绝该输入，修复后通过。这组数字衡量本地比较函数。`npm audit --json` 报存量 29 项，其中 high 8、critical 0，无新增依赖。

## 剩余边界

真实多来源资料里跨页图题的检出、实际 DeepSeek 的转录与答案质量、不同出版社的单独留出样本和约 10 GB 规模继续按活跃目标验收。当前约 1 GB 资料库的 245 个已解析续页中，按既有规则未找到同时以编号小问开头、包含图文且能定位下一父题的自然正例。

回退使用对应提交的常规 Git revert。本轮没有库表迁移，已保存的原件、裁图和任务回执仍可用于恢复或人工核对。

修改文件及 Git 内容哈希见 [文件清单](MANIFEST.json)。构建和专项结果摘要见 [summary.json](summary.json)。
