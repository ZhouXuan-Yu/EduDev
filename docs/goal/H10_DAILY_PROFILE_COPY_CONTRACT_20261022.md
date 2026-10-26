# H10 日常配置与旧会话隔离副本合同

## 问题

H10 要求验证当前日常保存配置、旧会话和冻结构建。直接使用真实 profile 会产生新聊天、native 文件和数据库变化，不适合把自动验收写回用户日常环境；只使用空隔离 profile 又不能证明保存凭证、模型和自动 DNS 能跨配置目录恢复。

解决方案是从用户日常 profile 做只读副本：复制完成后的副本归测试所有，源 profile 不启动、不写入、不迁移。

## 复制范围

- `Local State`：Windows safeStorage/Chromium 本地加密元数据。
- `Preferences`：存在时复制，仅用于启动偏好。
- `OmniEduData/app.db`及存在的`app.db-wal`、`app.db-shm`。
- `OmniEduData/xiaozhi-pi`：旧 Pi native 会话。
- 不复制教师原件、学生图片、缓存、历史归档或任何环境变量文件。

复制完成后只对 `--user-data-dir=<owned copy>` 启动。不得设置`OMNI_EDU_DATA_ROOT`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`OMNI_EDU_XIAOZHI_PI`或测试运行时开关。

## 验收标准

1. 启动前记录源日常数据库SHA256；运行结束后再次核对，源库必须完全不变。
2. 应用实际`userData/sessionData`等于owned副本；加载main不是`test-runtime`或验收替代入口。
3. 使用副本内已保存的safeStorage配置：`configured=true`、默认模型仍在官方目录、联网开启且DNS为`auto`；无环境凭证覆盖。
4. 通过可见会话侧栏打开一条真实旧会话，历史turn可读，旧native文件在打开前后字节不变。
5. 在副本中新建空聊天，发送只包含随机核验码的公开请求；真实保存配置完成该轮并回显核验码。
6. 新聊天不得改写旧会话SQLite消息、旧native字节或旧事件记录。
7. 报告只保存旧会话标题哈希，不保存标题正文；写报告前删除owned profile，避免副本继续携带加密配置和旧会话。
8. 渲染器无错误，最终冻结构建SHA不变，测试结束后相关进程为0。

## 边界

本片只证明日常保存配置与旧会话在冻结构建上的只读副本兼容。它不证明VPN关闭、Windows安装包、真实教师课程质量、Office/WPS动态放映，也不把复制副本验收写成真实日常profile已写入或已发布。
