# 旧基线启动准备

2026-11-17，旧基线 `d50ef330f0f9c4995cc7e096e85bd8fd93629c83` 的独立依赖安装、构建及启动预检通过。真实模型质量与时延 A/B 尚待 Phase8 执行，付费请求为0。

## 实际执行

工作树为 `C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject`，detached HEAD。依赖与输出均在此树内重新安装和构建。

```powershell
cd C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject/apps/desktop
npm ci --proxy= --https-proxy= --registry=https://registry.npmjs.org/
node node_modules/electron/install.js
npm run build
node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-baseline-preflight-20261117.mjs
```

四个命令均exit0。npm ci实际安装1181包，报告既有29项advisory，8 low、13 moderate、8 high。Electron官方安装器从已校验的43.8.3缓存安装到本树，锁文件SHA256为 `539328b91e79b02f7cd903f2bf92f24d5ae779f64f63ded01d60be861a6b47be`。

## 预检结果

- 真实Electron43.8.3、内置Node24.22.0，从本树 `out/main` 启动，PID45336。独立TEMP数据和Chromium profile通过原 `assertIsolatedPiMain` 核验。
- Pi聊天工作台和原输入区可见，两个窗口尺寸分别保存截图，renderer error为0。此预检覆盖静态启动，流式交互、拖动和生成性能沿Phase7/8原门禁执行。
- 自有SQLite建立180张表。环境中的模型key与模型ID均为空，没有提交对话，没有真实模型请求。
- 正常关闭后458个构建文件逐项SHA保持，build列表SHA256为 `9339199da66260513af57250be680c31b507d0f6549e4e5d4f545f13648734f2`。预检3/3断言通过。
- 正常build重生成六个Pi vendor文件的LF字节，Git标准化内容diff为空，`git diff --quiet` exit0。其原始文件状态与该树独立构建身份分别记录，后续比较继续使用冻结的实际构建。

`raw-preflight.zip` 保存8个原始文件，包括精确启动脚本、安装/构建日志、报告、构建清单和两张截图。`MANIFEST.json` 保存原始字节大小、SHA256和zip SHA256。

## 后续使用

保留本树作为A侧，不接收新功能。正式A/B前重新核对上述实际输出与锁文件，统一配置、合成数据和全局200次请求账本。B侧等待Phase7最终冻结。完整质量、性能、联网和打包结果仍待独立验收。
