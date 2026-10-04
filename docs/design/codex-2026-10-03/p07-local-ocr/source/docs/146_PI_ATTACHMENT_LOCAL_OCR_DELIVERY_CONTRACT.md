# D3-B 本地OCR、教师校正和必要脱敏交付合同

日期2026-10-04；M03/M10，承接144/145真实Windows英文失败与完整active目标。普通请求不启用子agent。三元题组暂停。原浏览器、Pi1.0.2压缩、无累计预算及缓存已140/141，不回底座反复验证。

## 目标与当前缺口

教师在当前小智附件入口选图→本地识别→查看原图及原始识别文字→编辑/确认或拒绝→发送/读取必要脱敏正文→真实Pi继续回复与来源。学生原图与待校正文字不入模型/public question/native历史；教师可修正和拒绝。自动OCR不等于确认。

现有capture/attachment_state及原Pro入口/preview/registry/once可复用，Pi文本读取图片返回needs_ocr。缺真实OCR worker、版本化本地校正事实、typed教师校正入口、批准后按ID必要文字读取与恢复测试。原PsOcr清晰英文错误不作为主引擎，先同图实测RapidOCR。

## 源码、依赖与Windows

PyPI当前rapidocr3.9.2，Apache2原实现，wheel27,275,208bytes；onnxruntime1.30.0 CPU(MIT)，Python3.12 win_amd64 wheel14,311,470bytes。明确CPU单机，不用GPU服务/外部OCR API。精确锁运行传递依赖和模型源/SHA/许可后才生产启用。PyPI与GitHubmain配置可能漂移，以安装精确wheel原source/model/default为准，不引用main新版本冒称当前能力。

先在ignored test-results独立Python3.12环境实测，不修改Codex/Conda共享Python环境。随后以PyInstaller6.22.3(GPL带分发例外，仅构建工具)生成拥有独立Python的onedir OCR runtime，开发/打包通过固定私有路径加载，不依赖用户安装Python/Codex。只安装本地依赖/下载开源模型，不更改系统语言包/网络/第三方凭证。记录完整体积/许可/Windows实际运行，安装包仍独立P08验。

原RapidOCR模型预处理/检测/方向/识别直接使用SDK，不重写OCR算法。禁运行时联网拉模型：明确本地三个模型路径及实际模型hash，自检缺失/篡改时失败；requests/socket在worker中禁用且缺模型不尝试网络。合成中英文同8v4Ggn源图严格实测，不改原fixture掩盖错误。手写/公式仍教师校正，不承诺自动正确。

## 纵向实施与修改面

1. 新shared严格OCR命令/result/engine schema，id/revision引用原captured附件，不暴露路径/脚本/原始bytes。固定worker/host用最小环境、boundedstdout/stderr、实际子进程退出/取消、源前后verify；资源尺寸/单次超时是保护，不是累计任务预算。
2. 增量本地OCR表以session/attachment/version/contentHash/engineIdentity为事实，状态processing/review/approved/rejected/interrupted与revision CAS；原始识别和教师修正仅private存储。新旧DB幂等初始化，冷启动中断processing，不自动识别/重新确认或上传。拒绝不恢复为批准，资料/引擎版本变不能用旧批准。
3. typed preload/main主frame约束→原附件hook/当前Modal增加真实OCR和校正，不在App/db/index大段堆领域代码。HeroUI MCP先核Modal/TextArea/Button，沿原组件/CSS，保留原预览/文本实读入口。
4. office_read_attachment沿原real message/run/submitted/capture/current取消，仅对approved且源版本一致的本地OCR返回必要修正文字，再原sanitizeOfficeDocumentText脱敏。待确认/拒绝返回明确教师操作指引，不将原始OCR塞ask_teacher公开问题；原Pi1.0.2单loop/once/缓存/压缩保持，独立能力identity兼容旧JSONL。
5. 前端识别/加载/待校正/确认/拒绝/停止/失败重试有稳定控件，两native尺寸可达；真实默认工作目录与capture分开。批准/拒绝单事实，停止/归档/跨会话/版本变化均不能迟到批准。

## 验收与回退

严格合成中英文实读/缺引擎模型与禁网络、原native SQLite迁移/旧数据/CAS/拒绝与停止、正式Electron从原“+”操作校正/脱敏→官方DeepSeek/Pi回复，冷恢复保持且无上传学生原图；8v4Ggn原合成图同源比较必须通过。npm build、renderer组件及关键路径主smoke、git diff --check；明确命令/结果/失败/未验范围。用户窗口活着时isolatedbuild/测试profile，禁止强杀或凭证维护。

保留原表/原文件/旧native身份及JSONL，新增OCR能力可失败closed或禁用，不能覆盖正式题目/产物。D3-C公开图Pi视觉、D4真正查看回执、E/全D1–D7/P08为后续，不把本轮OCR等于全部完成；首次引擎/模型硬件问题不因难度暂停整体goal，按证据修复。
