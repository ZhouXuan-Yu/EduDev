# UI / UX R1 执行恢复入口

状态：IN_PROGRESS。任务包 contract/01_EXECUTION_GOAL.md 是本轮入口，UIR1-01～28 全部保留。未更新自动Goal工具，未修改Master及其他AI任务。

工作树 D:/WorkProject/EduProject-ui-ux-r1-20261125；分支 codex/ui-ux-r1-20261125。P0基线700143f；已有a438902、bacc2c9（正常合入d2b1ccf）、6cfa15e；后续修复尚未提交/推送。远端已到2266b53，需收尾正常合入。D盘原工作树及其46项脏文件未写入，保护清单evidence/canonical-protection-corrected.json。

## 已实施

- 18页初审及三尺寸57幅基线、57幅迭代；设置间距token缺失、nav状态合并、无当前会话误取最近会话、任务层级与详情已局部修复。
- 原生select复用AppNativeSelect，不改原枚举/handler。多数默认summary改为现有DisclosureCard；原厂组件、依赖与vendor源码未改。
- 题本、讲义、资料目录/结构、设置/归档的读取失败不再冒充空数据；题目使用记录的迟到响应隔离。8项组件故障检查通过。
- 保护区例外仅按本包已授权的粗黑指示符替换：PiComposerQueue/PendingPanel使用indicatorOnly直接select，原DOM层级/事件/皮肤保留；OfficeComposer/工具栏/弹层源码不变。队列实际CSS几何对比见composer-hEz4EE/report.json。
- PPT真实生成发现保存刷新后共享busy不释放；新增office-save组件复现（before-4失败busy=true、after通过busy=false），仅PiOfficeArtifactCard两处finally释放共享busy。没有改Pi/Harness/授权或文档引擎。真实复验已越过编辑保存，但QA自身保存轮询覆盖artifact变量导致中断，待修正后完整文件验收。
- 设置当前项对比度实测3.06:1失败，应用自有nav文字改用既有edu-accent深蓝；待最终构建复验，未改HeroUI内部。

## 当前证据（均需区分层级及版本）

- 原P0 build/261renderer/57页通过；完整smoke通过在bacc2c9旧构建（不可当最终）。workbench实际导航/导入回读/冷启通过。
- 最新indicator构建通过；renderer261；新增组件17；read-errors8；office-save定向组件通过。office-save-build新构建renderer index-BQScmfVX，设置深蓝修复尚未编译。
- response-before-oc2EpU / response-after-nhu3iu：独立git700143f源码档案npm ci和build成功（从未借node_modules）；同机同数据三类各10次前后共60原始样本全部≤200ms。after最大21.1/5.5/9ms。不含模型完成耗时。
- pending-keyboard-final：真实生产Electron+受控SSE，6项通过，根Temp/xiaozhi-pending-keyboard-dytYhC；无真实provider/物理IME宣称。
- composer-current-controls：5项通过、真实SQLite排队/steer/编辑/重排/撤回/冷启；源生模型回复为受控SSE，非真实provider。evidence/composer-hEz4EE。
- 窄屏真实390溢出修复后5视图8键盘冷启通过；DPI forced125/150通过，但实际OS仅150，不能冒充系统125。
- settings-qMMYyH实际宿主10项通过。旧完整settings脚本已逐步修正当前9分类/归档子页/标题语义定位，所有原断言保留。VZFKZ9/10M8g3/jXe7HI/gbuzxp分别留原失败；gbuzxp25项后实际nav文字对比度失败，已最小修复待复验。gbuzxp期间out重建，后半段证据不可作为冻结最终构建验收。
- 实际provider live-yiyUAL：本地表单创建2题，真实条件抽取及PPT待审阅，改标题后busy卡住。live-lOkOm2：真实条件抽取→已有来源题面Modal→同会话返回通过，PPT编辑后已能确认；QA轮询错误导致终止，不能声称文件成功。
- 旧paper-real脚本因新建题目区折叠找不到可见字段失败；已按真实可见入口打开，未删原20题/6文件断言。当前paper-current-entries运行中。
- 原test:ui-contracts：参考文件CRLF通过精确.gitattributes固定LF修正，28通过、1历史prompt-input五文件旧指纹不符。其Git blob自effc6c0已变、R1未改vendor；保留失败，不刷新指纹蒙混。需最终明确旧门禁责任/影响。
- npm audit基线30（5high/17moderate/8low），无依赖变更，不擅自升级。

## 下一步

