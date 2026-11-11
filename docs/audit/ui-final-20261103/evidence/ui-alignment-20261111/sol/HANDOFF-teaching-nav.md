# 教学导航 R1

本项为用户新确认的教学主五页导航差异修复。触发证据为final-teaching-default/lessonbook/handout-1366x768.png及原型resources.js/pages.css/tokens.css。沿用paper R2记录，本项单独计为教学导航R1。源码已冻结，根会话统一下一构建，实际GUI另验。

## 新授权写集

- apps/desktop/src/renderer/components/product/WorkbenchPageNavigation.tsx
- apps/desktop/src/renderer/ui-system/workbench-page-navigation.module.css

static-check-teaching-nav.json与static-check-current.json列出本writer累计24份renderer源码及SHA。teaching-nav-before.json保存本项写入前的22份owned源码、原导航文件及u5 CSS身份。

## 实现与边界

新增原生button/nav分支只在view为teaching或isTeachingPage(view)时使用，覆盖教学文件、备课本、讲义、题本、组卷五个原路由。默认teaching继续选中artifacts。每个按钮沿用navigation.navigate({view:id})，继续经过原guard、历史、dirty和失败提示路径。

原teaching-page-navigation、教学工作台页内导航名称、全部hub-entry-*与aria-current=page保留。这里仍是路由导航，按钮采用原生Enter/Space激活，保持常规Tab顺序。旧学生七路使用原Button和u5样式分支。

CSS依据原型pages.css .tabs与tokens.css设置23px间距、22px下间距、11px垂直padding、14px/1.55 Segoe文字、2px选中下划线、#2563eb选中色、hover #eeeef0、active #e2e3e7。800px以下间距17px并横向滚动。focus-visible为2px蓝色轮廓，offset -2px使轮廓留在可滚动容器内，供实际键盘复验。

新模块通过显式import加载，位于原适配器豁免的ui-system目录。实际nativeComponentBoundary运行后CSS逐字节相同，字体/颜色/边框保留且没有生成legacy scope。模块规则仅匹配自己导出的navigation/item类。

ProductSpaceShell与paper-studio CSS的原wrapper隐藏规则保留其SHA。paper题篮页面仍通过page:has(paper-basket-workspace)隐藏pageNavigation wrapper，五个旧页内导航处于该wrapper内。原paper工作区结构继续按其既有构建证据和复验记录核对。

## 验证与证据

- node test-results/ui-alignment-20261111/sol/static-check.mjs，exit0，明确24路径解析、模块引用和hash检查通过。其它writer授权scope在清单中注明，由根汇总核对全树diff。
- git diff --check -- src/renderer/components/product/WorkbenchPageNavigation.tsx src/renderer/ui-system/workbench-page-navigation.module.css，exit0。
- teaching-nav-check.json记录实际PostCSS适配器保留完整新CSS、22份其它owned源码与u5 CSS hash相同、新旧navigation.navigate参数AST一致三组PASS。
- node --experimental-strip-types test-results/ui-alignment-20261111/sol/teaching-nav-check-transpiled.mjs，exit0，SSR 13/13。默认教学及五路选中通过，旧学生七路输出分别与HEAD原组件逐字节一致。终态保存在teaching-nav-render-check.json和teaching-nav-check-transpiled.log。

## 下一构建实际复验

沿原teaching-page-navigation与hub-entry-*定位，验证默认/教学文件/备课本/讲义/题本的下划线和Hover/Focus/Active，三尺寸可达与横向滚动。点击每个hub-entry确认原路由和guard，dirty取消/保存、回退与恢复继续原业务断言。进入paper题篮时验证原五导航wrapper隐藏，同时原四个paper tab与工作区结构保留。旧学生七路及已通过的新学生六tab分别使用原回归入口核对。

当前只取得源码、PostCSS与SSR层证据。真实截图、computed style、操作、性能或包体变化等待根下一构建。回滚限定本项两文件，保留paper R2、应用输入外框授权、其它writer源码和业务数据。


## 补充SSR夹具修正

首次teaching-nav-check.mjs的实际nativeBoundary/hash/导航参数检查通过。旧源码虚拟模块因TSX未转译，在Vite import-analysis失败，保留原teaching-nav-check.log。已仅在teaching-nav-check-transpiled.mjs的QA loader中将HEAD对照源码转成JS再加载，SSR断言和生产代码保持本轮冻结身份。第二次执行日志为teaching-nav-check-transpiled.log，终态以teaching-nav-render-check.json为准。

修正QA loader后，本轮补充SSR终态为13/13、exit0，实际nativeBoundary/hash/导航参数检查继续通过。原夹具失败日志保留。源码自宣布冻结后保持两文件最终版本。
