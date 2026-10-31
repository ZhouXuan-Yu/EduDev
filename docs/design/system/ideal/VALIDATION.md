# V2 设计交付验证

2026-11-01。验证层：离线 HTML / Skill 结构 / 文档；生产业务未实施。

| 检查 | 命令/方式 | 实际结果 |
| --- | --- | --- |
| 原型交互和截图 | `node docs/design/system/ideal/check.mjs` | 36项通过，69张当前截图，0脚本错误，0外部请求；exit0 |
| JS语法 | 本目录各js/mjs逐一 `node --check` | 全部exit0 |
| Skill结构 | skill-creator `quick_validate.py .agents/skills/edudev-design` | Skill is valid，exit0 |
| Skill/Goal/差距引用 | 本地Markdown路径检查 | 18条本地引用存在；交接HTML链接在交互检查另验 |
| 凭证检查 | 文本交付范围API key模式扫描 | 0命中文件；参考配置与原始模型内容不进入仓库 |
| 差异格式 | `git diff --check` | exit0 |
| 依赖审计 | `npm.cmd audit --prefix apps/desktop --json` | exit1；既有45项：8high/29moderate/8low/0critical，无依赖更改和自动升级 |
| 正式代码范围 | 对最新主线核对apps/差异 | 本轮不修改apps、vendor、运行时、数据、权限和生产提示词 |

报告 [evidence/report.json](evidence/report.json) 列出检查名称、69张当前截图与HTML/CSS/JS SHA256；目录额外PNG包括保留的历史失败，不能全部算作当前通过截图。当前视口：1366×768、1920×1080、840/700窄窗、911×512近似CSS可用面积。原生Windows DPI/IME不在此结论中。

历史问题保留：IME绑定、reduced-motion优先级、课堂窄窗、handoff相对路径错误，以及截图辅助函数误假设总览页也有toast。已修复后重跑；相关first-failure/report文件不代表最终失败。根目录第一次npm audit因无lockfile报ENOLOCK，记录另存 dependency-audit-enolock.json；正确在desktop包重跑得到上述45项。

## 参考项目运行边界

- DeepTutor：本地API8012 / 页面3012；合成PDF一次真模型请求、2次工具、最终回答、刷新后折叠，页面错误0；单样本不支持性能或教育效果结论。资料索引因缺少可用嵌入配置失败，原件仍保留。截图与脱敏事件计数见references。
- OpenMAIC：本地页面3013、独立数据库5544；8个工作包构建exit0，首页页面错误0；真实模型完成大纲、2页讲解和1道检查题，服务端终态completed。默认倒计时继续；新浏览器上下文原run URL为404，课堂重开/导入与实际互动未验收，图片/TTS/视频未配置。不能宣称完整教学闭环已通过。
- 默认webpack启动曾fs模块编译失败，切回项目默认Turbopack后首页可用；未修改参考项目业务源码。DeepTutor原有5项未提交修改保留，开发工具生成缓存和配置不提交到小智仓库。

## 未覆盖

正式 Electron CSSOM/运行事件、当前最新构建逐像素效果、实际RAG质量及大库规模、真实组卷与六类导出、学生权限/档案写入、备份恢复、教学内容正确性及教师视觉接受，全部留给开发Goal对应阶段。Skill结构与反例表不是独立模型行为评测。