1. 等当前纸卷/旧settings进程终态，任何实际UI验收期间不重建out，保证运行身份冻结；保留混合构建的失败证据。
2. 完成当前源修改、测试、提交，并保存/复原本树生成清单派生文件后正常整合最新origin/main；不动别的main工作树。
3. 冻结构建后复验nav对比度、实际PPT文件/来源题面/组卷链路、18页适用状态、CSSOM/键盘。旧脚本定位可按已批准当前结构适配，保留断言和失败。
4. 状态表/组件表/配置表/缺陷表/旧36映射/28验收逐项填实证据，最终报告仍模板，不能直接DONE。真实系统125%与历史原厂指纹门禁需诚实处理，先完成独立部分。
5. 本轮报告目录被gitignore：最终仅显式force-add审阅过的report/evidence/contract；不加入DB、用户配置、密钥和profile。证据文件引用与sha校验齐全。
6. 正常push HEAD:main、核实远端包含、实际启动验证过最新版。全部必选PASS才UI_R1_DONE；确实不可自行解除依赖时BLOCKED并给恢复入口，不能因难/慢/剩余工作多假阻塞。


## 后续实证更新（2026-11-25，替代上文过期待办状态）

- 已提交9c3c414、正常合入origin/main2266b53（合并7a17b31）、c2d93a7。最后仍有原生选择器line-height与模型保存按钮contrast opt-in两行修复，等待最终构建；不要重写此前已过业务。
- main整合构建/再次完整smoke exit0，207项底层/组件计数及真实Electron完整前端流程、各状态与30学生/资料等readback见logs/smoke-main-final.log；DOM操作后实际文件，非真实provider所有分支。该构建7a17与c2d仅样式/className受影响，后续必须说明复用边界。
- 实际题组闭环已过5项：evidence/paper-current-ZYV2rN/report.json。使用保留的20个界面手输测试题事实，选题自动建篮→本卷实例编辑→确认→真实DeepSeek导出Word/PDF→独立文本/文件哈希/答案隔离→每次返回同题篮。旧paper脚本引用旧自动蓝图入口，失败保留；撤销了尝试适配它的共享脚本变更，改为独立当前UI验收器。没有降低20题/6文件的旧断言。
- 实际PPT已保存，先前live-final失败是QA假定输入工作目录就是输出目录。真实路径在document_artifacts.file_path受管XiaozhiOutputs；标题在docProps/core.xml而不是自动改第1页标题。cold-readback-3通过：evidence/ppt-readback-kY8fCA，原生产UI冷启→当前文件预览→原会话返回，0 HTTP；原PPT三页由本机PowerPoint COM只读打开并渲染，evidence/ppt-native-open，原字节未改。完整自然结束的live脚本已修正QA轮询、路径和就绪条件，最后构建可再做一次。
- 已确认settings搜索/密钥placeholder 4.83:1（修复前3.40）；current nav 8.87:1（前3.06）。Save按钮进一步实测3.59:1，复用既有edu-primary-action-contrast。未配置的model选框原厂禁用opacity0.5属WCAG inactive例外，定向脚本如实登记，不改原厂禁用皮肤。
- geometry证明之前记录为空（队列未进入编辑态），不能使用composer-hEz4EE的空列表宣称几何不变；已把测量移至真实编辑select。composer-l5Pzsu实测宽140 vs132，padding20恢复132；composer-kTiO62实测高24 vs21.333，line-height normal待最终构建复核。事件/枚举/5原断言保留。
- 最新18页57截图仍通过：verification-pages-75wAJf（5状态CSSOM）及verification-pages-oDvt67；normal/hover/current/pressed、24/40px间距已确认。程序focus并不等于keyboard focus-visible，实际键盘定向脚本正在复核。
- 原生125%系统缩放确认存在环境依赖：computer-use技能已读，sky成功inventory，系统Settings不在app/window列表；明确存在SystemSettings.exe但launch_app返回“did not expose a targetable window”，新鲜list仍无设置，进程也不存在。未改系统状态/未动其他13个Harness窗口。evidence/system-scaling-availability.json。150%系统和forced125/150不是同一证据，UIR1-08原生125尚BLOCKED，完成独立部分后最终必须明确此限制，不能DONE。
- get_goal实际读取返回null；没有运行自动Goal，没虚假complete或pause。后续仍须完成28项/状态/组件/配置/旧36映射、指纹旧门禁说明、精确源码与最后运行、文档和正常main推送。
