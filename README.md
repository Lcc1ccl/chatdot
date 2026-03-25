# ChatDot Navigator

<p align="center">
  <img src="icons/icon128.png" width="80" alt="ChatDot Navigator">
</p>

<p align="center">
  <strong>AI 对话快速导航侧边栏</strong><br>
  在 ChatGPT 等 AI 对话页面中快速跳转到任意用户消息
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

## ✨ 功能特性

- **⏫ 跳到顶部** — 一键回到对话开始
- **⬆️ 上一条消息** — 跳转到上一条用户消息
- **⬇️ 下一条消息** — 跳转到下一条用户消息  
- **⏬ 跳到底部** — 一键回到对话末尾
- **📊 计数器** — 实时显示当前位置 (x/n)
- **🌙 暗色模式** — 自动适配 ChatGPT 暗色主题
- **🔄 SPA 感知** — 切换对话自动重置

## 🖼️ 效果预览

侧边栏默认以低透明度浮动在页面右侧，鼠标悬停时变为完全可见：

```
  ┌─────────────────────────┐    ┌──┐
  │                         │    │⏫│
  │     ChatGPT 对话页面      │    │⬆│
  │                         │    │2/5│
  │                         │    │⬇│
  │                         │    │⏬│
  └─────────────────────────┘    └──┘
```

## 📦 安装

### 从源码安装（开发模式）

1. 克隆仓库：
   ```bash
   git clone https://github.com/YishenTu/chatdot.git
   ```

2. 打开 Chrome，访问 `chrome://extensions/`

3. 开启右上角的 **开发者模式**

4. 点击 **加载已解压的扩展程序**

5. 选择克隆的 `chatdot` 目录

6. 访问 [chatgpt.com](https://chatgpt.com) 即可看到导航侧边栏

## 🔧 支持平台

| 平台 | 状态 |
|------|------|
| ChatGPT (chatgpt.com) | ✅ 已支持 |
| Claude.ai | 🔜 计划中 |
| Gemini | 🔜 计划中 |
| DeepSeek | 🔜 计划中 |

## 🏗️ 项目结构

```
chatdot/
├── manifest.json    # Chrome 扩展配置 (Manifest V3)
├── content.js       # 内容脚本：DOM 检测 + UI 注入 + 导航逻辑
├── content.css      # 导航侧边栏样式
├── popup.html       # 弹出窗口 UI
├── popup.js         # 弹出窗口逻辑
├── icons/           # 扩展图标
└── README.md
```

## 🎨 设计灵感

本项目的导航侧边栏设计灵感来自 [Claudian](https://github.com/YishenTu/claudian) — 一个在 Obsidian 中嵌入 Claude Code 的插件。

核心导航算法移植自 Claudian 的 `NavigationSidebar.ts`：
- 通过用户消息的 DOM 位置进行精准定位
- 平滑滚动 + 跳转高亮反馈
- 内容可滚动时才显示的智能可见性控制

## 📄 License

[MIT License](LICENSE)
