# D2-B 正式附件入口实施细化

2026-10-04。沿132§3完整合同、133入站底座和135后续；模块M01/M10。本轮直接接正式主进程→typed preload→原Pro卡片和本地预览，保留132§4发送/D3/D4完整范围，不把本地可见当模型可见。

## 接线与验收

严格附件v1请求只有schema/session/requestId及必要ID/revision；native picker具体路径仅main，最多8个实际槽/期限/取消，迟到工作结束前owner保留，归档/关闭后不登记。原host choosing锁同步预留，停止/退出取消附件作业；原目录菜单独立。选文件/去重/部分成功/大小类型错误/本地预览/移除/跨会话/重启和两native尺寸从真实页面操作，副窗口/子frame拒绝。

图片采用原Pi0.80.3 resizeImage（Photon0.3.4已在Pi依赖）在固定Electron utility里解码并缩略，避免主进程同步图像解码。原Hana model-image-preprocess也使用Pi resizeImage，但其模型上云policy不用于本地预览。图片入站前验证解码；不新增模型调用/学生图上传。复用原document-host的进程期限/取消/实际exit释放机制为共用local-utility-host，图像与文档共8槽，最小系统env不拿密钥；固定image-worker entry，协议严格/输入4MiB、单边8192与1600万像素、缩略192px/256KiB。PNG/JPEG/GIF/WebP按已有附件格式实际核验。

现有transitive image-size2.0.3（MIT/纯JS）改为精确直接依赖，只做解码前header尺寸限制，不以header成功当实际解码成功。当前目录体积和许可证在137按实际安装记录；既有包不复制新的原生addon，Windows需随固定worker/既有Photon WASM打包，安装包仍P08另验。Pi原API/原库体不改，失败不回主进程解码或给模型传图。

原PromptInput.Attachments/ChatAttachment/ChatAttachmentGroup和HeroUI Modal/Markdown直接接真实SQLite草稿。MCP chat-attachment/prompt-input/modal与CSS已查询；本地原组件Name/Preview/Remove、原CSS/utility保持，新增仅产品数据/焦点/状态适配；不能声称Codex官方同源。Finesse当前没有可调用接口，沿67已核0.20.0设计闭包。

D2-C前附件为待发送草稿，正常发送不得静默丢附件；页面明确保留待发送并阻止该组合发送。运行中原普通文字队列/停止保持，附件不能混入文字补充。完成B后下一直接132§4持久发送准入/消息-run绑定，而非停在这个暂时状态；然后D3/D4/E/全D1–D7/P08/未知参照。

最终build/renderer79、实际native/页面/相关Office预览及关键主smoke、diffcheck；失败/精确命令/截图/范围写137和四根/26/28/35/67。只owned合成数据，不动真实用户窗口/WPS/DB/凭证或系统DNS/代理/VPN，不提交/push/子agent。原132回滚/旧数据增量规则保持。
