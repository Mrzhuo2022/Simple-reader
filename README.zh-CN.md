<p align="center">
  <img width="120" height="120" src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/build/logo.svg">
</p>
<h3 align="center">简约阅读器 / Simple Reader</h3>
<p align="center">一款现代化的、集成 AI 能力的桌面 RSS 阅读器</p>
<p align="center">
  <a href="./README.md">English</a> | 中文
</p>
<hr />

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/SimpleReader.png">
</p>

## 🚀 关于

本项目是 [Fluent Reader](https://github.com/yang991178/fluent-reader) 的功能增强版 Fork，重命名为 **Simple Reader**，专注于 **AI 集成**、**性能优化** 与 **用户体验**。

### 📚 文档

- **[新特性指南](./docs/FORK_FEATURES.md)**：AI 摘要、翻译与缓存的详细说明。
- **[更新日志](./docs/FORK_CHANGELOG.md)**：查看本版本的更新内容。

---

## 下载

前往 [GitHub Releases](https://github.com/Mrzhuo2022/Simple-reader/releases) 下载 Windows、macOS 或 Linux 的最新版本。

## 功能特性

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/view.png" alt="文章阅读视图">
</p>

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/audio.png" alt="内嵌播客音频播放器">
</p>

- **🤖 AI 能力**：通过 OpenAI 兼容接口实现文章摘要与双语翻译
- 内置音频播放器，支持播客订阅源，封面智能兜底
- 关闭时最小化到托盘，右键菜单跟随显示语言
- 基于 Fluent Design System 的现代界面，完整支持暗色模式
- 本地阅读，或同步至 RSS 服务（Inoreader、Feedbin、The Old Reader、BazQux Reader 等）
- 兼容自建服务的 Fever 或 Google Reader API
- 导入 / 导出 OPML 文件，完整应用数据备份与还原
- 内置文章视图，借助 Mercury Parser 抓取全文
- 文章标题可直接点击跳转至原文
- 使用正则表达式搜索文章，或按已读状态筛选
- 以类似文件夹的分组组织订阅源
- 订阅源管理器支持实时搜索与状态列（未读数、上次抓取时间）
- 单键快捷键操作
- 通过正则规则自动隐藏、标记已读或加星收藏文章
- 后台抓取文章并推送通知

### AI 功能

- **文章摘要**：一键生成精炼摘要
- **双语翻译**：在中英文之间自动翻译
- **灵活接入**：兼容 OpenAI、Azure OpenAI、DeepSeek 及其他 OpenAI 格式接口
- **本地缓存**：AI 结果本地缓存，节省接口调用成本

## 开发

### 参与贡献

欢迎通过 [GitHub Issues](https://github.com/Mrzhuo2022/Simple-reader/issues) 反馈 Bug 或提出功能建议。

你也可以通过提供[更多语言的翻译](https://github.com/Mrzhuo2022/Simple-reader/tree/master/src/scripts/i18n)来帮助完善国际化。
国际化入门可参考 [react-intl-universal](https://github.com/alibaba/react-intl-universal) 仓库。

如果你喜欢这款应用，欢迎通过 [GitHub Sponsors](https://github.com/sponsors/Mrzhuo2022) 赞助支持开发。

### 从源码构建

```bash
# 安装依赖
pnpm install

# 编译 TypeScript 及依赖
pnpm run build

# 启动应用
pnpm run electron

# 打包分发
pnpm run package-win    # Windows
pnpm run package-mac    # macOS
pnpm run package-linux  # Linux
```

### 技术栈

- [Electron](https://github.com/electron/electron)
- [React](https://github.com/facebook/react)
- [Redux](https://github.com/reduxjs/redux)
- [Fluent UI](https://github.com/microsoft/fluentui)
- [Lovefield](https://github.com/google/lovefield)
- [Mercury Parser](https://github.com/postlight/mercury-parser)

## 许可证

BSD 3-Clause License

Copyright © 2020, Haoyuan Liu
Copyright © 2025, Evarle Zhuo

基于 Haoyuan Liu 的 [Fluent Reader](https://github.com/yang991178/fluent-reader) 开发。
