# D3-C 公开图片：能力与原生链路前置合同

日期：2026-10-04。承接146/147。总体目标仍是完整教育办公智能体与Codex交互对齐，三元题组暂停。本切片不能作为图片正式入口完成证据。

## 1. 本轮可核验交付

- M01/M10：保留DeepSeek官方目录的`input_modalities`，文本/图片能力来自实际目录，不根据模型名称猜测；缓存仍schema1，旧缓存未知图片能力，不静默补成支持。
- 核当前最新Pi和Hana发行版，比较原生prompt图片预处理、tool-result图片的provider转换；直接复用适用的原源，保留许可、版本、SHA及适配说明。
- 用自行生成的公开合成图，原Pi1.0.2 AgentSession/实际DeepSeek验证视觉内容与tool-result图片传输，不走额外自建视觉循环、不上传学生图或真实资料。
- 正式renderer/main图片上传能力保持关闭。本轮先验证原实现可行性，下一切片才接明确用途、教师授权、当前附件版本与真实传输回执。

## 2. 现状及缺口

140/141及WEB_CONNECTIVITY_RECOVERY验收：浏览器、原生自动压缩、无累计预算与实际缓存计数已交付。143按ID正文实读、147本地OCR校正已交付。本轮实际官方目录HTTP200：Flash支持text/image，Pro仅text；原model-capabilities投影丢弃该字段，Pi正式input=text、blockImages=true。

图谱已索引但当前model-capabilities符号未覆盖，精确文件查阅作为补充。不得以原Hana旧“Pi不预处理prompt图片”的注释替代当前1.0.2实际源码。

## 3. 修改范围与兼容

- shared/xiaozhi-agent.ts：可选inputModalities，未知时省略。
- main/xiaozhi-agent/model-capabilities.ts：官方严格解析与安全缓存往返；不改目录URL/限额/TTL/模型移除规则。
- scripts/xiaozhi-agent：原源核验、能力边界与实际原生视觉预验；产物只放owned test-results，公开报告不含key、base64或私有完整请求。
- 可新增固定原源vendor及source manifest，零新依赖。Pi MIT/Hana Apache-2.0；当前四Pi包1.0.2已安装，Windows安装包仍P08待验。
- 不新增表/IPC/renderer文件端口，不维护真实profile、不重写运行中的out、不删除或改写旧native。

## 4. 验收与下一步

目录边界包含缺字段、非法/重复/未知模态、旧缓存、冷读取、stale、官方移除；原自动上下文边界保持通过。视觉须检验图内随机码及颜色/布局，不能只检查HTTP200；tool-result须证实实际provider收到user image_url且模型作答，不把工具开始或本地缩略图写成已查看。

执行隔离build、renderer组件、相关smoke及git diff --check。记录准确成功/失败、未验证正式UI和图片授权的范围；四根与26/28/35/67同步。下一唯一动作：基于已验原native管道冻结正式D3-C授权合同，贯通附件ID/version/hash→明确公开/不含学生数据的教师声明与用途确认→实际Pi图片→可靠回执/失败停止/冷恢复，再D4/E/全D1–D7/P08。权限与来源规则优先于缓存命中率。
