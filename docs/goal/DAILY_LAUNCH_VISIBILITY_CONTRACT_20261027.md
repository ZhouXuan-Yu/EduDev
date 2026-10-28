# 日常启动窗口可见性窄范围合同（2026-10-27）

## 2026-10-28 主线发布授权与范围

用户本轮明确要求将本地代码与分支代码推送main并解决冲突，覆盖上一轮“不提交/push”的限制。本次仅集成本审阅分支的启动修复；不接管D:与beca的其他分支或脏改动。

已fetch origin/main：076edd1是本地main/93c6ac6的祖先，main领先99提交、落后0提交；因此此次推送会包含既有99提交及本次修复，采用正常fast-forward，禁止force。推送前再次fetch检查，若远端前进先集成并重新核验。

原专项补齐test-results父目录自动创建，支持全新工作区。npm audit --package-lock-only报告0 critical/8 high/6 moderate/8 low，未自动升级依赖。本轮安装与检查最终结果如下；此前缺依赖记录作为历史保留。

### 本轮提交前核验

- `npm.cmd ci --no-audit --no-fund` exit1，日志未给出明确终止原因；本工作区依赖安装不完整。随后离线ignore-scripts修复仍未完成，由本任务主动停止，未改变package-lock或D:依赖。
- `npm.cmd run build` exit1：Pi能力同步步骤执行后找不到tsc命令；构建命令产生的vendor文件变化已仅在本工作区还原，不纳入提交。
- `npm.cmd run test:renderer-components` exit1：react-aria/private/utils/constants缺失。未计为产品断言失败，亦不计为通过；原生窗口专项及smoke未执行。
- 两个脚本 `node --check`、仓库 `git diff --check` exit0；无冲突标记或未合并索引。安全审计现有22项依赖问题保留，未扩张为依赖升级。
- 发布范围为本地main既有99提交与本次启动修复；没有合并其他本地工作分支，没有修改D:运行目录。提交信息概括启动显示参数、全新工作区专项目录与历史/当前证据分层。用户已明确授权提交与正常推送；运行验收仍未通过，推送成功不能替代产品验收。

## 2026-10-28 主线审阅整理（当前结果）

- 工作区：C:/Users/ZhouXuan/.codex/worktrees/32aa/EduProject；分支 codex/daily-launch-visibility-review，基线为本地 main/93c6ac6。原32aa为干净detached d3e2dec，落后本地main 109个提交；未合并D:分支（相对main独有4提交、缺少27提交）。未移动main指针。
- 来源：D:/WorkProject/EduProject 的未提交启动修复；其HEAD现为38c1f06。下文3d3c630、PID、构建指纹与240项通过均为2026-10-27历史记录，不是当前HEAD的运行验收。已只读核对原RED J4rqJW与通过tqBYKI报告，两者build均为d7402d73f7b82c9740ba60fb80fa63b0c22ba74984d642b3731c4629bb3d5125。
- 交付仅启动脚本的一处显示参数与原因注释、原专项测试及13份既有状态文档中的相关四行记录；未整体复制D:文档，不带入pi-control-surfaces.css、截图、Playwright快照或其他分支功能。
- 当前验证：仓库根执行 `node --check apps/desktop/scripts/start-desktop.mjs`、`node --check apps/desktop/scripts/daily-launch-visibility.mjs`、`git diff --check` 均exit0。
- 当前工作区apps/desktop执行 `npm.cmd run build` exit1：缺node_modules/pi-web-access/package.json；`npm.cmd run test:renderer-components` exit1：缺react。此工作区未装node_modules，未借用D:运行目录或构建；未执行原生专项与smoke，未声称本次主线构建或Electron验收通过。
- 审阅方式：`git diff main --` 查看已跟踪变更；另须审阅未跟踪的本合同和scripts/daily-launch-visibility.mjs。无暂存、提交、push、远端资源变更；D:源工作区仅只读。
- 回滚：仅撤回本审阅分支上述路径的新增内容和交互spawn参数；不得清理、重置或覆盖D:工作区。后续验收应在本工作区安装锁定依赖、构建成功后运行组件与原生专项；历史“旧页面”根因继续未证实。

## 2026-10-27 原始合同与历史证据（保留）


编码前冻结。M12日常入口：用户要求启动D:最新源码，且再次报告偶发旧版页面。

