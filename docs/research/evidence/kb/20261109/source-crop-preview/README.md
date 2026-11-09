# 待核图组的实际原图核对

教师现在可从“查看原页与AI还原正文 → 原图转录与OCR纠正依据”定位具体图组的边缘疑点，并打开该组AI实际使用的保存裁图。默认不额外传裁图，每个来源面板仅展开一张；关闭、切换和迟到响应不会复用旧图。文件不可用时显示错误并可重试。

本轮发现的自然图题同时满足“两份转录文字一致”和“选项图下边缘有灰色水印墨迹”。旧界面只显示前者，无法定位真正的像素门禁。**本轮补齐诊断与原图核对，没有认定水印无害或放宽边缘阈值**。自然样本仍8题可用/4题待核、11份完整题文，整体逐字/数学质量仍FAIL，完整Goal ACTIVE；120留出、200查询、三蓝图、真实10→40GiB/72h、Windows链式安装和异机迁移仍OPEN。

## 代码与来源边界

- 共享`material-ai-page.ts`为既有`AiPageQuery`增加可选`cropPreview:{number,index}`，既有typed preload和`materials:ai-page`通道沿同一类型/validator，不新增IPC。严格拒绝路径、assetId、额外字段、访问器、越界索引和与整图同时请求。
- `MaterialAiRepository.page`沿原`pageEvidence/validateInput/readPageCrops`认证原件、权限、回执、配对及分组。新增领域helper`material-ai-source-preview.ts`只从`QuestionAssets`读已认证PNG，再核对SHA、尺寸；不重新render近似图。单次≤4MiB原PNG，找不到本题组即拒绝。
- `SourceReadingComparison.edgeContacts`来自保存的本地`CropQuality.clearEdges`，不接受模型自报或renderer声明。明确文字一致与图像完整性是不同结论，未改变任何发表、冷读、Pi或组卷条件。
- `MaterialSourceReadings`复用原折叠卡，`MaterialSourceCropPreview`提供单图加载、关闭、失败/重试，异步旧响应按组件身份丢弃。未新增导航、页面、CSS系统或依赖，没有修改OfficeComposer。
- 不增加DDL、索引、Worker、模型轮次或云上传。原裁图、OCR、AI回执、原题和候选资格不改写。实施前合同见`docs/goal/KB_IMPLEMENTATION_CONTRACT.md`的2026-11-09 M03/M05段。

## 验证与命令

工作目录：`C:\Users\ZhouXuan\.codex\worktrees\beca\EduProject\apps\desktop`。fixture、目录和故障范围均由脚本限制为明确的临时测试数据根，没有扫描用户其它目录。以下组数有导入重叠，不累加为独立用例。

| 命令/场景 | 结果 | 证据 |
| --- | --- | --- |
| `node --experimental-transform-types scripts/education/kb-source-preview-boundaries.mjs` | 新专项7组、原页245组PASS，exit0；严格query、默认无图、准确PNG、越界/错题、边缘与文字独立、篡改PNG拒绝、事实不变 | `boundaries.log` |
| `npm run build` | 最终build/typecheck PASS、exit0 | `build.log` |
| `npm run test:renderer-components` | 246/246，exit0 | `components.log` |
| `node --experimental-transform-types scripts/education/kb-source-preview-journey.mjs "$env:TEMP\omni-natural-paired-quality-miHb1y"` | 实际自然题本/保存裁图SHA、边缘提示、单图切换/关闭、双尺寸/冷启4组PASS，exit0 | `natural.json`、`natural.log` |
| `node --experimental-transform-types scripts/education/kb-source-preview-journey.mjs "$env:TEMP\omni-book-reference-ui-cPjO1s" --controlled-failures` | 实际受控来源6组PASS，exit0；包括文件暂不可用→可见错误→恢复原字节→重试，以及延迟文件读取中关闭后无旧图复活 | `controlled.json`、`controlled.log` |
| `node scripts/electron-smoke.mjs` | 同一冻结构建207/207，exit0，前后产物SHA一致 | `electron-smoke.log`、`build-before.json`、`build-after.json` |
| `npm audit --json` | exit1，既有28项（8high、12moderate、8low、0critical），无新增依赖或本轮升级 | `npm-audit.json` |
| 根目录`git diff --check` | PASS | 收尾复核 |

实际运行使用本工作树冻结的main/preload/renderer；窗口native content size与CSS尺寸均核对为1366×768、1920×1080，无横向溢出，renderer错误0。自然和受控最终两轮的units、final references、questions完整行字节指纹均不变。任务模型请求0，查看不派发OCR。所有可观察fetch均被测试阻止；末次自然冷启另记录1次无body模型目录GET被拒绝，受控末次冷启0次，报告未汇总首次启动的目录GET次数。

自然裁图、题文、答案、PDF、原始模型响应和截图不提交；仅提交元数据与日志。实际自然/受控截图分别保留于报告的本机output目录，不能当独立教师视觉接受或题库正确性验收。

## 原失败和修正

`natural-before-fix.log`及`controlled-before-fix.log`保留真实首轮失败：界面selected对象含内部sha256，结构类型允许传参，但严格IPC因多字段正确拒绝。已在请求边界显式投影number/index，没有放宽validator。该错误由真实Electron发现，纯host专项通过不能代替前端路径。

受控首轮`immutableFactsUnchanged=false`：启动时未禁用已有自动书册配答writer，正确题被原后台流程归档；此轮不能声称只读。之后只读脚本固定`OMNI_EDU_BOOK_ANSWER_WRITEBACK=0`，自然/受控最终均事实不变。故障注入只在明确受控临时目录暂移一张PNG并在finally恢复，延迟仅在该受控进程包装一次文件open；不改自然文件、生产代码或权限，不以proxy结果冒充模型质量。

一次工具JavaScript语法错误未执行命令；初期猜测文件路径及PowerShell通配路径读取失败未作为产品结论。原构建进程均已结束后才运行新构建，未因观察超时重启。

## 性能与回滚

相对`a828e06`：main由4341753增加至4343204B，增1451B；renderer主chunk由7929797增加至7933838B，增4041B；preload仍40997B。最终main SHA为`df58bfabcb6590dad974c2990aa3bfd957f2157035a9983bec8cb7c378ba78de`，renderer为`95cd3926fa746ded621d5e8d8cf236201b2e2fc64a09e9c556ec6aa2fad85d36`。冻结前后摘要见`build-before.json`、`build-after.json`，全部一致。

默认页面不增加图字节；显式请求至多一张4MiB PNG，base64最多约5.34MiB，随后只保留当前来源面板的一张图。不新增模型/OCR轮次。原路径已逐页验证保存图片，本轮显式预览再认证所选原PNG；尚未测量真实大库P95、峰值内存或吞吐前后对比，不宣称性能验收。

回滚采用正常revert本轮只读接口/界面并一致重建main和renderer，无迁移、无题库回写，不删除原资产/旧回执/配答journal。新renderer不能混配旧main。水印自动认证及教师安全补正图题仍是下一实现工作，不以此只读功能结项完整知识库Goal。
