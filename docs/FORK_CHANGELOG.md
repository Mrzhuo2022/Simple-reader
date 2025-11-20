# Fork 更新日志

## [Unreleased]

### ✨ 新增功能

#### AI 增强套件
- **AI 摘要功能** (`src/components/article.tsx`, `src/components/settings/ai.tsx`)
  - 集成 OpenAI 兼容接口，支持一键生成文章摘要。
  - 支持自定义 Prompt 模板。
  - 自动缓存摘要结果，避免重复计费。

- **智能双语翻译** (`src/components/translation-popup.tsx`, `src/scripts/models/services/aiClient.ts`)
  - **划词翻译**: 选中文字后通过快捷键或菜单触发悬浮翻译窗口。
  - **全文双语对照**: 文章视图下支持段落级双语对照显示，保持原文排版。
  - **智能缓存**: 翻译结果存储于本地 SQLite 数据库 (`ai-cache.db`)，离线可用。

- **AI 设置面板** (`src/components/settings/ai.tsx`)
  - 支持配置 API Endpoint、API Key、模型名称 (GPT-4, DeepSeek, Claude 等)。
  - 提供连接测试和模型列表刷新功能。

#### 交互优化
- **快捷键增强** (`src/components/settings/shortcuts.tsx`)
  - 新增 AI 摘要快捷键 (默认 `Alt+S`)。
  - 新增 AI 翻译快捷键 (默认 `Alt+T`)。
  - 快捷键设置界面重构，支持更直观的键位绑定。

### 🛠 代码重构与优化

#### 架构改进
- **本地缓存层** (`src/scripts/models/services/aiCache.ts`)
  - 引入 `better-sqlite3` 作为本地缓存数据库。
  - 实现了针对文章 ID 的摘要和翻译结果持久化存储。
  - 优化了数据读取性能，减少 IPC 通信开销。

- **服务层解耦**
  - 将 AI API 调用逻辑独立封装为 `aiClient.ts`。
  - 统一了不同 AI 服务商（OpenAI, Azure, DeepSeek）的接口调用方式。

#### 性能优化
- 优化了文章列表的渲染逻辑，减少不必要的重绘。
- 改进了右键菜单 (`src/components/context-menu.tsx`) 的响应速度。

### 🐛 修复
- 修复了 WebView 中无法直接操作 DOM 导致的翻译内容插入失败问题。
- 修复了深色模式下部分弹窗样式显示异常的问题。
- 修正了快捷键冲突导致的某些系统组合键失效问题。

## License
本项目基于 [Fluent Reader](https://github.com/yang991178/fluent-reader) 二次开发，遵循 BSD 3-Clause License。

