# D3-B/C源码预验：真实Windows OCR结果与下一选型

日期：2026-10-04；合同144。**生产OCR/教师校正/公开图Pi视觉仍未完成。** 本阶段为实际引擎与源码预验，完整目标active。未改主进程/preload/renderer/SQLite/生产依赖，未更新out或真实凭证。

## 1. 当前用户要求的交付已核实

140→141的office_browser真实Electron DOM/ref/动作/教师确认/停止恢复、Pi1.0.2原自动压缩、取消累计运行预算、Hana450 cache-prefix和真实DeepSeek缓存仍是当前实现。官方latest本轮仍指向这两个版本。两条复用核验命令本轮再次exit0：

```powershell
cd D:\WorkProject\EduProject\apps\desktop
node scripts/xiaozhi-agent/reuse-hana-browser.mjs --verify
node scripts/xiaozhi-agent/reuse-hana-cache-prefix.mjs --verify
```

原真实浏览器native15/UI11、自动压缩live8/旧副本UI6、缓存四请求后三次94.8148%、renderer79/主207属于141既有验收，本阶段未重复运行，不称新验收。当前实际源码仍通过production-host注入browserTools和原ask_teacher确认，Pi嵌入运行，不接Codex CLI。独立无VPN/Windows安装仍未验。

## 2. 原源与环境实际核验

- 官方PsOcr tag1.1通过GitHub只读API解析为commit `0e25eb553d57077193d186eb447815330d7c8c99`。直接下载该commit原root.psm1/manifest/LICENSE，byte原样调用，不Install-Module。共7333字节，MIT，模块1.1.0，无额外npm/Python依赖。
- root.psm1 SHA `de10fa8c23a0d39ac6e909328d567500911f5f950ad27de2eadb7e244fdccb21`；manifest `8589111eb5082d0fbcdc3068053fa98f22ab2608f58b96083afaec7413bfa849`；LICENSE `a8245e0c251cd76d53abcd3de1ab49a8af2fb4256706f6803d38f9ec2a4a3fed`。
- 固定Windows PowerShell5.1在当前电脑实调Windows.Media.Ocr，中文语言 `zh-Hans-CN`，最大尺寸10000。使用最小Windows环境及stdin JSON；OCR过程中没有fetch/API调用，未改语言包或系统网络。
- 原上游需要PS5.1 Desktop；没有采用windows-ocr二次包装宣称的PS7自动选择，原源码说明PS7不支持这一WinRT方式。二次包装重复/连接粘贴代码未直接采用。
- Hana当前read-image-vision、model-image-preprocess、chat-image-send-preflight已查看：区分native-image/text-only/unknown，支持辅助视觉、资源哈希和Pi原resizeImage。当前小智仍文本模型+blockImages=true，不能把先前直接HTTP synthetic probe作为Pi视觉完成。
- RapidAI/RapidOCR官方仓库有中文/英文及离线ONNX方案、源码/模型许可证分开记录，当前未安装模型/包，未确认Windows实际识别或安装包体积。需下一阶段实际比较，不能用README精度说法替代结果。

## 3. 真实合成图片识别与保留失败

```powershell
cd D:\WorkProject\EduProject\apps\desktop
node scripts/xiaozhi-agent/pi-local-ocr-feasibility-smoke.mjs
node --check scripts/xiaozhi-agent/pi-local-ocr-feasibility-smoke.mjs
```

脚本只生成1400×400合成印刷图片（无学生数据），上游模块真实识别三行。最后 `8v4Ggn`：OCR子进程exit0、无超时/超量，但**严格内容预验3/4，通过中文/数字短码/37时长，英文OFFICE失败，因此测试脚本exit1**。图像实际已看，清晰OFFICE并无绘图损坏，中文引擎识别成 `OFF ℃ E`，不归一化为正确英文掩盖问题。原图、实际文字、原源、report保留ignored测试根，不公共归档。

前次7QgqMa子进程exit0但中文失败：PS5.1无BOM时把UTF-8中文脚本按ANSI读取；增加UTF-8 BOM后中文真实通过，英文错误仍存在。最早JS模板含PS反引号导致SyntaxError，改Environment.NewLine，最终node --check exit0。未将早期失败删掉或改断言为已识别英文。

当前结论：**Windows引擎可真实本地识别中文/数字，但本阶段中英文准确性门禁未通过，尚未冻结为生产主引擎。** 手写、复杂公式/表格、扫描PDF页及倾斜图片没有测试；不能承诺准确。此结果也说明教师校正必须存在。

## 4. 状态与下一唯一位置

四根及26/28/35/67已同步本阶段有限范围，不推倒之前交付。原65252本轮实际查询已不在，未强杀，退出原因未知；本阶段未启动/操作真实教师会话。无产品代码更改，因此未重复build/renderer/207测试；收尾git diff --check按实际返回，无提交/push/子agent。

下一唯一动作：**对正确RapidAI/RapidOCR当前原实现/模型许可证、Windows运行和体积做实际合成中英文比较，再冻结生产OCR引擎；随后D3-B共享契约/增量事实/typedIPC/原Pro教师校正→脱敏必要文字完整用户链，再D3-C公开图明确授权与真实Pi视觉/D4回执。** 不继续调整同一清晰英文合成样本以制造WindowsOCR全过；不让学生图片用云视觉补救。E/全D1–D7/P08保持active。

来源：

- https://github.com/TobiasPSP/PsOcr/tree/0e25eb553d57077193d186eb447815330d7c8c99
- https://github.com/RapidAI/RapidOCR
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine
- https://github.com/liliMozi/openhanako/releases/tag/v0.450.0
- https://github.com/earendil-works/pi/releases/tag/v1.0.2
