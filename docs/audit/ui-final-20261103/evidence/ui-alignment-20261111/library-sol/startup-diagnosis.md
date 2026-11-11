# Owned启动只读诊断

2026-11-11。读取启动器、4份运行记录、冻结main产物及实际依赖入口。资料库7份生产文件与最新source-check.json逐项同SHA256。当前PID172252对应after-teaching-out，本次只读取现有日志和文件。

## 后续真实探针结果

本节补记根后续owned运行，下面的初始诊断、当时PID及探针草案保留为历史。本次只补记已有运行证据。

### 原生锁探针 UPRzpL

`after-runtime-UPRzpL/native-startup-probe.json`记录Node24.22.0、Electron43.8.3，requestSingleInstanceLock为2.8848ms，CPU user/system均为0。startup.json中before-main-import为394ms、after-main-import为51489ms，区间51095ms，window-created为51974ms。这次原生锁计时已将锁调用对长延迟的贡献限定到毫秒量级。

### 模块与文件读取探针 TuDQbv

证据为 `after-runtime-TuDQbv/{module-startup-probe.json,startup.json,observed-errors.json,stderr.log}`。helper在首次browser-window-created停止，观察窗口45260.3147ms，moduleHooks与四个native包装及fs.readFileSync均成功安装，observerErrors为0。

startup.json记录app-ready为87ms、before-main-import为93ms、after-main-import为44965ms、window-created为45259ms。根记录的约44.97s对应after-main-import相对started的读数，相邻import标记差值为44872ms。下表统计覆盖整个helper观察窗口。

| 操作 | 调用次数 | 累计墙钟ms | 累计CPU user/system ms |
| --- | ---: | ---: | ---: |
| fs.readFileSync | 2661 | 39389.3937 | 1004 / 864 |
| load | 2962 | 39617.5412 | 1004 / 880 |
| resolve | 8432 | 3823.3186 | 1386 / 1140 |
| app.setPath | 4 | 0.1014 | 0 / 0 |
| app.setName | 1 | 0.0134 | 0 / 0 |
| app.requestSingleInstanceLock | 1 | 2.5955 | 0 / 0 |

app.setAppUserModelId包装已安装，本轮totals未记录该方法调用。resolve有3次throw，fs.readFileSync和load的throw均为0；resolve计数本身不足以判定应用错误。

最慢的配对记录包括jsdom/lib/generated/idl/CSSStyleProperties.js，load为200.4172ms、其内fs.readFileSync为200.2878ms；@bramus/specificity/dist/index.cjs的对应值为132.3595ms与132.2673ms。两对记录的起点及耗时均近乎重合，显示文件读取包含在load观察区间内。load与fs墙钟、CPU累计值具有嵌套关系，应按同一段加载工作解释。resolve也需要结合调用时间轴理解嵌套，三个累计值直接求和会重复计算。

同步读取累计墙钟约39.39s，其累计当前进程CPU约1.868s。测量把主要耗时进一步定位到大量外部模块文件的同步读取调用边界。该边界还包含文件系统处理、文件缓存/缺页、调度及等待等成本，现有数据尚未分离物理磁盘访问、系统缓存、文件系统过滤或安全扫描的贡献。Defender归因仍待对应OS级证据，当前证据只支持记录同步读取路径上的长墙钟等待。

`observed-errors.json`确认attachedBeforeMain=true，至window-loaded时consoleErrors为0、httpAttempts为0、processEvents为0、dropped为0。独立stderr在15:51:03.756另有一次Network service crashed or was terminated, restarting service。两个观察通道及其覆盖范围分别保留；该Chromium消息与本次读取等待的因果关系仍未确定。当前数据将原生锁贡献限定到毫秒级，并直接显示主进程模块文件读取的累计成本，UI源码归因仍缺乏对应证据。

### 最终helper身份

`library-sol/owned-startup-probe.cjs`与TuDQbv实际加载副本的SHA256逐字相同，均为 `8a1de6db800f35e1907d65845707669a620efb3e828c6d359cca3cb8699b9b0f`。最终 `node --check` 为PASS。本次补记结束此可选探针子任务。

## 已核实证据

### 延迟所在区间

数值均来自各runtime目录的startup.json，单位ms。最后两列由相邻phase相减。

| runtime / PID | app-ready | before-main-import | after-main-import | window-created | import区间 | import后到建窗 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| before-runtime-68U2XG / 176432 | 122 | 131 | 5734 | 6462 | 5603 | 728 |
| after-runtime-KLgvvJ / 50944，after-verified-out | 121 | 128 | 43569 | 43996 | 43441 | 427 |
| after-runtime-xbWjZw / 58540，after-repair-out | 144 | 152 | 53446 | 53814 | 53294 | 368 |
| after-runtime-WGBCYX / 172252，after-teaching-out | 430 | 438 | 42079 | 43478 | 41641 | 1399 |

