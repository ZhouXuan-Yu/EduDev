# 重排运行时白名单打包修复

已修改唯一授权生产文件 `D:/WorkProject/EduProject-harness/apps/desktop/scripts/release/build-reranker-runtime.mjs`。最终SHA256为 `9cbef61d741520e7aaf683117de7d6d2a758625d86f820a8a5f8a479047ab0b2`。生产写入已结束，脚本冻结供总控验收和打包。

## 修改结果

构建器读取仓库固定 `src/main/retrieval/reranker-assets.json`，要求原 `base/model-lock.json` 匹配其内容，逐个校验固定资产的文件类型、size和SHA256。PyInstaller的模型数据参数按文件生成，原始model-lock字节独立收录。嵌套相对文件按其父目录映射至 `models`，防止同basename扁平覆盖。

路径校验拒绝父目录、绝对路径、反斜线别名、Windows保留设备名、尾点/空格、ADS、分隔参数符号，大小写不敏感的重复目标及 `model-lock.json` 保留目标。真实路径检查阻断越出模型根的链接父目录，资产和锁本身不接受符号链接。

模型identity、许可收集、sidecar源码、工具链版本检查、其余PyInstaller安装参数和buildInputs路径列表沿原实现。生产runtime manifest、out、模型锁和Git未由本Agent修改。

## 实际构建

独立候选根为 `C:/Users/ZhouXuan/AppData/Local/Temp/rk-wl-83c937b8`。只读复制原下载完成的固定7资产和原锁，未下载模型。

模型源位于 `C:/Users/ZhouXuan/AppData/Local/Temp/rk-595b73fa/apps/desktop/.local-reranker/base`。wheel和tokenizers许可复制自 `D:/WorkProject/EduProject-kb-isolation/apps/desktop/.local-retrieval`。

在TEMP源模型目录放入三个真实无害canary。

| 文件 | 字节数 | 输出结果 |
|---|---|---|
| model_quantized.onnx.download | 11079949 | 未入包、未入清单 |
| unexpected.txt | 28 | 未入包、未入清单 |
| unexpected/config.json | 28 | 未入包、未覆盖正式config.json |

精确PowerShell命令如下。工作目录为候选的 `apps/desktop`。

```powershell
$env:OMNI_EDU_BUILD_PYTHON='D:/WorkProject/EduProject-kb-isolation/apps/desktop/.local-retrieval/build-env/Scripts/python.exe'
node C:/Users/ZhouXuan/AppData/Local/Temp/rk-wl-83c937b8/apps/desktop/scripts/release/build-reranker-runtime.mjs
```

真实PyInstaller6.22.3构建exit0。固定工具链为Python3.12.14、numpy2.5.3、onnxruntime1.30.0、tokenizers0.21.4。

候选为 `apps/desktop/.local-reranker/dist/omni-edu-reranker`，共155文件、397959129 bytes。模型目录恰好固定7资产与原锁，共8文件。155条候选清单均按实际输出重新核对size与SHA，全部匹配。原始完整输出保存在 `build.log`，退出码为 `build-exit-code.txt`。

| 对象 | SHA256 |
|---|---|
| 修复构建脚本 | 9cbef61d741520e7aaf683117de7d6d2a758625d86f820a8a5f8a479047ab0b2 |
| 候选生成manifest | 3707e18b10cc7f76706a795791d8ef56341ee26e6d9bf8148e35704c13320dd1 |
| 候选omni-edu-reranker.exe | 0b7581e977a4a05d11a8e5a0f3f254f1dc0c4b95d244721974c62cb97e8a6c29 |
| 原model-lock.json及候选内同字节副本 | 2d5c383b959749a2a2e326acbeb5e8a88b02302a6df0d75a1c5c330a9c525b04 |
| 本次构建前生产manifest | a31127c41f84dfe54f2b572a398526e7848544ccc877afa994b77b26fe03160b |

候选生成清单位于 `apps/desktop/src/main/retrieval/reranker-runtime-manifest.json`，完整逐文件证明和现锁差异位于 `whitelist-proof.json`。

## 边界与实际运行验证

```powershell
node C:/Users/ZhouXuan/AppData/Local/Temp/rk-wl-83c937b8/verify-whitelist.mjs
node C:/Users/ZhouXuan/AppData/Local/Temp/rk-wl-83c937b8/path-boundaries.mjs
node C:/Users/ZhouXuan/AppData/Local/Temp/rk-wl-83c937b8/packaged-smoke.mjs
```

三个命令均exit0。

- 白名单证明读取真实候选目录与生产构建器生成清单，检查所有155文件、精确8模型文件、原锁字节和canary排除。
- 边界测试12/12。该TEMP小文件夹具导入原字节构建器，拦截子进程调用，用于验证参数映射和拒绝条件。嵌套同名文件目标映射正确，重复大小写、锁目标覆盖、目录越界、绝对/反斜线/尾点/ADS路径、size/hash不符、local lock替换均在编译器前被拒绝。真实junction父目录越界也被拒绝。该测试未执行12次PyInstaller。
- 候选sidecar真实启动使用原 `--parent-pid`，输出原 `xiaozhi.rerank.v1` ready，model/tokenizer hash匹配，随后对两项合成文本返回有限分数。exit0，stderr为空。ready1750ms，实际两项重排31ms，整次1979ms。该样本只证明候选可启动与协议兼容，不代表普遍质量或性能验收。

边界与sidecar报告分别为 `path-boundaries-report.json` 和 `packaged-smoke-report.json`，原始日志保留同名log。

`node --check` 与限定生产脚本的 `git diff --check` 均exit0。没有仓库测试新增。

## 与采用前现锁的差异

候选的模型与许可资产及原model-lock内容全部与现锁一致。manifest.model和toolchain字段相等，buildInputs四个路径列表相等，其中仅当前构建脚本的输入SHA变化。

本批准工具链重新构建相对于仓库现有运行时清单，新增1个文件、移除3个文件、24个文件SHA变化。新增为numpy dist-info/REQUESTED，移除为charset_normalizer的两个pyd和yaml的一个pyd。变化包括Python原生DLL/pyd、numpy安装记录、base_library.zip和重排exe，完整路径在 `whitelist-proof.json.differences`。这些实际字节差异已披露，未通过修改生产清单来掩盖。

总控可以从该候选独立核验后采用。应用安装包和整体发布验收由总控执行。本Agent未发布、未提交、未更新生产runtime manifest或out。

writer释放时复核发现总控已将生产manifest采用为本候选SHA3707e18b。上文差异保持对采用前a31127c4的比较，保留该历史身份。

## 回退

该修复仅涉及一个构建脚本。若要撤回，可由总控恢复该脚本前一版本。TEMP候选和残片canary保持可检查，不会在生产启动中读取。
