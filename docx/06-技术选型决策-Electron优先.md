# 技术选型决策：Electron 优先

## 1. 结论

第一阶段选择：

```text
Electron + Vite + React + TypeScript
```

暂不选择 Tauri 作为第一版桌面壳。

## 2. 背景

产品第一阶段需要做的是本地学生档案系统，后续会接入：

- 本地大文件管理
- SQLite
- OCR
- Python 本地处理管道
- 向量检索
- DeepSeek 调用
- Windows 打包

真正复杂的部分不是桌面窗口，而是本地数据与 AI 管道。

## 3. 为什么选择 Electron

### 3.1 本地文件能力成熟

Electron 主进程基于 Node.js，处理本地文件、路径、复制、打开文件夹、调用子进程都很直接。

### 3.2 更适合早期集成 Python

后续 OCR、ChromaDB、文档解析大概率会在 Python 侧实现。

Electron 可以直接：

- 调 Python CLI
- 启动本地 FastAPI 服务
- 监听子进程输出
- 管理长任务状态

这对 MVP 很省心。

### 3.3 前端开发效率高

React + Vite 生态成熟，开发学生列表、时间线、记录编辑器、报告编辑器很快。

### 3.4 Windows 分发经验更多

Electron 在 Windows 桌面软件分发上经验更丰富，遇到问题更容易找到方案。

## 4. 为什么第一版不选 Tauri

Tauri 的优点：

- 安装包更小
- 内存占用更低
- 安全模型更细
- Rust 后端性能好

但当前阶段的问题是：

- 需要额外维护 Rust 后端。
- Python OCR/向量库仍然要作为 sidecar 或本地服务存在。
- 早期会增加打包和权限配置复杂度。
- 产品核心价值尚未验证，不应先优化壳体积。

因此 Tauri 可以作为 V2 选项，而不是 V1 起点。

## 5. 推荐技术栈

### 桌面端

- Electron
- electron-vite
- React
- TypeScript
- Tailwind CSS 或 Ant Design

### 本地数据库

- SQLite
- 后续可评估 DuckDB 做分析型查询

### 本地文件

- Node fs/path
- 文件复制到应用数据目录
- 大文件只保存路径和元数据

### AI 与解析

- Python
- 后续：OpenCV、PaddleOCR、ChromaDB、sentence-transformers

## 6. 进程结构

```text
React Renderer
  -> preload 暴露安全 API
  -> Electron Main
    -> SQLite
    -> 文件系统
    -> Python CLI / Local Service
    -> DeepSeek API
```

Renderer 不直接访问文件系统，也不直接执行命令。

## 7. 未来切换 Tauri 的条件

当满足以下条件时，可以重新评估 Tauri：

- MVP 已验证真实用户价值。
- Python 管道已经稳定打成独立可执行文件。
- Electron 安装包体积或内存占用成为真实用户阻碍。
- 需要更强的安全沙箱和权限模型。
- 有能力维护 Rust/Tauri 工程。

## 8. 第一阶段工程建议

优先搭建：

```text
apps/desktop
  src/main
  src/preload
  src/renderer
```

先完成：

- 本地 SQLite
- 学生 CRUD
- 学习记录 CRUD
- 附件复制
- 时间线
- 复盘模板生成

不要一开始接 OCR 和大模型，先把本地档案闭环做稳。