`scripts/acceptance/zero-network-bootstrap.mjs` 第33～42行按顺序记录app-ready、接入defaultSession的webRequest拦截、before-main-import、await import(main)、after-main-import。现有数据中，app-ready到before-main-import仅7～9ms。计时区间包含ESM解析/链接/依赖加载/模块顶层执行，以及期间可能交错的微任务。

`after-main-import`记录在整个应用的异步初始化完成之前。正式main在app.whenReady回调中先await selectedBackupRoot，后创建store并await store.init，再注册服务并建窗。因此该phase名称只证明动态import已返回。现有日志把长延迟定位到了建窗之前，同时保留初始化微任务交错这一测量边界。

### 冻结产物差异

| main/index.js | 字节数 | SHA256 |
| --- | ---: | --- |
| before-out | 4343323 | 7b483047ea60d444fdf782bf88324fb098d3f7ba3da61a023e3effdb94f78579 |
| after-verified-out | 4343204 | df58bfabcb6590dad974c2990aa3bfd957f2157035a9983bec8cb7c378ba78de |
| after-repair-out | 4343204 | df58bfabcb6590dad974c2990aa3bfd957f2157035a9983bec8cb7c378ba78de |
| after-teaching-out | 4348759 | 1238dc6a3019acdde038635ba0cd7debd4c53f28fadc52068b1bc7dad3c88904 |

四个main目录均有34个JS文件。逐文件对比，33个文件同名同哈希，差异集中在index.js。index的50条直接静态import相同，包含14个本地块，14块也全部同哈希。其余JS文件包含异步块及worker入口，逐文件比较也已覆盖。

before到after-verified的index差异只有119字节，位置在原KB literal-policy定义附近。具体为移除ISOLATED_BODY_READING常量及两个策略判断中的引用。直接imports与末尾启动逻辑保持相同。after-verified与after-repair字节完全相同，import区间仍相差9853ms。

after-teaching增加5555字节，差异包括KB题目隔离、检索题号约束及解析队列恢复逻辑。其import区间41641ms，比前两次after都短。该变化本身不足以解释三次after共有的长延迟。

### 实际模块加载路径

入口链为现有owned runtime的launch.cjs → 同目录zero-network-bootstrap.cjs → pathToFileURL(各冻结输出/main/index.js)。当前链终点为 `D:/WorkProject/EduProject/apps/desktop/test-results/ui-alignment-20261111/after-teaching-out/main/index.js`。

最近的package.json是apps/desktop/package.json，其中type为module。electron.vite.config.ts的main使用externalizeDepsPlugin。直接静态import仍指向应用的node_modules，冻结build目录的指纹没有覆盖这些外部依赖内容。

以下入口已通过包exports.import或CommonJS解析规则和realpath核对。路径均以 `D:/WorkProject/EduProject/apps/desktop/node_modules/` 为根。

| 包及当前本机版本 | 实际入口 |
| --- | --- |
| @earendil-works/pi-coding-agent 1.0.2 | @earendil-works/pi-coding-agent/dist/index.js |
| @earendil-works/pi-ai 1.0.2 | @earendil-works/pi-ai/dist/index.js |
| @openmaic/dsl 0.11.2 | @openmaic/dsl/dist/index.js |
| jsdom 29.0.2 | jsdom/lib/api.js |
| sqlite3 6.0.1 | sqlite3/lib/sqlite3.js |

其余直接外部入口包括image-size、tar、ipaddr.js、undici、yauzl、saxes、katex。它们在四个产物中具有相同specifier和查找祖先。Pi与OpenMAIC的根exports仅提供import条件，CommonJS的createRequire.resolve会返回ERR_PACKAGE_PATH_NOT_EXPORTED；已依据实际import条件核对入口，该解析工具结果没有成为应用的启动错误。

Pi coding-agent根入口还重导出CLI main、交互模式、终端组件、扩展、主题和图像工具。主进程对根包的静态导入因此具有较广的外部依赖加载面。config.js在模块顶层读取包元数据。图像resize核心所引用的Photon加载位于调用时的异步路径，本次没有证据显示启动进行了图像处理。

本机electron包版本为43.8.3。此次只读脚本的宿主Node为24.12.0，现有startup.json未保存Electron进程自己的process.versions，需要下一次owned探针记录。

### profile/data复用及原生同步边界

三次after的metadata均指向同一原before目录下的data/profile，路径为 `before-runtime-68U2XG/data` 和 `before-runtime-68U2XG/profile`。after-verified、after-repair、after-teaching分别保留duGYWi、Vtjcu7、7pNpMG三个before-state-archive快照。快照哈希不同，证明各轮启动前的保存状态已经随真实操作变化。

