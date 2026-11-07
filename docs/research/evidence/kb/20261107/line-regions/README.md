# M03 行区与侧栏裁图，2026-11-07

目标是让侧栏、二维码只限制与它相邻的正文行，避免把整个正文块压窄。复用已安装的RapidOCR行坐标、PP-DocLayout版面、既有owned分组DP、原图资产与三遍DeepSeek；没有另建OCR、图像模型或索引服务。

## 生产变化

- `material-ai-line-blocks.ts`只派生新任务版面：原text块的12px侧边被局部外块阻挡，且本地OCR有行间空隙时，按障碍变化的行间拆分。完整覆盖原块核心，保留父ID/矩形及左右各自留白；图、表、公式、无OCR、重叠歧义及超预算不拆。
- 新engine为`rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1+ocr-line-regions.v1`。`PageBlock.lineRegion`冻结父证据和marginX；共享validator要求同父2～8块完整、连续、等宽覆盖，留白各12～192px。留白依据行高及同侧障碍范围，上下仍12px；所有原外块阻挡检查不变。
- `material-ai-owned-crops.ts`仅同父子块互相限制上下留白，保持其它图题原分组算法；仍按八图预算，无法合法分组就待核。没有涂白、删除或伪造原图像素，没有调整深浅色和边缘检查阈值。
- `MaterialAiRepository.localBlocks`只在新任务准备时派生，当前页和续页一致；目录quality/适用新模式默认启用，legacy手动页只有`OMNI_EDU_AI_LINE_REGIONS=1`显式启用。无新DDL/IPC/依赖，不改版面缓存、旧冻结输入、旧模型回执和原题。`pageBlockTexts`复用同源行证据重建提示。

## 保留失败及像素对照

- 新测试最初使用静态TS依赖，加载器注册时机错误，未进入几何断言。`initial-loader-failure.log`保留该脚本问题。改为注册后动态导入；`--legacy`只运行原几何，不做行区派生，在尾行留白断言失败，`legacy-geometry-red.log`。这是基线算法对照，不冒充旧Electron整套重跑。
- 第一版行区沿用12px仍不足；第二版仅用行高，四边检查已全绿，却仍只含左括号，完整右括号仍在裁图外。`line-height-only-inspection.log`保留坐标/像素摘要。说明clearEdges不能独立证明来源完整，不能据此自动宣称质量通过。
- 最终只读使用上一轮自然页同一SHA验证的缓存栅格，59块→61块。第2题原第一裁图621×173、右边不清；新正文三块加原选项块，像素检查已保留整对括号、未混入二维码，四边均清。第5题保持原三块及原坐标/像素摘要，水印触底继续不清，不随本片放行。`crop-inspection.json`。
- 对照PNG由同一栅格经Electron nativeImage重新编码；PNG SHA与旧资产可能因编码不同，不宣称原PNG字节相同。只读检查核对父栅格SHA、来源版本/页、派生输入不变及原数据库事实指纹，未写回诊断几何。自然PNG/原题文/原模型响应只留本机，不提交Git。
- 停新策略冷读脚本先误用不存在的comparison testid，随后把被拒绝的目录探测也算成云调用，最后又遗漏模型目录实际`/v1`前缀。三次失败保留为cold-harness/metric/catalog-before.json/log，非产品来源失败，全部原事实不变。按现有组件的`material-source-readings`及实际请求路径修正；最终逐项记录method/body，所有请求仍在本地拒绝，仅无body的GET模型目录探测可出现，任何解题/其它数据请求仍使验收失败。

## 实际运行与精确命令

