# 资料库源码交接

## 定向修复1已冻结

根释放本次实际差异后，已直接查看 `terra/after-library-one-txt-1366x768.png` 并完成本次有限修复。最新检查为32项通过、退出0，当前7文件哈希见 `source-check.json` 与 `static-check.json`。修复前29项和哈希完整保留在 `static-check-before-repair-1.json`，以下旧29项记录属于修复前阶段。

本次生产源只修改3份。

| 文件 | 修复 |
| --- | --- |
| ui-system/material-library/material-library.module.css | 用精确 `:global(.edu-page):has(> .workspace)` 令本页父级padding为26px 28px，800及以下按原型22px 18px。自有mode类显式border-radius为0，保持2px直线下划线与焦点态，并提供disabled反馈 |
| components/product/material-library-ui/MaterialLibraryLayout.tsx | 两个既有应用自有button接入受控modeDisabled，保持aria-pressed、onClick及旧testid |
| components/product/MaterialsWorkspace.tsx | 传入detailBlocked作为modeDisabled；名称SearchField使用官方默认primary外观，原onChange/canChangeSource、disabled与offset重置保留 |

其余迁移路径和验收入口继续按下表执行。静态脚本再次确认原服务/轮询/epoch/dirty数据前缀逐字一致，修复未扩入全局字体或组件样式。最新32项增加本页padding选择器、模式disabled/直线下划线、SearchField默认variant及既有guard/paging核对。

根统一构建与Terra对图待执行，修复后像素/hover/focus及业务终态仍需在新冻结产物上实测。后续按根实际失败定位与释放处理。

## 状态

源稳定可构建。本切片生产写集已冻结为下列7份文件。局部静态检查29项通过，含6份TSX解析、相对导入、全部7份文件空白检查、CSS解析和边界、旧Workspace数据逻辑逐字比较及旧testid保留核对。精确SHA256见本目录 `static-check.json`。

根在所有writer稳定后统一构建、类型与组件检查。Terra执行GUI、视觉与真实业务验收。本切片当前为源码实现及静态检查完成，视觉与业务验收待执行。

已直接查看 `terra/before-library-empty-1366.png` 与 `terra/reference-library-1366.png`，并读取 `terra/initial-findings.md`。真实空库使用合法空态。原型样例资料及其收藏/归档未投影到生产。

## 全部生产文件

| 文件，相对仓库根 | 本轮职责 |
| --- | --- |
| apps/desktop/src/renderer/components/product/MaterialsWorkspace.tsx | 既有服务/状态/guard与新资料库布局的组合 |
| apps/desktop/src/renderer/components/product/MaterialCatalogFilters.tsx | 增加navigation/toolbar放置方式，保留默认完整筛选与legacy loaded-page消费者 |
| apps/desktop/src/renderer/components/product/material-library-ui/MaterialLibraryLayout.tsx | 标题、156px领域导航、查找模式、紧凑处理入口与主区 |
| apps/desktop/src/renderer/components/product/material-library-ui/MaterialLibraryNavigation.tsx | 全库facets目录、AND标签及真实状态快速范围 |
| apps/desktop/src/renderer/components/product/material-library-ui/MaterialLibraryCatalog.tsx | 本领域列表，真实格式/收录状态/更新时间 |
| apps/desktop/src/renderer/components/product/material-library-ui/MaterialLibraryActivity.tsx | 队列摘要、任务控制、保留挂载的批次/诊断/metadata披露 |
| apps/desktop/src/renderer/ui-system/material-library/material-library.module.css | 独立应用布局和领域控件样式，走既有ui-system CSS处理边界 |

components下初版新module已迁到上表路径，六处显式import已同步。历史teacher-library.css、materials-workspace.css及共享material-catalog.module.css仍沿既有引用读取。其他writer的paper、shell、student/settings及既有ANATOMY/科普文档改动由根分别核对，其dirty状态不参与本worker越界判定。

## 旧控件位置与展开路径

### 默认页面与筛选

