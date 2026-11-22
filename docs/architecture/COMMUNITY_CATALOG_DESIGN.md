# 小智社区扩展页

## 产品参考

- OpenAI 插件将 Skills、MCP 配置和资源放进同一个有稳定名称、版本和清单的包。目录负责发现，宿主按包版本安装，单个 Skill 维持 `SKILL.md` 及资源目录。小智可以兼容这一类公开清单，沿用现有 Skill 预览和启用。 [OpenAI 插件包规范](https://developers.openai.com/plugins/build/plugins)
- ClawHub 提供技能搜索、发布者和版本详情。OpenClaw 安装后回读实际安装版本，并保留来源以便后续更新。小智「已安装」也应以本机真实版本和宿主状态为准。 [ClawHub 目录](https://docs.openclaw.ai/clawhub/how-it-works) · [OpenClaw 桌面技能页](https://docs.openclaw.ai/platforms/mac/skills)
- VS Code 在目录页展示发布者、能力和安装条件，再从同一条流程进入安装和使用。它分别处理本地 stdio 和远程 HTTP。小智的本地 MCP 可以复用现有托管安装和运行时，远程 MCP 要展示请求会发送到的域名及数据范围。 [VS Code MCP 安装](https://code.visualstudio.com/docs/agent-customization/mcp-servers)
- MCP 官方 Registry 统一提供服务器 ID、目录元数据和分发位置。它建议产品通过适配过的下游目录使用这些数据。小智可以用精选目录标注真实兼容性，由主进程按固定版本和摘要获取原发布制品。 [MCP Registry 维护者说明](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/about.mdx)

## 教师使用路径

在小智的工具区打开独立「社区扩展」页，查找课堂备课、课件和资料工具。页面提供「技能」「MCP」「已安装」，支持关键词搜索与教学任务筛选。列表展示发布者、使用场景、是否支持 Windows、是否需联网或账号。选中后显示版本、来源、数据范围和所需能力。

「安装到小智」使用已锁定制品。文本型 Skill 进入已有预览和启用流程，脚本依赖按现有权限执行。托管 MCP 复用现有下载、探针、能力绑定和权限租约。从结果页可启用，也可直接回小智发起任务。首次需要文件、外部传输或凭据时使用已经存在的授权入口。同一权限无需在目录与对话中重复确认。

「已安装」查看当前版本、禁用、更新、回到已验证的版本和诊断。来源不可达时保留已安装条目和已有功能，下载中断可重试。来源或权限范围改变后重新核验绑定。换机记录包含已安装清单、选中版本和脱敏设置，新设备重新获取对应版本并确认凭据或与本机路径相关的权限。

## 第一版完成条件

1. 精选目录至少各有一个真实公开 Skill 与小智当前支持的 MCP，具备来源、许可证、版本、兼容性和用例证据。
2. 从页面安装两类条目后能在真实小智对话使用，状态在冷启动后可核对。可取消安装，失败可重试，停用立即从可用工具范围移除。
3. 在断网、版本变化、缺运行时和授权拒绝场景下提示可采取的动作。Windows 不支持的传输或依赖显示原因。远程服务器范围由现有宿主策略判定。
4. 两个桌面分辨率都可发现、安装、查看状态和停用。运行证据归档至 `D:/WorkProject/EduProject/acceptance`。

本文件记录 D1 之后的独立前台需求。D1 的受控 AppContainer 扩展用于验证运行架构。社区页的页面代码、产品目录和发布入口属于单独的实现切片。
