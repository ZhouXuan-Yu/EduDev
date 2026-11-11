# 上海数学与物理资料获取

2026-11-11用户将规模验收调整至约10GB。资料获取与知识库功能实现持续推进。

## 当前下载快照

快照时间为2026-11-11T07:41:00.798362+00:00。实际已下载来源文件337份、354508438字节、约0.3302GiB。下载时逐文件保存SHA，本次核对文件存在及字节数，按已保存SHA去重。统计排除元数据、Git对象、未完成下载和解压副本。目标10GB尚未达到，规模/内容质量/产品导入均未验收。下载成功只表明对应下载和文件校验完成。

本地目录为`D:/WorkProject/EduProject-kb-corpus/shanghai-10gb`。`inventory.json`为当前快照，`manifest.jsonl`保留事件、来源URL、分类、字节、SHA、结果及解压成员来源。后续下载会继续增长，本提交保存当时快照。

## 获取来源

- 上海市教育考试院公开的2020初中数学和物理评价指南，PDF正文核对准确标题，含样题。文件下载URL年份2019属于发布路径，资料自身年份为2020。来源 [数学](https://www.shmeea.edu.cn/download/20190926/02.pdf) / [物理](https://www.shmeea.edu.cn/download/20190926/04.pdf)。
- 上海公开物理教学站多年高考、会考、各区模拟和期末试卷，原网页下载链接与年份选择器显式调用的公开API构成930项批次。保留历史学年，当前批次以高中物理为主，第三方解析待核。来源 [试卷目录](https://www.enjoyphysics.cn/Materials/Papers)。
- 锦宏公开2025上海数学/物理试卷及参考答案，4份PDF合计34页，题卷可抽文字，两个答案PDF为扫描件、文字层为空。物理正文标题为普通高中学业水平等级性考试。来源 [发布页](https://www.jhcee.cn/pc/gk_information/consultation_detail-d6278da9-0614-42f2-b955-956d684bd64c.html)。
- 中考网公开2022上海数学、物理附件，已通过ZIP CRC。数学含1份DOCX，物理含7张PNG，解压成员另存import-ready并保留父ZIP/SHA/原始成员名。来源 [数学](https://m.zhongkao.com/e/20220714/62cfc991a3b3c.shtml) / [物理](https://m.zhongkao.com/e/20220714/62cfc7610e53b.shtml)。
- 作者公开上海初中数学复习讲义和2024中考数学LaTeX重排卷。讲义作者声明部分章节未完成，不能作为完整课程或独立正确答案。来源 [数学讲义](https://github.com/Onion12138/math) / [重排卷](https://github.com/Code1ce/2024-shzk-Math)。
- 作者上海初中物理讲义及独立题册/答案PDF正在获取，Git来源固定195e6f8b733cd4e3d1c4116a74b10954073b46e4。含手写截图、参考第三方资料和拓展内容，沿作者说明分类。来源 [物理资料](https://github.com/gavingqchen/middle-school-physics)。

## 下载与校验

本地开发资料获取复用curl和Git。HTTP经过现有本机代理，证书链与主机名验证保留，schannel仅对离线吊销检查使用best-effort。无登录、购买、配置或凭证改动。原资料保存在仓库外，本提交包含来源和快照。

每份资料先写.pending，下载成功及格式检查后移至正式资料路径。DOCX/ZIP校验CRC及DOCX主文档，旧DOC仅验证OLE头并标明转换需求，PDF先验证文件头再对指定样本核对页数/文字层，PNG解压成员核对签名与尺寸。来源正确性和答案正确性须后续按正式流程核验。当前无产品云上传、模型调用或原件改写。

`acquire-resumed.log`为930项后台批次日志。`retry-large.log`中的ep-1724已在较长超时重试后成功下载6998826B。第一次90秒超时事件保留在manifest，本地获取脚本已将后续单次上限调整至300秒。`acquire.py`重跑时复核已完成SHA并跳过，失败项保留明确结果。6个有界并发传输，最终累计以实际SHA去重字节为准。

物理作者仓库Git获取因TLS失败结束，批量补取Git对象亦失败，已转为固定commit、原仓库显式文件路径的公开raw URL下载。该批次记录在physics-author-plan.json及physics-author-curl.log，当前工具会话83262，尚在获取。930项主批次工具会话93846、PID188976，后续恢复须现场核对。目录ZIP解出的物理图片按原成员页号零填充命名，保留原名和SHA，避免10/11排在2之前。

Exa本地未配置、Jina返回401、部分站点TLS或GitHub匿名API403已转用现有web工具、原站公开下载链接和Git获取。5·3官方入口本次尚未找到可直接获取的完整PDF，上海数字教材官方介绍要求统一身份登录。来源 [5·3](https://www.quyixian.com/Book/WSZFX/) / [上海教委说明](https://edu.sh.gov.cn/xxgk2_zhzw_jyta_02/20231024/4fc69936201a44c88bd29352687a5d53.html)。

## 继续位置

后台批次获取中。下一核对下载终态并重试失败项，补齐数学和初中物理资料比例，更新去重总量。原先约0.309GiB的大哥素材独立保留，当前快照不将其计入新下载量。真实约10GB、自然内容质量、检索指标、安装和换机仍待完成，完整Goal ACTIVE。

本轮已交付的生产缺陷修复为dffb5ed题图发布前认证，13组定向、47组归档相关与typecheck通过，详见[原报告](../asset-publication/README.md)。下载快照追加无生产/依赖变更，使用上述定向证据。远端同步另以收尾git核对为准。
