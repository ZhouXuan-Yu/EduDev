# Word矢量题图恢复

## 结果与实际边界

本轮关闭Word的WMF/EMF题图及公式预览被unsupported_image拦截的缺陷，并修复转换实验中发现的公式字符重叠。复用Windows GDI+和受管Pillow，现有资料预览、题本、OCR及DeepSeek入口已贯通。

当前148份Word已沿原后台队列升级word-metafile.v2，恢复1646处矢量图片引用，21处空白、47处缺字体、2处超限保留确定原因。当前派生PNG比本轮前增加1353个唯一资产、3650908B。以上为已识别矢量媒体的引用统计，完整图像必要性与原题正确率继续按KB-A02/A03验收。

4541处Word候选中来源无疑点仍95处，其中6处有原答案。图片恢复后，公共前置信息、嵌入对象及特殊结构的归属继续阻断自动定稿。当前221份资料、完整自动稿质量、独立召回、约10GB、普通安装及异机迁移仍待达成，完整Goal ACTIVE。

## 实现

- word-parser根据媒体字节识别WMF/EMF，保留原part、SHA和有界临时数据；正文图片占位仍具有原锚点。
- 原extractWord在解析utility退出后，通过ocr-host复用受管OCR进程转换。xiaozhi.local-metafile.v1按批绑定原SHA，主进程校验回执、PNG格式/摘要/尺寸和预算，再补全原图引用。
- Windows GDI+负责原始绘图记录的渲染。Pillow13读取物理边界、编码PNG。字体可用性、NULL终止字段、声明EOF、空白和尺寸限制均有回归。
- imagePolicy=word-metafile.v2，当前引擎windows-gdiplus-pillow-13.0.0-144dpi.v1。历史表示保留其原引擎。图片替换要求同一原媒体SHA，原正文、锚点和角色通过兼容比较，原writer在验证原件后提交。
- 当前148份表示记录生成时的GDI+/Pillow12.3引擎身份。依赖更新后的Pillow13组件对同一9图逐像素一致，并能冷读这些既有派生图；新的转换使用13。
- idx_material_word_metafile_v2维护待升级集，现有typed preload和前端读PNG；错误图片显示具体原因。
- 新增运行依赖包0。基础组件沿用Pillow，并更新至项目已采用的13.0.0，同时更新certifi/pip/setuptools及对应许可证。组件712文件、279128229B，较原清单279039929B增加88300B。Windows系统提供gdiplus.dll和shlwapi.dll。

## 真实题目链路

通过原资料界面选择当前Word中原文第17处、印刷第14题，处理此前缺失的EMF示意图。原媒体转换为155×185 PNG，正常资料入口在1366×768和1920×1080均可查看。

批次aibatch_9acf7719-b0c0-4008-a50c-a32684757e08首次DeepSeek返回了字符串形式的projection，严格结构校验拒绝，原provider回执保存。补充六个对象字段的明确JSON结构示例后，通过原“重发未知项”操作继续，累计3次调用，其中2次有效。schema校验保持原有约束。

新题question_4925c280-cf14-4b65-a5b1-f8bdef4d3e44已保存本地OCR及两次有效结果，进入题本。当前archive为ai_needs_review，issues含incomplete_question；原来源含shared_context。组卷入口显示待核。题本题面PNG为1240×873，恢复原图在其中的像素匹配为1.0、位置16/328，两窗口尺寸与冷启通过。

3次调用的原始响应、输入与图片继续保存在本地运行根。既有21项历史unknown保持，新增格式失败经上述原操作恢复。当前AI单元complete3/review244/no_questions2/failed4/outcome_unknown21，题目总记录3120。

## 数据及版本一致性

- 221条teacher_resources的全行SHA为32034ce9fc2ed0ceabb9d207fcc26ecc6c8edf656e72ad16c9dd94d2cccb105b。
- 1312条resource_chunks的全行SHA为b37d0efdfff17443313506b68dafb5818966baef0ae4367a13434ade5c1ee08a。
- 上述SHA与本轮前相同，原3115条题目逐行哈希一致，原148份文档JSON按摘要在历史表逐字匹配。历史表示现591份。
- 当前文档JSON合计11875477B，本轮前11232193B，增加643284B。派生PNG增量另计，历史表示及实验缓存继续保留。
- 整合后实际冷读新题原图SHA一致，既有自动题question_809887b8-2c67-4484-8db6-fb9ad4680b1c原图SHA与归档记录一致。

## 验证命令与终态

功能提交3d39f66，首次整合协作者4cc99ca得到763c93f，后续整合教学UI提交e03e03c得到ed0bad6。冲突位于electron-smoke的中文查询断言，保留协作者更完整的精确题干筛选与总写入数断言。

