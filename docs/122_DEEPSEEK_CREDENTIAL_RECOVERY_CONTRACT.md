# DeepSeek凭证导入与旧模型恢复合同

2026-10-04；用户报告真实“小智未完成本轮/DeepSeek凭证不可用”和“API密钥未通过验证/显示上次目录”。优先处理此故障，120办公接线保持完整，已实现基础尚未作为教师功能交付。

## 当前实证

本地调试密钥35字符/预期尾码，官方/v1/models HTTP200，实际目录deepseek-flash（DeepSeek-V4.1-Flash）与deepseek-v4-pro。真实正在使用的OmniEduAgent数据根app.db WAL持续更新；只读查deepseek设置保存的旧密钥与本地不同，实测HTTP401，旧默认deepseek-v4-flash不在当前目录；无正式xiaozhi.provider.v1，已记录running为0。没有打印密钥/headers/数据库内容。当前UI accept将不在目录的默认设空；save因!model禁用，刷新仍用旧密钥，因此新密钥无法独立验证。

## 本轮修改与范围

复用现有fetchDeepSeekCatalogue/原ModelSettings/宿主全局配置owner/Windows safeStorage、原HeroUI Button/Input/原Hana设置布局；不新建供应商、代理或网络栈，不改系统网络。

新增strict xiaozhi.settings.v1 verify输入（apiKey；无URL/provider/model/root），独立main-frame settings-verify和typed preload。主进程用本次输入密钥取真实官方目录，返回仅安全模型能力，不保存密钥/配置，不借用旧credential，UI密码框保留候选供用户随后保存；失败不改变已保存配置。仅裁剪首尾粘贴空白，拒绝内部空白/控制/未知字段。

UI单独“验证密钥”，验证成功用返回目录提供合法候选；旧默认不可用时明确提示新对话候选，最终仍需用户点击保存确认，不替换旧会话绑定。保存复用现有认证、codec和revision CAS，提交清密码框，仅显示masked；保留旧认证失败/网络错误反馈。

用户已明确授权这份DeepSeek密钥用于默认调试、写入本地及修复当前无法使用问题。源码与隔离真实页面验收后，若修复真实配置，严格仅服务原配置键（主进程safeStorage/原service/revision CAS），先查无running；不初始化/迁移/恢复真实整库、不改原legacy行/会话/历史/原教师数据、不在真实数据发送合成任务。实际对话在独立测试根/窗口验收，真实配置只验证官方目录与必要小型无个人数据模型连接。

## 完成定义

原故障隔离复现→新密钥独立验证→旧默认恢复候选→明确保存/实际Windows加密→重启读配置→正式Pi输入真实回复且清空。非法/401/网络失败/异frame/忙状态、旧配置不变、密钥不入日志/报告。build/renderer、设置边界、必要主smoke、diff；保留失败。报告123，办公基础报告121仍单独记录，下一继续120正式工具/审阅，而非称总目标已完成。