launch-owned.mjs第22～49行核对旧owned父PID已退出，然后复制data/profile到archive并验证指纹，再原路径复用。此检查覆盖记录中的父PID，其日志未提供全部Chromium子进程退出与profile文件句柄释放的独立证据。档案复制发生在spawn前，其耗时位于startup.json计时之外。

bootstrap先设置userData/sessionData并创建默认session的拦截。正式main导入时还会执行这些同步顶层动作，after-teaching冻结产物的定位如下。

| 冻结main行号 | 动作 | 可区分的影响 |
| --- | --- | --- |
| 65164 | applyLaunchProfile，检查目录并再次app.setPath | profile路径及原生属性设置 |
| 65280 | app.setName | 原生应用属性设置 |
| 65334 | app.requestSingleInstanceLock | profile相关的原生锁/IPC等待 |
| 65335～65340 | desktopRevision后立即求值openedRevision | 同步读取main/index.js、preload/index.cjs、renderer/index.html并base64/hash |
| 65354起 | 注册并调度whenReady异步初始化 | 首个await及后续初始化微任务可能交错 |
| 65707 | createWindow | 之后才开始本轮窗口及renderer加载 |

desktopRevision直接读取的renderer文件为index.html。资料库CSS和JS由后续建窗后的renderer加载，现有长区间早于window-created。before主进程的KB并发差异已在上述产物比较中保留。

### Chromium network-service日志

三次after各有一条Network service crashed or was terminated, restarting service；before的stderr只有DevTools监听信息。after错误的本地墙钟分别为14:08:39.402、14:44:14.077、15:02:42.925。

以bootstrap文件写入时间作近似参照，三条错误都接近该轮import结束及建窗时刻。该参照还包含文件写入到子进程开始的差值，现有phase也只有Date.now相对值。现有stderr没有网络服务PID、reason、exitCode或崩溃堆栈，无法据此确定错误发生和长等待的因果先后。

## 待验证推断

当前最应优先定位的是主进程import链的环境相关长等待。两类候选均有实际入口可测。

1. profile复用相关的原生锁/IPC或session恢复。复用是三次after的共同变化，requestSingleInstanceLock又位于被测import内部。当前证据没有该原生调用的单独耗时。defaultSession接入只花7～9ms，也没有排除其后异步恢复或其他原生等待。
2. 相同大依赖图在不同冻结目录下的解析、文件读取、V8编译/执行及OS调度。约4.34MB主bundle之外还有Pi根包、jsdom、sqlite3等外部模块。新产物路径、文件缓存、文件系统过滤及其他进程资源占用均可能影响墙钟时间，现有记录没有CPU或文件I/O归因。

现有证据支持把二者作为最小探针的分界点，尚不足以在二者间给出确定根因。前两次after的主JS完全相同且墙钟不同，使“新增UI代码量导致这一整个延迟”的解释缺少对应证据。网络服务错误目前只形成共同出现的相关性。

## 下一次owned启动的最小探针

接入时沿用根当前网络边界、权限、安全选项、启动超时及PID所有权。只在新owned wrapper/生成的bootstrap增加观察代码，并保持正式产物和当前Terra进程的运行现场。

### 第一层低成本计时