| 旧testid或入口 | 当前位置与实际操作 |
| --- | --- |
| materials-workspace | MaterialLibraryLayout根。页面名称和h1为“资料库” |
| materials-paper-handoff / materials-paper-notebook / materials-return-paper | 有paperReturn时，标题上方保留原说明及回题本/原题篮动作 |
| materials-import-folder / materials-import | 页头右侧，添加文件夹/添加资料 |
| materials-mode-catalog | 中间顶部“资料”按钮，aria-pressed保持受控 |
| materials-mode-text | 同行“检索内容”按钮，切换继续经过canChangeSource |
| materials-search | 资料模式搜索行。名称/格式查询继续经listMaterialCatalog |
| materials-refresh | 搜索行图标按钮，可访问名“刷新资料库” |
| materials-filters | 左侧导航根；全库facets原语义保持 |
| materials-filter-directory | 左侧教学目录fieldset。原select改成真实目录button。点组内materials-directory-all恢复全部目录。其他目录按钮testid为materials-directory-加encodeURIComponent(catalogKey(目录名))，data-directory继续保存JSON.stringify(真实目录值)，aria-pressed表示当前目录 |
| materials-filter-tags | 左侧标签fieldset。原multi-select改为checkbox列表。每个checkbox的value为catalogKey(标签)，aria-label为真实标签名，testid为materials-tag-加encodeURIComponent(catalogKey(标签名))。逐个勾选仍为AND，最多16个 |
| materials-filter-format / materials-filter-state | 中间搜索行select，原value与selectOption调用可继续使用 |
| materials-filter-clear | 同行“清除筛选”，清空query/offset/目录/标签/格式/状态，并增加原正文resetKey |
| materials-count | 移到列表/检索区底部，显示真实总数、页内数量及本机原件提示 |
| material-加resourceId | 独立资料列表的tr，仍含一个打开资料button。继续读取aria-selected；点击行内button选择 |
| materials-previous / materials-next | 列表下方原Pagination，依busy/fetching/dirty/分页状态禁用 |

1366与1920下目录标签默认可见。800及以下先点新增 `materials-navigation-toggle` 展开目录与标签，随后上述组和控件可见。快速范围“全部资料 / 待处理 / 读取失败”保持可见，分别用 `materials-range-all / materials-range-waiting / materials-range-error`。状态快速范围只更新既有scope.state，与其余筛选继续组合；全部资料执行完整clearFilters。

根适配原验收时保留目录/标签组合与清空断言，目录的selectOption应改为点击目录按钮，标签的selectOption应改为勾选checkbox。清空后的目录断言改为materials-directory-all的aria-pressed=true，标签断言改为checked checkbox集合为空。原fieldset和子控件的disabled语义保留，busy/dirty时不能改筛选。

### 处理队列、批次与诊断

| 旧testid或能力 | 先操作与当前位置 |
| --- | --- |
| materials-queue | 先点新增materials-queue-toggle。展开区内“收录与处理”section保留旧testid，展示真实queue.tasks与“打开资料”动作 |
| materials-progress / materials-stop | busy或后台pending/running时，在折叠外的当前进度条显示。停止收录可以直接点击 |
| materials-notice / materials-error / materials-import-failures | 折叠外，成功/失败/部分失败提示保持可见 |
| materials-task | 选择资料后，详情顶部。原data-status保持，任务须与resourceId及contentHash匹配 |
| materials-prioritize / materials-task-stop | 当前任务为原可操作状态时显示在详情顶部，随原busy语义禁用。先选择对应资料即可访问 |
| 失败任务重试 | 原MaterialBodyAvailability重试入口保留；详情顶部新增materials-task-retry，经原work(true)发送version-bound retry |
| materials-batches | 先点materials-queue-toggle，再点此section内的“文件夹批次与恢复”button。原组件持续挂载，展开不重置恢复状态 |
| material-batches | 上一步后，存在真实批次/错误时由原MaterialImportPanel渲染 |
| material-batch-加batchId / batch-counts-加batchId | 原批次卡及计数，位于批次恢复展开区 |
| batch-pause- / batch-resume- / batch-retry-加batchId | 原暂停、继续、失败重试，按原状态出现 |
| batch-files-加batchId / batch-file-list | 继续点击原“查看文件”；原文件分页、来源路径与状态保持 |
| batch-files-all / batch-files-issues / batch-file / batch-file-retry | 文件列表展开后，全部/待处理、逐文件状态和可重试操作保持 |
| 文件夹AI模式/质量处理及恢复 | 原MaterialFolderAiPanel继续在每个批次内，沿其原有披露与操作，不更改AI服务或数据 |
| materials-diagnostics | 先点materials-queue-toggle，再点此section内“题库归档与检索状态”button |
| material-question-status | 上一步后，原自动归档状态、失败原因及重试失败抽题动作 |
| retrieval-progress / retrieval-status / retrieval-maintenance | 上一步后，原语义检索/维护进度 |
| retrieval-toggle / retrieval-rebuild | 同诊断展开区，原暂停/继续整理、重建索引 |

