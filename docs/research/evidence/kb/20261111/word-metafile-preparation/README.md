# Word矢量题图恢复准备与交接

## 当前进度

功能基线2863ad0，交接前main为e34f9aa。本轮按用户要求整理后交接，只更新文档。当前已导入221份资料、328203104字节，数据库3115条题目记录，148份Word均为word-question-booklet.v3。AI单元complete3、review234、no_questions2、failed4、outcome_unknown21，本轮只读核对。原目录归档暂停，控制器与Electron已退出，run-state.json为runner_error。

已有真实单题完成本地OCR、两遍DeepSeek、Pi检索实读、蓝图选题及学生/教师PDF导出，教师确认由测试代理执行。131组定向、246组件及build的既有证据见相邻word-booklet-roles报告。本轮未重跑功能验收。

上一轮4541处Word源索引候选仅95处无来源疑点，其中6处有原答案。全批自动整理、复杂图文与公式质量尚未达到验收标准。题目记录数量和complete状态不能用于推断质量通过。

## 已做诊断与实验

从当前含unsupported_image的12份Word中验证原文件路径及SHA后只读解包，发现WMF165、EMF24、PNG150、GIF11、JPEG11、JPG2、WDP1，计数仅覆盖这12份。

选择6个WMF和6个EMF唯一媒体进行离线实验。朴素System.Drawing按Metafile.Width放大导致部分WMF宽至6144像素，2个WMF超过实验预算，部分EMF输出全白。

Pillow 13.0.0在Windows按144dpi读取12个媒体均生成PNG。6个WMF含可见像素、宽125至349像素。6个EMF中3个含可见像素、3个全白。全白原因、缺字体及逐字公式正确性尚未完成独立原件对照。有像素也不能作为公式正确依据。

实验Python来自Codex自带运行时。项目OCR受管组件已包含Pillow，基础锁文件为12.3.0，page-blocks锁文件为13.0.0。正式交付仍需沿项目冻结组件构建、清单认证与安装入口验证。

实验文件保存在D:/WorkProject/EduProject-kb-run/flow-1gb-20261111下的metafile-inventory.json、metafile-probe-results.json、metafile-pillow-probe.json及metafile-probe目录。脚本在独立工作树apps/desktop/test-results/corpus-flow-1gb忽略目录中。原始资料媒体保留在本地。

## 下一轮第一项任务

修复Word中WMF/EMF预览图被unsupported_image拦截造成的题图、公式预览缺失，贯通原后台解析、前端预览和题库AI处理。

1. 冻结M02/M03/M05切片合同，优先复用现有受管OCR进程与Pillow，新增严格版本化转换请求/回执，复用超时、取消、父进程退出监视和有界输出。
2. 保存原part、原媒体SHA、引擎版本、PNG SHA与尺寸，限制字节、像素及批量大小。空白、损坏、超预算及不确定字体保留明确失败或待核。
3. 在原extractWord入口补全媒体，沿原仓库writer写入，新转换策略进入文档身份。升级只允许可证明的媒体补全，旧正文、题序、锚点与历史来源继续可读。
4. 待升级索引使用新名称和新谓词，覆盖当前148份Word。取消可恢复、重复处理幂等，旧付费回执按原摘要读取。
5. 使用当前受影响的新题从正常后台转换、资料预览走到OCR、DeepSeek与题本。通过后记录实际修复覆盖、耗时及磁盘增量，正常整合推送main。

## 切片验收标准

- 当前真实Word的WMF、EMF各有可核对恢复，比例、文字和公式内容经原件对照；不确定项明确待核。
- 前端可看图，对应题经原OCR/DeepSeek路径处理，来源与题目/答案角色准确。
- 损坏、全白、超预算、组件缺失、取消、冷启和重复处理有确定状态，历史摘要和教师结果可读。
- 受影响定向测试、desktop build及renderer组件测试通过，记录命令、通过数、失败、未验证范围及性能变化。
- 检查diff、整合origin/main并正常推送，报告提交及远端一致性。

复杂OLE/MathType结构、年级分类、PDF局部失败、21项unknown恢复、缺答案联网补答、多候选重排、完整留出质量/召回、约10GB/长期处理、普通Windows安装与异机迁移继续待完成。完整标准见KB_EXAM_ACTIVE_TASK.md的KB-A01至A10。

## 成熟实现参考

Pillow官方文档与源码包含Windows WMF/EMF读取和dpi配置说明。[格式文档](https://github.com/python-pillow/Pillow/blob/main/docs/handbook/image-file-formats.rst) [Windows绘制源码](https://github.com/python-pillow/Pillow/blob/main/src/display.c)

Windows官方接口可用于核对图元格式与渲染行为。[Metafile](https://learn.microsoft.com/en-us/dotnet/api/system.drawing.imaging.metafile) [增强图元文件操作](https://learn.microsoft.com/en-us/windows/win32/gdi/enhanced-metafile-operations)

## 当前验证与回滚

本轮只有文档更新，无生产行为或性能变化，可回退本轮文档提交。转换生产接入尚未完成，下一轮按上述切片交付。旧失败及实验记录继续保留。

本轮git diff --check通过。提交前执行npm audit --omit=dev --audit-level=high，exit 1，报告22项存量依赖问题，其中8 low、6 moderate、8 high；未修改依赖。该命令仅检查生产依赖，统计范围与此前完整audit的28项不同。生产功能未变，本轮未运行build或组件验收。