- 保留原四个phase，同时增加UTC墙钟、process.hrtime.bigint、process.cpuUsage、process.versions及当前main/profile/data/build标识。每次mark的写文件本身也要测量，防止startup.json同步写入混入相邻phase。
- 在动态import之前包装app.requestSingleInstanceLock与app.setPath的调用计时，使用原receiver和原返回值。方法不可写时记为探针未接入。记录操作名和耗时即可。
- 对desktopRevision的三个已知文件定点包装fs.readFileSync，保持原参数/返回值，并同步内置ESM导出。记录路径和时长、字节数，生产内容保持原字节。
- 加入app的child-process-gone事件，只记录type/serviceName/name/reason/exitCode/systemErrorCode与墙钟。主线程繁忙时JS事件处理也可能延后，需和原stderr墙钟共同判断。Electron官方已定义这些原因及字段。[官方事件文档](https://www.electronjs.org/docs/latest/api/app#event-child-process-gone)

这一层可以直接判断原生锁、三个同步文件读取及bootstrap日志写入是否各自占据长区间。

### 第二层模块resolve/load计时草案

Node支持在入口中先registerHooks，再动态import目标模块。resolve/load观察的是加载边界，模块求值、原生初始化和顶层await还需结合CPU、原生调用及phase。下方草案只供下一次owned wrapper接入，本次未执行。实际Electron进程先做能力检测，并记录versions。[官方模块钩子文档](https://nodejs.org/api/module.html#customization-hooks)

```js
// 放在owned bootstrap内，正式main的动态import之前。
// output/main仍由根现有pins与owned路径校验产生。
const moduleApi = require('node:module');
const probeFs = require('node:fs');
const probePath = require('node:path');
const { pathToFileURL } = require('node:url');
const events = [];
const origin = process.hrtime.bigint();
let dropped = 0;

function point() {
  return {
    wall: new Date().toISOString(),
    elapsedMs: Number(process.hrtime.bigint() - origin) / 1e6,
    cpu: process.cpuUsage(),
  };
}
function observe(kind, id, run) {
  const start = point();
  try {
    return run();
  } finally {
    const cpu = process.cpuUsage(start.cpu);
    const row = {
      kind, id, startMs: start.elapsedMs,
      elapsedMs: Number(process.hrtime.bigint() - origin) / 1e6 - start.elapsedMs,
      cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000,
    };
    if (events.length < 12000) events.push(row);
    else dropped++;
  }
}

// 不预导入生产依赖，保持本次import的模块缓存基线。
let hooks;
let hookErrorCode;
try {
  if (typeof moduleApi.registerHooks === 'function') {
    hooks = moduleApi.registerHooks({
      resolve(specifier, context, nextResolve) {
        return observe('resolve', specifier, () => nextResolve(specifier, context));
      },
      load(url, context, nextLoad) {
        return observe('load', url, () => nextLoad(url, context));
      },
    });
  }
} catch (error) {
  hookErrorCode = String(error.code || error.name);
}

// 原zero-network-bootstrap的HTTP拦截已在此前完成安装。
const importStart = point();
let imported = false;
try {
  await import(pathToFileURL(main).href);
  imported = true;
} finally {
  const importEnd = point();
  if (imported) mark('after-main-import');
  hooks?.deregister();
  const report = {
    versions: process.versions, main, importStart, importEnd,
    hooksAvailable: Boolean(hooks), hookErrorCode, dropped, events,
  };
  try {
    probeFs.writeFileSync(probePath.join(output, 'module-loading.json'), JSON.stringify(report));
  } catch (error) {
    process.stderr.write('owned module probe output failed ' + String(error.code) + '\n');
  }
}
```

现有生成文件是CJS，上段await必须放入其已有app.whenReady的async回调内，用其中的try/finally包住原单次动态import。原after-main-import标记移动到草案中的同名调用，紧邻import返回并位于探针文件写盘之前。output/main使用生成器注入的已校验常量。相对路径、specifier、URL和返回对象原样交给next函数，记录有上限且不在每个模块加载时同步写盘。钩子安装失败会记录该探针能力缺口并沿原bootstrap启动，根可再选择适配方式。

每条load/resolve时长带有嵌套或链接行为，直接累加不能当成总启动耗时。process.cpuUsage统计当前进程的用户态/内核态CPU微秒值，允许多核累计值大于墙钟；网络utility子进程需要独立PID事件关联。[官方CPU计时文档](https://nodejs.org/api/process.html#processcpuusagepreviousvalue)

| 下次观测 | 可验证的方向 |
| --- | --- |
| requestSingleInstanceLock占大部分时间 | 进一步核对owned profile对应的单实例锁、旧子进程与原生IPC等待 |
| 某个readFileSync占大部分时间 | 定位该精确冻结文件及OS文件I/O，结合按PID/路径过滤的现有ETW/Process Monitor证据 |
| resolve/load长、主进程CPU低 | 文件读取、模块路径查找或OS等待候选。继续取得实际文件I/O或线程等待证据 |
| resolve/load短、import CPU高 | 继续定位V8解析/模块求值或外部包顶层初始化 |
| resolve/load短、原生包装短、import CPU低 | 补查依赖顶层await及事件循环等待，并关联network utility原因 |

### profile与代码路径的受控比较

待Terra结束并由根安排下一次owned运行，先固定同一个after产物，比较新profile与从同一关闭快照复制的profile。两轮使用同源、可核对的owned QA data，保留其启动恢复写入证据。两个profile都使用新的owned目的目录，避免操作当前正在使用的profile。

若复用快照明显更慢，再交换顺序复验一次，以识别文件缓存/OS负载的顺序效应。若两者都慢，沿原native/load探针继续定位。随后才补before/after产物交叉比较，并在每轮记录外部依赖入口及选定依赖指纹。

分包import成本若需单测，应在独立owned进程中每次只导入一个目标。先在同一正式计时进程里预导入Pi或jsdom，会使后续main import命中模块缓存，改变原测量含义。现有冻结build哈希和实际node_modules身份均需保留在结果里。

## 本次交付边界

已完成源码、产物、运行记录和依赖入口的只读比对，输出本文件。探针草案只做语法核对，实际probe、CPU/磁盘归因及profile对照仍待下一次owned运行。资料库生产写集的7项SHA256仍与定向修复1清单相同。