全局无效队列记录、当前导入失败、当前folderProgress.failed仍在折叠外以实际alert显示。队列摘要在有失败任务时显示“有失败项”。已选中任务的失败原因直接在资料详情显示。

### 详情、metadata与原有子面板

| 旧testid或能力 | 先操作与当前位置 |
| --- | --- |
| materials-detail | 先点真实资料行、真实正文命中或批次/队列中的“打开资料”。有resource才挂载。空库初态改为没有详情DOM |
| materials-detail-close | 新增右上收起按钮。busy/dirty时禁用；handler继续经过canChangeSource并递增sourceEpoch、清空本地选择 |
| material-catalog-editor | 选资料后，先点新增materials-metadata内“编辑目录、标签与元数据”button |
| material-catalog-directory / material-catalog-tags | 上一步后，原目录/标签编辑input |
| material-catalog-save / material-catalog-cancel | 同metadata展开区，原保存与取消 |
| material-catalog-reconcile / material-catalog-message | 同metadata展开区，保存结果不确定时原只读核实、放弃本地草稿及真实回执提示 |
| materials-draft-status | 新增折叠外实际dirty/待核实提示；草稿保持绑定原资料，关闭披露仍保留挂载 |
| materials-overview / materials-background-status | 选择资料后原概要分区，沿原MaterialBodyPanel |
| materials-section-overview / original / content / questions / notes / advanced | 选择资料后原详情导航。具体testid分别为materials-section-加上表枚举 |
| materials-original-open / materials-locate | 原详情头部，查看原页仅在原PDF条件满足时出现；定位文件仍走原host权限服务 |
| materials-first-excerpt / materials-chunk-加chunkId | 概要“查看正文首段”披露及正文内容，原来源标记与OCR提示保持 |
| materials-body-location / materials-body-previous / materials-body-next | 点materials-section-content或由真实来源打开，沿原正文分页 |
| materials-section-original及原预览内部控件 | 点原页分区，MaterialOriginalPreview原实现继续提供实际栅格/页码/原图/识别校对和失败重试 |
| materials-question-detail及原AI/Word内部控件 | 点materials-section-questions，原MaterialAiPanel及符合DOCX条件的MaterialWordPanel继续挂载；原来源、原图、对照、修正、待核和题本门禁保持 |
| material-study / material-study-note / material-study-save / material-study-complete | 点materials-section-notes，或概要materials-study-toggle。原阅读位置、笔记和完成标记 |
| material-study-previous / material-study-next / material-study-question / material-study-ask / material-study-classroom | 阅读笔记内，原前后段、问题和携带来源到小智/课堂草稿的入口；隐私与dirty条件保持 |
| materials-processing-detail | 点materials-section-advanced，原MaterialPdfProgress及处理说明 |
| curriculum-* / curriculum-fields | 原概要中，按原MaterialBodyPanel的已读正文条件挂载MaterialCurriculumPanel。沿原分区/登记入口操作，与metadata目录标签编辑分别保存 |
| materials-ai-restored-source | 从原AI正文引用来源进入时，继续走原validAiTextSource特殊分支及MaterialAiPagePanel，原来源/页/裁图验证保持 |

metadata披露承载的是原目录标签editor。教材/课标来源登记、修订比较、显式采用仍属于原MaterialCurriculumPanel，沿原已收录正文与来源锚点条件出现。其登记、比较与采用断言全部保留。

## 全部能力迁移核对

