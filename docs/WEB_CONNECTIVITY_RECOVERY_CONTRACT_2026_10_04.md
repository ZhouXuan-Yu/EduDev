# 小智真实联网与浏览器白屏修复合同

日期2026-10-04，M10，用户截图故障优先，当前OCR146工作保留。目标是正式小智搜索→打开公网网页→真实DOM/正文与来源可用，失败能看见原因，不依赖用户手动切测试DNS设置。

## 已确认故障

实际真实profile没有xiaozhi.web.v1配置行，旧默认system；当前DNS将cn.bing.com/www.moe.gov.cn/www.baidu.com等返回198.18/15虚拟地址，原公网安全检查正确拒绝，真实历史两次搜索permission_denied。浏览器activate先显示窗口，loadURL失败后没有可见加载/错误页，形成截图白屏。当前系统解析实际API也虚拟IP，但这不能据此允许任意虚拟/内网直连。

实际原Hana AnySearch与当前安全fetch：system三个请求失败；明确alidns返回真实搜索来源、Bing搜索200、MOE302待原重定向逻辑；不能把这个probe或旧141的显式alidns测试称默认流程完成。

## 改动与兼容

1. 联网设置增量auto模式作为未配置默认，保留显式system/alidns与旧revision/关闭偏好。auto使用正常系统公网结果；系统结果全部为198.18/15代理虚拟地址或正常DNS失败时，仅此应用调用已有阿里公开解析，验证返回公网地址并绑定相同IP连接。真实私网/混合公网私网/localhost/local/单标签/凭证URL仍拒绝；取消/超时有效，不改OS代理/DNS/VPN，不上传教师/学生文件。
2. 原HeroUI/Hana联网设置增加自动选项和可理解说明，typed严格schema保持；浏览器已有分组随解析配置变更更新私有proxy模式，不能将旧system连接永久沿用。
3. 原WebContentsView保留DOM/ref/会话隔离/动作确认。增加本地安全loading/error页面，失败不入模型来源/DOM成功回执，不执行远程错误文本或放宽preload/权限；取消真实停止load与连接。错误区分公开解析受阻/连接失败/超时，不一概指称用户未授权。

## 验收与完成定义

新旧配置/schema/CAS/default自动、fake DNS恢复/真内网不回退/取消/DNS错误、实际原Hana搜索和网页正文、原native浏览器安全边界/公网DOM、正式页面默认不改设置搜索与browser、来源/非白屏失败/停止/两native尺寸/重启；真正DeepSeek/Pi调用，不能用夹具代替第三方公网。桌面build/renderer79/相关专项/关键主smoke207/diffcheck精确终态记录验收MD。

当前真实用户窗口66208存在并响应，保留不强杀、不维护凭证、不发送真实教师任务。先独立构建/owned profile验收，确认后交付更新文件，由用户关闭再启动加载新版；不得在正在使用的out上build。若用户窗口自然退出，重新观察后才可更新正常out。旧验收与失败报告保留；不提交/push/子agent/远端资源修改。完整目标保持active，修复后继续OCR146→D3-C/D4/E/全D1–D7/P08无VPN/安装/最终八组。
