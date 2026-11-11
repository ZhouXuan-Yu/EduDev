# 稳定首页与目的页有限复核

PID 176656；入口 D:\WorkProject\EduProject\apps\desktop\test-results\ui-alignment-20261111\after-startup-out\main\index.js；build d9bb14092fba320280017058c4dbe5ee1a54f7ff86516b9721a8c2466e71e534；目标窗口句柄4464634，native JPEG 909×601：stable-final-native-ready.jpg。仅控制指定进程，没有操作其他窗口。

- 稳定首页：输入框连续三次（间隔350ms）enabled，页面均无“正在同步过程记录/正在读取”，之后采集1366×768、1920×1080、800×768截图。不是先前loading截图。
- 1366首页：sidebar 232px、header 60px，输入外框720×178、1px rgb(227,229,235)、radius16；三个轻量入口均可见，页面仅有左侧aside，右栏默认未见。参考原型审阅条36px、Electron菜单区44px，比较时分开。问小智/新建对话图标分别为message-square/plus。
- 当前实际导航可到资料库（1份合成TXT）、教学工作台（教学文件真实空态）、组卷（两题已保存题篮）、学生工作台（选中合成学生）、设置。各三视口页面截图与DOM/PNG尺寸在 stable-final-manifest.json；18次采样 document.scrollWidth等于clientWidth，检查到的渲染可见控件无超出视口左右边界。这不是对所有滚动容器、动态弹层和全部键盘操作的可达性证明。
- 按根任务提供，after-draft与after-startup renderer逐文件fingerprint同为76e98a35604039f0605996bcf12812e4a92f3af182ff9ce17a4395ce2b5e7dfe；本轮未独立重算，历史纸/学生/教学三尺寸证据保留其原构建身份。
- 本范围没有创建数据、发送模型请求或执行完整journeys；监听从CDP附加后开始，之前未知。本次附加后console.error/pageerror捕获 0 条，不能宣称全程零错误。主进程与预附加观察器由根任务单独汇总。

GUI操作到此停止，窗口保留给用户及根任务。