当前D: main/3d3c630含其他协作中的未提交界面修改，保留全部现状。本轮npm.cmd start已从当前源码build exit0，日常进程28804运行out/main/index.js；首次原生窗口存在但IsWindowVisible=false，再次单实例激活后可见。桌面启动小智.cmd已核实指向D:。本现象不能直接证明旧版本页面因果。

范围：先用当前out、独立profile/data和真实Windows窗口对比spawn windowsHide true/false；若复现，仅修start-desktop.mjs的交互式Electron显示参数，保留构建失败不启动、环境清理、单实例和legacy权限。补进程/UI回归，不改协作者脏区、renderer、IPC、schema、provider或正式数据。不停止他人的测试，不发布/提交/push。

完成：受控对比与当前实际启动参数回归、build日志、日常窗口PID/可见/响应证据、git diff --check；记录未证实的旧版页面、安装包/快捷方式以外入口与测试窗口混淆边界。失败则保留结果，不把推断写成根因。状态/稳定文档据真实结果更新。

## 最终结果（限定验收）

业务变更仅scripts/start-desktop.mjs交互Electron的windowsHide:true→false及原因注释；spawnSync构建仍隐藏。未改App、runtime authority、typed IPC、数据schema、已打开教师会话或协作者脏区域。调用npm.cmd start前后HEAD为3d3c630；未提交/push。

命令工作目录均为D:/WorkProject/EduProject/apps/desktop：

| 精确命令 | 结果 | test-results证据 |
|---|---|---|
| `npm.cmd start`（修前） | build/typecheck exit0；日常PID28804创建真实窗口HWND11080396但Win32可见=false；再次单实例激活后可见 | latest-daily-launch-20261027.log、本轮终端Win32枚举 |
| `node scripts/daily-launch-visibility.mjs`（修前） | exit1/预期RED：同构建hidden=true→visible=false、hidden=false→visible=true；旧日常配置断言失败 | daily-launch-visibility-J4rqJW/report.json、daily-launch-visibility-before.log |
| `node scripts/daily-launch-visibility.mjs`（修后） | exit0/两例通过、当前配置必须visible=true、已观测rendererErrors=0、两独立实例优雅退出；无skipped字段 | daily-launch-visibility-tqBYKI/report.json、daily-launch-visibility-after.log |
| `npm.cmd run test:renderer-components` | exit0，240/240；0失败/0 skipped | daily-launch-visibility-renderer.log |
| `npm.cmd start`（修后） | build/typecheck exit0，当前out复用日常单实例；PID28804/HWND11080396、Omni-Edu Agent、Responding=true | latest-daily-launch-fixed-20261027.log、当前终端readback |
| `node --check scripts/start-desktop.mjs`、`node --check scripts/daily-launch-visibility.mjs`、仓库根`git diff --check` | exit0；仅仓库原autocrlf提示 | 本轮终端 |

最终out指纹d7402d73f7b82c9740ba60fb80fa63b0c22ba74984d642b3731c4629bb3d5125与可见性专项完全一致；renderer入口index-DBu-FPDD.js、7054638字节。桌面C:/Users/ZhouXuan/Desktop/启动小智.cmd已实读，其调用D:根启动器；无需要改写的旧路径。另有协作者在运行/退出独立test-results profile的测试实例，未停止或修改它们。

专项从当前启动脚本读取实际windowsHide配置，使用等价真实spawn、明确可见的隔离E2E profile/data，通过CDP确认file renderer/真实Pi会话完成加载，再以Win32 IsWindowVisible核对。因此是启动参数与真实原生窗口回归，不冒充对日常正式数据的CDP检查。修前初版PowerShell进度CLIXML曾污染父stderr，已禁进度并捕获子管道；JSON内真实窗口对比及RED仍有效，失败日志保留。

未验：用户“实际加载旧bundle”的现象没有复现；本轮只证实新窗口首次被隐藏，不能断言解释所有不同页面。未验证安装包/其他手动入口、升级重启、其他Windows版本或全部业务provider；不将本轮启动测试扩大成完整教育Goal或视觉接受。未重新运行历史207项smoke（无业务/renderer改动，本片以两种真实spawn原生可见性为直接门禁）。用户现有资料未清理，日常应用保持开启。
