# ChatDot

<p align="center">
  <img src="icons/icon128.png" width="80" alt="ChatDot">
</p>

<p align="center">
  <strong>AI 对话导航侧边栏</strong><br>
  在多款 AI 对话页面中快速定位和跳转到任意用户消息
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-1.1.0-5ca8c8" alt="Version 1.1.0">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

## 它解决什么问题

当一个 AI 对话变长之后，想回头找某一轮提问需要反复滚动。ChatDot 在页面右侧注入一个浮动导航栏，让你可以逐条跳转、直接定位到任意一条消息。

## 功能

### 导航

- **跳到顶部 / 底部** — 一键到达对话首尾
- **上一条 / 下一条** — 逐条跳转用户消息，跳转时目标消息会有高亮反馈
- **位置计数器** — 实时显示当前位置 (x/n)

### 消息预览

鼠标悬停在上/下导航按钮上时，会在左侧弹出下一条目标消息的内容预览，无需实际跳转即可了解上下文。

### 大纲面板

点击大纲按钮可展开一个浮动面板，列出所有用户消息的摘要索引，支持：
- 点击直达对应消息
- 实时高亮当前可见位置
- 钉住面板保持常驻，或点击空白区域关闭

### 设置

通过扩展弹窗（点击工具栏图标）进行配置：

| 设置项 | 说明 |
|--------|------|
| 启用导航栏 | 整体开关 |
| 悬浮预览 | 控制 hover 消息预览的显示 |
| 消息大纲 | 控制大纲按钮和面板的显示 |
| 显示模式 | Light / Dark / System |
| 滚动模式 | 平滑滚动 / 瞬间跳转 |
| 语言 | 中文 / English / 日本語 / 한국어 |

### 其他

- **暗色模式** — 自动适配 AI 对话页面暗色主题
- **主题切换** — 支持浅色 / 深色 / 跟随系统
- **SPA 感知** — 切换对话时自动重置导航状态
- **低打扰设计** — 侧边栏默认低透明度，鼠标悬停时才完全显示；内容不可滚动时自动隐藏

## 安装

### 从源码加载（开发模式）

1. 克隆仓库：
   ```bash
   git clone https://github.com/Lcc1ccl/chatdot.git
   ```
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择 `chatdot` 目录
5. 打开 [chatgpt.com](https://chatgpt.com) 即可使用

## 支持平台

ChatGPT、Gemini、Claude 和豆包（更多平台逐步接入中）。

## 项目结构

```
chatdot/
├── manifest.json    # 扩展配置 (Manifest V3)
├── content.js       # 内容脚本：DOM 检测 + 导航 UI + 大纲面板 + 消息预览
├── content.css      # 侧边栏 + 大纲面板样式（含暗色模式）
├── popup.html       # 设置面板 UI
├── popup.js         # Popup 交互逻辑
├── popup-logic.js   # Popup 文案、商店链接与 changelog 数据
├── icons/           # 扩展图标
├── tests/           # 逻辑测试
├── docs/            # 上架文案、报告与计划
└── LICENSE
```

## 设计说明

导航侧边栏的核心算法移植自 [Claudian](https://github.com/YishenTu/claudian)（一个在 Obsidian 中嵌入 Claude Code 的插件）的 `NavigationSidebar.ts`，包括：

- 基于 DOM offsetTop 的精准滚动定位
- 平滑滚动 + 跳转高亮反馈
- 内容可滚动时才显示的智能可见性控制

## License

[MIT](LICENSE)
