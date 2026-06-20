<p align="center">
  <img width="120" height="120" src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/build/logo.svg">
</p>
<h3 align="center">简约阅读器 / Simple Reader</h3>
<p align="center">A modern desktop RSS reader with AI-powered features</p>
<p align="center">
  English | <a href="./README.zh-CN.md">中文</a>
</p>
<hr />

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/SimpleReader.png">
</p>

## 🚀 About

This is a feature-rich fork of [Fluent Reader](https://github.com/yang991178/fluent-reader), renamed to **Simple Reader** , focusing on **AI integration**, **Performance Optimization**, and **User Experience**.

### 📚 Documentation

- **[New Features Guide](./docs/FORK_FEATURES.md)**: Detailed guide on AI summarization, translation, and caching.
- **[Changelog](./docs/FORK_CHANGELOG.md)**: See what's new in this version.

---

## Download

Download the latest release for Windows, macOS, or Linux from [GitHub Releases](https://github.com/Mrzhuo2022/Simple-reader/releases).

## Features

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/view.png" alt="Article reading view">
</p>

<p align="center">
  <img src="https://github.com/Mrzhuo2022/Simple-reader/raw/master/docs/screenshots/audio.png" alt="Inline podcast audio player">
</p>

- **🤖 AI-Powered Features**: Article summarization and bilingual translation with OpenAI-compatible APIs
- Inline audio player for podcast feeds with smart cover fallback
- Minimize to tray on close with a locale-aware context menu
- Modern UI inspired by Fluent Design System with full dark mode support
- Read locally or sync with RSS services (Inoreader, Feedbin, The Old Reader, BazQux Reader, etc.)
- Self-hosted services compatible with Fever or Google Reader API
- Import/export OPML files, full application data backup & restoration
- Built-in article view with Mercury Parser for full content extraction
- Article title links directly to the original source
- Search articles with regular expressions or filter by read status
- Organize subscriptions with folder-like groupings
- Live search and status columns (unread count, last fetched) in the sources manager
- Single-key keyboard shortcuts
- Auto-hide, mark as read, or star articles with regex rules
- Background article fetching with push notifications

### AI Features

- **Article Summarization**: Generate concise summaries with a single click
- **Bilingual Translation**: Automatically translate between Chinese and English
- **Flexible Integration**: Compatible with OpenAI, Azure OpenAI, DeepSeek, and other OpenAI-format APIs
- **Local Caching**: AI results cached locally to save API costs

## Development

### Contribute

Help make Simple Reader better by reporting bugs or opening feature requests through [GitHub issues](https://github.com/Mrzhuo2022/Simple-reader/issues).

You can also help internationalize the app by providing [translations into additional languages](https://github.com/Mrzhuo2022/Simple-reader/tree/master/src/scripts/i18n).
Refer to the repo of [react-intl-universal](https://github.com/alibaba/react-intl-universal) to get started on internationalization.

If you enjoy using this app, consider supporting its development by donating through [GitHub Sponsors](https://github.com/sponsors/Mrzhuo2022).

### Build from source

```bash
# Install dependencies
pnpm install

# Compile TypeScript and dependencies
pnpm run build

# Start the application
pnpm run electron

# Package for distribution
pnpm run package-win    # Windows
pnpm run package-mac    # macOS
pnpm run package-linux  # Linux
```

### Developed with

- [Electron](https://github.com/electron/electron)
- [React](https://github.com/facebook/react)
- [Redux](https://github.com/reduxjs/redux)
- [Fluent UI](https://github.com/microsoft/fluentui)
- [Lovefield](https://github.com/google/lovefield)
- [Mercury Parser](https://github.com/postlight/mercury-parser)

## License

BSD 3-Clause License

Copyright © 2020, Haoyuan Liu
Copyright © 2025, Evarle Zhuo

Based on [Fluent Reader](https://github.com/yang991178/fluent-reader) by Haoyuan Liu.