| 能力 | 保留方式与核验重点 |
| --- | --- |
| 全库目录、标签、格式、状态与AND组合 | 原CatalogScope和全库facets，名称catalog分页及清空原逻辑保留 |
| 名称查找与正文检索两种mode | 名称走listMaterialCatalog；正文原MaterialTextSearch走searchMaterialCatalogBody，保留keyword/hybrid、实际模式、覆盖/待核/索引不完整提示、rerank信息和来源定位 |
| 导入文件/文件夹及后台收录 | 原work、importMaterialsBackground/createMaterialBatch、复用/跳过/部分失败/取消/进度及原件本机语义 |
| 队列优先、停止全部、停止单份、失败重试 | 原stop/control/work(true)与schema/version；当前任务须匹配所选原件版本 |
| 文件夹批次、暂停继续、重启恢复、逐文件失败重试 | 原MaterialImportPanel和MaterialFolderAiPanel，hidden折叠持续挂载 |
| 目录标签编辑与保存不确定处理 | 原CAS/revision/operation receipt、只读核实、取消与pending/unknown guard |
| 教材版本登记、来源比较与显式采用 | 原MaterialCurriculumPanel及原来源锚点/append-only修订条件 |
| 原文件定位、PDF原页/栅格、识别与教师校对 | 原MaterialBodyPanel/MaterialOriginalPreview，保留页码、来源版本、权限及临时文字guard |
| AI还原来源及实际原图/裁图与独立读图对照 | 原MaterialAiPanel/MaterialAiPagePanel及其全部下游组件，未替换原来源读口 |
| DOCX图文和题目整理 | 原MaterialWordPanel及原源重建回调 |
| 正文段落阅读与引用分页 | 原MaterialBodyPanel来源检查和body读取，原页未定位/OCR未经核验语义保持 |
| 阅读笔记、位置保存、读完标记、问小智与课堂草稿 | 原MaterialStudyPanel及隐私、dirty、来源守卫 |
| 题库归档状态/失败重试 | 原MaterialQuestionStatus，状态与收录/检索状态分别展示 |
| 语义索引暂停继续、重建、维护与降级 | 原RetrievalProgress及MaterialTextSearch既有状态 |
| 题本核对及返回原题篮 | 原paperReturn/回调与disabled语义 |
| 草稿、迟到响应与页面权限 | 原Workspace状态机逐字保留；新筛选/模式/选择/关闭handler全部经过canChangeSource。原sourceEpoch/listEpoch/alive/selectedTask/version快照和各子面板epoch保持 |

新处理、metadata折叠均用实际button的aria-expanded/aria-controls与Chevron，body保持挂载。新增代码只投影既有服务数据。全库顺序沿原服务updated_at DESC、id DESC，无新排序请求。

## 静态证据与待验项

在 `D:/WorkProject/EduProject/apps/desktop` 运行 `node test-results/ui-alignment-20261111/library-sol/static-check.mjs`，29项通过，退出0。该脚本只读取明确的7份生产文件和原87a7f9d基线，输出源码SHA256，核对解析、相对导入、CSS边界、旧静态testid与原Workspace核心逻辑一致性。首次解析记录 `static-parse.json` 产生于CSS迁移前，当前最终写集和哈希以 `static-check.json` 为准。

在仓库根执行 `git diff --check -- apps/desktop/src/renderer/components/product/MaterialsWorkspace.tsx apps/desktop/src/renderer/components/product/MaterialCatalogFilters.tsx`，退出0。Git提示Workspace后续会按仓库规则归一CRLF。7份源码的空白检查和当前原字节SHA256另由静态脚本覆盖，新增文件与其他writer文件分开核对。

本目录全部工件为 `CONTRACT.md`、`HANDOFF.md`、`static-check.mjs`、`static-check.json`、`source-check.json`、`static-check-before-repair-1.json`、`static-parse.json`。生产源码以最新7文件哈希清单冻结，后续修改交根协调。

根仍需在统一冻结构建上完成下列验证。

- build、全局类型、renderer组件检查，以及原真实资料库验收脚本的入口适配。
- 1366×768、1920×1080、800×768的首屏、选中详情、目录/标签展开、队列/批次/诊断/metadata、长文件名与键盘焦点。
- 名称/正文两mode、AND筛选与清空、批次/文件失败重试、停止/优先、来源迟到响应和版本变化。
- metadata保存/结果不确定核实、笔记与原页临时文字guard、引用原图、题库门禁、来源修订及应用重启读回。
- 性能前后计时、真实持久化读回与教师视觉接受。本轮保留原轮询频率和服务调用，没有性能实测值。

所有旧真实断言按上表迁移入口后继续执行。原来对目录/标签select DOM、默认空详情DOM、页标题“我的资料”和三张直接可见卡片的断言需随已批准布局更新。

## 回滚

由根按本轮提交限定恢复两份既有TSX并移除4份新增UI模块和本轮独立CSS module，再统一重建。SQLite、原件、笔记和保存回执沿原存储保留，本切片无需数据迁移。
