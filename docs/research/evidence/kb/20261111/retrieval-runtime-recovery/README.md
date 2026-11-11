# 本地语义组件缺失与索引恢复

## 本轮合同

M04/M12。前轮实际修复连续中文召回并推送main，属于progress。当前真实运行语义状态available=false、indexed0、pending8893、error=index_unavailable。实际工作树及main都缺.local-retrieval，冻结测试入口旁也无所需资源，文件ENOENT被泛化成索引故障。

复用已有锁定BGE q8/ONNX Runtime/Python worker、LanceDB、原构建与资源清单、已有索引队列和typed preload/界面。恢复同版本原组件，在隔离构建环境重建本地资产，逐文件校验，冻结开发入口通过既有OMNI_EDU_REPO_ROOT定位所需资源，资源逐文件认证继续执行。生产错误边界将可识别的组件缺失/不完整归为embedding_unavailable，保留真实数据库/运行故障类别。原件、SQLite业务事实、当前索引世代和历史AI回执继续保留。

修改范围预期runtime-command、VectorHost开发路径的必要适配、corpus-flow资源准备与恢复测试，若构建器因解释器路径/下载连接失败则按实际修复已有脚本。没有新业务表/IPC或模型版本，下载仅在准备层，worker维持离线。新建仓库内隔离build environment，不修改现有Conda/用户环境。版本、SHA、许可证及资产体积沿清单记录。

验收为缺失/坏资产的明确状态、完整资产与真实离线worker通过校验，当前冻结Electron从原队列继续向量化，生成可用世代并实际执行语义检索；保持词法可用、暂停/恢复与来源门禁。性能记录从0索引到实际进度、资源和首/热查询，整体10GB/质量指标继续OPEN。若单轮未完成整个世代，保留已验证活进程并继续监控，不能宣布语义检索已经恢复。

build/typecheck、组件246与本轮定向边界，真实现有数据通过原UI/typed preload验证。完整Goal ACTIVE。常规revert回滚代码，资产和派生索引保留可重建，业务数据不降级迁移。没有发布安装包或远端组件资源的授权动作。

## 已完成的修复

已修复两项实际启动缺陷。runtime-command把缺目录/缺文件/不可读组件转换为embedding_unavailable，数据/未知运行错误继续原错误链。VectorHost通过既有OMNI_EDU_REPO_ROOT定位移动后的开发构建组件，正常开发默认路径与正式安装resources路径保留，并对开发相对根拒绝，正式安装忽略该开发覆盖。两种组件根同时覆盖embedding与reranker，逐文件SHA/尺寸/真实路径校验继续执行。

原模型和协议身份不变，现有building世代generation_c1d1ab8a-bebe-440a-b58c-734182a21043直接继续。没有清库或重置世代、业务题、原件、AI回执，也没有新表/IPC/生产依赖。生产变更为runtime-command.ts、vector-host.ts及重建后的runtime-manifest.json，新增kb-retrieval-runtime-boundaries.mjs。

### 实际组件恢复

通过仓库原prepare/build流程恢复同版本Xenova/BAAI BGE-small-zh-v1.5 q8模型及tokenizer，固定模型/词表SHA不变。构建解释器在.local-retrieval/build-python，依赖在独立build-env，版本Python3.12.14、NumPy2.5.3、ORT1.30.0、PyInstaller6.22.3、tokenizers0.21.4。未修改现有Conda环境。

初次直连和代理下载发生TLS连接重置，保留retrieval-assets-prepare.log、retrieval-python-prepare/proxy.log。uv代理重试后取得Python。模型通过curl HTTPS重试下载，固定SHA验收后发布。初次uv默认尝试创建全局Python入口，已有入口拒绝覆盖；随后使用--no-bin --no-registry并只使用本轮仓库内解释器，检查HKCU Python项未发现指向该目录的注册值。后续准备命令须使用本轮隔离参数。

重建产物154文件、126001951B，均通过生产verifyRetrievalRuntime，验证耗时379ms。旧清单156文件/127076474B，工具链根版本与模型相同，本次生成实际字节清单并提交。运行时二进制、构建环境和模型均留在ignored本地目录，Git只提交SHA清单和代码。许可证沿用SOURCE.md与实际冻结包中的Python/NumPy/ORT/tokenizer许可证，模型MIT、tokenizers Apache-2.0等已有声明未变化。没有发布组件或安装包。

### 当前实例端到端

最终main入口SHA256为65ffa4aa5fd6032b5d37640fef5bd825f250a331d0c63022f3b7f62658755db9。沿用221份已导入、328203104B的原data/profile，原目录归档paused。通过原UI暂停folder AI且dispatched=0后关闭，使用新的唯一冻结out目录启动，原building世代恢复。

