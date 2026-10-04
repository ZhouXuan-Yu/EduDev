# P07-D4图片查看计数与本地缩略图交付合同

日期2026-10-04，承接150/151；模块M01/M10，完整Codex/harness目标不缩减。上一轮完成正式公开图链与真实证据，属于进展；本轮接67参考图“已查看N张图像”展开入口，三元暂停。

## 当前缺口与结果

image_delivery只有callId/title/state，尚无确切附件版本引用；原UI仅准备/交付工具细行，没有按本轮真实图片去重的查看数量及缩略图。现有usePiAttachments已提供原Pro ChatAttachment/Group、受控thumbnail/preview/cancel和本地Modal，直接复用，不造新的图片下载/解码/权限入口。HeroUI MCP当前list及chat-attachment/chat-tool文档已查询，原vendor/CSS保留。Finesse无当前可调用接口，不虚构。

## 纵向范围及兼容

- shared PublicImageDelivery增量optional attachment:{id,revision,version}，只当前捕获事实，不加路径/base64。main原runtime准备时写真实版本，后续notify保持；原事件持久化/投影沿既有链，无新表/迁移/IPC/依赖。
- 只state=received且有效版本的真实receipt进入计数。每turn按ID/revision/version去重；重复同图调用、工具开始/准备/正在发送、失败/停止/拒绝、列表/本地预览/OCR文字均不增加。received证明模型实际接收并有效响应，不保证视觉内容正确或教师已确认答案。不同图或新版本独立计。
- renderer每turn一次原ChatTool disclosure“已查看N张图像”，展开复用原附件缩略图Group。点击当前确切版本打开原本地Modal，无API/自动上传；没有current元数据/旧回执缺版本不根据标题猜身份，显示无法关联/历史回执说明。源/原公开分段过程与工具细行保持，用户可区分本地预览与模型交付。
- 新会话/冷恢复计数来自该turn真实持久receipt，原grant仍run-scoped。展开状态只本地，无额外模型请求/权限。旧151及更早native/profile不维护、不改原字节，不补写猜测version。关闭/切会话/归档/迟到预览沿现有cancel与epoch。

## 验收及回滚

严格计数边界（多图/同图重复/新version/非法ref/旧无ref/各失败状态）+真实ElectronStore/utility持久引用+正式原Pi/DeepSeek单图和多图两native。真实“+”发送，确认前零已查看、收到后正确计数/本地thumb/实际Modal、拒绝/停止不增加、冷恢复原native/receipt保持且点击预览不新增provider请求；旧fixture副本兼容。真实API内容仍严格图内码/图形，错误不降断言。同构建失败永久记录，分层A/B/C与日常D/无VPN安装E分开；不替用户关闭反馈或宣称人工已验收。

使用新的isolated build，不重写标准out或终止用户33640。门禁typecheck/build、renderer-components、专项、isolated主smoke207与git diff --check；不扩大无关回归。通过后153验收、四根/26/28/35/67及source-only档案。可关闭renderViewedImages入口回退，真实receipt/version仍保留。下一E持久goal，再全D1–D7/P08无VPN/安装/最终八组，整体仍NOT_ACCEPTED/active直到实际完整验收。