命令从`apps/desktop`运行。当前源码已冻结，所有最终进程终态另见下表；不以局部对照代替自然三遍或完整产品质量。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build`（含`tsc --noEmit`） | exit0 | build.log |
| `npm run test:renderer-components` | 246/246，exit0 | components.log |
| `node --experimental-transform-types scripts/education/kb-line-region-boundaries.mjs` | 29组，exit0 | line-boundaries.log |
| `node --experimental-transform-types scripts/education/kb-book-reference-boundaries.mjs` | 原页245/配答34/最终引用34，exit0；重复导入套件不累加 | page-suite.log |
| `node --experimental-transform-types scripts/education/kb-line-region-natural-inspect.mjs "$env:TEMP\omni-natural-books-62sbkdoe" aibatch_73727b15-cedb-4933-976d-83a6ea4e1e00` | 只读几何/像素/不变性通过，provider0 | crop-inspection.json |
| `node --experimental-transform-types scripts/education/kb-source-content-journey.mjs --literal --partial` | 递归PNG导入、本地OCR、三遍、typed来源/Pi取题和组卷门禁、双尺寸/冷启5组通过，受控HTTP3次、云0、renderer错误0 | controlled-report.json/log |
| `node --experimental-transform-types scripts/education/kb-source-reading-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" --source-content --literal --line-regions` | 4组机制/UI/双尺寸/冷启通过，exit0，真实3次HTTP200、62647 tokens；新批aibatch_3a7f4886-e184-46a2-8b1f-6e451c9af6d1 | natural-report.json，natural.log |
| `node --experimental-transform-types scripts/education/kb-line-region-cold-journey.mjs "$env:TEMP\omni-natural-books-62sbkdoe" aibatch_3a7f4886-e184-46a2-8b1f-6e451c9af6d1` | 停新策略后的新源/题本双尺寸、12条旧可用来源、事实不变3组通过，exit0；实际云0/provider尝试0，1次无body目录GET被本地拒绝 | cold-report.json，cold.log |
| `node scripts/electron-smoke.mjs` | 同一冻结构建207/207，exit0 | electron.log |
| `npm audit --json` | exit1，28项：8high/12moderate/8low，0critical；无新增依赖 | audit.json |
| `git diff --check` | 最终收尾记录 | 无输出为通过 |

自然新批在请求发送前验证新engine，旧付费/题目/裁图指纹不变。首遍选择全部三个正文子块和原选项块，未选择旁侧二维码；真实生产readPageFragments又校验已落盘第2题四份来源/输入/几何/资产SHA，四边均清，metadata见persisted-source.json。这仍不是逐字/数学验收。

实际12题归档、11份完整文档、8题ai_final、4待核，renderer错误0，历史付费/题目指纹不变。第2题完整来源和typed读口恢复；第5题图文/水印完整性仍待核；第4/6/10题答案冲突保留。相较上一轮10份完整文档增加1份，但可用题总数仍8：模型另在第4题产生答案冲突，不得宣称整体可用率提高或数学通过。qualitySuccess仍false，原失败与旧状态未重写。

## 性能、回滚与未完成

基线ac5e589主程序4,330,868B，新构建4,335,041B（+4,173B）；renderer主包7,920,365B→7,921,977B（+1,612B），preload40,997B不变。无额外模型轮次/服务，派生只按当前页至多256块/2000行计算，不扫描整库。拆分可能增加每题裁图与本地OCR数量，仍遵守原八图/字节预算；本片没有40GiB吞吐、P95或内存前后测量。自然本批第二/第三请求各25张图像（含页/裁图），输入成本可能增加，不能将正文恢复等同成本下降。最终构建main SHA `1d17cfae32c9eb6bf4365bf665b14f87537f43688bd616839384bae4abdd0aa7`，冻结摘要见frozen-before/after.json。所有最终验证进程已结束，前后产物摘要一致。

`OMNI_EDU_AI_LINE_REGIONS=0`仅停新输入派生，既有新版冻结输入仍按新engine读取，不需要改写或模型重发。旧二进制不认识新engine，整体旧二进制降级未验收；不得删新输入或用旧几何冒充原裁图。

完整Goal保持ACTIVE，KB-A01～A10仍OPEN。水印/真实题面缺失、字面与数学独立质量、已知答案冲突的发布时机、120自然留出、200检索查询、三套正式蓝图、真实10→40GiB/72h、普通Windows安装和异机迁移仍需完成。本页是开发资料，不是按该书逐页修补后的验收金标。