启动前indexed0、pending8893、index_unavailable；2026-11-11T11:31:34.994Z首次ready采样，indexed1314、pending0、failed0、error空、building空，同世代转active。相对本次11:24:42.373Z启动约412.6秒，采样周期30秒；这包括启动与后台处理，不是纯推理吞吐或大库指标。监控历史保存在retrieval-recovery-history.jsonl，原诊断见上一轮chinese-retrieval-status.json。

实际题本/“按题意找相似题”使用“绳端挂球往复所需时长”，过滤高三/物理，纯关键词对照0命中。真实BGE/Lance混合检索返回原单摆题，semantic.available=true、complete=true、backfilling=false。首次UI3523ms，随后完整typed检索热缓存25ms，均当前小库/限定范围，不能泛化成全库P95。

真实Pi以同一改述实际执行education_search_questions和education_read_question，返回原题号7、答案C与原来源。3次真实DeepSeek请求、整轮约15.37s，实际工具执行检索400ms、实读203ms。回执在retrieval-semantic-native-pi.json与retrieval-semantic-pi-summary.json，原图仍留在本地，读题依据明确为AI转写。

第二次冷启动沿用同一冻结构建，原active世代/1314内容保留，语义查找1342ms，选中题SQLite全行SHA前后相同e50dd4865978f5f8f0b84db099d8d73c7ab132b81dbd0f6e0b3e8c23f44446ad。retrieval-cold-before/after.json保存原始读回。两次启动renderer错误0。folder AI通过原UI恢复running，目录归档保持paused。

### 验证命令与结果

工作目录apps/desktop，日志均位于上述运行根。

| 命令 | 结果 |
| --- | --- |
| `uv python install 3.12.14 --install-dir .local-retrieval/build-python --no-bin --no-registry` | 项目内解释器已就绪 |
| `uv venv .local-retrieval/build-env --python <项目内3.12.14>`及`uv pip install --python <build-env> numpy==2.5.3 onnxruntime==1.30.0 pyinstaller==6.22.3` | 隔离构建依赖就绪，日志保留版本 |
| 设置OMNI_EDU_BUILD_PYTHON为本轮build-env/Scripts/python.exe后`node scripts/release/build-retrieval-runtime.mjs` | PASS，约18.5秒PyInstaller阶段，154文件/126001951B |
| `node --experimental-transform-types scripts/education/kb-retrieval-runtime-boundaries.mjs` | 修改前缺目录用例FAIL保留，最终6组PASS |
| `node --experimental-transform-types scripts/education/kb-semantic-native.mjs` | 8组PASS，真实CPU ONNX/tokenizer/Lance；19对象/46向量，16对象提交194ms |
| `node --experimental-transform-types scripts/education/kb-retrieval-locks.mjs` | 3组PASS，真实Windows并发锁/进程退出重获 |
| `node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs` | 17组PASS，真实SQLite/受控vector端口 |
| `node scripts/education/kb-rerank-host-deadlines.mjs` | 3组PASS，受控startup/send的真实宿主方法 |
| `npm run build` | typecheck及构建PASS，retrieval-recovery-build.log |
| `npm run test:renderer-components` | 246/246 PASS |
| `uv tool run --from pip-audit pip-audit --path .local-retrieval/build-env/Lib/site-packages --format json` | 11项构建依赖未报已知漏洞，结果留存retrieval-python-audit.json |
| `npm audit --json` | 28项已有依赖问题，8high/12moderate/8low |
| `git diff --check` | PASS |

真实用户入口脚本和证据保留在ignored test-results/corpus-flow-1gb/semantic-restored-ui.mjs、semantic-restored-pi.mjs、semantic-cold-readback.mjs，以及运行根retrieval-semantic-restored-live.json、retrieval-semantic-lexical-controls.json、截图和冷读记录。截图/响应含实际题文，不上传Git。没有重发已有题目的OCR/两遍归档，也没有重复旧四份导出或全套共享验收。renderer未修改，本轮实际界面1366宽度，1920未重跑。

## 尚未完成与下一步

1314索引内容代表当前可索引事实，当前221份资料中的待核题/部分PDF仍待完成，不代表1314题正确或全部原件已完整解析。该自然语义用例仅一个合格候选，rerank标记reason=not_needed、processed0，不能证明cross-encoder组件可用。当前.local-reranker资产仍缺，后续需恢复并用多候选实际验证。

整批自然图文、旧v1 Word后台升级、复杂公式与MathType转换、答案册配对/争议修正、自然高召回基准、约10GB规模及普通Windows链式安装/异机迁移继续OPEN。初次UI3.52秒超过2秒试验目标，热缓存数据不覆盖该边界。完整Goal ACTIVE。

本地资产已经重建，源仓库的其他工作树需按既有prepare/build步骤准备匹配清单的资产。正式打包按原extraResources装入组件，本轮没有重新生成NSIS或发布远端下载件。回滚用正常revert，模型/索引格式不变。回退旧二进制时需使用其匹配SHA清单，原业务数据和AI回执保持原文件，派生索引可从事实重新建立。