最新整合构建main SHA为e256923d46376b17f6492e5500bf5b97a0071b700d2e3bce8477ebca715f157c，完整out树SHA为860232412e85bc220e9f91f8c059df79b0cba19aab953d32fdf44595d7aa8207。该树包含最新renderer，实际页面URL来自runtime-e256923d4637-86023241；只按main摘要复用目录会遗漏纯UI更新，最终恢复入口使用完整树身份。最新整合后build、246组件、实际宿主/取消及新旧题冷读再次通过。

| 命令或范围 | 终态 |
| --- | --- |
| npm run build | 整合后通过，包含typecheck |
| npm run test:renderer-components | 整合后246/246 |
| node --experimental-transform-types scripts/education/kb-word-metafiles.mjs | 10/10 |
| 既有9组Word/目录/native专项 | 共131/131，分组数8/7/10/29/5/20/11/18/23 |
| .local-ocr/build-env/Scripts/python.exe -m unittest discover -s ../../python/omni_edu_ocr -p test_metafiles.py -v | 6/6 |
| 上述定向合计 | 147/147 |
| 受管Windows组件及独立System.Drawing对照 | 9/9非空图逐像素一致，3个空白项明确失败 |
| 整合应用中的原Word宿主与真实取消 | 原件转换15资产；实际子进程收到取消并退出 |
| 新题与历史自动题冷读 | 原图SHA一致，renderer errors 0 |
| npm run test:smoke后的修复复跑node scripts/electron-smoke.mjs | 整合前371572374c0d构建207/207 |
| pip-audit -r requirements-windows.lock.txt --no-deps --disable-pip --format json | 更新前55项/4包，更新后0项已知漏洞 |
| npm audit --omit=dev --json | exit1，22项存量，8 low/6 moderate/8 high |
| git diff --check | 通过 |

整合后的综合207仍可在后续关键改动需要时运行，当前整合范围为build、组件、定向、实际原生宿主及冷读。普通Windows链式安装、异机迁移、留出质量与召回、规模/长期负载继续OPEN。转换进程取消由实际子进程退出核对。

## 性能

同一587944B Word，当前纯解析71.70ms，解析加冻结组件转换426.75ms，8个不同媒体在一批完成，资产7→15。该直接调用不含Electron IPC、组件逐文件认证和前端时延。

整合应用中包括原utility与受管组件认证的实际Word宿主转换约1.6至1.9秒，样本为同一Word。完整题库P95和大型资料后台交互指标继续待测。恢复了原图，也增加了本地处理时间与派生数据。

## 保留的失败

1. 初次build暴露WordResult泛型和校验闭包类型错误，已修复。
2. Pillow GDI输出有像素的WMF公式仍重叠，改用Windows GDI+，独立对照9图一致。
3. 固定长度字体字段及EOF后的填充导致部分真实图误拒，补充有界短字段与NULL/声明结束处理；缺字体仍保持待核。
4. 首个真实模型projection为字符串，回执与3次计费记录均保留，明确结构示例后原路径恢复。
5. 初次综合smoke在旧“查询只返回1条”断言超时。协作者同时修复同一处，合并采用其精确题干与新增总数断言。
6. Electron测试VM的dynamic import无回调，宿主探针改用Node createRequire加载实际ESM模块，生产逻辑保持。
7. Python锁审计曾有55项，更新项目既有依赖版本后为0。npm存量问题另有明确结果。

## 参考与本地证据

GDI+采用Windows系统实现，并通过System.Drawing独立对照。[Windows GDI+接口](https://learn.microsoft.com/en-us/windows/win32/gdiplus/-gdiplus-flatapi-flat) [System.Drawing Metafile](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.imaging.metafile)

字体与文件结束依据官方格式说明核对。[WMF字体](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-wmf/dabb1ed6-e5e8-4243-80ed-e63443e5484f) [EMF字体](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-emf/1cd7cb7a-1a7c-48d2-b4a4-c218f9d12100) [EMF文件结构](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-emf/daaf9447-0c47-446e-b72e-ac6bd7a2e8f1)

原始材料、图片和模型响应在D:/WorkProject/EduProject-kb-run/flow-1gb-20261111；执行脚本与日志在独立工作树apps/desktop/test-results/corpus-flow-1gb。本目录保存必要的摘要与日志校验清单。

## 回滚及继续

回滚时选择匹配的应用版本、组件清单与.local-ocr/file-v3-before-<timestamp>备份。当前原始资料、教师事实和来源历史具有上述核对结果。单独切换组件须与应用编译清单一致。

测试程序已关闭，目录及folder AI暂停，prepared.json已指向本轮整合入口。下一先修复公共前置信息与来源归属，依据当前221份资料中的实际阻断实现通用规则，继续提高完整可用自动稿覆盖。执行入口为docs/goal/KB_EXAM_ACTIVE_TASK.md。
